// Karte: 2D (Leaflet) und 3D-Globus (globe.gl) mit gemeinsamer Schnittstelle.
GE.map = (() => {
  const { $, fmt } = GE.ui;
  let view = '2d';
  let lmap = null;   // Leaflet
  let globe = null;  // globe.gl
  let globeTileFn = null;
  const clickFns = [];
  const moveFns = [];

  function initLeaflet() {
    lmap = L.map('map2d', {
      center: [30, 10], zoom: 3, minZoom: 2, maxZoom: 18,
      worldCopyJump: true, zoomControl: false, attributionControl: true,
      preferCanvas: true
    });
    L.control.zoom({ position: 'bottomright' }).addTo(lmap);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(lmap);
    // Eigene Ebenen-Reihenfolge: Rasterdaten unter den Markern
    lmap.createPane('overlayTiles').style.zIndex = 250;
    lmap.createPane('shapes').style.zIndex = 420;

    lmap.on('mousemove', (e) => readout(e.latlng.lat, e.latlng.lng));
    lmap.on('click', (e) => clickFns.forEach((fn) => fn(e.latlng.lat, e.latlng.lng, e)));
    lmap.on('moveend', () => moveFns.forEach((fn) => fn()));
  }

  function initGlobe() {
    if (globe) return;
    const el = $('#map3d');
    globe = Globe({ rendererConfig: { antialias: true, alpha: false } })(el)
      .backgroundColor('#02040a')
      .showAtmosphere(true)
      .atmosphereColor(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3fe0ff')
      .atmosphereAltitude(0.18)
      .pointLat('lat').pointLng('lng').pointColor('color').pointAltitude('alt').pointRadius('r').pointLabel('label')
      .pointsMerge(false)
      .onPointClick((d) => d && d.onClick && d.onClick())
      .pathPoints('pts').pathPointLat((p) => p[0]).pathPointLng((p) => p[1]).pathPointAlt((p) => p[2] || 0.01)
      .pathColor('color').pathStroke(1.2).pathTransitionDuration(0)
      .ringLat('lat').ringLng('lng').ringColor((d) => () => d.color).ringMaxRadius('maxR').ringPropagationSpeed(1.5).ringRepeatPeriod(1400)
      .onGlobeClick(({ lat, lng }) => clickFns.forEach((fn) => fn(lat, lng)))
      .onZoom(() => moveFns.forEach((fn) => fn()));
    if (globeTileFn) globe.globeTileEngineUrl(globeTileFn);
    resizeGlobe();
    new ResizeObserver(resizeGlobe).observe(el);
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const c = globe.toGlobeCoords(e.clientX - r.left, e.clientY - r.top);
      if (c) readout(c.lat, c.lng);
    });
    const c = lmap.getCenter();
    globe.pointOfView({ lat: c.lat, lng: c.lng, altitude: zoomToAlt(lmap.getZoom()) }, 0);
  }

  function resizeGlobe() {
    if (!globe) return;
    const el = $('#map3d');
    globe.width(el.clientWidth).height(el.clientHeight);
  }

  const zoomToAlt = (z) => Math.max(0.02, 2.6 / Math.pow(2, Math.max(0, z - 2)));
  const altToZoom = (a) => Math.round(2 + Math.log2(2.6 / Math.max(a, 0.02)));

  function readout(lat, lon) {
    $('#coordReadout').textContent = GE.geo.toDec(lat, lon, 4);
    $('#coordDms').textContent = GE.geo.toDms(lat, lon);
  }

  function setView(v) {
    if (v === view) return;
    const c = center(), z = zoom();
    view = v;
    $('#map2d').hidden = v !== '2d';
    $('#map3d').hidden = v !== '3d';
    if (v === '3d') {
      initGlobe();
      globe.pointOfView({ lat: c.lat, lng: c.lon, altitude: zoomToAlt(z) }, 0);
      GE.layers && GE.layers.render3d();
    } else {
      lmap.invalidateSize();
      lmap.setView([c.lat, c.lon], z, { animate: false });
    }
    moveFns.forEach((fn) => fn());
  }

  function center() {
    if (view === '3d' && globe) { const p = globe.pointOfView(); return { lat: p.lat, lon: p.lng }; }
    const c = lmap.getCenter().wrap();
    return { lat: c.lat, lon: c.lng };
  }

  function zoom() {
    if (view === '3d' && globe) return altToZoom(globe.pointOfView().altitude);
    return lmap.getZoom();
  }

  function bounds() {
    if (view === '3d' && globe) {
      const p = globe.pointOfView();
      const half = Math.min(80, Math.acos(1 / (1 + p.altitude)) * 180 / Math.PI);
      return { s: Math.max(-90, p.lat - half), n: Math.min(90, p.lat + half), w: p.lng - half * 1.5, e: p.lng + half * 1.5 };
    }
    const b = lmap.getBounds();
    return { s: b.getSouth(), n: b.getNorth(), w: b.getWest(), e: b.getEast() };
  }

  function flyTo(lat, lon, z = 11, label) {
    if (view === '3d' && globe) globe.pointOfView({ lat, lng: lon, altitude: zoomToAlt(z) }, 1600);
    else lmap.flyTo([lat, lon], z, { duration: 1.4 });
    scan(lat, lon, label);
  }

  // Zielerfassungs-Animation an einer Kartenposition
  function scan(lat, lon, label) {
    if (!GE.store.get('scanFx', true)) return;
    const fx = $('#scanFx');
    const place = () => {
      let p;
      if (view === '3d' && globe) { const s = globe.getScreenCoords(lat, lon, 0); p = s && { x: s.x, y: s.y }; }
      else p = lmap.latLngToContainerPoint([lat, lon]);
      if (!p) return;
      fx.style.left = p.x + 'px'; fx.style.top = p.y + 'px';
    };
    $('#scanLabel').textContent = (label ? label + ' · ' : '') + GE.geo.toDec(lat, lon, 4);
    fx.hidden = false;
    // Neustart der CSS-Animation
    fx.querySelectorAll('.scan-ring, .scan-cross').forEach((n) => { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
    const start = performance.now();
    (function loop(t) { place(); if (t - start < 1700) requestAnimationFrame(loop); else fx.hidden = true; })(start);
  }

  function setGlobeTiles(fn) {
    globeTileFn = fn;
    if (globe) globe.globeTileEngineUrl(fn);
  }

  function setAccent(color) { if (globe) globe.atmosphereColor(color); }

  return {
    init() { initLeaflet(); },
    get view() { return view; },
    get leaflet() { return lmap; },
    get globe() { return globe; },
    setView, center, zoom, bounds, flyTo, scan, setGlobeTiles, setAccent,
    onClick: (fn) => clickFns.push(fn),
    onMove: (fn) => moveFns.push(fn),
    fmtNow: () => fmt.utc(Date.now())
  };
})();
