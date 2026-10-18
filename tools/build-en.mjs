#!/usr/bin/env node
/**
 * Builds the English site (/en/*.html) from the Spanish pages + i18n/en.json.
 * Spanish HTML stays the single source for layout; en.json holds every English string.
 *
 *   node tools/build-en.mjs           write en/*.html (refuses if any text has no translation)
 *   node tools/build-en.mjs --check   exit 1 if en/ is stale or a translation is missing
 *   node tools/build-en.mjs --missing print untranslated strings as JSON (to paste into en.json)
 *
 * Run it after every change to a Spanish page or to i18n/en.json, and commit the en/ output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://menteconmpsicologia.com/';
const PAGES = ['index.html', 'hakkimda.html', 'calisma-alanlari.html', 'blog.html', 'iletisim.html', 'privacy-policy.html'];
const OUT_DIR = path.join(ROOT, 'en');

const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--missing') ? 'missing' : 'write';
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'en.json'), 'utf8'));
const same = new Set(dict.same || []);
const shared = dict.strings || {};

const missing = new Map();
const used = new Set();

const norm = s => s.replace(/\s+/g, ' ').trim();
const hasWords = s => /\p{L}/u.test(s.replace(/&[a-zA-Z]+;|&#\d+;/g, ''));

function lookup(key, ctx) {
  const pageStrings = ctx.pageDict.strings || {};
  if (Object.prototype.hasOwnProperty.call(pageStrings, key)) {
    used.add(ctx.page + '\u0000' + key);
    return pageStrings[key];
  }
  if (Object.prototype.hasOwnProperty.call(shared, key)) {
    used.add(key);
    return shared[key];
  }
  if (same.has(key)) {
    used.add('same\u0000' + key);
    return key;
  }
  return null;
}

function translate(raw, ctx) {
  const key = norm(raw);
  if (!key || !hasWords(key)) return raw;
  const en = lookup(key, ctx);
  if (en == null) {
    if (!missing.has(key)) missing.set(key, ctx.page);
    return raw;
  }
  const lead = /^[,.;:!?)]/.test(en) ? '' : raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  return lead + en + trail;
}

const toEnUrl = url => (url.startsWith(SITE) ? SITE + 'en/' + url.slice(SITE.length) : url);

function rewritePath(value) {
  const v = value.trim();
  if (!v || v.startsWith('#') || v.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(v)) return value;
  const file = v.split(/[?#]/)[0];
  if (file.endsWith('.html')) {
    if (!PAGES.includes(file)) throw new Error('Link to a page without an English version: ' + v);
    return value;
  }
  return '../' + v;
}

const ATTR_RE = /(\s)([^\s"'>\/=]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;
const TEXT_ATTRS = new Set(['alt', 'title', 'aria-label', 'placeholder']);
const URL_ATTRS = new Set(['href', 'src', 'data-src', 'poster', 'action']);
const META_TEXT = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description']);

function langSwitchTag(attrs, ctx) {
  const lang = attrs['data-lang-switch'];
  const active = lang === 'en';
  const href = lang === 'es' ? '../' + ctx.page : ctx.page;
  return '<a href="' + href + '" class="lang-switch__link' + (active ? ' is-active' : '') + '" lang="' + lang +
    '" hreflang="' + lang + '" aria-label="' + attrs['aria-label'] + '"' + (active ? ' aria-current="true"' : '') +
    ' data-lang-switch="' + lang + '">';
}

function processTag(tag, ctx) {
  const m = tag.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!m) return tag;
  const name = m[1].toLowerCase();
  const attrs = {};
  tag.replace(ATTR_RE, (_, sp, n, eq, v1, v2) => { attrs[n.toLowerCase()] = v1 != null ? v1 : v2; });

  if (name === 'a' && attrs['data-lang-switch']) return langSwitchTag(attrs, ctx);

  return tag.replace(ATTR_RE, (full, sp, n, eq, v1, v2) => {
    const attr = n.toLowerCase();
    const quote = v1 != null ? '"' : "'";
    const value = v1 != null ? v1 : v2;
    let next = value;

    if (name === 'html' && attr === 'lang') next = 'en';
    else if (TEXT_ATTRS.has(attr)) next = translate(value, ctx);
    else if (name === 'meta' && attr === 'content') {
      const key = attrs.name || attrs.property;
      if (META_TEXT.has(key)) next = translate(value, ctx);
      else if (key === 'og:locale') next = 'en_GB';
      else if (key === 'og:locale:alternate') next = 'es_ES';
      else if (key === 'og:url') next = toEnUrl(value);
    } else if (name === 'link' && attr === 'href' && attrs.rel === 'canonical') next = toEnUrl(value);
    else if (name === 'link' && attr === 'href' && attrs.rel === 'alternate') next = value;
    else if (URL_ATTRS.has(attr)) next = rewritePath(value);
    else if (attr === 'style') {
      next = value.replace(/url\((['"]?)(?!data:|https?:|\/)([^'")]+)\1\)/g, (_, q, p) => 'url(' + q + '../' + p + q + ')');
    }

    return next === value ? full : sp + n + eq + quote + next + quote;
  });
}

const TOKEN_RE = /(<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>)/gi;

function buildPage(page) {
  const pageDict = (dict.pages && dict.pages[page]) || {};
  const ctx = { page, pageDict };
  let src = fs.readFileSync(path.join(ROOT, page), 'utf8');

  for (const [from, to] of dict.replace || []) src = src.split(from).join(to);
  for (const [from, to] of pageDict.replace || []) {
    if (!src.includes(from)) throw new Error(page + ': replace source not found: ' + from.slice(0, 80));
    src = src.split(from).join(to);
  }

  return src.split(TOKEN_RE).map((part, i) => {
    if (i % 2 === 0) return translate(part, ctx);
    if (/^<!--|^<style\b/i.test(part)) return part;
    if (/^<script\b/i.test(part)) {
      const open = part.match(/^<script\b[^>]*>/i)[0];
      return processTag(open, ctx) + part.slice(open.length);
    }
    return processTag(part, ctx);
  }).join('');
}

const outputs = PAGES.map(page => [page, buildPage(page)]);

const unused = [];
for (const key of Object.keys(shared)) if (!used.has(key)) unused.push(key);
for (const key of same) if (!used.has('same\u0000' + key)) unused.push(key);
for (const [page, pd] of Object.entries(dict.pages || {})) {
  for (const key of Object.keys(pd.strings || {})) if (!used.has(page + '\u0000' + key)) unused.push(page + ': ' + key);
}

if (mode === 'missing') {
  const obj = {};
  for (const [key] of missing) obj[key] = '';
  console.log(JSON.stringify(obj, null, 2));
  console.error(missing.size + ' missing, ' + unused.length + ' unused');
  process.exit(0);
}

if (unused.length) console.warn('Unused entries in i18n/en.json (safe to delete):\n  ' + unused.join('\n  '));

if (missing.size) {
  console.error('Missing English translations (' + missing.size + '):');
  for (const [key, page] of missing) console.error('  [' + page + '] ' + key);
  process.exit(1);
}

if (mode === 'check') {
  const stale = outputs.filter(([page, html]) => {
    const file = path.join(OUT_DIR, page);
    return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html;
  });
  if (stale.length) {
    console.error('en/ is out of date, run: node tools/build-en.mjs\n  ' + stale.map(([p]) => p).join('\n  '));
    process.exit(1);
  }
  console.log('en/ is up to date (' + outputs.length + ' pages).');
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [page, html] of outputs) fs.writeFileSync(path.join(OUT_DIR, page), html);
  console.log('Built ' + outputs.length + ' English pages in en/.');
}
