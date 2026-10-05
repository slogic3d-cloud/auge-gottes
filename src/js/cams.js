// Livecams: Liste, Favoriten, eigene Kameras, API-Quellen, freie Fenster und Video-Wand.
GE.cams = (() => {
  const { $, $$, h, toast, esc, fmt, link } = GE.ui;
  const t = GE.t;
  let apiCams = [];           // aus TfL, NYC DOT, Windy (nur im Speicher)
  let z = 100;                // Fenster-Stapelreihenfolge
  const openWins = new Map(); // winId -> {cam, el, cleanup}

  const own = () => GE.store.get('ownCams', []);
  const favs = () => new Set(GE.store.get('favCams', []));

  function list() {
    return [
      ...GE.CURATED_CAMS.map((c) => Object.assign({ source: 'curated' }, c)),
      ...own().map((c) => Object.assign({ source: 'own' }, c)),
      ...apiCams
    ];
  }
  const byId = (id) => list().find((c) => c.id === id);

  // ---------- Kamera-Typ aus URL erkennen ----------
  function fromUrl(url) {
    const u = url.trim();
    let m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return { kind: 'youtube', video: m[1] };
    m = u.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    if (m) return { kind: 'youtube', channel: m[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { kind: 'video', url: u };
    if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(u) || /\/image(\?|$)/.test(u)) return { kind: 'image', url: u, refresh: 30 };
    return { kind: 'iframe', url: u };
  }

  // ---------- Player bauen ----------
  function player(cam) {
    const wrap = h('div', { style: 'position:absolute;inset:0' });
    let timer = null;
    if (cam.kind === 'youtube') {
      const src = cam.channel
        ? `https://www.youtube.com/embed/live_stream?channel=${cam.channel}&autoplay=1&mute=1&playsinline=1`
        : `https://www.youtube.com/embed/${cam.video}?autoplay=1&mute=1&playsinline=1`;
      wrap.append(h('iframe', { src, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', title: cam.name }));
    } else if (cam.kind === 'image') {
      const img = h('img.cam-img', { alt: cam.name });
      const load = () => { img.src = cam.url + (cam.url.includes('?') ? '&' : '?') + '_t=' + Date.now(); };
      img.onerror = () => { if (!wrap.querySelector('.cam-error')) wrap.append(h('div.cam-error', null, t('cam.err'))); };
      img.onload = () => { const e = wrap.querySelector('.cam-error'); if (e) e.remove(); };
      load(); timer = setInterval(load, (cam.refresh || 30) * 1000);
      wrap.append(img);
    } else if (cam.kind === 'video') {
      const v = h('video', { autoplay: true, muted: true, loop: true, playsinline: true, src: cam.url });
      v.muted = true;
      v.onerror = () => wrap.append(h('div.cam-error', null, t('cam.err')));
      // TfL-Clips werden alle paar Minuten erneuert
      timer = setInterval(() => { v.src = cam.url + '?_t=' + Date.now(); v.play().catch(() => {}); }, 5 * 60000);
      wrap.append(v);
    } else {
      wrap.append(h('iframe', { src: cam.url, allow: 'autoplay; fullscreen', title: cam.name }));
    }
    return { el: wrap, cleanup: () => clearInterval(timer) };
  }

  // Overlay: Ort, Ortszeit, Wetter, Mini-Karte
  function overlay(cam, withMap) {
    const loc = h('span.co-loc', null, cam.name);
    const meta = h('span.co-meta', null, cam.lat != null ? GE.geo.toDec(cam.lat, cam.lon, 3) : '');
    const ov = h('div.cam-overlay', null, h('div.co-text', null, h('span.co-rec', null, '● LIVE'), loc, meta));
    let tz = null, wx = '';
    const tick = () => { meta.textContent = [tz ? `${fmt.time(Date.now(), tz)} ${t('i.localtime')}` : '', wx, cam.lat != null ? GE.geo.toDec(cam.lat, cam.lon, 3) : ''].filter(Boolean).join(' · '); };
    let timer = null;
    if (cam.lat != null) {
      GE.weather.get(cam.lat, cam.lon).then((w) => {
        if (!w) return;
        tz = w.timezone;
        wx = `${fmt.num(w.current.temperature_2m, 0)} °C · ${GE.weather.label(w.current.weather_code)} · ${fmt.num(w.current.wind_speed_10m, 0)} km/h`;
        tick();
      }).catch(() => {});
      timer = setInterval(tick, 30000);
      if (withMap) {
        const mm = h('div.cam-minimap');
        ov.append(mm);
        setTimeout(() => {
          const m = L.map(mm, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false }).setView([cam.lat, cam.lon], 11);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd' }).addTo(m);
          L.circleMarker([cam.lat, cam.lon], { radius: 4, color: GE.layers.accentHex(), fillOpacity: 1 }).addTo(m);
          mm.addEventListener('click', () => GE.map.flyTo(cam.lat, cam.lon, 14, cam.name));
        }, 50);
      }
    }
    return { el: ov, cleanup: () => clearInterval(timer) };
  }

  // ---------- Freie Fenster ----------
  function open(cam) {
    const id = 'w' + Date.now() + Math.random().toString(16).slice(2, 6);
    const n = openWins.size;
    const el = h('div.win', { style: `left:${320 + n * 34}px;top:${90 + n * 30}px;width:480px;height:330px;z-index:${++z}` });
    const p = player(cam), o = overlay(cam, true);
    const bar = h('div.win-bar', null,
      h('span.win-title', { title: cam.name }, cam.name),
      h('button.icon-btn', { type: 'button', title: t('cam.snapshot'), onclick: () => snapshot(cam, body) }, '◉'),
      h('button.icon-btn', { type: 'button', title: t('cams.towall'), onclick: () => toWall(cam.id) }, '▦'),
      cam.lat != null ? h('button.icon-btn', { type: 'button', title: t('cams.goto'), onclick: () => GE.map.flyTo(cam.lat, cam.lon, 14, cam.name) }, '⌖') : null,
      cam.link ? h('a.icon-btn', { href: cam.link, target: '_blank', rel: 'noopener', title: 'Quelle' }, '↗') : null,
      h('button.icon-btn', { type: 'button', title: t('common.close'), onclick: close }, '✕'));
    const body = h('div.win-body', null, p.el, o.el);
    el.append(bar, body);
    $('#windowLayer').append(el);
    openWins.set(id, { cam, el, cleanup: () => { p.cleanup(); o.cleanup(); } });

    function close() { const w = openWins.get(id); if (w) { w.cleanup(); w.el.remove(); openWins.delete(id); } }
    el.addEventListener('mousedown', () => focus(el));
    drag(el, bar);
    focus(el);
    return id;
  }

  function focus(el) { $$('.win').forEach((w) => w.classList.remove('is-focus')); el.classList.add('is-focus'); el.style.zIndex = ++z; }

  function drag(el, handle) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, a')) return;
      const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      // iframes schlucken sonst die Mausbewegung
      $$('.win iframe').forEach((f) => (f.style.pointerEvents = 'none'));
      const move = (ev) => {
        el.style.left = Math.max(0, Math.min(window.innerWidth - 80, ox + ev.clientX - sx)) + 'px';
        el.style.top = Math.max(0, Math.min(window.innerHeight - 40, oy + ev.clientY - sy)) + 'px';
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); $$('.win iframe').forEach((f) => (f.style.pointerEvents = '')); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  // Alle Fenster ein-/ausblenden
  function toggleWindows() {
    const layer = $('#windowLayer');
    if (!openWins.size) { const first = list().find((c) => favs().has(c.id)) || list()[0]; if (first) open(first); return; }
    layer.hidden = !layer.hidden;
  }

  // ---------- Snapshot ----------
  async function snapshot(cam, body) {
    let dataUrl = null;
    const r = body.getBoundingClientRect();
    if (window.godseye) dataUrl = await window.godseye.capture({ x: r.left, y: r.top, width: r.width, height: r.height });
    else {
      const media = body.querySelector('img, video');
      if (media) {
        try {
          const c = document.createElement('canvas');
          c.width = media.naturalWidth || media.videoWidth; c.height = media.naturalHeight || media.videoHeight;
          c.getContext('2d').drawImage(media, 0, 0); dataUrl = c.toDataURL('image/jpeg', 0.9);
        } catch (_) { dataUrl = null; }
      }
    }
    if (!dataUrl) { toast(t('toast.electron'), 'warn'); return; }
    const name = `snapshot_${cam.name.replace(/[^\w]+/g, '_').slice(0, 40)}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    GE.cases.addItem({ type: 'snapshot', label: `${t('cam.snapshot')}: ${cam.name}`, lat: cam.lat, lon: cam.lon, thumb: await shrink(dataUrl, 360) });
    if (window.godseye) await window.godseye.saveFile(name, dataUrl, 'dataurl');
    else { const a = h('a', { href: dataUrl, download: name }); document.body.append(a); a.click(); a.remove(); }
  }

  function shrink(dataUrl, w) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, w / img.width); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.75)); };
      img.onerror = () => ok(null);
      img.src = dataUrl;
    });
  }

  // ---------- Video-Wand ----------
  let wallCells = [];
  const wallCleanups = [];

  function wallSize() { return { cols: Math.max(1, Math.min(8, +$('#wallCols').value || 3)), rows: Math.max(1, Math.min(8, +$('#wallRows').value || 3)) }; }

  function renderWall() {
    wallCleanups.splice(0).forEach((fn) => fn());
    const { cols, rows } = wallSize();
    const n = cols * rows;
    wallCells = (GE.store.get('wall', []) || []).slice(0, n);
    while (wallCells.length < n) wallCells.push(null);
    const grid = $('#wallGrid');
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    grid.innerHTML = '';
    wallCells.forEach((id, i) => {
      const cell = h('div.wall-cell', { 'data-i': i });
      const cam = id && byId(id);
      if (cam) {
        const p = player(cam), o = overlay(cam, false);
        cell.append(p.el, o.el, h('button.icon-btn.wall-x', { type: 'button', title: t('common.close'), onclick: () => setCell(i, null) }, '✕'));
        cell.addEventListener('dblclick', () => open(cam));
        wallCleanups.push(p.cleanup, o.cleanup);
      } else {
        const sel = h('select.select', { 'aria-label': 'Kamera wählen', onchange: (e) => setCell(i, e.target.value) }, h('option', { value: '' }, '—'), ...list().slice(0, 400).map((c) => h('option', { value: c.id }, c.name)));
        cell.append(h('div.wall-empty', null, t('wall.empty')), h('div.wall-pick', null, sel));
      }
      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('is-drop'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('is-drop'));
      cell.addEventListener('drop', (e) => { e.preventDefault(); const cid = e.dataTransfer.getData('text/cam'); if (cid) setCell(i, cid); });
      grid.append(cell);
    });
  }

  function setCell(i, id) { wallCells[i] = id || null; GE.store.set('wall', wallCells); renderWall(); }

  function toWall(id) {
    const cells = GE.store.get('wall', []) || [];
    const { cols, rows } = wallSize();
    let i = cells.findIndex((c, k) => !c && k < cols * rows);
    if (i < 0) i = cells.length < cols * rows ? cells.length : 0;
    cells[i] = id; GE.store.set('wall', cells);
    openWall();
  }

  function fillWall() {
    const { cols, rows } = wallSize();
    const f = favs();
    const pool = [...list().filter((c) => f.has(c.id)), ...list().filter((c) => !f.has(c.id))];
    const cells = (GE.store.get('wall', []) || []).slice(0, cols * rows);
    const used = new Set(cells.filter(Boolean));
    for (let i = 0; i < cols * rows; i++) if (!cells[i]) { const c = pool.find((x) => !used.has(x.id)); if (!c) break; cells[i] = c.id; used.add(c.id); }
    GE.store.set('wall', cells); renderWall();
  }

  function openWall() { $('#wall').hidden = false; $('#windowLayer').hidden = true; renderWall(); }
  function closeWall() { $('#wall').hidden = true; $('#windowLayer').hidden = false; wallCleanups.splice(0).forEach((fn) => fn()); $('#wallGrid').innerHTML = ''; }

  // ---------- Liste ----------
  const kindTag = { youtube: 'YT', image: 'IMG', video: 'MP4', iframe: 'WEB' };

  function renderList() {
    const q = $('#camFilter').value.trim().toLowerCase();
    const cat = $('#camCategory').value;
    const f = favs();
    const items = list().filter((c) => (cat === 'all' || (cat === 'fav' ? f.has(c.id) : c.cat === cat)) && (!q || c.name.toLowerCase().includes(q)));
    $('#camCount').textContent = t('cams.count', { n: items.length });
    const ul = $('#camList');
    ul.innerHTML = '';
    items.slice(0, 300).forEach((c) => {
      const li = h('li.cam-item', { draggable: 'true' },
        h('span.cam-ico', null, kindTag[c.kind] || 'CAM'),
        h('span.cam-name', { title: c.name }, c.name, h('span.cam-meta', null, [t('cams.' + c.cat) || c.cat, c.source].join(' · '))),
        h('span.cam-btns', null,
          h('button.icon-btn' + (f.has(c.id) ? '.is-on' : ''), { type: 'button', title: t('cams.fav'), onclick: () => toggleFav(c.id) }, '★'),
          h('button.icon-btn', { type: 'button', title: t('cams.open'), onclick: () => open(c) }, '⧉'),
          h('button.icon-btn', { type: 'button', title: t('cams.towall'), onclick: () => toWall(c.id) }, '▦'),
          c.lat != null ? h('button.icon-btn', { type: 'button', title: t('cams.goto'), onclick: () => GE.map.flyTo(c.lat, c.lon, 14, c.name) }, '⌖') : null));
      li.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/cam', c.id));
      li.addEventListener('dblclick', () => open(c));
      ul.append(li);
    });
  }

  function toggleFav(id) {
    const f = favs(); f.has(id) ? f.delete(id) : f.add(id);
    GE.store.set('favCams', [...f]); renderList();
  }

  function changed() { renderList(); const l = GE.layers.get('camsMap'); if (GE.layers.isOn('camsMap')) l.redraw(); }

  // ---------- API-Quellen ----------
  async function loadTraffic() {
    let n = 0;
    try {
      const tfl = await GE.net.json('https://api.tfl.gov.uk/Place/Type/JamCam');
      tfl.forEach((c) => {
        const p = {}; (c.additionalProperties || []).forEach((a) => (p[a.key] = a.value));
        if (p.available === 'false') return;
        apiCams.push({ id: 'tfl-' + c.id, name: 'London – ' + c.commonName, cat: 'traffic', lat: c.lat, lon: c.lon, kind: p.videoUrl ? 'video' : 'image', url: p.videoUrl || p.imageUrl, refresh: 60, source: 'TfL', link: 'https://tfl.gov.uk/traffic/status/' });
        n++;
      });
    } catch (e) { toast('TfL: ' + e.message, 'warn'); }
    try {
      const nyc = await GE.net.json('https://webcams.nyctmc.org/api/cameras');
      nyc.forEach((c) => {
        if (c.isOnline !== 'true') return;
        apiCams.push({ id: 'nyc-' + c.id, name: 'New York – ' + c.name, cat: 'traffic', lat: c.latitude, lon: c.longitude, kind: 'image', url: c.imageUrl, refresh: 5, source: 'NYC DOT', link: 'https://webcams.nyctmc.org/' });
        n++;
      });
    } catch (e) { toast('NYC DOT: ' + e.message, 'warn'); }
    dedupe();
    toast(t('toast.camsloaded', { n }), 'ok');
    changed();
  }

  async function loadWindy() {
    const key = GE.store.get('keyWindy', '');
    if (!key) { toast(t('toast.nokey') + ' (Windy)', 'warn'); return; }
    const c = GE.map.center();
    try {
      const d = await GE.net.json(`https://api.windy.com/webcams/api/v3/webcams?nearby=${c.lat.toFixed(3)},${c.lon.toFixed(3)},250&include=location,player,images,categories&limit=50`, { headers: { 'x-windy-api-key': key } });
      const cams = (d.webcams || []).map((w) => {
        const pl = w.player || {};
        const embed = pl.live || pl.day || pl.month;
        const catIds = (w.categories || []).map((x) => x.id);
        return {
          id: 'windy-' + w.webcamId, name: w.title, lat: w.location && w.location.latitude, lon: w.location && w.location.longitude,
          cat: catIds.some((x) => /traffic|highway/.test(x)) ? 'traffic' : catIds.some((x) => /city|square|building/.test(x)) ? 'city' : 'nature',
          kind: embed ? 'iframe' : 'image', url: embed || (w.images && w.images.current && w.images.current.preview), refresh: 300, source: 'Windy', link: `https://www.windy.com/webcams/${w.webcamId}`
        };
      });
      apiCams.push(...cams); dedupe();
      toast(t('toast.camsloaded', { n: cams.length }), 'ok');
      changed();
    } catch (e) { toast('Windy: ' + e.message, 'crit'); }
  }

  function dedupe() { const m = new Map(); apiCams.forEach((c) => m.set(c.id, c)); apiCams = [...m.values()]; }

  // ---------- Eigene, Import/Export ----------
  function addOwn(data) {
    const cams = own();
    cams.push(Object.assign({ id: 'own-' + Date.now() }, data));
    GE.store.set('ownCams', cams);
    if (!GE.store.persist) toast(t('toast.persistoff'), 'warn');
    changed();
  }

  async function exportCams() {
    const data = JSON.stringify({ app: 'godseye', type: 'cams', cams: own(), favorites: [...favs()] }, null, 2);
    if (window.godseye) await window.godseye.saveFile('godseye-kameras.json', data);
    else { const a = h('a', { href: 'data:application/json;charset=utf-8,' + encodeURIComponent(data), download: 'godseye-kameras.json' }); document.body.append(a); a.click(); a.remove(); }
  }

  async function importCams() {
    let text = null;
    if (window.godseye) text = await window.godseye.openFile([{ name: 'JSON', extensions: ['json'] }]);
    else {
      text = await new Promise((ok) => { const i = h('input', { type: 'file', accept: '.json,application/json' }); i.onchange = () => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsText(i.files[0]); }; i.click(); });
    }
    if (!text) return;
    try {
      const d = JSON.parse(text);
      const arr = Array.isArray(d) ? d : d.cams || [];
      const valid = arr.filter((c) => c && c.name && (c.url || c.channel || c.video)).map((c) => Object.assign({ cat: 'city' }, c, { id: c.id || 'own-' + Math.random().toString(36).slice(2) }));
      GE.store.set('ownCams', [...own(), ...valid]);
      if (d.favorites) GE.store.set('favCams', [...new Set([...favs(), ...d.favorites])]);
      toast(t('toast.camsloaded', { n: valid.length }), 'ok');
      changed();
    } catch (e) { toast('JSON: ' + e.message, 'crit'); }
  }

  function near(lat, lon, km) {
    return list().filter((c) => c.lat != null).map((c) => Object.assign({ d: GE.geo.distKm(lat, lon, c.lat, c.lon) }, c)).filter((c) => c.d <= km).sort((a, b) => a.d - b.d);
  }

  function init() {
    $('#camFilter').addEventListener('input', GE.ui.debounce(renderList, 150));
    $('#camCategory').addEventListener('change', renderList);
    $('#btnLoadTraffic').addEventListener('click', loadTraffic);
    $('#btnLoadWindy').addEventListener('click', loadWindy);
    $('#btnExportCams').addEventListener('click', exportCams);
    $('#btnImportCams').addEventListener('click', importCams);
    $('#btnAddCam').addEventListener('click', () => {
      $('#addCamForm').hidden = false;
      const c = GE.map.center(); $('#camLat').value = c.lat.toFixed(5); $('#camLon').value = c.lon.toFixed(5);
      $('#camName').focus();
    });
    $('#btnCancelCam').addEventListener('click', () => ($('#addCamForm').hidden = true));
    $('#addCamForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const info = fromUrl($('#camUrl').value);
      addOwn(Object.assign(info, { name: $('#camName').value.trim(), lat: parseFloat($('#camLat').value), lon: parseFloat($('#camLon').value), cat: $('#camCat').value, link: $('#camUrl').value.trim() }));
      e.target.reset(); e.target.hidden = true;
    });
    $('#btnWindows').addEventListener('click', toggleWindows);
    $('#btnWall').addEventListener('click', openWall);
    $('#btnWallClose').addEventListener('click', closeWall);
    $('#btnWallFill').addEventListener('click', fillWall);
    $('#btnWallClear').addEventListener('click', () => { GE.store.set('wall', []); renderWall(); });
    $('#wallCols').addEventListener('change', () => { GE.store.set('wallSize', wallSize()); renderWall(); });
    $('#wallRows').addEventListener('change', () => { GE.store.set('wallSize', wallSize()); renderWall(); });
    const ws = GE.store.get('wallSize', null); if (ws) { $('#wallCols').value = ws.cols; $('#wallRows').value = ws.rows; }
    GE.i18n.onChange(renderList);
    renderList();
  }

  return { init, list, open, near, toWall, openWall, closeWall, renderList, byId, esc };
})();
