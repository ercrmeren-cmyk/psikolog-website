/**
 * Language routing (ES at the site root, EN under /en/ with the same file names).
 * Loaded synchronously in <head> so a remembered choice redirects before first paint.
 *
 * The choice is stored only when the visitor clicks the ES | EN switcher.
 * It is applied only when entering the site from outside (bookmark, typed URL, search result);
 * internal links, reload and back/forward always keep the page that was requested.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'psiko_lang';
  var LANGS = { es: true, en: true };

  var script = document.currentScript;
  var basePath = '/';
  if (script && script.src) {
    basePath = new URL(script.src).pathname.replace(/js\/lang-boot\.js$/, '');
  }

  var path = location.pathname;
  var rel = path.indexOf(basePath) === 0 ? path.slice(basePath.length) : path.replace(/^\//, '');
  var isEn = /^en(\/|$)/.test(rel);
  var pageLang = isEn ? 'en' : 'es';
  var page = isEn ? rel.replace(/^en\/?/, '') : rel;

  function urlFor(lang) {
    return basePath + (lang === 'en' ? 'en/' : '') + page;
  }

  function readPref() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return LANGS[v] ? v : null;
    } catch (e) {
      return null;
    }
  }

  function writePref(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) { /* storage unavailable: switching still works via the link */ }
  }

  function navigationType() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type;
    } catch (e) { /* older browsers */ }
    return 'navigate';
  }

  function cameFromThisSite() {
    if (!document.referrer) return false;
    try {
      return new URL(document.referrer).origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  var pref = readPref();
  var navType = navigationType();
  if (pref && pref !== pageLang && navType === 'navigate' && !cameFromThisSite()) {
    document.documentElement.style.visibility = 'hidden';
    try {
      location.replace(urlFor(pref) + location.search + location.hash);
      return;
    } catch (e) {
      document.documentElement.style.visibility = '';
    }
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[data-lang-switch]');
    if (!link) return;
    var lang = link.getAttribute('data-lang-switch');
    if (!LANGS[lang]) return;
    writePref(lang);
    if (link.hasAttribute('data-lang-fixed')) return;
    if (lang === pageLang) {
      e.preventDefault();
      return;
    }
    link.setAttribute('href', urlFor(lang) + location.search + location.hash);
  }, true);

  window.PSIKO_LANG_ROUTE = { lang: pageLang, page: page, urlFor: urlFor };
})();
