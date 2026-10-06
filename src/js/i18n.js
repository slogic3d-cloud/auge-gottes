// Zweisprachigkeit DE/EN. Statische Texte über data-i18n, dynamische über GE.t('schlüssel').
window.GE = window.GE || {};

GE.i18n = (() => {
  const dict = {
    de: {
      'brand.sub': 'Offenes Lagebild · OSINT',
      'search.placeholder': 'Ort, Koordinaten, Flug (DLH400), MMSI, Domain, IP, @Benutzername, Name …',
      'preset.custom': 'Eigene Auswahl', 'preset.overview': 'Weltlage', 'preset.air': 'Luftraum', 'preset.sea': 'Seeverkehr',
      'preset.disaster': 'Katastrophen', 'preset.space': 'Orbit', 'preset.cams': 'Kameras',
      'btn.windows': 'Fenster', 'btn.wall': 'Video-Wand', 'btn.settings': 'Einstellungen',
      'layers.title': 'Ebenen', 'layers.alloff': 'Alle aus',
      'lg.base': 'Basiskarte', 'lg.sat': 'Satellit', 'lg.weather': 'Wetter', 'lg.track': 'Live-Tracker', 'lg.events': 'Ereignisse', 'lg.own': 'Eigene',
      'hud.cursor': 'Fadenkreuz', 'hud.mode': 'Zeitmodus',
      'tab.intel': 'Ziel', 'tab.osint': 'OSINT', 'tab.cams': 'Kameras', 'tab.cases': 'Fälle', 'tab.alerts': 'Alarme',
      'intel.empty': 'Klick auf einen Ort, ein Flugzeug, Schiff oder Ereignis. Hier erscheinen Ortsinfos, Wetter, nahe Kameras, Satellitenbild und Ereignisse in der Umgebung.',
      'osint.user': 'Benutzer', 'osint.person': 'Person', 'osint.image': 'Bild', 'osint.run': 'Abfragen',
      'osint.drop': 'Bild hierher ziehen oder auswählen – EXIF, GPS und Rückwärtssuche',
      'cams.filter': 'Kameras filtern …', 'cams.all': 'Alle', 'cams.city': 'Stadt', 'cams.traffic': 'Verkehr', 'cams.nature': 'Natur/Wetter', 'cams.space': 'Weltraum', 'cams.fav': 'Favoriten',
      'cams.loadapi': 'Verkehrskameras laden (TfL, NYC)', 'cams.loadwindy': 'Windy-Webcams im Ausschnitt', 'cams.add': '+ Eigene Kamera', 'cams.import': 'Import', 'cams.export': 'Export',
      'cams.f.name': 'Name', 'cams.f.url': 'YouTube-Link, Bild-URL (JPG) oder Video-URL (MP4)', 'cams.f.cat': 'Kategorie',
      'common.save': 'Speichern', 'common.cancel': 'Abbrechen', 'common.close': 'Schließen',
      'cases.new': '+ Fall', 'cases.placeholder': 'Notizen, Quellen, Beobachtungen …', 'cases.pin': 'Kartenausschnitt anheften', 'cases.shot': 'Screenshot',
      'cases.pdf': 'PDF-Bericht', 'cases.export': 'Alles exportieren (JSON)', 'cases.items': 'Funde & Anheftungen', 'cases.favs': 'Favoriten-Orte',
      'alerts.quake': 'Erdbeben-Alarm ab Magnitude', 'alerts.keywords': 'Stichwörter für News-Alarm (Komma-getrennt)', 'alerts.addzone': '+ Geofence-Zone zeichnen',
      'alerts.clear': 'Liste leeren', 'alerts.zones': 'Zonen', 'alerts.log': 'Ereignisprotokoll',
      'geofence.hint': 'Zwei Ecken auf der 2D-Karte anklicken, um eine Zone zu zeichnen · Esc bricht ab',
      'ticker.tag': 'LAGE',
      'wall.title': 'Video-Wand', 'wall.cols': 'Spalten', 'wall.rows': 'Zeilen', 'wall.fill': 'Mit Kameras füllen', 'wall.clear': 'Leeren',
      'settings.title': 'Einstellungen', 'settings.look': 'Darstellung', 'settings.scanfx': 'Scan- und Zoom-Animationen', 'settings.storage': 'Speichern',
      'settings.persist': 'Daten lokal speichern (Favoriten, Fälle, Kameras, Keys, Einstellungen)',
      'settings.persisthint': 'Aus: Nichts wird gespeichert, alles ist nach dem Schließen weg. An: Alles bleibt lokal auf diesem Rechner.',
      'settings.wipe': 'Alle gespeicherten Daten löschen', 'settings.keys': 'API-Schlüssel (kostenlos)',
      'settings.keyhint': 'Ohne Schlüssel funktionieren: Flüge, Erdbeben, NASA-Satellit, Wettersatellit, Regenradar, Satelliten-Tracking, Verkehrskameras, News und alle OSINT-Werkzeuge.',
      'settings.legal': 'Rechtliches',
      'settings.legaltext': "GOD'S EYE nutzt nur öffentlich zugängliche, offizielle Datenquellen und Kameras, die von ihren Betreibern freigegeben sind. Keine Zugriffe auf ungeschützte private Kameras, keine Personenprofile. Beachte die Nutzungsbedingungen der Quellen und die DSGVO.",
      // dynamisch
      'live': 'LIVE', 'replay': 'RÜCKBLICK', 'loading': 'Lädt …', 'error': 'Fehler', 'none': 'Keine Daten',
      'k.place': 'Ort', 'k.flight': 'Flug', 'k.ship': 'Schiff', 'k.quake': 'Erdbeben', 'k.event': 'Naturereignis', 'k.sat': 'Satellit', 'k.cam': 'Kamera', 'k.ip': 'IP-Adresse',
      'i.weather': 'Wetter vor Ort', 'i.localtime': 'Ortszeit', 'i.satimg': 'Satellitenbild', 'i.nearcams': 'Kameras in der Nähe', 'i.nearevents': 'Ereignisse in der Nähe',
      'i.news': 'Nachrichten zu diesem Ort', 'i.nocams': 'Keine Kamera im Umkreis von 150 km.', 'i.noevents': 'Keine Erdbeben oder Naturereignisse im Umkreis von 500 km.',
      'i.flightsnear': 'Flugzeuge im Umkreis 50 km', 'i.fav': '★ Favorit', 'i.pin': 'An Fall anheften', 'i.zoom': 'Heranzoomen', 'i.zone': 'Zone hier', 'i.copernicus': 'Copernicus Browser',
      'i.worldview': 'NASA Worldview', 'i.osm': 'OpenStreetMap', 'i.track': 'Spur anzeigen', 'i.follow': 'Verfolgen', 'i.orbit': 'Umlaufbahn',
      'toast.saved': 'Gespeichert', 'toast.pinned': 'An Fall angeheftet', 'toast.fav': 'Als Favorit gespeichert', 'toast.nokey': 'Für diese Quelle fehlt ein API-Schlüssel (Einstellungen).',
      'toast.electron': 'Diese Funktion braucht die Desktop-App (Electron).', 'toast.persistoff': 'Speichern ist aus – Daten gehen beim Schließen verloren.',
      'toast.zone': 'Zone gespeichert', 'toast.camsloaded': '{n} Kameras geladen', 'toast.norecord': 'Für diesen Zeitpunkt gibt es keine Flugaufzeichnung. Flugdaten werden ab App-Start mitgeschnitten.',
      'cams.count': '{n} Kameras', 'cams.open': 'Im Fenster öffnen', 'cams.towall': 'Auf Video-Wand', 'cams.goto': 'Auf Karte zeigen',
      'wall.empty': 'Kamera hierher ziehen', 'cam.offline': 'Dieser Kanal sendet gerade nicht live.', 'cam.snapshot': 'Snapshot', 'cam.err': 'Stream nicht erreichbar. Manche Betreiber erlauben keine Einbettung – Link im Browser öffnen.',
      'case.default': 'Allgemein', 'case.newname': 'Fall {n}', 'case.noitems': 'Noch nichts angeheftet.', 'case.nofav': 'Noch keine Favoriten.',
      'alert.quake': 'Erdbeben M{m} – {place}', 'alert.zone': '{what} hat Zone „{zone}“ betreten', 'alert.news': 'Stichwort „{kw}“: {title}',
      'alert.none': 'Noch keine Alarme.', 'zone.none': 'Keine Zonen.', 'zone.name': 'Zone {n}',
      'osint.hint.domain': 'WHOIS (RDAP), DNS-Einträge, Zertifikats-Transparenz (Subdomains) und weiterführende Links.',
      'osint.hint.ip': 'Standort, Provider/ASN, Reverse-DNS und Registrierungsdaten der IP.',
      'osint.hint.user': 'Prüft öffentliche Profile auf ~30 Plattformen. Grün = gefunden, grau = nicht gefunden, gelb = nicht prüfbar (Link öffnen).',
      'osint.hint.person': 'Nur für öffentliche Personen und eigene Recherchen: Wikipedia/Wikidata-Treffer plus gezielte Suchlinks. Keine Personenprofile, Privatsphäre respektieren.',
      'osint.hint.image': 'EXIF-Metadaten und GPS werden nur lokal ausgelesen. Für die Rückwärtssuche öffnet sich der jeweilige Dienst.',
      'osint.browser': 'Im Browser-Modus nicht prüfbar – Link öffnen. In der Desktop-App wird automatisch geprüft.',
      'osint.noexif': 'Keine EXIF-Daten gefunden (oft von Messengern/Plattformen entfernt).', 'osint.gps': 'GPS-Position gefunden', 'osint.showmap': 'Auf Karte zeigen',
      'src.flights': 'Flüge', 'src.ships': 'Schiffe', 'src.sats': 'Satelliten', 'src.quakes': 'Beben', 'src.eonet': 'EONET', 'src.radar': 'Radar', 'src.news': 'News', 'src.gibs': 'GIBS',
      'cnt.flights': 'Flüge', 'cnt.ships': 'Schiffe', 'cnt.quakes': 'Beben 24h', 'cnt.events': 'Ereignisse', 'cnt.sats': 'Satelliten'
    },
    en: {
      'brand.sub': 'Open situational picture · OSINT',
      'search.placeholder': 'Place, coordinates, flight (DLH400), MMSI, domain, IP, @username, name …',
      'preset.custom': 'Custom', 'preset.overview': 'World', 'preset.air': 'Airspace', 'preset.sea': 'Maritime',
      'preset.disaster': 'Disasters', 'preset.space': 'Orbit', 'preset.cams': 'Cameras',
      'btn.windows': 'Windows', 'btn.wall': 'Video wall', 'btn.settings': 'Settings',
      'layers.title': 'Layers', 'layers.alloff': 'All off',
      'lg.base': 'Base map', 'lg.sat': 'Satellite', 'lg.weather': 'Weather', 'lg.track': 'Live trackers', 'lg.events': 'Events', 'lg.own': 'Own',
      'hud.cursor': 'Crosshair', 'hud.mode': 'Time mode',
      'tab.intel': 'Target', 'tab.osint': 'OSINT', 'tab.cams': 'Cameras', 'tab.cases': 'Cases', 'tab.alerts': 'Alerts',
      'intel.empty': 'Click a place, aircraft, ship or event. Location info, weather, nearby cameras, satellite image and nearby events appear here.',
      'osint.user': 'User', 'osint.person': 'Person', 'osint.image': 'Image', 'osint.run': 'Run',
      'osint.drop': 'Drop or choose an image – EXIF, GPS and reverse search',
      'cams.filter': 'Filter cameras …', 'cams.all': 'All', 'cams.city': 'City', 'cams.traffic': 'Traffic', 'cams.nature': 'Nature/Weather', 'cams.space': 'Space', 'cams.fav': 'Favourites',
      'cams.loadapi': 'Load traffic cams (TfL, NYC)', 'cams.loadwindy': 'Windy webcams in view', 'cams.add': '+ Own camera', 'cams.import': 'Import', 'cams.export': 'Export',
      'cams.f.name': 'Name', 'cams.f.url': 'YouTube link, image URL (JPG) or video URL (MP4)', 'cams.f.cat': 'Category',
      'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close',
      'cases.new': '+ Case', 'cases.placeholder': 'Notes, sources, observations …', 'cases.pin': 'Pin map view', 'cases.shot': 'Screenshot',
      'cases.pdf': 'PDF report', 'cases.export': 'Export all (JSON)', 'cases.items': 'Findings & pins', 'cases.favs': 'Favourite places',
      'alerts.quake': 'Earthquake alert from magnitude', 'alerts.keywords': 'News alert keywords (comma separated)', 'alerts.addzone': '+ Draw geofence zone',
      'alerts.clear': 'Clear list', 'alerts.zones': 'Zones', 'alerts.log': 'Event log',
      'geofence.hint': 'Click two corners on the 2D map to draw a zone · Esc cancels',
      'ticker.tag': 'BRIEF',
      'wall.title': 'Video wall', 'wall.cols': 'Columns', 'wall.rows': 'Rows', 'wall.fill': 'Fill with cameras', 'wall.clear': 'Clear',
      'settings.title': 'Settings', 'settings.look': 'Appearance', 'settings.scanfx': 'Scan and zoom animations', 'settings.storage': 'Storage',
      'settings.persist': 'Store data locally (favourites, cases, cameras, keys, settings)',
      'settings.persisthint': 'Off: nothing is stored, everything is gone after closing. On: everything stays local on this computer.',
      'settings.wipe': 'Delete all stored data', 'settings.keys': 'API keys (free)',
      'settings.keyhint': 'Without keys you get: flights, earthquakes, NASA imagery, weather satellite, rain radar, satellite tracking, traffic cams, news and all OSINT tools.',
      'settings.legal': 'Legal',
      'settings.legaltext': "GOD'S EYE only uses publicly accessible, official data sources and cameras published by their operators. No access to unsecured private cameras, no profiling of people. Respect each source's terms and the GDPR.",
      'live': 'LIVE', 'replay': 'REPLAY', 'loading': 'Loading …', 'error': 'Error', 'none': 'No data',
      'k.place': 'Place', 'k.flight': 'Flight', 'k.ship': 'Ship', 'k.quake': 'Earthquake', 'k.event': 'Natural event', 'k.sat': 'Satellite', 'k.cam': 'Camera', 'k.ip': 'IP address',
      'i.weather': 'Local weather', 'i.localtime': 'Local time', 'i.satimg': 'Satellite image', 'i.nearcams': 'Nearby cameras', 'i.nearevents': 'Nearby events',
      'i.news': 'News about this place', 'i.nocams': 'No camera within 150 km.', 'i.noevents': 'No earthquakes or natural events within 500 km.',
      'i.flightsnear': 'Aircraft within 50 km', 'i.fav': '★ Favourite', 'i.pin': 'Pin to case', 'i.zoom': 'Zoom in', 'i.zone': 'Zone here', 'i.copernicus': 'Copernicus Browser',
      'i.worldview': 'NASA Worldview', 'i.osm': 'OpenStreetMap', 'i.track': 'Show track', 'i.follow': 'Follow', 'i.orbit': 'Orbit',
      'toast.saved': 'Saved', 'toast.pinned': 'Pinned to case', 'toast.fav': 'Saved as favourite', 'toast.nokey': 'This source needs an API key (settings).',
      'toast.electron': 'This feature needs the desktop app (Electron).', 'toast.persistoff': 'Storage is off – data is lost on close.',
      'toast.zone': 'Zone saved', 'toast.camsloaded': '{n} cameras loaded', 'toast.norecord': 'No flight recording for this time. Flights are recorded from app start.',
      'cams.count': '{n} cameras', 'cams.open': 'Open in window', 'cams.towall': 'To video wall', 'cams.goto': 'Show on map',
      'wall.empty': 'Drag a camera here', 'cam.offline': 'This channel is not live right now.', 'cam.snapshot': 'Snapshot', 'cam.err': 'Stream unavailable. Some operators block embedding – open the link in your browser.',
      'case.default': 'General', 'case.newname': 'Case {n}', 'case.noitems': 'Nothing pinned yet.', 'case.nofav': 'No favourites yet.',
      'alert.quake': 'Earthquake M{m} – {place}', 'alert.zone': '{what} entered zone “{zone}”', 'alert.news': 'Keyword “{kw}”: {title}',
      'alert.none': 'No alerts yet.', 'zone.none': 'No zones.', 'zone.name': 'Zone {n}',
      'osint.hint.domain': 'WHOIS (RDAP), DNS records, certificate transparency (subdomains) and further links.',
      'osint.hint.ip': 'Location, provider/ASN, reverse DNS and registration data of the IP.',
      'osint.hint.user': 'Checks public profiles on ~30 platforms. Green = found, grey = not found, yellow = not checkable (open link).',
      'osint.hint.person': 'Only for public figures and your own research: Wikipedia/Wikidata hits plus targeted search links. No profiling, respect privacy.',
      'osint.hint.image': 'EXIF metadata and GPS are read locally only. Reverse search opens the respective service.',
      'osint.browser': 'Not checkable in browser mode – open the link. The desktop app checks automatically.',
      'osint.noexif': 'No EXIF data found (often stripped by messengers/platforms).', 'osint.gps': 'GPS position found', 'osint.showmap': 'Show on map',
      'src.flights': 'Flights', 'src.ships': 'Ships', 'src.sats': 'Satellites', 'src.quakes': 'Quakes', 'src.eonet': 'EONET', 'src.radar': 'Radar', 'src.news': 'News', 'src.gibs': 'GIBS',
      'cnt.flights': 'Flights', 'cnt.ships': 'Ships', 'cnt.quakes': 'Quakes 24h', 'cnt.events': 'Events', 'cnt.sats': 'Satellites'
    }
  };

  let lang = 'de';
  const listeners = [];

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) || dict.de[key] || key;
    if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    return s;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const badge = el.querySelector('.tab-badge');
      el.textContent = t(el.dataset.i18n);
      if (badge) el.appendChild(badge);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.documentElement.lang = lang;
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'de';
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  return { t, apply, setLang, get lang() { return lang; }, onChange: (fn) => listeners.push(fn) };
})();

GE.t = GE.i18n.t;
