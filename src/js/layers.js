// Ebenen: Basiskarten, Satelliten-/Wetter-Raster und Live-Datenquellen.
// Jede Ebene kann einzeln an/aus; Raster haben einen Transparenz-Regler.
GE.layers = (() => {
  const { $, h, fmt, toast } = GE.ui;
  const t = GE.t;
  const all = [];
  const byId = {};
  let render3dTimer = null;

  // ---------- Zeit-Helfer für Raster ----------
  const dayStr = (d) => d.toISOString().slice(0, 10);
  const geoStr = (d) => { const x = new Date(Math.floor(d.getTime() / 600000) * 600000); return x.toISOString().slice(0, 17) + '00Z'; };
  const timeAt = () => GE.time ? GE.time.at() : null; // null = live
  // Tagesbilder: live = gestern (vollständig belichtet), sonst gewählter Tag
  const dailyTime = () => { const at = timeAt(); return dayStr(at || new Date(Date.now() - 86400000)); };
  const geoTime = () => { const at = timeAt(); return at ? geoStr(new Date(at.getTime() - 20 * 60000)) : null; };

  // WMS-Kachel als URL für den 3D-Globus (Web-Mercator)
  function wmsTileUrl(base, params, x, y, z) {
    const R = 20037508.342789244, size = 2 * R / Math.pow(2, z);
    const minx = -R + x * size, maxy = R - y * size;
    const q = new URLSearchParams(Object.assign({
      SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.1.1', SRS: 'EPSG:3857', STYLES: '',
      WIDTH: 256, HEIGHT: 256, FORMAT: 'image/jpeg', BBOX: [minx, maxy - size, minx + size, maxy].join(',')
    }, params));
    return base + '?' + q.toString();
  }

  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';
  const GIBS_ATTR = 'Imagery: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>';

  // ---------- Fabriken ----------
  function base(id, name, src, url, opts = {}) {
    return {
      id, group: 'base', type: 'base', name, src,
      make: () => L.tileLayer(url, Object.assign({ maxZoom: 19, crossOrigin: true }, opts)),
      tile3d: (x, y, z) => url.replace('{s}', 'a').replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', '')
    };
  }

  function gibs(id, group, name, layerName, timeFn, opts = {}) {
    const fmtType = opts.png ? 'image/png' : 'image/jpeg';
    return {
      id, group, type: 'raster', name, src: 'NASA GIBS', opacity: opts.opacity ?? 1, sat3d: !opts.png,
      timeKey: () => timeFn() || 'latest',
      make() {
        const p = { layers: layerName, format: fmtType, transparent: !!opts.png, version: '1.1.1', attribution: GIBS_ATTR, pane: 'overlayTiles', maxZoom: 19, maxNativeZoom: opts.maxNative || 9 };
        const tm = timeFn(); if (tm) p.TIME = tm;
        return L.tileLayer.wms(GIBS, p);
      },
      tile3d(x, y, z) {
        const p = { LAYERS: layerName, FORMAT: fmtType }; const tm = timeFn(); if (tm) p.TIME = tm;
        return wmsTileUrl(GIBS, p, x, y, Math.min(z, 9));
      }
    };
  }

  const layers = [
    // Basiskarten
    base('esri', 'Satellit (Esri World Imagery)', 'Esri, Maxar, Earthstar', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri — Maxar, Earthstar Geographics' }),
    base('dark', 'Dunkel (CARTO)', 'OpenStreetMap, CARTO', 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap, © CARTO', subdomains: 'abcd' }),
    base('osm', 'Straßenkarte (OSM)', 'OpenStreetMap', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap-Mitwirkende' }),

    // Satellit
    gibs('viirs', 'sat', 'VIIRS Tagesbild (Echtfarben)', 'VIIRS_SNPP_CorrectedReflectance_TrueColor', dailyTime),
    gibs('modis', 'sat', 'MODIS Terra Tagesbild', 'MODIS_Terra_CorrectedReflectance_TrueColor', dailyTime),
    {
      id: 's2', group: 'sat', type: 'raster', name: 'Sentinel-2 wolkenfrei (10 m)', src: 'Copernicus · EOX', opacity: 1, sat3d: true,
      make: () => L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg', { attribution: 'Sentinel-2 cloudless 2024 by <a href="https://s2maps.eu">EOX</a> (Copernicus Sentinel data)', pane: 'overlayTiles', maxZoom: 19, maxNativeZoom: 15 }),
      tile3d: (x, y, z) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/${z}/${y}/${x}.jpg`
    },
    {
      id: 'sentinelhub', group: 'sat', type: 'raster', name: 'Sentinel-2 aktuell (Sentinel Hub)', src: 'Copernicus Data Space · Key', opacity: 1, needsKey: 'keySentinel',
      timeKey: () => dayStr(timeAt() || new Date()),
      make() {
        const id = GE.store.get('keySentinel', '');
        const end = timeAt() || new Date(); const start = new Date(end.getTime() - 30 * 86400000);
        return L.tileLayer.wms(`https://sh.dataspace.copernicus.eu/ogc/wms/${encodeURIComponent(id)}`, {
          layers: GE.store.get('sentinelLayer', 'TRUE_COLOR'), format: 'image/jpeg', version: '1.3.0', pane: 'overlayTiles',
          TIME: `${dayStr(start)}/${dayStr(end)}`, MAXCC: 30, attribution: 'Copernicus Sentinel data, Sentinel Hub', maxZoom: 19
        });
      }
    },
    gibs('night', 'sat', 'Nachtlichter (VIIRS Day/Night)', 'VIIRS_SNPP_DayNightBand_ENCC', dailyTime, { maxNative: 8 }),

    // Wetter
    gibs('goesE', 'weather', 'Wettersatellit Amerika/Atlantik (GOES-East)', 'GOES-East_ABI_GeoColor', geoTime, { png: true, opacity: 0.85, maxNative: 7 }),
    gibs('goesW', 'weather', 'Wettersatellit Pazifik (GOES-West)', 'GOES-West_ABI_GeoColor', geoTime, { png: true, opacity: 0.85, maxNative: 7 }),
    gibs('himawari', 'weather', 'Wettersatellit Asien/Ozeanien IR (Himawari)', 'Himawari_AHI_Band13_Clean_Infrared', geoTime, { png: true, opacity: 0.7, maxNative: 7 }),
    radarLayer(),
    gibs('fires', 'events', 'Feuer & Hitzepunkte (VIIRS)', 'VIIRS_SNPP_Thermal_Anomalies_375m_All', dailyTime, { png: true, opacity: 1, maxNative: 9 }),

    // Live-Tracker
    flightsLayer(),
    shipsLayer(),
    satsLayer(),

    // Ereignisse
    quakesLayer(),
    eonetLayer(),

    // Eigene
    camsLayer()
  ];

  // ---------- Regenradar (RainViewer) ----------
  function radarLayer() {
    let frames = [], host = '';
    const L_ = {
      id: 'radar', group: 'weather', type: 'raster', name: 'Regenradar', src: 'RainViewer', opacity: 0.75,
      timeKey: () => pick() || 'none',
      async prepare() {
        try {
          GE.net.source('radar', 'load');
          const d = await GE.net.json('https://api.rainviewer.com/public/weather-maps.json');
          host = d.host; frames = (d.radar && d.radar.past) || [];
          GE.net.source('radar', 'ok');
        } catch (e) { GE.net.source('radar', 'err'); }
      },
      refreshMs: 5 * 60000,
      make() {
        const p = pick();
        if (!p) return L.layerGroup();
        return L.tileLayer(`${host}${p}/256/{z}/{x}/{y}/2/1_1.png`, { pane: 'overlayTiles', maxNativeZoom: 7, maxZoom: 19, attribution: 'Radar © <a href="https://www.rainviewer.com">RainViewer</a>' });
      }
    };
    function pick() {
      if (!frames.length) return null;
      const at = timeAt();
      if (!at) return frames[frames.length - 1].path;
      const ts = at.getTime() / 1000;
      let best = null, bd = Infinity;
      frames.forEach((f) => { const d = Math.abs(f.time - ts); if (d < bd) { bd = d; best = f; } });
      return bd < 1800 ? best.path : null; // nur letzte ~2 h verfügbar
    }
    return L_;
  }

  // ---------- Flugzeuge (ADS-B über adsb.lol) ----------
  function flightsLayer() {
    const live = new Map();      // hex -> Flugzeug
    const trails = new Map();    // hex -> [[lat,lon,alt]]
    const history = [];          // Aufzeichnung für die Zeitleiste
    const markers = new Map();
    let group = null, timer = null, selected = null;

    const planeSvg = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c.6 0 1 .8 1 1.6v6l8 4.6v2l-8-2.5v4.8l2.2 1.7V22L12 21l-3.2 1v-1.8L11 18.5v-4.8L3 16.2v-2l8-4.6v-6C11 2.8 11.4 2 12 2z"/></svg>';

    function radiusNm() {
      const z = GE.map.zoom();
      return z <= 5 ? 250 : z <= 6 ? 200 : z <= 7 ? 120 : z <= 8 ? 70 : 40;
    }

    async function load() {
      if (timeAt()) return; // im Rückblick nicht nachladen
      const c = GE.map.center();
      try {
        GE.net.source('flights', 'load');
        const d = await GE.net.json(`https://api.adsb.lol/v2/lat/${c.lat.toFixed(3)}/lon/${c.lon.toFixed(3)}/dist/${radiusNm()}`);
        const now = Date.now();
        const seen = new Set();
        (d.ac || []).forEach((a) => {
          if (a.lat == null || a.lon == null) return;
          const ac = {
            hex: a.hex, flight: (a.flight || '').trim(), reg: a.r, type: a.t, lat: a.lat, lon: a.lon,
            alt: a.alt_baro === 'ground' ? 0 : a.alt_baro, ground: a.alt_baro === 'ground', gs: a.gs, track: a.track ?? a.true_heading ?? 0,
            squawk: a.squawk, cat: a.category, emergency: a.emergency, vrate: a.baro_rate, mil: (a.dbFlags & 1) === 1, ts: now
          };
          live.set(ac.hex, ac); seen.add(ac.hex);
          const tr = trails.get(ac.hex) || [];
          const last = tr[tr.length - 1];
          if (!last || last[0] !== ac.lat || last[1] !== ac.lon) tr.push([ac.lat, ac.lon, ac.alt || 0]);
          if (tr.length > 120) tr.shift();
          trails.set(ac.hex, tr);
        });
        // veraltete entfernen
        for (const [k, v] of live) if (now - v.ts > 60000) { live.delete(k); trails.delete(k); }
        history.push({ ts: now, list: Array.from(live.values()).map((a) => Object.assign({}, a)) });
        if (history.length > 720) history.shift();
        GE.net.source('flights', 'ok');
        draw();
        GE.alerts && GE.alerts.checkMovers('flight', Array.from(live.values()));
      } catch (e) { GE.net.source('flights', 'err'); }
    }

    function current() {
      const at = timeAt();
      if (!at) return Array.from(live.values());
      const ts = at.getTime();
      let snap = null;
      for (let i = history.length - 1; i >= 0; i--) if (history[i].ts <= ts) { snap = history[i]; break; }
      return snap && ts - snap.ts < 120000 ? snap.list : [];
    }

    function color(a) {
      if (a.emergency && a.emergency !== 'none' || ['7500', '7600', '7700'].includes(a.squawk)) return 'var(--crit)';
      if (a.mil) return 'var(--warn)';
      return '';
    }

    function draw() {
      if (!group) return;
      const list = current();
      const keep = new Set();
      list.forEach((a) => {
        keep.add(a.hex);
        let m = markers.get(a.hex);
        const html = `<div class="mk-plane" style="transform:rotate(${a.track || 0}deg);${color(a) ? 'color:' + color(a) : ''}">${planeSvg}</div>`;
        if (!m) {
          m = L.marker([a.lat, a.lon], { icon: L.divIcon({ className: '', html, iconSize: [18, 18], iconAnchor: [9, 9] }), keyboard: false });
          m.on('click', () => { selected = a.hex; GE.intel.showFlight(live.get(a.hex) || a); drawTrail(); });
          m.bindTooltip('', { className: 'ge-tip', direction: 'top', offset: [0, -8] });
          m.addTo(group); markers.set(a.hex, m);
        } else {
          m.setLatLng([a.lat, a.lon]);
          m.setIcon(L.divIcon({ className: '', html, iconSize: [18, 18], iconAnchor: [9, 9] }));
        }
        m.setTooltipContent(`${a.flight || a.hex} · ${a.ground ? 'GND' : fmt.num(a.alt) + ' ft'}`);
      });
      for (const [k, m] of markers) if (!keep.has(k)) { group.removeLayer(m); markers.delete(k); }
      drawTrail();
      L_.count = list.length;
      schedule3d();
    }

    let trailLine = null;
    function drawTrail() {
      if (trailLine) { trailLine.remove(); trailLine = null; }
      if (!selected || !group) return;
      const tr = trails.get(selected);
      if (tr && tr.length > 1) trailLine = L.polyline(tr.map((p) => [p[0], p[1]]), { color: getComputedStyle(document.documentElement).getPropertyValue('--accent'), weight: 2, opacity: 0.8, dashArray: '4 4', pane: 'shapes' }).addTo(GE.map.leaflet);
    }

    const L_ = {
      id: 'flights', group: 'track', type: 'data', name: 'Flugzeuge (ADS-B)', src: 'adsb.lol · ODbL', count: 0,
      enable() {
        group = L.layerGroup().addTo(GE.map.leaflet);
        load(); timer = setInterval(load, 10000);
        L_._move = GE.ui.debounce(load, 800);
      },
      disable() { clearInterval(timer); group && group.remove(); group = null; markers.clear(); if (trailLine) trailLine.remove(); trailLine = null; L_.count = 0; schedule3d(); },
      onMove() { L_._move && L_._move(); },
      onTime() { draw(); if (timeAt() && !current().length && history.length === 0) toast(t('toast.norecord'), 'warn'); },
      items3d() {
        return current().map((a) => ({ lat: a.lat, lng: a.lon, alt: Math.max(0.002, (a.alt || 0) / 3.3e5 * 10), r: 0.12, color: color(a) ? '#ff5468' : accentHex(), label: `${a.flight || a.hex} · ${fmt.num(a.alt)} ft`, onClick: () => GE.intel.showFlight(a) }));
      },
      paths3d() { const tr = selected && trails.get(selected); return tr && tr.length > 1 ? [{ pts: tr.map((p) => [p[0], p[1], Math.max(0.002, p[2] / 3.3e5 * 10)]), color: accentHex() }] : []; },
      get(hex) { return live.get(hex); },
      all: () => current(),
      select(hex) { selected = hex; drawTrail(); schedule3d(); },
      trail: (hex) => trails.get(hex) || []
    };
    return L_;
  }

  // ---------- Schiffe (AIS über aisstream.io, nur Desktop) ----------
  function shipsLayer() {
    const ships = new Map();
    let group = null, drawTimer = null, started = false;

    function start() {
      if (!window.godseye) { toast(t('toast.electron'), 'warn'); GE.net.source('ships', 'err'); return; }
      const key = GE.store.get('keyAis', '');
      if (!key) { toast(t('toast.nokey') + ' (AISStream)', 'warn'); GE.net.source('ships', 'err'); return; }
      const b = GE.map.bounds();
      GE.net.source('ships', 'load');
      window.godseye.ais.start(key, [[b.s, b.w], [b.n, b.e]]);
      if (!started) {
        started = true;
        window.godseye.ais.onStatus((s) => GE.net.source('ships', s === 'online' ? 'ok' : s === 'offline' ? '' : 'err'));
        window.godseye.ais.onMessage(onMsg);
      }
    }

    function onMsg(m) {
      const md = m.MetaData || {};
      const id = md.MMSI; if (!id) return;
      const s = ships.get(id) || { mmsi: id };
      s.name = (md.ShipName || s.name || '').trim();
      s.lat = md.latitude; s.lon = md.longitude; s.ts = Date.now();
      const pr = m.Message && m.Message.PositionReport;
      if (pr) { s.cog = pr.Cog; s.sog = pr.Sog; s.heading = pr.TrueHeading; s.nav = pr.NavigationalStatus; }
      const st = m.Message && m.Message.ShipStaticData;
      if (st) { s.type = st.Type; s.dest = st.Destination; s.callsign = st.CallSign; s.imo = st.ImoNumber; s.dim = st.Dimension; s.eta = st.Eta; }
      ships.set(id, s);
      if (ships.size > 4000) { const oldest = [...ships.values()].sort((a, b) => a.ts - b.ts)[0]; ships.delete(oldest.mmsi); }
    }

    function draw() {
      if (!group) return;
      group.clearLayers();
      const now = Date.now();
      for (const [k, s] of ships) {
        if (now - s.ts > 20 * 60000) { ships.delete(k); continue; }
        const m = L.circleMarker([s.lat, s.lon], { radius: 3.5, color: '#7cf2c8', weight: 1, fillOpacity: 0.85, pane: 'shapes' });
        m.on('click', () => GE.intel.showShip(s));
        m.bindTooltip(`${s.name || s.mmsi} · ${s.sog != null ? s.sog + ' kn' : ''}`, { className: 'ge-tip' });
        m.addTo(group);
      }
      L_.count = ships.size;
      schedule3d();
      GE.alerts && GE.alerts.checkMovers('ship', Array.from(ships.values()));
    }

    const L_ = {
      id: 'ships', group: 'track', type: 'data', name: 'Schiffe (AIS)', src: 'aisstream.io · Key', count: 0, needsKey: 'keyAis',
      enable() { group = L.layerGroup().addTo(GE.map.leaflet); start(); drawTimer = setInterval(draw, 3000); L_._move = GE.ui.debounce(start, 2500); },
      disable() { clearInterval(drawTimer); window.godseye && window.godseye.ais.stop(); group && group.remove(); group = null; L_.count = 0; schedule3d(); },
      onMove() { L_._move && L_._move(); },
      items3d() { return [...ships.values()].map((s) => ({ lat: s.lat, lng: s.lon, alt: 0.001, r: 0.08, color: '#7cf2c8', label: s.name || String(s.mmsi), onClick: () => GE.intel.showShip(s) })); },
      find(q) { q = String(q).toLowerCase(); return [...ships.values()].filter((s) => String(s.mmsi) === q || (s.name || '').toLowerCase().includes(q)); },
      all: () => [...ships.values()]
    };
    return L_;
  }

  // ---------- Satelliten (CelesTrak TLE + satellite.js) ----------
  function satsLayer() {
    let sats = [], group = null, timer = null, selected = null, orbitLine = null;
    const markers = new Map();

    async function load() {
      try {
        GE.net.source('sats', 'load');
        const groups = ['stations', 'visual', 'weather'];
        const seen = new Set();
        sats = [];
        for (const g of groups) {
          const txt = await GE.net.text(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`);
          const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          for (let i = 0; i + 2 < lines.length + 1; i += 3) {
            const name = lines[i], l1 = lines[i + 1], l2 = lines[i + 2];
            if (!l1 || !l2 || !l1.startsWith('1 ')) continue;
            const norad = l1.slice(2, 7).trim();
            if (seen.has(norad)) continue; seen.add(norad);
            try { sats.push({ name, norad, group: g, rec: satellite.twoline2satrec(l1, l2) }); } catch (_) {}
          }
        }
        GE.net.source('sats', 'ok');
        draw();
      } catch (e) { GE.net.source('sats', 'err'); }
    }

    function pos(s, date) {
      const pv = satellite.propagate(s.rec, date);
      if (!pv || !pv.position) return null;
      const gmst = satellite.gstime(date);
      const g = satellite.eciToGeodetic(pv.position, gmst);
      const v = pv.velocity ? Math.sqrt(pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2) : null;
      return { lat: satellite.degreesLat(g.latitude), lon: satellite.degreesLong(g.longitude), altKm: g.height, vel: v };
    }

    const isIss = (s) => /ISS \(ZARYA\)/.test(s.name);

    function draw() {
      if (!group) return;
      const date = timeAt() || new Date();
      sats.forEach((s) => {
        const p = pos(s, date); s.p = p;
        if (!p || isNaN(p.lat)) return;
        let m = markers.get(s.norad);
        if (!m) {
          const big = isIss(s) || s.group === 'stations';
          m = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="mk-sat"><div class="sat-dot"${big ? '' : ' style="width:5px;height:5px"'}></div>${big ? `<span class="sat-lbl">${GE.ui.esc(s.name)}</span>` : ''}</div>`, iconSize: [8, 8], iconAnchor: [4, 4] }) });
          m.on('click', () => { selected = s.norad; GE.intel.showSat(s, pos(s, timeAt() || new Date())); drawOrbit(); });
          m.bindTooltip(s.name, { className: 'ge-tip' });
          m.addTo(group); markers.set(s.norad, m);
        } else m.setLatLng([p.lat, p.lon]);
      });
      L_.count = sats.length;
      schedule3d();
    }

    function orbitPts(s) {
      const base = (timeAt() || new Date()).getTime();
      const pts = [];
      for (let m = -50; m <= 50; m += 1) { const p = pos(s, new Date(base + m * 60000)); if (p) pts.push([p.lat, p.lon, p.altKm]); }
      return pts;
    }

    function drawOrbit() {
      if (orbitLine) { orbitLine.remove(); orbitLine = null; }
      const s = sats.find((x) => x.norad === selected); if (!s || !group) return;
      // Linie an der Datumsgrenze auftrennen
      const segs = [[]];
      orbitPts(s).forEach((p, i, arr) => { if (i && Math.abs(p[1] - arr[i - 1][1]) > 180) segs.push([]); segs[segs.length - 1].push([p[0], p[1]]); });
      orbitLine = L.polyline(segs, { color: '#ffffff', weight: 1.2, opacity: 0.6, dashArray: '2 5', pane: 'shapes' }).addTo(GE.map.leaflet);
      schedule3d();
    }

    const L_ = {
      id: 'sats', group: 'track', type: 'data', name: 'Satelliten & ISS', src: 'CelesTrak · satellite.js', count: 0,
      enable() { group = L.layerGroup().addTo(GE.map.leaflet); if (sats.length) draw(); else load(); timer = setInterval(draw, 2000); },
      disable() { clearInterval(timer); group && group.remove(); group = null; markers.clear(); if (orbitLine) orbitLine.remove(); orbitLine = null; L_.count = 0; schedule3d(); },
      onTime() { draw(); if (selected) drawOrbit(); },
      items3d() {
        return sats.filter((s) => s.p && !isNaN(s.p.lat)).map((s) => ({ lat: s.p.lat, lng: s.p.lon, alt: s.p.altKm / 6371, r: isIss(s) ? 0.6 : 0.18, color: isIss(s) ? '#ffffff' : '#c9d8ea', label: s.name, onClick: () => { selected = s.norad; GE.intel.showSat(s, s.p); drawOrbit(); } }));
      },
      paths3d() { const s = sats.find((x) => x.norad === selected); return s ? [{ pts: orbitPts(s).map((p) => [p[0], p[1], p[2] / 6371]), color: '#ffffff' }] : []; },
      find(q) { q = q.toLowerCase(); return sats.filter((s) => s.name.toLowerCase().includes(q) || s.norad === q); },
      select(s) { selected = s.norad; drawOrbit(); },
      pos
    };
    return L_;
  }

  // ---------- Erdbeben (USGS) ----------
  function quakesLayer() {
    let feats = [], group = null, timer = null;

    async function load() {
      try {
        GE.net.source('quakes', 'load');
        const d = await GE.net.json('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson');
        feats = d.features.map((f) => ({ id: f.id, mag: f.properties.mag, place: f.properties.place, time: f.properties.time, url: f.properties.url, tsunami: f.properties.tsunami, alert: f.properties.alert, depth: f.geometry.coordinates[2], lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], felt: f.properties.felt }));
        GE.net.source('quakes', 'ok');
        draw();
        GE.alerts && GE.alerts.checkQuakes(feats);
      } catch (e) { GE.net.source('quakes', 'err'); }
    }

    function visible() {
      const at = (timeAt() || new Date()).getTime();
      return feats.filter((f) => f.time <= at && at - f.time < 86400000);
    }

    function colorFor(f) {
      const age = ((timeAt() || new Date()).getTime() - f.time) / 3600000;
      return age < 1 ? '#ff5468' : age < 6 ? '#ff8a4b' : '#ffc24b';
    }

    function draw() {
      if (!group) return;
      group.clearLayers();
      const list = visible();
      list.forEach((f) => {
        const m = L.circleMarker([f.lat, f.lon], { radius: Math.max(3, (f.mag || 0) * 2.6), color: colorFor(f), weight: 1.2, fillOpacity: 0.25, pane: 'shapes' });
        m.bindTooltip(`M${(f.mag ?? 0).toFixed(1)} · ${f.place || ''}`, { className: 'ge-tip' });
        m.on('click', () => GE.intel.showQuake(f));
        m.addTo(group);
      });
      L_.count = list.length;
      schedule3d();
    }

    const L_ = {
      id: 'quakes', group: 'events', type: 'data', name: 'Erdbeben (24 h)', src: 'USGS', count: 0,
      enable() { group = L.layerGroup().addTo(GE.map.leaflet); load(); timer = setInterval(load, 60000); },
      disable() { clearInterval(timer); group && group.remove(); group = null; L_.count = 0; schedule3d(); },
      onTime: () => draw(),
      items3d: () => visible().map((f) => ({ lat: f.lat, lng: f.lon, alt: 0.005, r: Math.max(0.15, (f.mag || 0) * 0.12), color: colorFor(f), label: `M${(f.mag ?? 0).toFixed(1)} ${f.place}`, onClick: () => GE.intel.showQuake(f) })),
      rings3d: () => visible().filter((f) => f.mag >= 4.5).map((f) => ({ lat: f.lat, lng: f.lon, maxR: f.mag * 0.8, color: colorFor(f) })),
      near: (lat, lon, km) => feats.filter((f) => GE.geo.distKm(lat, lon, f.lat, f.lon) < km),
      all: () => feats,
      load
    };
    return L_;
  }

  // ---------- Naturereignisse (NASA EONET) ----------
  function eonetLayer() {
    let events = [], group = null, timer = null;
    const colors = { wildfires: '#ff8a4b', severeStorms: '#b996ff', volcanoes: '#ff5468', seaLakeIce: '#7fd8ff', floods: '#4b9bff', earthquakes: '#ffc24b', landslides: '#c58f5a', dustHaze: '#d9c27a', snow: '#e6f2ff', drought: '#e0a050', manmade: '#bbbbbb', tempExtremes: '#ff6bb5', waterColor: '#3dd6c8' };

    async function load() {
      try {
        GE.net.source('eonet', 'load');
        const d = await GE.net.json('https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=30&limit=400');
        events = d.events.map((e) => ({ id: e.id, title: e.title, cat: e.categories[0] && e.categories[0].id, catTitle: e.categories[0] && e.categories[0].title, sources: e.sources, closed: e.closed, geom: e.geometry.map((g) => ({ date: new Date(g.date).getTime(), type: g.type, coords: g.coordinates, mag: g.magnitudeValue, unit: g.magnitudeUnit })) }));
        GE.net.source('eonet', 'ok');
        draw();
      } catch (e) { GE.net.source('eonet', 'err'); }
    }

    // Position zum Zeitpunkt der Zeitleiste
    function at(e) {
      const ts = (timeAt() || new Date()).getTime();
      const gs = e.geom.filter((g) => g.date <= ts);
      if (!gs.length) return null;
      if (e.closed && new Date(e.closed).getTime() < ts) return null;
      const g = gs[gs.length - 1];
      let lat, lon;
      if (g.type === 'Point') { lon = g.coords[0]; lat = g.coords[1]; }
      else { const ring = g.coords[0]; lon = ring.reduce((s, p) => s + p[0], 0) / ring.length; lat = ring.reduce((s, p) => s + p[1], 0) / ring.length; }
      return { lat, lon, g, track: gs.filter((x) => x.type === 'Point').map((x) => [x.coords[1], x.coords[0]]) };
    }

    function visible() { return events.map((e) => ({ e, p: at(e) })).filter((x) => x.p); }

    function draw() {
      if (!group) return;
      group.clearLayers();
      const list = visible();
      list.forEach(({ e, p }) => {
        const c = colors[e.cat] || '#ffffff';
        if (p.track.length > 1) {
          // Spur an der Datumsgrenze auftrennen, sonst läuft eine Linie quer über die Karte
          const segs = [[]];
          p.track.forEach((pt, i, arr) => { if (i && Math.abs(pt[1] - arr[i - 1][1]) > 180) segs.push([]); segs[segs.length - 1].push(pt); });
          L.polyline(segs, { color: c, weight: 1.5, opacity: 0.6, pane: 'shapes' }).addTo(group);
        }
        const m = L.circleMarker([p.lat, p.lon], { radius: 6, color: c, weight: 2, fillColor: c, fillOpacity: 0.35, pane: 'shapes' });
        m.bindTooltip(`${e.catTitle}: ${e.title}`, { className: 'ge-tip' });
        m.on('click', () => GE.intel.showEvent(e, p));
        m.addTo(group);
      });
      L_.count = list.length;
      schedule3d();
    }

    const L_ = {
      id: 'eonet', group: 'events', type: 'data', name: 'Naturereignisse (Feuer, Stürme, Vulkane)', src: 'NASA EONET', count: 0,
      enable() { group = L.layerGroup().addTo(GE.map.leaflet); load(); timer = setInterval(load, 10 * 60000); },
      disable() { clearInterval(timer); group && group.remove(); group = null; L_.count = 0; schedule3d(); },
      onTime: () => draw(),
      items3d: () => visible().map(({ e, p }) => ({ lat: p.lat, lng: p.lon, alt: 0.01, r: 0.35, color: colors[e.cat] || '#fff', label: e.title, onClick: () => GE.intel.showEvent(e, p) })),
      near: (lat, lon, km) => visible().filter(({ p }) => GE.geo.distKm(lat, lon, p.lat, p.lon) < km)
    };
    return L_;
  }

  // ---------- Kamera-Standorte ----------
  function camsLayer() {
    let group = null;
    function draw() {
      if (!group) return;
      group.clearLayers();
      const list = GE.cams.list().filter((c) => c.lat != null);
      list.forEach((c) => {
        const m = L.circleMarker([c.lat, c.lon], { radius: c.source === 'curated' || c.source === 'own' ? 6 : 4, color: accentHex(), weight: 1.5, fillColor: '#04060c', fillOpacity: 0.9, pane: 'shapes' });
        m.bindTooltip(c.name, { className: 'ge-tip' });
        m.on('click', () => GE.cams.open(c));
        m.addTo(group);
      });
      L_.count = list.length;
      schedule3d();
    }
    const L_ = {
      id: 'camsMap', group: 'own', type: 'data', name: 'Kamera-Standorte', src: 'Kuratierte Liste, TfL, NYC DOT, Windy', count: 0,
      enable() { group = L.layerGroup().addTo(GE.map.leaflet); draw(); },
      disable() { group && group.remove(); group = null; schedule3d(); },
      redraw: draw,
      items3d: () => GE.cams.list().filter((c) => c.lat != null).map((c) => ({ lat: c.lat, lng: c.lon, alt: 0.004, r: 0.14, color: accentHex(), label: c.name, onClick: () => GE.cams.open(c) }))
    };
    return L_;
  }

  // ---------- Verwaltung ----------
  const active = {};     // id -> Leaflet-Ebene oder true
  const timeKeys = {};
  let baseId = 'esri';

  function accentHex() { return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3fe0ff'; }

  async function enable(l) {
    if (l.needsKey && !GE.store.get(l.needsKey, '')) { toast(t('toast.nokey'), 'warn'); return false; }
    if (l.type === 'data') { l.enable(); active[l.id] = true; }
    else {
      if (l.prepare) await l.prepare();
      const lay = l.make();
      if (l.opacity != null && lay.setOpacity) lay.setOpacity(getOpacity(l));
      lay.addTo(GE.map.leaflet);
      lay.on && lay.on('tileerror', () => setState(l.id, 'err'));
      lay.on && lay.on('load', () => setState(l.id, 'ok'));
      active[l.id] = lay;
      timeKeys[l.id] = l.timeKey ? l.timeKey() : null;
      if (l.refreshMs) l._timer = setInterval(async () => { await l.prepare(); refreshRaster(l, true); }, l.refreshMs);
    }
    saveActive(); updateGlobeTiles();
    return true;
  }

  function disable(l) {
    const a = active[l.id];
    if (!a) return;
    if (l.type === 'data') l.disable();
    else { a.remove(); clearInterval(l._timer); }
    delete active[l.id];
    setState(l.id, '');
    saveActive(); updateGlobeTiles();
  }

  function refreshRaster(l, force) {
    const a = active[l.id];
    if (!a || l.type !== 'raster') return;
    const key = l.timeKey ? l.timeKey() : null;
    if (!force && key === timeKeys[l.id]) return;
    timeKeys[l.id] = key;
    a.remove();
    const lay = l.make();
    if (lay.setOpacity) lay.setOpacity(getOpacity(l));
    lay.addTo(GE.map.leaflet);
    active[l.id] = lay;
    updateGlobeTiles();
  }

  function setBase(id) {
    const l = byId[id]; if (!l) return;
    if (active['base']) active['base'].remove();
    const lay = l.make().addTo(GE.map.leaflet);
    lay.bringToBack();
    active['base'] = lay; baseId = id;
    GE.store.set('base', id);
    updateGlobeTiles();
  }

  // Der Globus kann nur eine Kachelquelle zeigen: oberstes aktives Satellitenbild, sonst Basiskarte
  function updateGlobeTiles() {
    const top = layers.filter((l) => l.tile3d && l.type === 'raster' && active[l.id] && l.sat3d).pop();
    const src = top || byId[baseId];
    GE.map.setGlobeTiles((x, y, z) => src.tile3d(x, y, z));
  }

  const getOpacity = (l) => { const o = GE.store.get('opacity', {}); return o[l.id] ?? l.opacity ?? 1; };
  function setOpacity(l, v) {
    const o = GE.store.get('opacity', {}); o[l.id] = v; GE.store.set('opacity', o);
    const a = active[l.id]; if (a && a.setOpacity) a.setOpacity(v);
  }

  function saveActive() { GE.store.set('layers', Object.keys(active).filter((k) => k !== 'base')); renderStates(); }

  function setState(id, s) { const dot = document.querySelector(`[data-layer-state="${id}"]`); if (dot) dot.className = 'ly-state ' + (s || ''); }

  function renderStates() {
    layers.forEach((l) => {
      const cb = document.querySelector(`[data-layer="${l.id}"]`);
      if (cb && l.type !== 'base') cb.checked = !!active[l.id];
      if (l.type === 'data') setState(l.id, active[l.id] ? 'ok' : '');
    });
  }

  function renderList() {
    const root = $('#layerList');
    root.innerHTML = '';
    const groups = [['base', 'lg.base'], ['sat', 'lg.sat'], ['weather', 'lg.weather'], ['track', 'lg.track'], ['events', 'lg.events'], ['own', 'lg.own']];
    groups.forEach(([g, key]) => {
      const box = h('div.lg', null, h('div.lg-title', null, t(key)));
      layers.filter((l) => l.group === g).forEach((l) => {
        let ctl;
        if (l.type === 'base') {
          ctl = h('input.ly-radio', { type: 'radio', name: 'base', id: 'base-' + l.id, onchange: () => setBase(l.id) });
          if (l.id === baseId) ctl.checked = true;
        } else {
          const cb = h('input', { type: 'checkbox', id: 'ly-' + l.id, 'data-layer': l.id, onchange: async (e) => {
            if (e.target.checked) { const ok = await enable(l); if (!ok) e.target.checked = false; } else disable(l);
            $('#presetSelect').value = 'custom';
          } });
          cb.checked = !!active[l.id];
          ctl = h('label.ly-sw', null, cb, h('i'));
        }
        const row = h('div.ly', null, ctl,
          h('label.ly-name', { for: l.type === 'base' ? 'base-' + l.id : 'ly-' + l.id }, l.name, h('span.ly-src', null, l.src)),
          l.type === 'base' ? h('span') : h('span.ly-state', { 'data-layer-state': l.id }));
        if (l.type === 'raster' && l.group !== 'base') {
          const r = h('input.ly-opacity', { type: 'range', min: 0, max: 1, step: 0.05, 'aria-label': 'Transparenz ' + l.name, oninput: (e) => setOpacity(l, +e.target.value) });
          r.value = getOpacity(l);
          row.append(r);
        }
        box.append(row);
      });
      root.append(box);
    });
  }

  // ---------- 3D-Ausgabe ----------
  function schedule3d() {
    if (GE.map.view !== '3d') return;
    if (render3dTimer) return;
    render3dTimer = setTimeout(() => { render3dTimer = null; render3d(); }, 600);
  }

  function render3d() {
    const g = GE.map.globe; if (!g) return;
    const pts = [], paths = [], rings = [];
    layers.forEach((l) => {
      if (!active[l.id] || l.type !== 'data') return;
      if (l.items3d) pts.push(...l.items3d());
      if (l.paths3d) paths.push(...l.paths3d());
      if (l.rings3d) rings.push(...l.rings3d());
    });
    if (GE.cases) pts.push(...GE.cases.items3d());
    g.pointsData(pts).pathsData(paths).ringsData(rings);
  }

  // ---------- Modi (Presets) ----------
  const presets = {
    overview: { base: 'esri', on: ['quakes', 'eonet', 'flights', 'sats'] },
    air: { base: 'dark', on: ['flights', 'radar'] },
    sea: { base: 'dark', on: ['ships'] },
    disaster: { base: 'esri', on: ['quakes', 'eonet', 'fires', 'goesE', 'goesW', 'himawari'] },
    space: { base: 'dark', on: ['sats', 'night'], view: '3d' },
    cams: { base: 'dark', on: ['camsMap'] }
  };

  async function applyPreset(name) {
    const p = presets[name]; if (!p) return;
    layers.forEach((l) => { if (l.type !== 'base' && active[l.id] && !p.on.includes(l.id)) disable(l); });
    if (byId[p.base] && byId[p.base].type === 'base') setBase(p.base);
    for (const id of p.on) if (!active[id] && byId[id]) await enable(byId[id]);
    if (p.view) GE.app.setView(p.view);
    renderList();
  }

  return {
    async init() {
      layers.forEach((l) => { all.push(l); byId[l.id] = l; });
      baseId = GE.store.get('base', 'esri');
      setBase(baseId);
      renderList();
      const saved = GE.store.get('layers', null) || ['flights', 'quakes', 'eonet', 'camsMap'];
      for (const id of saved) if (byId[id] && byId[id].type !== 'base') await enable(byId[id]);
      renderStates();
      GE.map.onMove(() => { layers.forEach((l) => active[l.id] && l.onMove && l.onMove()); schedule3d(); });
      GE.i18n.onChange(renderList);
    },
    onTime() {
      layers.forEach((l) => {
        if (!active[l.id]) return;
        if (l.type === 'raster') refreshRaster(l);
        else if (l.onTime) l.onTime();
      });
      schedule3d();
    },
    allOff() { layers.forEach((l) => l.type !== 'base' && disable(l)); renderList(); },
    get: (id) => byId[id],
    isOn: (id) => !!active[id],
    enable: (id) => byId[id] && enable(byId[id]).then(renderStates),
    applyPreset, render3d, schedule3d, accentHex,
    counts() {
      return { flights: byId.flights.count, ships: byId.ships.count, quakes: byId.quakes.count, events: byId.eonet.count, sats: byId.sats.count };
    },
    timeStamps: { dailyTime, geoTime }
  };
})();
