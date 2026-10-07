// Alarme (Erdbeben, Geofence-Zonen, News-Stichwörter) und der Lage-Ticker.
GE.alerts = (() => {
  const { $, h, toast, fmt, link } = GE.ui;
  const t = GE.t;
  const log = [];
  let unread = 0;
  const seenQuakes = new Set();
  let quakesPrimed = false;
  const inside = {};        // zoneId:kind -> Set(ids)
  let zoneLayer = null;
  let drawing = null;       // erste Ecke beim Zeichnen
  const seenNews = new Set();
  let newsPrimed = false;

  // ---------- Protokoll & Benachrichtigung ----------
  function raise(level, text, lat, lon) {
    log.unshift({ ts: Date.now(), level, text, lat, lon });
    if (log.length > 200) log.pop();
    unread++;
    renderLog();
    toast(text, level, 7000);
    if (window.godseye) window.godseye.notify("GOD'S EYE", text);
    else if ('Notification' in window && Notification.permission === 'granted') new Notification("GOD'S EYE", { body: text });
  }

  function renderLog() {
    const ul = $('#alertLog'); ul.innerHTML = '';
    if (!log.length) ul.append(h('li', null, h('span'), h('span.hint', null, t('alert.none'))));
    log.forEach((a) => ul.append(h('li.' + a.level, { style: a.lat != null ? 'cursor:pointer' : '', onclick: () => a.lat != null && GE.map.flyTo(a.lat, a.lon, 8) }, h('time', null, fmt.time(a.ts)), h('span', null, a.text))));
    const b = $('#alertBadge');
    b.hidden = !unread; b.textContent = unread;
  }

  // ---------- Erdbeben ----------
  function checkQuakes(feats) {
    const th = +GE.store.get('quakeThreshold', 6);
    feats.forEach((f) => {
      if (seenQuakes.has(f.id)) return;
      seenQuakes.add(f.id);
      const fresh = Date.now() - f.time < 3600000;
      if (f.mag >= th && (quakesPrimed || fresh)) raise(f.mag >= 7 ? 'crit' : 'warn', t('alert.quake', { m: f.mag.toFixed(1), place: f.place }), f.lat, f.lon);
    });
    quakesPrimed = true;
  }

  // ---------- Geofences ----------
  const zones = () => GE.store.get('zones', []);

  function drawZones() {
    if (!zoneLayer) zoneLayer = L.layerGroup().addTo(GE.map.leaflet);
    zoneLayer.clearLayers();
    zones().forEach((z) => L.rectangle([[z.s, z.w], [z.n, z.e]], { color: '#ffc24b', weight: 1.5, dashArray: '6 4', fillOpacity: 0.06, pane: 'shapes' }).bindTooltip(z.name, { className: 'ge-tip' }).addTo(zoneLayer));
    const ul = $('#geofenceList'); ul.innerHTML = '';
    if (!zones().length) ul.append(h('li', null, h('span.hint', null, t('zone.none'))));
    zones().forEach((z, i) => ul.append(h('li', null, h('span.pill.warn', null, 'ZONE'), h('span.grow', null, z.name, h('span.cam-meta', null, `${z.s.toFixed(2)}…${z.n.toFixed(2)}, ${z.w.toFixed(2)}…${z.e.toFixed(2)}`)),
      h('button.icon-btn', { type: 'button', onclick: () => GE.map.leaflet.fitBounds([[z.s, z.w], [z.n, z.e]]) }, '⌖'),
      h('button.icon-btn', { type: 'button', onclick: () => { const l = zones(); l.splice(i, 1); GE.store.set('zones', l); drawZones(); } }, '✕'))));
  }

  function addZone(z) {
    const l = zones();
    l.push(Object.assign({ id: 'z' + Date.now(), name: z.name || t('zone.name', { n: l.length + 1 }) }, z));
    GE.store.set('zones', l);
    drawZones();
    toast(t('toast.zone'), 'ok', 2000);
  }

  function zoneAround(lat, lon, name) {
    addZone({ s: lat - 0.4, n: lat + 0.4, w: lon - 0.6, e: lon + 0.6, name: name ? 'Zone ' + name.split(',')[0] : undefined });
    GE.ui.showTab('alerts');
  }

  function startDrawing() {
    if (GE.map.view !== '2d') GE.app.setView('2d');
    drawing = 'first';
    $('#geofenceHint').hidden = false;
  }
  function stopDrawing() { drawing = null; $('#geofenceHint').hidden = true; }

  function onMapClick(lat, lon) {
    if (!drawing) return false;
    if (drawing === 'first') { drawing = { lat, lon }; return true; }
    const a = drawing;
    addZone({ s: Math.min(a.lat, lat), n: Math.max(a.lat, lat), w: Math.min(a.lon, lon), e: Math.max(a.lon, lon) });
    stopDrawing();
    return true;
  }

  function checkMovers(kind, list) {
    zones().forEach((z) => {
      const key = z.id + ':' + kind;
      const prev = inside[key];
      const now = new Set();
      list.forEach((m) => { if (m.lat >= z.s && m.lat <= z.n && m.lon >= z.w && m.lon <= z.e) now.add(kind === 'flight' ? m.hex : m.mmsi); });
      if (prev) now.forEach((id) => {
        if (prev.has(id)) return;
        const m = list.find((x) => (kind === 'flight' ? x.hex : x.mmsi) === id);
        const what = kind === 'flight' ? `✈ ${m.flight || m.hex.toUpperCase()}` : `⚓ ${m.name || m.mmsi}`;
        raise('warn', t('alert.zone', { what, zone: z.name }), m.lat, m.lon);
      });
      inside[key] = now;
    });
  }

  // ---------- News & Ticker ----------
  const feeds = [
    ['Tagesschau', 'https://www.tagesschau.de/xml/rss2/'],
    ['DW', 'https://rss.dw.com/rdf/rss-de-all'],
    ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
    ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
    ['NASA', 'https://www.nasa.gov/news-release/feed/']
  ];
  let news = [];

  async function loadNews() {
    GE.net.source('news', 'load');
    const all = [];
    let ok = 0;
    await Promise.all(feeds.map(async ([src, url]) => {
      try {
        const xml = await GE.net.text(url);
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        doc.querySelectorAll('item').forEach((it, i) => {
          if (i > 12) return;
          const title = (it.querySelector('title') || {}).textContent;
          const href = (it.querySelector('link') || {}).textContent;
          const date = (it.querySelector('pubDate') || it.getElementsByTagName('dc:date')[0] || {}).textContent;
          if (title) all.push({ src, title: title.trim(), url: (href || '').trim(), ts: date ? Date.parse(date) || Date.now() : Date.now() });
        });
        ok++;
      } catch (_) {}
    }));
    GE.net.source('news', ok ? 'ok' : 'err');
    if (!all.length) return;
    news = all.sort((a, b) => b.ts - a.ts).slice(0, 40);
    renderTicker();
    // Stichwort-Alarm
    const kws = String(GE.store.get('newsKeywords', '')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    news.forEach((n) => {
      const id = n.src + n.title;
      if (seenNews.has(id)) return;
      seenNews.add(id);
      if (!newsPrimed) return;
      const kw = kws.find((k) => n.title.toLowerCase().includes(k));
      if (kw) raise('info', t('alert.news', { kw, title: n.title }));
    });
    newsPrimed = true;
  }

  function renderTicker() {
    const run = $('#tickerRun'); run.innerHTML = '';
    const items = [];
    // aktuelle starke Beben vorne in den Ticker
    const q = GE.layers.get('quakes').all().filter((f) => f.mag >= 5 && Date.now() - f.time < 86400000).slice(0, 5);
    q.forEach((f) => items.push(h('span', null, h('span.t-src', null, 'USGS'), `M${f.mag.toFixed(1)} ${f.place} · vor ${fmt.ago(f.time)}`)));
    news.forEach((n) => items.push(h('span', null, h('span.t-src', null, n.src), n.url ? link(n.url, n.title) : n.title)));
    run.append(...items);
  }

  function init() {
    $('#quakeThreshold').value = GE.store.get('quakeThreshold', 6);
    $('#quakeThreshold').addEventListener('change', (e) => GE.store.set('quakeThreshold', +e.target.value));
    $('#newsKeywords').value = GE.store.get('newsKeywords', '');
    $('#newsKeywords').addEventListener('change', (e) => GE.store.set('newsKeywords', e.target.value));
    $('#btnAddGeofence').addEventListener('click', startDrawing);
    $('#btnClearAlerts').addEventListener('click', () => { log.length = 0; unread = 0; renderLog(); });
    document.querySelector('[data-tab="alerts"]').addEventListener('click', () => { unread = 0; renderLog(); if ('Notification' in window && Notification.permission === 'default' && !window.godseye) Notification.requestPermission(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawing) stopDrawing(); });
    drawZones(); renderLog();
    loadNews(); setInterval(loadNews, 5 * 60000);
    GE.i18n.onChange(() => { renderLog(); drawZones(); });
  }

  return { init, checkQuakes, checkMovers, zoneAround, onMapClick, renderTicker, raise };
})();
