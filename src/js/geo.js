// Geo-Helfer: Entfernungen, Koordinaten-Formate, Parsen von Eingaben.
GE.geo = (() => {
  const R = 6371; // Erdradius km
  const rad = (d) => d * Math.PI / 180;

  function distKm(a, b, c, d) {
    const dLat = rad(c - a), dLon = rad(d - b);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function dms(v, pos, neg) {
    const a = Math.abs(v);
    const d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d - m / 60) * 3600).toFixed(1);
    return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(4, '0')}″${v >= 0 ? pos : neg}`;
  }
  const toDms = (lat, lon) => `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`;
  const toDec = (lat, lon, d = 5) => `${lat.toFixed(d)}, ${lon.toFixed(d)}`;

  // Erkennt "52.52, 13.40", "52.52 13.40" und "52°31'12"N 13°24'18"E"
  function parse(str) {
    const s = String(str).trim();
    let m = s.match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
    if (m) {
      const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
    const re = /(\d{1,3})[°\s]+(\d{1,2})?['′\s]*(\d{1,2}(?:[.,]\d+)?)?["″\s]*([NSEWO])/gi;
    const parts = [...s.matchAll(re)];
    if (parts.length === 2) {
      const conv = (p) => {
        let v = +p[1] + (+(p[2] || 0)) / 60 + (+(String(p[3] || 0).replace(',', '.'))) / 3600;
        if (/[SW]/i.test(p[4])) v = -v;
        return { v, axis: /[NS]/i.test(p[4]) ? 'lat' : 'lon' };
      };
      const a = conv(parts[0]), b = conv(parts[1]);
      const lat = a.axis === 'lat' ? a.v : b.v, lon = a.axis === 'lat' ? b.v : a.v;
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
    return null;
  }

  // Quadrat um einen Punkt (für WMS-Vorschaubilder)
  function box(lat, lon, km) {
    const dLat = km / 111;
    const dLon = km / (111 * Math.max(Math.cos(rad(lat)), 0.05));
    return { s: lat - dLat, n: lat + dLat, w: lon - dLon, e: lon + dLon };
  }

  return { distKm, toDms, toDec, parse, box };
})();
