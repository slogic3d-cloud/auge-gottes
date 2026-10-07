// Universalsuche: erkennt automatisch, was eingegeben wurde, und schlägt passende Aktionen vor.
GE.search = (() => {
  const { $, h, toast, esc } = GE.ui;
  const t = GE.t;
  let sel = -1, results = [];

  const re = {
    ipv4: /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/,
    ipv6: /^[0-9a-f:]{3,39}$/i,
    domain: /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/i,
    user: /^@[\w.-]{1,40}$/,
    mmsi: /^\d{9}$/,
    flight: /^[A-Z]{2,3}\d{1,4}[A-Z]?$/i,
    hex: /^[0-9a-f]{6}$/i,
    reg: /^([A-Z]{1,2}-[A-Z0-9]{3,5}|N\d{1,5}[A-Z]{0,2})$/i
  };

  function item(type, main, sub, act) { return { type, main, sub, act }; }

  async function suggest(q) {
    const out = [];
    const c = GE.geo.parse(q);
    if (c) out.push(item('Koord.', GE.geo.toDec(c.lat, c.lon, 5), GE.geo.toDms(c.lat, c.lon), () => { GE.map.flyTo(c.lat, c.lon, 12); GE.intel.showPlace(c.lat, c.lon); }));
    if (re.ipv4.test(q) || (q.includes(':') && re.ipv6.test(q))) out.push(item('IP', q, 'Standort, ASN, Reverse-DNS', () => GE.osint.run('ip', q)));
    if (re.domain.test(q)) out.push(item('Domain', q, 'WHOIS, DNS, Subdomains', () => GE.osint.run('domain', q)));
    if (re.user.test(q)) out.push(item('User', q, 'Profile auf ~30 Plattformen prüfen', () => GE.osint.run('user', q)));
    if (re.flight.test(q)) out.push(item('Flug', q.toUpperCase(), 'Live-Position (adsb.lol)', () => findFlight('callsign', q.toUpperCase())));
    if (re.reg.test(q)) out.push(item('Kennz.', q.toUpperCase(), 'Luftfahrzeug-Kennzeichen', () => findFlight('reg', q.toUpperCase())));
    if (re.hex.test(q) && !/^\d+$/.test(q)) out.push(item('ICAO', q.toLowerCase(), 'ICAO-24-Bit-Adresse', () => findFlight('hex', q.toLowerCase())));
    if (re.mmsi.test(q)) out.push(item('Schiff', 'MMSI ' + q, 'aktive AIS-Daten', () => findShip(q)));
    // Satelliten im geladenen Katalog
    const sats = GE.layers.get('sats').find ? GE.layers.get('sats').find(q).slice(0, 3) : [];
    sats.forEach((s) => out.push(item('Satellit', s.name, 'NORAD ' + s.norad, () => { if (!GE.layers.isOn('sats')) GE.layers.enable('sats'); const p = GE.layers.get('sats').pos(s, GE.time.at() || new Date()); GE.layers.get('sats').select(s); GE.map.flyTo(p.lat, p.lon, 4, s.name); GE.intel.showSat(s, p); })));
    // Schiffe nach Name
    if (GE.layers.isOn('ships') && q.length > 2) GE.layers.get('ships').find(q).slice(0, 3).forEach((s) => out.push(item('Schiff', s.name || s.mmsi, 'MMSI ' + s.mmsi, () => { GE.map.flyTo(s.lat, s.lon, 11, s.name); GE.intel.showShip(s); })));
    // Kameras
    GE.cams.list().filter((x) => x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 3).forEach((x) => out.push(item('Kamera', x.name, x.source, () => GE.cams.open(x))));
    // Freitext: Ort, Person, Benutzername
    if (!c && !re.ipv4.test(q) && q.length > 2) {
      try {
        const places = await GE.net.json(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&accept-language=${GE.i18n.lang}`);
        places.forEach((p) => out.push(item('Ort', p.display_name.split(',').slice(0, 2).join(','), p.display_name.split(',').slice(2).join(',').trim() || p.type, () => {
          const lat = +p.lat, lon = +p.lon;
          const z = p.boundingbox ? Math.max(4, Math.min(16, Math.round(14 - Math.log2(Math.max(0.01, Math.abs(p.boundingbox[1] - p.boundingbox[0])) * 50)))) : 12;
          GE.map.flyTo(lat, lon, z, p.display_name.split(',')[0]);
          GE.intel.showPlace(lat, lon, p.display_name.split(',').slice(0, 2).join(','));
        })));
      } catch (_) {}
      if (/^[\p{L}][\p{L}.' -]+\s[\p{L}.' -]+$/u.test(q)) out.push(item('Person', q, 'Öffentliche Person: Wikipedia + Suchlinks', () => GE.osint.run('person', q)));
      if (/^[\w.-]{3,40}$/.test(q) && !re.domain.test(q)) out.push(item('User', '@' + q, 'Als Benutzername prüfen', () => GE.osint.run('user', q)));
    }
    return out;
  }

  async function findFlight(kind, v) {
    try {
      const d = await GE.net.json(`https://api.adsb.lol/v2/${kind}/${encodeURIComponent(v)}`);
      const a = (d.ac || []).find((x) => x.lat != null);
      if (!a) {
        toast(`${v}: ${t('none')}`, 'warn');
        if (kind === 'callsign') { const r = await GE.net.json(`https://api.adsbdb.com/v0/callsign/${v}`).catch(() => null); const fr = r && r.response && r.response.flightroute; if (fr) toast(`${v}: ${fr.origin.iata_code} → ${fr.destination.iata_code} (${fr.airline.name}) – gerade nicht in der Luft`, 'info', 7000); }
        return;
      }
      if (!GE.layers.isOn('flights')) await GE.layers.enable('flights');
      const ac = { hex: a.hex, flight: (a.flight || '').trim(), reg: a.r, type: a.t, lat: a.lat, lon: a.lon, alt: a.alt_baro === 'ground' ? 0 : a.alt_baro, ground: a.alt_baro === 'ground', gs: a.gs, track: a.track, squawk: a.squawk, cat: a.category, emergency: a.emergency, vrate: a.baro_rate };
      GE.map.flyTo(ac.lat, ac.lon, 8, ac.flight || ac.hex);
      GE.intel.showFlight(ac);
    } catch (e) { toast('adsb.lol: ' + e.message, 'crit'); }
  }

  function findShip(mmsi) {
    const s = GE.layers.get('ships').find(mmsi)[0];
    if (s) { GE.map.flyTo(s.lat, s.lon, 11, s.name); GE.intel.showShip(s); return; }
    toast(`MMSI ${mmsi}: nicht im aktuellen AIS-Ausschnitt. Öffne externe Suche.`, 'info');
    window.open(`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`, '_blank');
  }

  function render() {
    const box = $('#searchResults');
    box.innerHTML = '';
    if (!results.length) { box.hidden = true; return; }
    results.forEach((r, i) => {
      box.append(h('button.sr-item' + (i === sel ? '.is-sel' : ''), { type: 'button', onclick: () => choose(i) },
        h('span.sr-type', null, r.type), h('span.sr-main', null, r.main, ' ', h('span.sr-sub', null, r.sub || ''))));
    });
    box.hidden = false;
  }

  function choose(i) {
    const r = results[i]; if (!r) return;
    $('#searchResults').hidden = true;
    $('#searchInput').blur();
    r.act();
  }

  let seq = 0;
  const update = GE.ui.debounce(async () => {
    const q = $('#searchInput').value.trim();
    if (!q) { results = []; render(); return; }
    const my = ++seq;
    const r = await suggest(q);
    if (my !== seq) return;
    results = r; sel = 0; render();
  }, 350);

  function init() {
    const inp = $('#searchInput');
    inp.addEventListener('input', update);
    inp.addEventListener('keydown', async (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(results.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (!results.length) { results = await suggest(inp.value.trim()); sel = 0; }
        choose(Math.max(0, sel));
      } else if (e.key === 'Escape') { $('#searchResults').hidden = true; inp.blur(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#searchResults').hidden = true; });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); inp.select(); }
    });
  }

  return { init, suggest };
})();
