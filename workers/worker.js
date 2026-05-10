/**
 * Cloudflare Worker - EmailJS proxy (paste full file → Save and deploy).
 *
 * Optional env:
 *   EXPOSE_EMAILJS_ERRORS = "1" → include upstream `detail` in JSON (debug only).
 * Omit or any other value → generic `message` to client (reduces info leakage).
 */
export default {
  async fetch(request, env) {
    var MAX_BODY_BYTES = 49152;
    var PROXY_VERSION = '2-sequential-safe';
    var exposeUpstream = env.EXPOSE_EMAILJS_ERRORS === '1';

    function jsonHeaders(cors) {
      return {
        ...cors,
        'Content-Type': 'application/json',
        'X-Proxy-Version': PROXY_VERSION
      };
    }

    function sanitizeClient502(step, httpStatus, upstreamText) {
      var body = {
        success: false,
        step: step,
        status: httpStatus,
        message: 'No se pudo completar el envío. Inténtelo más tarde o contacte por otro canal.'
      };
      if (exposeUpstream && upstreamText != null && String(upstreamText).length > 0) {
        body.detail = String(upstreamText).slice(0, 2000);
      }
      return body;
    }

    var allowed = (env.ALLOWED_ORIGIN || '').trim().replace(/\/$/, '');
    var corsHeaders = {
      'Access-Control-Allow-Origin': allowed || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, 'X-Proxy-Version': PROXY_VERSION }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: jsonHeaders(corsHeaders)
      });
    }

    var origin = request.headers.get('Origin');
    if (allowed && origin && origin !== allowed) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden origin' }), {
        status: 403,
        headers: jsonHeaders(corsHeaders)
      });
    }

    var buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload too large', maxBytes: MAX_BODY_BYTES }),
        { status: 413, headers: jsonHeaders(corsHeaders) }
      );
    }

    var formData;
    try {
      var text = new TextDecoder().decode(buf);
      formData = JSON.parse(text);
    } catch (_e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: jsonHeaders(corsHeaders)
      });
    }

    function normalizePublicKey(raw) {
      if (raw == null) return '';
      var s = String(raw).trim();
      if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
        s = s.slice(1, -1).trim();
      }
      return s;
    }

    var pub = normalizePublicKey(env.EMAILJS_PUBLIC_KEY);
    var svc = (env.EMAILJS_SERVICE_ID || '').trim();
    var adminTpl = (env.EMAILJS_ADMIN_TEMPLATE_ID || '').trim();
    var autoTpl = (env.EMAILJS_AUTOREPLY_TEMPLATE_ID || '').trim();

    if (!pub || !svc || !adminTpl || !autoTpl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Worker misconfigured: missing EMAILJS_PUBLIC_KEY, SERVICE_ID, or template IDs'
        }),
        { status: 500, headers: jsonHeaders(corsHeaders) }
      );
    }

    if (pub.length < 12) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'EMAILJS_PUBLIC_KEY looks truncated - copy the full key from EmailJS Account page (full line, not partial)'
        }),
        { status: 500, headers: jsonHeaders(corsHeaders) }
      );
    }

    function buildTemplateParams(body) {
      var p = {};
      if (body && typeof body === 'object') {
        Object.keys(body).forEach(function (k) {
          p[k] = body[k];
        });
      }
      var reply = (p.reply_to || p.user_email || '').trim();
      if (!p.email && reply) p.email = reply;
      if (!p.current_date) {
        try {
          p.current_date = new Date().toLocaleString('es-ES', {
            dateStyle: 'long',
            timeStyle: 'short'
          });
        } catch (e) {
          p.current_date = new Date().toISOString();
        }
      }
      return p;
    }

    var templateParams = buildTemplateParams(formData);

    function buildEmailJsBody(templateId) {
      var out = {
        service_id: svc,
        template_id: templateId,
        user_id: pub,
        template_params: templateParams
      };
      var priv = env.EMAILJS_PRIVATE_KEY;
      if (priv && String(priv).trim()) {
        out.accessToken = String(priv).trim();
      }
      return out;
    }

    var emailjsUrl = 'https://api.emailjs.com/api/v1.0/email/send';

    try {
      var adminRes = await fetch(emailjsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmailJsBody(adminTpl))
      });
      var adminText = await adminRes.text();

      if (!adminRes.ok) {
        var adminBody = sanitizeClient502('admin', adminRes.status, adminText);
        if (exposeUpstream && adminText.indexOf('Public Key') !== -1) {
          adminBody.hint =
            'Copy full Public Key from https://dashboard.emailjs.com/admin/account into EMAILJS_PUBLIC_KEY';
        }
        return new Response(JSON.stringify(adminBody), {
          status: 502,
          headers: jsonHeaders(corsHeaders)
        });
      }

      await new Promise(function (r) {
        setTimeout(r, 1100);
      });

      var autoRes = await fetch(emailjsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmailJsBody(autoTpl))
      });
      var autoText = await autoRes.text();

      if (!autoRes.ok) {
        var autoBody = sanitizeClient502('autoreply', autoRes.status, autoText);
        autoBody.note = 'Admin mail may have been sent; autoreply failed';
        return new Response(JSON.stringify(autoBody), {
          status: 502,
          headers: jsonHeaders(corsHeaders)
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: jsonHeaders(corsHeaders)
      });
    } catch (err) {
      var msg = exposeUpstream && err && err.message ? err.message : 'Error interno del servidor';
      return new Response(JSON.stringify({ success: false, message: msg }), {
        status: 500,
        headers: jsonHeaders(corsHeaders)
      });
    }
  }
};
