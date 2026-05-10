/**
 * Cloudflare Worker - EmailJS proxy (paste full file -> Save and deploy)
 *
 * Preview tab sends GET -> you will see Method not allowed (expected). Real test: POST from site or curl.
 * Public Key errors come from EmailJS user_id, not template text.
 */
export default {
  async fetch(request, env) {
    const PROXY_VERSION = '2-sequential';
    const jsonHeaders = (cors) => ({
      ...cors,
      'Content-Type': 'application/json',
      'X-Proxy-Version': PROXY_VERSION
    });

    const allowed = (env.ALLOWED_ORIGIN || '').trim().replace(/\/$/, '');
    const corsHeaders = {
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

    const origin = request.headers.get('Origin');
    if (allowed && origin && origin !== allowed) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden origin' }), {
        status: 403,
        headers: jsonHeaders(corsHeaders)
      });
    }

    let formData;
    try {
      formData = await request.json();
    } catch (_e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: jsonHeaders(corsHeaders)
      });
    }

    /**
     * Public key: tırnak / fazla boşluk kırp; EmailJS dashboard’dan TEK parça kopyalanmalı.
     */
    function normalizePublicKey(raw) {
      if (raw == null) return '';
      var s = String(raw).trim();
      if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
        s = s.slice(1, -1).trim();
      }
      return s;
    }

    const pub = normalizePublicKey(env.EMAILJS_PUBLIC_KEY);
    const svc = (env.EMAILJS_SERVICE_ID || '').trim();
    const adminTpl = (env.EMAILJS_ADMIN_TEMPLATE_ID || '').trim();
    const autoTpl = (env.EMAILJS_AUTOREPLY_TEMPLATE_ID || '').trim();

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

    /**
     * Admin: from_name, reply_to, message, selected_date, current_date
     * Auto-Reply şablonunda "To" = {{email}} → reply_to ve user_email ile doldur
     */
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

    const templateParams = buildTemplateParams(formData);

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

    const emailjsUrl = 'https://api.emailjs.com/api/v1.0/email/send';

    try {
      const adminRes = await fetch(emailjsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmailJsBody(adminTpl))
      });
      const adminText = await adminRes.text();

      if (!adminRes.ok) {
        var adminErr = {
          success: false,
          step: 'admin',
          status: adminRes.status,
          detail: adminText
        };
        if (adminText.indexOf('Public Key') !== -1) {
          adminErr.hint =
            'Copy full Public Key from https://dashboard.emailjs.com/admin/account into EMAILJS_PUBLIC_KEY';
        }
        return new Response(JSON.stringify(adminErr), {
          status: 502,
          headers: jsonHeaders(corsHeaders)
        });
      }

      await new Promise(function (r) {
        setTimeout(r, 1100);
      });

      const autoRes = await fetch(emailjsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmailJsBody(autoTpl))
      });
      const autoText = await autoRes.text();

      if (!autoRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            step: 'autoreply',
            status: autoRes.status,
            detail: autoText,
            note: 'Admin mail may have been sent; autoreply failed'
          }),
          { status: 502, headers: jsonHeaders(corsHeaders) }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: jsonHeaders(corsHeaders)
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err && err.message ? err.message : 'Worker error' }),
        { status: 500, headers: jsonHeaders(corsHeaders) }
      );
    }
  }
};
