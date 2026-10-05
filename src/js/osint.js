// OSINT-Werkzeuge: Domain, IP, Benutzername, öffentliche Person, Bild-Metadaten.
// Nur öffentliche Quellen. Keine Personenprofile, keine Umgehung von Zugriffsschutz.
GE.osint = (() => {
  const { $, $$, h, block, kv, link, toast, esc, fmt } = GE.ui;
  const t = GE.t;
  let tool = 'domain';
  const out = () => $('#osintOut');

  const placeholders = { domain: 'example.com', ip: '8.8.8.8', user: 'benutzername', person: 'Vorname Nachname', image: 'https://…/bild.jpg (optional)' };

  function setTool(name) {
    tool = name;
    $$('#osintTools .seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.tool === name));
    $('#osintInput').placeholder = placeholders[name];
    $('#imageDrop').hidden = name !== 'image';
    $('#osintHint').textContent = t('osint.hint.' + name);
  }

  function run(name, value) {
    GE.ui.showTab('osint');
    setTool(name);
    if (value != null) $('#osintInput').value = value;
    const v = $('#osintInput').value.trim();
    out().innerHTML = '';
    if (name === 'image') { if (v) imageUrl(v); return; }
    if (!v) return;
    ({ domain, ip, user, person })[name](v);
  }

  const pre = (obj) => h('pre', null, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  const loading = (title) => { const b = block(title, h('p.hint', null, t('loading'))); out().append(b); return b; };
  const fill = (b, content) => { if (b.lastChild && b.lastChild.tagName !== 'H4') b.lastChild.remove(); b.append(content); };
  const fail = (b, e) => fill(b, h('p.hint', null, `${t('error')}: ${e.message || e}`));

  // ---------- Domain ----------
  async function domain(d) {
    d = d.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    out().append(h('div.link-grid', null,
      link(`https://web.archive.org/web/*/${d}`, 'Wayback Machine'),
      link(`https://urlscan.io/search/#domain:${d}`, 'urlscan.io'),
      link(`https://www.virustotal.com/gui/domain/${d}`, 'VirusTotal'),
      link(`https://securitytrails.com/domain/${d}/dns`, 'SecurityTrails'),
      link(`https://dnsdumpster.com/`, 'DNSDumpster'),
      link(`https://www.shodan.io/search?query=hostname%3A${d}`, 'Shodan'),
      link(`https://crt.sh/?q=${d}`, 'crt.sh'),
      link(`https://builtwith.com/${d}`, 'BuiltWith')));

    const bRdap = loading('WHOIS (RDAP)');
    GE.net.json(`https://rdap.org/domain/${encodeURIComponent(d)}`).then((r) => {
      const ev = {}; (r.events || []).forEach((e) => (ev[e.eventAction] = e.eventDate));
      const registrar = (r.entities || []).find((e) => (e.roles || []).includes('registrar'));
      const regName = registrar && registrar.vcardArray && (registrar.vcardArray[1].find((x) => x[0] === 'fn') || [])[3];
      fill(bRdap, kv([
        ['Domain', r.ldhName], ['Registrar', regName], ['Registriert', ev.registration && fmt.dateTime(ev.registration)],
        ['Geändert', ev['last changed'] && fmt.dateTime(ev['last changed'])], ['Läuft ab', ev.expiration && fmt.dateTime(ev.expiration)],
        ['Status', (r.status || []).join(', ')], ['Nameserver', (r.nameservers || []).map((n) => n.ldhName).join(', ')],
        ['DNSSEC', r.secureDNS ? (r.secureDNS.delegationSigned ? 'signiert' : 'nicht signiert') : null]
      ]));
    }).catch((e) => fail(bRdap, e));

    const bDns = loading('DNS');
    const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'CAA', 'SOA'];
    Promise.all(types.map((ty) => dns(d, ty).then((a) => [ty, a]).catch(() => [ty, []]))).then((res) => {
      const lines = res.filter(([, a]) => a.length).map(([ty, a]) => `${ty.padEnd(6)} ${a.join('\n       ')}`);
      fill(bDns, pre(lines.join('\n') || t('none')));
      const firstA = (res.find(([ty]) => ty === 'A') || [, []])[1][0];
      if (firstA) bDns.querySelector('h4').append(h('button.link-btn', { type: 'button', onclick: () => run('ip', firstA) }, '→ ' + firstA));
    });

    const bCrt = loading('Subdomains (Zertifikats-Transparenz)');
    GE.net.json(`https://crt.sh/?q=%25.${encodeURIComponent(d)}&output=json`, { timeout: 45000 }).then((rows) => {
      const names = new Set();
      rows.forEach((r) => String(r.name_value).split('\n').forEach((n) => names.add(n.trim().toLowerCase())));
      const list = [...names].filter((n) => n && !n.startsWith('*')).sort();
      fill(bCrt, pre(`${list.length} Einträge\n\n` + list.slice(0, 400).join('\n')));
    }).catch((e) => fail(bCrt, e));
  }

  async function dns(name, type) {
    const r = await GE.net.json(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
    return (r.Answer || []).map((a) => a.data);
  }

  // ---------- IP ----------
  async function ip(addr) {
    out().append(h('div.link-grid', null,
      link(`https://www.shodan.io/host/${addr}`, 'Shodan'),
      link(`https://search.censys.io/hosts/${addr}`, 'Censys'),
      link(`https://www.abuseipdb.com/check/${addr}`, 'AbuseIPDB'),
      link(`https://viz.greynoise.io/ip/${addr}`, 'GreyNoise'),
      link(`https://www.virustotal.com/gui/ip-address/${addr}`, 'VirusTotal'),
      link(`https://bgp.he.net/ip/${addr}`, 'Hurricane Electric BGP')));
    const bGeo = loading('Standort & Provider');
    GE.net.json(`https://ipwho.is/${encodeURIComponent(addr)}`).then((g) => {
      if (g.success === false) throw new Error(g.message);
      fill(bGeo, kv([['IP', g.ip], ['Typ', g.type], ['Land', `${g.country} (${g.country_code})`], ['Region', g.region], ['Stadt', g.city], ['Koord.', g.latitude != null ? GE.geo.toDec(g.latitude, g.longitude, 3) : null],
        ['ASN', g.connection && `AS${g.connection.asn}`], ['Organisation', g.connection && g.connection.org], ['Provider', g.connection && g.connection.isp], ['Zeitzone', g.timezone && g.timezone.id]]));
      if (g.latitude != null) bGeo.querySelector('h4').append(h('button.link-btn', { type: 'button', onclick: () => { GE.map.flyTo(g.latitude, g.longitude, 10, addr); GE.cases.addItem({ type: 'ip', label: `IP ${addr} (${g.city || g.country})`, lat: g.latitude, lon: g.longitude }); } }, t('osint.showmap')));
      bGeo.append(h('p.hint', null, 'IP-Geolokation ist ungenau (oft nur Stadt oder Rechenzentrum des Providers).'));
    }).catch((e) => fail(bGeo, e));

    const bPtr = loading('Reverse-DNS');
    const ptrName = addr.includes(':') ? null : addr.split('.').reverse().join('.') + '.in-addr.arpa';
    if (ptrName) dns(ptrName, 'PTR').then((a) => fill(bPtr, pre(a.join('\n') || t('none')))).catch((e) => fail(bPtr, e));
    else fill(bPtr, pre('IPv6: ' + t('none')));

    const bRdap = loading('Registrierung (RDAP)');
    GE.net.json(`https://rdap.org/ip/${encodeURIComponent(addr)}`).then((r) => {
      fill(bRdap, kv([['Netz', r.handle], ['Name', r.name], ['Bereich', r.startAddress && `${r.startAddress} – ${r.endAddress}`], ['Land', r.country], ['Typ', r.type]]));
    }).catch((e) => fail(bRdap, e));
  }

  // ---------- Benutzername ----------
  // check: 'status' = 200 gefunden / 404 nicht; json/text-Funktionen für APIs; null = nur Link
  const sites = [
    ['GitHub', 'https://github.com/{u}', { api: 'https://api.github.com/users/{u}', mode: 'status' }],
    ['GitLab', 'https://gitlab.com/{u}', { api: 'https://gitlab.com/api/v4/users?username={u}', mode: 'json', ok: (d) => Array.isArray(d) && d.length > 0 }],
    ['Codeberg', 'https://codeberg.org/{u}', { api: 'https://codeberg.org/api/v1/users/{u}', mode: 'status' }],
    ['Reddit', 'https://www.reddit.com/user/{u}', { api: 'https://www.reddit.com/user/{u}/about.json', mode: 'json', ok: (d) => d && d.data && !d.data.is_suspended }],
    ['Hacker News', 'https://news.ycombinator.com/user?id={u}', { api: 'https://hacker-news.firebaseio.com/v0/user/{u}.json', mode: 'json', ok: (d) => !!d }],
    ['Keybase', 'https://keybase.io/{u}', { api: 'https://keybase.io/_/api/1.0/user/lookup.json?usernames={u}', mode: 'json', ok: (d) => d.them && d.them[0] }],
    ['Mastodon.social', 'https://mastodon.social/@{u}', { api: 'https://mastodon.social/api/v1/accounts/lookup?acct={u}', mode: 'status' }],
    ['Bluesky', 'https://bsky.app/profile/{u}.bsky.social', { api: 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={u}.bsky.social', mode: 'status' }],
    ['dev.to', 'https://dev.to/{u}', { api: 'https://dev.to/api/users/by_username?url={u}', mode: 'status' }],
    ['Docker Hub', 'https://hub.docker.com/u/{u}', { api: 'https://hub.docker.com/v2/users/{u}', mode: 'status' }],
    ['npm', 'https://www.npmjs.com/~{u}', { api: 'https://registry.npmjs.org/-/user/org.couchdb.user:{u}', mode: 'status' }],
    ['PyPI', 'https://pypi.org/user/{u}/', { api: 'https://pypi.org/user/{u}/', mode: 'status' }],
    ['Chess.com', 'https://www.chess.com/member/{u}', { api: 'https://api.chess.com/pub/player/{u}', mode: 'status' }],
    ['Lichess', 'https://lichess.org/@/{u}', { api: 'https://lichess.org/api/user/{u}', mode: 'status' }],
    ['Duolingo', 'https://www.duolingo.com/profile/{u}', { api: 'https://www.duolingo.com/2017-06-30/users?username={u}', mode: 'json', ok: (d) => d.users && d.users.length > 0 }],
    ['Gravatar', 'https://gravatar.com/{u}', { api: 'https://en.gravatar.com/{u}.json', mode: 'status' }],
    ['Telegram', 'https://t.me/{u}', { api: 'https://t.me/{u}', mode: 'text', ok: (s) => /tgme_page_title/.test(s) }],
    ['Steam', 'https://steamcommunity.com/id/{u}', { api: 'https://steamcommunity.com/id/{u}', mode: 'text', ok: (s) => !/The specified profile could not be found/.test(s) }],
    ['YouTube', 'https://www.youtube.com/@{u}', { api: 'https://www.youtube.com/@{u}', mode: 'status' }],
    ['SoundCloud', 'https://soundcloud.com/{u}', { api: 'https://soundcloud.com/{u}', mode: 'status' }],
    ['Vimeo', 'https://vimeo.com/{u}', { api: 'https://vimeo.com/{u}', mode: 'status' }],
    ['Linktree', 'https://linktr.ee/{u}', { api: 'https://linktr.ee/{u}', mode: 'status' }],
    ['Patreon', 'https://www.patreon.com/{u}', { api: 'https://www.patreon.com/{u}', mode: 'status' }],
    ['Medium', 'https://medium.com/@{u}', { api: 'https://medium.com/@{u}', mode: 'status' }],
    ['Twitch', 'https://www.twitch.tv/{u}', null],
    ['X / Twitter', 'https://x.com/{u}', null],
    ['Instagram', 'https://www.instagram.com/{u}/', null],
    ['TikTok', 'https://www.tiktok.com/@{u}', null],
    ['Facebook', 'https://www.facebook.com/{u}', null],
    ['Pinterest', 'https://www.pinterest.com/{u}/', null],
    ['Snapchat', 'https://www.snapchat.com/add/{u}', null],
    ['Threads', 'https://www.threads.net/@{u}', null]
  ];

  async function checkSite(check, u) {
    if (!check || !GE.net.desktop) return 'unknown';
    const url = check.api.replace(/\{u\}/g, encodeURIComponent(u));
    try {
      if (check.mode === 'status') {
        const r = await GE.net.raw(url, { type: 'status', timeout: 12000 });
        if (r.status === 200) return 'found';
        if (r.status === 404 || r.status === 410 || r.status === 400) return 'missing';
        return 'unknown';
      }
      if (check.mode === 'json') return check.ok(await GE.net.json(url, { timeout: 12000 })) ? 'found' : 'missing';
      if (check.mode === 'text') return check.ok(await GE.net.text(url, { timeout: 12000 })) ? 'found' : 'missing';
    } catch (e) { return e.status === 404 ? 'missing' : 'unknown'; }
    return 'unknown';
  }

  async function user(u) {
    u = u.replace(/^@/, '').trim();
    if (!/^[\w.-]{1,40}$/.test(u)) { out().append(h('p.hint', null, 'Ungültiger Benutzername.')); return; }
    if (!GE.net.desktop) out().append(h('p.hint', null, t('osint.browser')));
    const grid = h('div.user-grid');
    const counter = h('span.mono', null, '0/' + sites.length);
    out().append(block(`@${u}`, grid, counter));
    const cells = sites.map(([name, profile, check]) => {
      const a = h('a.user-hit', { href: profile.replace(/\{u\}/g, encodeURIComponent(u)), target: '_blank', rel: 'noopener noreferrer' }, h('i.dot'), h('span', null, name));
      grid.append(a);
      return { a, check };
    });
    let done = 0, found = 0;
    // max. 6 gleichzeitige Prüfungen
    const queue = cells.slice();
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const c = queue.shift();
        const st = await checkSite(c.check, u);
        c.a.classList.add(st);
        if (st === 'found') found++;
        counter.textContent = `${++done}/${sites.length} · ${found} gefunden`;
      }
    }));
    GE.cases.addItem({ type: 'user', label: `Benutzername @${u}: ${found} Treffer` }, true);
  }

  // ---------- Öffentliche Person ----------
  async function person(name) {
    const q = encodeURIComponent(name), qq = encodeURIComponent('"' + name + '"');
    out().append(h('p.hint', null, t('osint.hint.person')));
    out().append(block('Suchlinks', h('div.link-grid', null,
      link(`https://www.google.com/search?q=${qq}`, 'Google'),
      link(`https://www.bing.com/search?q=${qq}`, 'Bing'),
      link(`https://duckduckgo.com/?q=${qq}`, 'DuckDuckGo'),
      link(`https://news.google.com/search?q=${qq}`, 'Google News'),
      link(`https://scholar.google.com/scholar?q=${qq}`, 'Google Scholar'),
      link(`https://www.google.com/search?q=${qq}+site%3Alinkedin.com%2Fin`, 'LinkedIn (über Google)'),
      link(`https://www.google.com/search?q=${qq}+site%3Axing.com`, 'XING (über Google)'),
      link(`https://www.northdata.de/${q}`, 'North Data (Firmen)'),
      link(`https://www.wikidata.org/w/index.php?search=${q}`, 'Wikidata'))));
    const bWiki = loading('Wikipedia');
    const lang = GE.i18n.lang;
    GE.net.json(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=5&origin=*`).then(async (d) => {
      const hits = (d.query && d.query.search) || [];
      if (!hits.length) { fill(bWiki, h('p.hint', null, t('none'))); return; }
      const top = hits[0];
      const sum = await GE.net.json(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.title)}`).catch(() => null);
      const wrap = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
      if (sum) {
        if (sum.thumbnail) wrap.append(h('img.thumb', { src: sum.thumbnail.source, alt: sum.title, style: 'max-width:140px;aspect-ratio:auto' }));
        wrap.append(h('strong', null, sum.title), h('span.hint', null, sum.description || ''), h('p', { style: 'margin:0' }, sum.extract || ''), link(sum.content_urls && sum.content_urls.desktop.page, 'Wikipedia'));
        if (sum.coordinates) wrap.append(h('button.btn.btn-s', { type: 'button', onclick: () => GE.map.flyTo(sum.coordinates.lat, sum.coordinates.lon, 10, sum.title) }, t('osint.showmap')));
      }
      if (hits.length > 1) wrap.append(h('ul.mini-list', null, hits.slice(1).map((x) => h('li', null, link(`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(x.title)}`, x.title)))));
      fill(bWiki, wrap);
    }).catch((e) => fail(bWiki, e));
  }

  // ---------- Bild ----------
  function reverseLinks(url) {
    const u = url ? encodeURIComponent(url) : null;
    return h('div.link-grid', null,
      link(u ? `https://lens.google.com/uploadbyurl?url=${u}` : 'https://lens.google.com/', 'Google Lens'),
      link(u ? `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${u}` : 'https://www.bing.com/visualsearch', 'Bing Visual'),
      link(u ? `https://yandex.com/images/search?rpt=imageview&url=${u}` : 'https://yandex.com/images/', 'Yandex'),
      link(u ? `https://tineye.com/search?url=${u}` : 'https://tineye.com/', 'TinEye'),
      link('https://fotoforensics.com/', 'FotoForensics'));
  }

  async function imageFile(file) {
    out().innerHTML = '';
    const url = URL.createObjectURL(file);
    out().append(h('img.thumb.thumb-wide', { src: url, alt: file.name, style: 'object-fit:contain' }));
    const buf = await file.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map((b) => b.toString(16).padStart(2, '0')).join('');
    out().append(block('Datei', kv([['Name', file.name], ['Größe', fmt.num(file.size / 1024, 1) + ' KB'], ['Typ', file.type], ['SHA-256', hash]])));
    await exifBlock(buf);
    out().append(block('Rückwärts-Bildersuche (Bild dort hochladen)', reverseLinks(null)));
  }

  async function imageUrl(u) {
    out().append(h('img.thumb.thumb-wide', { src: u, alt: 'Bild', style: 'object-fit:contain' }));
    out().append(block('Rückwärts-Bildersuche', reverseLinks(u)));
    try {
      const dataUrl = await GE.net.dataUrl(u);
      const bin = atob(dataUrl.split(',')[1]);
      const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      await exifBlock(buf.buffer);
    } catch (e) { out().append(h('p.hint', null, 'EXIF: ' + e.message)); }
  }

  async function exifBlock(buf) {
    let ex = null;
    try { ex = await exifr.parse(buf, { tiff: true, exif: true, gps: true, ifd0: true, xmp: false, translateValues: true, reviveValues: true }); } catch (_) { ex = null; }
    if (!ex) { out().append(block('EXIF', h('p.hint', null, t('osint.noexif')))); return; }
    const keys = ['Make', 'Model', 'LensModel', 'DateTimeOriginal', 'CreateDate', 'ModifyDate', 'Software', 'Artist', 'Copyright', 'ExposureTime', 'FNumber', 'ISO', 'FocalLength', 'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight', 'Orientation', 'GPSAltitude', 'GPSImgDirection'];
    const rows = keys.filter((k) => ex[k] != null).map((k) => [k, ex[k] instanceof Date ? fmt.dateTime(ex[k]) : String(ex[k])]);
    out().append(block('EXIF', kv(rows)));
    if (ex.latitude != null && ex.longitude != null) {
      const lat = ex.latitude, lon = ex.longitude;
      const b = block(t('osint.gps'), kv([['Position', GE.geo.toDec(lat, lon, 6)], ['DMS', GE.geo.toDms(lat, lon)]]));
      b.append(h('div.intel-actions', null,
        h('button.btn.btn-s.btn-accent', { type: 'button', onclick: () => { GE.map.flyTo(lat, lon, 15, 'EXIF-GPS'); GE.intel.showPlace(lat, lon); } }, t('osint.showmap')),
        h('button.btn.btn-s', { type: 'button', onclick: () => GE.cases.addItem({ type: 'image', label: 'Bild-GPS ' + GE.geo.toDec(lat, lon, 4), lat, lon }) }, t('i.pin'))));
      out().append(b);
    }
  }

  function init() {
    $$('#osintTools .seg-btn').forEach((b) => b.addEventListener('click', () => { setTool(b.dataset.tool); out().innerHTML = ''; }));
    $('#osintForm').addEventListener('submit', (e) => { e.preventDefault(); run(tool); });
    $('#imageInput').addEventListener('change', (e) => e.target.files[0] && imageFile(e.target.files[0]));
    const drop = $('#imageDrop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); const f = e.dataTransfer.files[0]; if (f) imageFile(f); });
    setTool('domain');
    GE.i18n.onChange(() => setTool(tool));
  }

  return { init, run };
})();
