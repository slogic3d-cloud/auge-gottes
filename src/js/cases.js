// Fälle: Notizen, angeheftete Funde, Favoriten-Orte, Screenshots, PDF- und JSON-Export.
GE.cases = (() => {
  const { $, h, toast, fmt, esc } = GE.ui;
  const t = GE.t;
  let pinLayer = null;

  function cases() {
    let c = GE.store.get('cases', null);
    if (!c || !c.length) { c = [{ id: 'c1', name: t('case.default'), notes: '', items: [] }]; GE.store.set('cases', c); }
    return c;
  }
  const activeId = () => GE.store.get('caseActive', cases()[0].id);
  const active = () => cases().find((c) => c.id === activeId()) || cases()[0];
  function save(list) { GE.store.set('cases', list); render(); }

  function addItem(item, silent) {
    const list = cases();
    const c = list.find((x) => x.id === activeId()) || list[0];
    c.items.unshift(Object.assign({ ts: Date.now() }, item, { data: item.data ? slim(item.data) : undefined }));
    save(list);
    if (!silent) toast(t('toast.pinned') + ' · ' + c.name, 'ok', 2200);
  }

  // Nur einfache Werte speichern (keine Funktionen/Satelliten-Objekte)
  function slim(d) { try { return JSON.parse(JSON.stringify(d, (k, v) => (k === 'rec' ? undefined : v))); } catch (_) { return undefined; } }

  function addFav(p) {
    const f = GE.store.get('favPlaces', []);
    f.unshift({ label: p.label, lat: p.lat, lon: p.lon, ts: Date.now() });
    GE.store.set('favPlaces', f);
    toast(t('toast.fav'), 'ok', 2000);
    if (!GE.store.persist) toast(t('toast.persistoff'), 'warn');
    render();
  }

  function render() {
    const sel = $('#caseSelect');
    sel.innerHTML = '';
    cases().forEach((c) => sel.append(h('option', { value: c.id }, `${c.name} (${c.items.length})`)));
    sel.value = active().id;
    $('#caseNotes').value = active().notes || '';

    const ul = $('#caseItems'); ul.innerHTML = '';
    const items = active().items;
    if (!items.length) ul.append(h('li', null, h('span.hint', null, t('case.noitems'))));
    items.forEach((it, i) => {
      ul.append(h('li', null,
        it.thumb ? h('img', { src: it.thumb, alt: '', style: 'width:48px;height:32px;object-fit:cover;border-radius:3px' }) : h('span.pill.info', null, it.type || '•'),
        h('span.grow', { title: it.label }, it.label, h('span.cam-meta', null, fmt.dateTime(it.ts) + (it.lat != null ? ' · ' + GE.geo.toDec(it.lat, it.lon, 3) : ''))),
        it.lat != null ? h('button.icon-btn', { type: 'button', title: 'Zeigen', onclick: () => goto(it) }, '⌖') : null,
        h('button.icon-btn', { type: 'button', title: 'Entfernen', onclick: () => { const l = cases(); const c = l.find((x) => x.id === active().id); c.items.splice(i, 1); save(l); } }, '✕')));
    });

    const fl = $('#favPlaces'); fl.innerHTML = '';
    const favs = GE.store.get('favPlaces', []);
    if (!favs.length) fl.append(h('li', null, h('span.hint', null, t('case.nofav'))));
    favs.forEach((f, i) => fl.append(h('li', null, h('span', null, '★'),
      h('span.grow', { title: f.label }, f.label, h('span.cam-meta', null, GE.geo.toDec(f.lat, f.lon, 3))),
      h('button.icon-btn', { type: 'button', onclick: () => { GE.map.flyTo(f.lat, f.lon, 12, f.label); GE.intel.showPlace(f.lat, f.lon, f.label); } }, '⌖'),
      h('button.icon-btn', { type: 'button', onclick: () => { const l = GE.store.get('favPlaces', []); l.splice(i, 1); GE.store.set('favPlaces', l); render(); } }, '✕'))));
    drawPins();
  }

  function goto(it) {
    if (it.type === 'view' && it.data) { GE.app.setView(it.data.view); GE.map.flyTo(it.lat, it.lon, it.data.zoom, it.label); return; }
    GE.map.flyTo(it.lat, it.lon, 12, it.label);
  }

  function drawPins() {
    if (!GE.map.leaflet) return;
    if (!pinLayer) pinLayer = L.layerGroup().addTo(GE.map.leaflet);
    pinLayer.clearLayers();
    const icon = L.divIcon({ className: '', html: '<div class="mk-pin"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
    [...active().items, ...GE.store.get('favPlaces', [])].filter((x) => x.lat != null).forEach((x) => {
      L.marker([x.lat, x.lon], { icon }).bindTooltip(x.label, { className: 'ge-tip' }).on('click', () => goto(x)).addTo(pinLayer);
    });
    GE.layers && GE.layers.schedule3d();
  }

  function items3d() {
    return [...active().items, ...GE.store.get('favPlaces', [])].filter((x) => x.lat != null).map((x) => ({ lat: x.lat, lng: x.lon, alt: 0.006, r: 0.22, color: '#ffffff', label: '★ ' + x.label, onClick: () => goto(x) }));
  }

  // ---------- Export ----------
  async function screenshot() {
    if (!window.godseye) { toast(t('toast.electron'), 'warn'); return; }
    const dataUrl = await window.godseye.capture();
    const c = GE.map.center();
    const small = await new Promise((ok) => { const i = new Image(); i.onload = () => { const cv = document.createElement('canvas'); cv.width = 360; cv.height = 360 * i.height / i.width; cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height); ok(cv.toDataURL('image/jpeg', 0.7)); }; i.src = dataUrl; });
    addItem({ type: 'screenshot', label: 'Screenshot ' + fmt.utc(Date.now()), lat: c.lat, lon: c.lon, thumb: small });
    await window.godseye.saveFile(`godseye_${new Date().toISOString().replace(/[:.]/g, '-')}.png`, dataUrl, 'dataurl');
  }

  function reportHtml() {
    const c = active();
    const rows = c.items.map((it) => `<tr><td>${esc(fmt.dateTime(it.ts))}</td><td>${esc(it.type || '')}</td><td>${esc(it.label)}${it.thumb ? `<br><img src="${it.thumb}" style="max-width:240px;margin-top:4px">` : ''}</td><td>${it.lat != null ? esc(GE.geo.toDec(it.lat, it.lon, 5)) + '<br>' + esc(GE.geo.toDms(it.lat, it.lon)) : ''}</td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.name)}</title><style>
      body{font:12px/1.5 "IBM Plex Sans",Segoe UI,sans-serif;color:#111;margin:32px}
      h1{font:600 22px "Chakra Petch",Segoe UI,sans-serif;letter-spacing:.06em;margin:0}
      .meta{color:#555;margin:4px 0 20px} pre{white-space:pre-wrap;background:#f3f5f8;padding:12px;border-radius:4px;font:12px/1.5 "IBM Plex Mono",Consolas,monospace}
      table{width:100%;border-collapse:collapse;margin-top:12px} td,th{border-bottom:1px solid #ddd;padding:6px;vertical-align:top;text-align:left}
      th{font:600 10px "Chakra Petch",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#555}
      .foot{margin-top:24px;color:#777;font-size:10px}</style></head><body>
      <h1>GOD'S EYE · ${esc(c.name)}</h1>
      <div class="meta">Erstellt ${esc(fmt.dateTime(Date.now()))} · ${esc(fmt.utc(Date.now()))} · ${c.items.length} Einträge</div>
      <h3>Notizen</h3><pre>${esc(c.notes || '—')}</pre>
      <h3>Funde</h3><table><thead><tr><th>Zeit</th><th>Typ</th><th>Eintrag</th><th>Position</th></tr></thead><tbody>${rows || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <div class="foot">Quellen: NASA GIBS/EONET, USGS, adsb.lol (ODbL), CelesTrak, Copernicus/EOX, OpenStreetMap/Nominatim, Open-Meteo, RainViewer, GDELT, TfL, NYC DOT. Nur öffentlich zugängliche Daten.</div>
      </body></html>`;
  }

  async function pdf() {
    const name = `godseye_${active().name.replace(/[^\w]+/g, '_')}.pdf`;
    if (window.godseye) { const r = await window.godseye.pdfReport(reportHtml(), name); if (r.saved) toast(t('toast.saved') + ': ' + r.filePath, 'ok'); return; }
    const w = window.open(URL.createObjectURL(new Blob([reportHtml()], { type: 'text/html' })), '_blank');
    if (w) setTimeout(() => w.print(), 600);
  }

  async function exportAll() {
    const data = GE.store.all();
    ['keyWindy', 'keyAis', 'keySentinel'].forEach((k) => delete data[k]); // Schlüssel nie exportieren
    const text = JSON.stringify({ app: 'godseye', version: 1, exported: new Date().toISOString(), data }, null, 2);
    if (window.godseye) await window.godseye.saveFile('godseye-export.json', text);
    else { const a = h('a', { href: 'data:application/json;charset=utf-8,' + encodeURIComponent(text), download: 'godseye-export.json' }); document.body.append(a); a.click(); a.remove(); }
  }

  function init() {
    $('#caseSelect').addEventListener('change', (e) => { GE.store.set('caseActive', e.target.value); render(); });
    $('#caseNotes').addEventListener('input', GE.ui.debounce((e) => { const l = cases(); const c = l.find((x) => x.id === active().id); c.notes = e.target.value; GE.store.set('cases', l); }, 400));
    $('#btnNewCase').addEventListener('click', () => {
      const l = cases(); const id = 'c' + Date.now();
      l.push({ id, name: t('case.newname', { n: l.length + 1 }), notes: '', items: [] });
      GE.store.set('caseActive', id); save(l);
    });
    $('#btnPinView').addEventListener('click', () => { const c = GE.map.center(); addItem({ type: 'view', label: `Ausschnitt ${GE.map.view.toUpperCase()} · Zoom ${GE.map.zoom()}`, lat: c.lat, lon: c.lon, data: { view: GE.map.view, zoom: GE.map.zoom() } }); });
    $('#btnShot').addEventListener('click', screenshot);
    $('#btnPdf').addEventListener('click', pdf);
    $('#btnExportAll').addEventListener('click', exportAll);
    GE.i18n.onChange(render);
    render();
  }

  return { init, addItem, addFav, items3d, render };
})();
