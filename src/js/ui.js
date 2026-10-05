// Kleine UI-Helfer: Elemente bauen, Toasts, Tabs, Formatierung.
GE.ui = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // h('div.klasse', {attr}, kinder...)
  function h(tag, attrs, ...kids) {
    const [name, ...cls] = tag.split('.');
    const el = document.createElement(name || 'div');
    if (cls.length) el.className = cls.join(' ');
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  }

  function toast(msg, kind = 'info', ms = 4200) {
    const el = h('div.toast.' + kind, null, msg);
    $('#toasts').append(el);
    setTimeout(() => el.remove(), ms);
  }

  function showTab(name) {
    $$('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    $$('.tab-pane').forEach((p) => p.classList.toggle('is-active', p.dataset.pane === name));
  }

  function kv(pairs) {
    const dl = h('dl.kv');
    pairs.filter((p) => p && p[1] != null && p[1] !== '').forEach(([k, v]) => { dl.append(h('dt', null, k), h('dd', null, v)); });
    return dl;
  }

  function block(title, content, extra) {
    const b = h('div.res-block', null, h('h4', null, h('span', null, title), extra || ''));
    if (content != null) b.append(typeof content === 'string' ? h('pre', null, content) : content);
    return b;
  }

  // Links immer über <a target=_blank>; Electron öffnet sie im Standardbrowser.
  function link(href, label) { return h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label); }

  const fmt = {
    num(n, d = 0) { return n == null || isNaN(n) ? '—' : Number(n).toLocaleString(GE.i18n.lang === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: d, minimumFractionDigits: d }); },
    ago(ts) {
      const s = Math.round((Date.now() - ts) / 1000);
      if (s < 60) return s + ' s';
      if (s < 3600) return Math.round(s / 60) + ' min';
      if (s < 86400) return Math.round(s / 3600) + ' h';
      return Math.round(s / 86400) + ' d';
    },
    time(d, tz) {
      try { return new Date(d).toLocaleTimeString(GE.i18n.lang === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch (_) { return '—'; }
    },
    dateTime(d, tz) {
      try { return new Date(d).toLocaleString(GE.i18n.lang === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch (_) { return '—'; }
    },
    utc(d) { return new Date(d).toISOString().slice(0, 16).replace('T', ' ') + 'Z'; }
  };

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('✓ ' + text.slice(0, 60), 'ok', 1800); } catch (_) {}
  }

  return { $, $$, h, esc, toast, showTab, kv, block, link, fmt, debounce, copy };
})();
