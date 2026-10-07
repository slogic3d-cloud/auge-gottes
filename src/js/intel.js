// Ziel-Panel: Details zu Ort, Flugzeug, Schiff, Erdbeben, Naturereignis oder Satellit.
GE.weather = (() => {
  const cache = new Map();
  const codes = {
    de: { 0: 'klar', 1: 'überwiegend klar', 2: 'teils bewölkt', 3: 'bedeckt', 45: 'Nebel', 48: 'Raureifnebel', 51: 'leichter Niesel', 53: 'Niesel', 55: 'starker Niesel', 61: 'leichter Regen', 63: 'Regen', 65: 'starker Regen', 66: 'gefrierender Regen', 67: 'gefrierender Regen', 71: 'leichter Schnee', 73: 'Schnee', 75: 'starker Schnee', 77: 'Schneegriesel', 80: 'Schauer', 81: 'Schauer', 82: 'heftige Schauer', 85: 'Schneeschauer', 86: 'Schneeschauer', 95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel' },
    en: { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'rime fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'showers', 81: 'showers', 82: 'violent showers', 85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm', 96: 'thunderstorm, hail', 99: 'thunderstorm, hail' }
  };
  return {
    async get(lat, lon) {
      const k = lat.toFixed(2) + ',' + lon.toFixed(2);
      const c = cache.get(k);
      if (c && Date.now() - c.ts < 600000) return c.data;
      const data = await GE.net.json(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,is_day,pressure_msl&timezone=auto`);
      cache.set(k, { ts: Date.now(), data });
      return data;
    },
    label: (code) => (codes[GE.i18n.lang] || codes.de)[code] ?? '—'
  };
})();

GE.intel = (() => {
  const { $, h, kv, fmt, toast, link, esc, block } = GE.ui;
  const t = GE.t;
  let followTimer = null;
  let lastGdelt = 0;
  let current = null;

  function frame(kind, title, lat, lon, extraHead) {
    stopFollow();
    $('#intelEmpty').hidden = true;
    const box = $('#intelContent');
    box.hidden = false;
    box.innerHTML = '';
    const head = h('div.intel-head', null,
      h('span.intel-kind', null, kind),
      h('h3.intel-title', null, title),
      lat != null ? h('span.intel-coords.mono', { title: 'Kopieren', style: 'cursor:copy', onclick: () => GE.ui.copy(GE.geo.toDec(lat, lon, 5)) }, `${GE.geo.toDec(lat, lon, 5)} · ${GE.geo.toDms(lat, lon)}`) : null,
      extraHead || null);
    box.append(head);
    GE.ui.showTab('intel');
    return box;
  }

  function actions(lat, lon, label, extra = []) {
    return h('div.intel-actions', null,
      h('button.btn.btn-s', { type: 'button', onclick: () => GE.map.flyTo(lat, lon, 13, label) }, t('i.zoom')),
      h('button.btn.btn-s', { type: 'button', onclick: () => GE.cases.addFav({ label, lat, lon }) }, t('i.fav')),
      h('button.btn.btn-s', { type: 'button', onclick: () => GE.cases.addItem({ type: current && current.type || 'place', label, lat, lon, data: current && current.data }) }, t('i.pin')),
      ...extra);
  }

  function section(title) { return h('h3.sub-h', null, title); }

  function placeLinks(lat, lon) {
    const d = GE.layers.timeStamps.dailyTime();
    return h('div.link-grid', null,
      link(`https://browser.dataspace.copernicus.eu/?zoom=13&lat=${lat}&lng=${lon}`, t('i.copernicus')),
      link(`https://worldview.earthdata.nasa.gov/?v=${lon - 1.5},${lat - 1},${lon + 1.5},${lat + 1}&t=${d}`, t('i.worldview')),
      link(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`, t('i.osm')),
      link(`https://www.google.com/maps/@${lat},${lon},800m/data=!3m1!1e3`, 'Google Maps'),
      link(`https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=16`, 'Mapillary'),
      link(`https://www.lightningmaps.org/#m=oss;t=3;s=0;o=0;b=;ts=0;y=${lat};x=${lon};z=8;`, 'Blitze live'),
      link(`https://zoom.earth/maps/satellite/#view=${lat},${lon},9z`, 'Zoom Earth'));
  }

  // Satellitenbild-Vorschau (NASA VIIRS des gewählten Tages oder Sentinel-2 wolkenfrei)
  function satPreview(lat, lon) {
    const b = GE.geo.box(lat, lon, 30);
    const day = GE.layers.timeStamps.dailyTime();
    const srcs = {
      s2: `https://tiles.maps.eox.at/wms?service=WMS&request=GetMap&version=1.1.1&layers=s2cloudless-2024&styles=&format=image/jpeg&srs=EPSG:4326&bbox=${b.w},${b.s},${b.e},${b.n}&width=512&height=512`,
      viirs: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&STYLES=&FORMAT=image/jpeg&SRS=EPSG:4326&BBOX=${b.w},${b.s},${b.e},${b.n}&WIDTH=512&HEIGHT=512&TIME=${day}`
    };
    const img = h('img.thumb', { alt: t('i.satimg'), src: srcs.s2, loading: 'lazy' });
    const cap = h('span.hint', null, 'Sentinel-2 cloudless 2024 · 60 × 60 km');
    const seg = h('div.seg', null,
      h('button.seg-btn.is-active', { type: 'button', onclick: (e) => sw(e, 's2', 'Sentinel-2 cloudless 2024 · 60 × 60 km') }, 'Sentinel-2'),
      h('button.seg-btn', { type: 'button', onclick: (e) => sw(e, 'viirs', `NASA VIIRS · ${day} · 60 × 60 km`) }, 'VIIRS ' + day));
    function sw(e, k, c) { seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('is-active')); e.target.classList.add('is-active'); img.src = srcs[k]; cap.textContent = c; }
    return h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, seg, img, cap);
  }

  function weatherBlock(lat, lon) {
    const box = h('div', null, h('p.hint', null, t('loading')));
    GE.weather.get(lat, lon).then((w) => {
      const c = w.current;
      box.innerHTML = '';
      box.append(kv([
        [t('i.localtime'), `${fmt.time(Date.now(), w.timezone)} (${w.timezone_abbreviation || w.timezone})`],
        ['Wetter', GE.weather.label(c.weather_code)],
        ['Temp.', `${fmt.num(c.temperature_2m, 1)} °C (gefühlt ${fmt.num(c.apparent_temperature, 1)} °C)`],
        ['Wind', `${fmt.num(c.wind_speed_10m, 0)} km/h aus ${fmt.num(c.wind_direction_10m, 0)}° · Böen ${fmt.num(c.wind_gusts_10m, 0)} km/h`],
        ['Wolken', `${fmt.num(c.cloud_cover, 0)} %`],
        ['Feuchte', `${fmt.num(c.relative_humidity_2m, 0)} %`],
        ['Druck', `${fmt.num(c.pressure_msl, 0)} hPa`],
        ['Niederschl.', `${fmt.num(c.precipitation, 1)} mm`]
      ]));
    }).catch((e) => { box.innerHTML = ''; box.append(h('p.hint', null, 'Open-Meteo: ' + e.message)); });
    return box;
  }

  function camsNear(lat, lon) {
    const box = h('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const render = () => {
      box.innerHTML = '';
      const near = GE.cams.near(lat, lon, 150).slice(0, 10);
      if (near.length) box.append(h('ul.mini-list', null, near.map((c) => h('li', { onclick: () => GE.cams.open(c) }, '⧉ ', c.name, h('span.m-meta', null, `${fmt.num(c.d, 0)} km · ${c.source || ''}`)))));
      else box.append(h('p.hint', null, t('i.nocams')));
      box.append(h('div.intel-actions', null,
        h('button.btn.btn-s', { type: 'button', onclick: async () => { await GE.cams.loadWindy({ lat, lon }); render(); } }, t('i.windyhere')),
        link(`https://www.windy.com/-Webcams/webcams?${lat.toFixed(3)},${lon.toFixed(3)},11`, 'Windy-Webcamkarte'),
        link(`https://www.meteoblue.com/de/wetter/webcams/${lat.toFixed(3)}N${lon.toFixed(3)}E`, 'meteoblue Webcams')));
    };
    render();
    if (!GE.cams.openLoaded) setTimeout(render, 6000);
    return box;
  }

  function eventsNear(lat, lon) {
    const q = GE.layers.get('quakes').near(lat, lon, 500).sort((a, b) => b.time - a.time).slice(0, 6);
    const e = GE.layers.isOn('eonet') ? GE.layers.get('eonet').near(lat, lon, 500).slice(0, 6) : [];
    const fl = GE.layers.get('flights').all().filter((a) => GE.geo.distKm(lat, lon, a.lat, a.lon) < 50);
    const ul = h('ul.mini-list');
    fl.length && ul.append(h('li', null, '✈ ', t('i.flightsnear'), h('span.m-meta', null, String(fl.length))));
    q.forEach((f) => ul.append(h('li', { onclick: () => showQuake(f) }, h('span.pill.' + (f.mag >= 6 ? 'crit' : f.mag >= 4.5 ? 'warn' : 'info'), null, 'M' + (f.mag ?? 0).toFixed(1)), ' ', f.place || '', h('span.m-meta', null, fmt.ago(f.time)))));
    e.forEach(({ e: ev, p }) => ul.append(h('li', { onclick: () => showEvent(ev, p) }, h('span.pill.warn', null, ev.catTitle || ''), ' ', ev.title)));
    return ul.children.length ? ul : h('p.hint', null, t('i.noevents'));
  }

  // GDELT erlaubt eine Anfrage alle 5 Sekunden
  function newsFor(query) {
    const box = h('div', null, h('p.hint', null, t('loading')));
    const wait = Math.max(0, 5200 - (Date.now() - lastGdelt));
    setTimeout(async () => {
      lastGdelt = Date.now();
      try {
        const d = await GE.net.json(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent('"' + query + '"')}&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=3d`);
        box.innerHTML = '';
        const arts = (d && d.articles) || [];
        if (!arts.length) { box.append(h('p.hint', null, t('none'))); return; }
        box.append(h('ul.mini-list', null, arts.map((a) => h('li', null, link(a.url, a.title), h('span.m-meta', null, (a.domain || '') + ' · ' + (a.sourcecountry || ''))))));
      } catch (e) { box.innerHTML = ''; box.append(h('p.hint', null, 'GDELT: ' + e.message)); }
    }, wait);
    return box;
  }

  // ---------- Ort ----------
  async function showPlace(lat, lon, name) {
    current = { type: 'place', data: { lat, lon } };
    const box = frame(t('k.place'), name || GE.geo.toDec(lat, lon, 4), lat, lon);
    const title = box.querySelector('.intel-title');
    box.append(actions(lat, lon, name || GE.geo.toDec(lat, lon, 4), [
      h('button.btn.btn-s', { type: 'button', onclick: () => GE.alerts.zoneAround(lat, lon, name) }, t('i.zone'))
    ]));
    box.append(placeLinks(lat, lon));
    box.append(section(t('i.weather')), weatherBlock(lat, lon));
    box.append(section(t('i.satimg')), satPreview(lat, lon));
    box.append(section(t('i.nearcams')), camsNear(lat, lon));
    box.append(section(t('i.nearevents')), eventsNear(lat, lon));
    const newsSec = section(t('i.news'));
    box.append(newsSec);
    try {
      const r = await GE.net.json(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&accept-language=${GE.i18n.lang}`);
      const a = r.address || {};
      const place = a.city || a.town || a.village || a.municipality || a.county || a.state || a.country;
      if (!name) {
        title.textContent = r.display_name ? r.display_name.split(',').slice(0, 3).join(',') : GE.geo.toDec(lat, lon, 4);
        current.data.name = title.textContent;
      }
      if (a.country) box.querySelector('.intel-head').append(h('span.hint', null, [a.country, a.state].filter(Boolean).join(' · ')));
      if (place) newsSec.after(newsFor(place));
      else newsSec.after(h('p.hint', null, t('none')));
    } catch (e) {
      newsSec.after(h('p.hint', null, 'Nominatim: ' + e.message));
    }
  }

  // ---------- Flugzeug ----------
  function showFlight(a) {
    current = { type: 'flight', data: a };
    const title = a.flight || a.reg || a.hex.toUpperCase();
    const emerg = (a.emergency && a.emergency !== 'none') || ['7500', '7600', '7700'].includes(a.squawk);
    const box = frame(t('k.flight'), title, a.lat, a.lon, emerg ? h('span.pill.crit', null, 'NOTFALL · SQUAWK ' + a.squawk) : a.mil ? h('span.pill.warn', null, 'Militär') : null);
    GE.layers.get('flights').select(a.hex);
    box.append(actions(a.lat, a.lon, title, [
      h('button.btn.btn-s', { type: 'button', onclick: () => follow(a.hex) }, t('i.follow'))
    ]));
    const photo = h('div');
    box.append(photo);
    box.append(kv([
      ['ICAO-Hex', a.hex.toUpperCase()], ['Kennz.', a.reg], ['Typ', a.type], ['Höhe', a.ground ? 'am Boden' : `${fmt.num(a.alt)} ft (${fmt.num((a.alt || 0) * 0.3048)} m)`],
      ['Tempo', a.gs != null ? `${fmt.num(a.gs)} kn (${fmt.num(a.gs * 1.852)} km/h)` : null], ['Kurs', a.track != null ? fmt.num(a.track) + '°' : null],
      ['Steigrate', a.vrate != null ? `${fmt.num(a.vrate)} ft/min` : null], ['Squawk', a.squawk], ['Kategorie', a.cat]
    ]));
    const route = h('div'), acInfo = h('div');
    box.append(section('Route'), route, section('Luftfahrzeug'), acInfo);
    box.append(h('div.link-grid', null,
      link(`https://globe.adsbexchange.com/?icao=${a.hex}`, 'ADS-B Exchange'),
      link(`https://adsb.lol/?icao=${a.hex}`, 'adsb.lol'),
      a.flight ? link(`https://www.flightaware.com/live/flight/${a.flight}`, 'FlightAware') : null,
      a.flight ? link(`https://www.flightradar24.com/${a.flight}`, 'Flightradar24') : null,
      a.reg ? link(`https://www.jetphotos.com/registration/${a.reg}`, 'JetPhotos') : null));
    if (a.flight) GE.net.json(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(a.flight)}`).then((d) => {
      const r = d.response && d.response.flightroute; if (!r) { route.append(h('p.hint', null, t('none'))); return; }
      route.append(kv([['Airline', r.airline && `${r.airline.name} (${r.airline.icao})`], ['Von', r.origin && `${r.origin.municipality} – ${r.origin.name} (${r.origin.iata_code})`], ['Nach', r.destination && `${r.destination.municipality} – ${r.destination.name} (${r.destination.iata_code})`]]));
    }).catch(() => route.append(h('p.hint', null, t('none'))));
    else route.append(h('p.hint', null, t('none')));
    GE.net.json(`https://api.adsbdb.com/v0/aircraft/${a.hex}`).then((d) => {
      const x = d.response && d.response.aircraft; if (!x) { acInfo.append(h('p.hint', null, t('none'))); return; }
      acInfo.append(kv([['Hersteller', x.manufacturer], ['Modell', x.type], ['ICAO-Typ', x.icao_type], ['Halter', x.registered_owner], ['Land', x.registered_owner_country_name]]));
      if (x.url_photo_thumbnail || x.url_photo) photo.append(h('img.thumb.thumb-wide', { src: x.url_photo || x.url_photo_thumbnail, alt: title, loading: 'lazy' }));
    }).catch(() => acInfo.append(h('p.hint', null, t('none'))));
  }

  function follow(hex) {
    stopFollow();
    const step = () => { const a = GE.layers.get('flights').get(hex); if (a) GE.map.view === '3d' ? GE.map.globe.pointOfView({ lat: a.lat, lng: a.lon }, 800) : GE.map.leaflet.panTo([a.lat, a.lon]); };
    step(); followTimer = setInterval(step, 5000);
    toast(t('i.follow') + ': ' + hex.toUpperCase(), 'info', 2000);
  }
  function stopFollow() { if (followTimer) { clearInterval(followTimer); followTimer = null; } }

  // ---------- Schiff ----------
  const shipTypes = (n) => n >= 70 && n < 80 ? 'Frachter' : n >= 80 && n < 90 ? 'Tanker' : n >= 60 && n < 70 ? 'Passagierschiff' : n === 30 ? 'Fischerei' : n === 52 ? 'Schlepper' : n === 36 ? 'Segelboot' : n === 37 ? 'Sportboot' : n === 35 ? 'Militär' : n ? 'Typ ' + n : null;
  const navStatus = ['in Fahrt (Motor)', 'vor Anker', 'manövrierunfähig', 'eingeschränkt manövrierfähig', 'tiefgangbehindert', 'festgemacht', 'auf Grund', 'beim Fischen', 'in Fahrt (Segel)'];

  function showShip(s) {
    current = { type: 'ship', data: s };
    const box = frame(t('k.ship'), s.name || 'MMSI ' + s.mmsi, s.lat, s.lon);
    box.append(actions(s.lat, s.lon, s.name || String(s.mmsi)));
    box.append(kv([
      ['MMSI', s.mmsi], ['IMO', s.imo || null], ['Rufzeichen', s.callsign], ['Typ', shipTypes(s.type)], ['Status', navStatus[s.nav]],
      ['Tempo', s.sog != null ? `${fmt.num(s.sog, 1)} kn` : null], ['Kurs', s.cog != null ? fmt.num(s.cog) + '°' : null], ['Ziel', s.dest],
      ['Maße', s.dim ? `${(s.dim.A || 0) + (s.dim.B || 0)} × ${(s.dim.C || 0) + (s.dim.D || 0)} m` : null], ['Gemeldet', fmt.ago(s.ts)]
    ]));
    box.append(h('div.link-grid', null,
      link(`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${s.mmsi}`, 'MarineTraffic'),
      link(`https://www.vesselfinder.com/vessels/details/${s.mmsi}`, 'VesselFinder'),
      link(`https://www.myshiptracking.com/vessels/mmsi-${s.mmsi}`, 'MyShipTracking')));
  }

  // ---------- Erdbeben ----------
  function showQuake(f) {
    current = { type: 'quake', data: f };
    const sev = f.mag >= 6 ? 'crit' : f.mag >= 4.5 ? 'warn' : 'info';
    const box = frame(t('k.quake'), `M${(f.mag ?? 0).toFixed(1)} · ${f.place || ''}`, f.lat, f.lon, h('span.pill.' + sev, null, f.alert ? 'PAGER ' + f.alert : 'M' + (f.mag ?? 0).toFixed(1)));
    box.append(actions(f.lat, f.lon, `M${(f.mag ?? 0).toFixed(1)} ${f.place || ''}`));
    box.append(kv([['Zeit (UTC)', fmt.utc(f.time)], ['Vor', fmt.ago(f.time)], ['Tiefe', fmt.num(f.depth, 1) + ' km'], ['Tsunami', f.tsunami ? 'Hinweis aktiv' : 'nein'], ['Gespürt', f.felt ? f.felt + ' Meldungen' : null]]));
    box.append(h('div.link-grid', null, link(f.url, 'USGS-Ereignisseite'), link(`https://www.emsc-csem.org/Earthquake_map/?lat=${f.lat}&lon=${f.lon}`, 'EMSC')));
    box.append(section(t('i.nearcams')), camsNear(f.lat, f.lon));
    box.append(section(t('i.satimg')), satPreview(f.lat, f.lon));
  }

  // ---------- Naturereignis ----------
  function showEvent(e, p) {
    current = { type: 'event', data: { id: e.id, title: e.title, lat: p.lat, lon: p.lon } };
    const box = frame(t('k.event') + ' · ' + (e.catTitle || ''), e.title, p.lat, p.lon, e.closed ? h('span.pill.ok', null, 'beendet') : h('span.pill.warn', null, 'aktiv'));
    box.append(actions(p.lat, p.lon, e.title));
    box.append(kv([['Stand', fmt.utc(p.g.date)], ['Stärke', p.g.mag != null ? `${p.g.mag} ${p.g.unit || ''}` : null], ['Messpunkte', String(e.geom.length)], ['EONET-ID', e.id]]));
    box.append(h('div.link-grid', null, ...(e.sources || []).map((s) => link(s.url, s.id)), link(`https://eonet.gsfc.nasa.gov/api/v3/events/${e.id}`, 'EONET JSON')));
    box.append(section(t('i.satimg')), satPreview(p.lat, p.lon));
    box.append(section(t('i.nearcams')), camsNear(p.lat, p.lon));
  }

  // ---------- Satellit ----------
  function showSat(s, p) {
    current = { type: 'sat', data: { name: s.name, norad: s.norad } };
    const box = frame(t('k.sat'), s.name, p && p.lat, p && p.lon);
    if (p) box.append(actions(p.lat, p.lon, s.name));
    const live = h('div');
    box.append(live);
    const upd = () => {
      const q = GE.layers.get('sats').pos(s, GE.time.at() || new Date());
      if (!q) return;
      live.innerHTML = '';
      live.append(kv([['NORAD', s.norad], ['Gruppe', s.group], ['Position', GE.geo.toDec(q.lat, q.lon, 3)], ['Höhe', fmt.num(q.altKm, 0) + ' km'], ['Tempo', q.vel ? fmt.num(q.vel, 2) + ' km/s (' + fmt.num(q.vel * 3600) + ' km/h)' : null]]));
    };
    upd();
    const timer = setInterval(() => { if (!document.body.contains(live)) clearInterval(timer); else upd(); }, 2000);
    box.append(h('div.link-grid', null, link(`https://www.n2yo.com/satellite/?s=${s.norad}`, 'N2YO'), link(`https://celestrak.org/satcat/table-satcat.php?CATNR=${s.norad}`, 'CelesTrak SATCAT'), link(`https://www.heavens-above.com/SatInfo.aspx?satid=${s.norad}`, 'Heavens-Above')));
    if (/ISS/.test(s.name)) box.append(h('button.btn.btn-s', { type: 'button', onclick: () => GE.cams.open(GE.cams.byId('c-nasa')) }, 'NASA Live öffnen'));
  }

  function clear() { stopFollow(); $('#intelContent').hidden = true; $('#intelEmpty').hidden = false; }

  return { showPlace, showFlight, showShip, showQuake, showEvent, showSat, clear, satPreview };
})();
