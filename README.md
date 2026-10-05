# GOD'S EYE

Ein OSINT-Lagebild als Desktop-App (Electron), inspiriert vom „God's Eye“ aus *Fast & Furious* – aber nur mit **offenen, legalen Quellen**: öffentliche Livecams, NASA-/Copernicus-Satellitenbilder, Live-Flug- und Schiffsverkehr, Satelliten-Tracking, Erdbeben, Naturereignisse, Nachrichten und Recherche-Werkzeuge.

## Starten

```bash
npm install
npm start            # Desktop-App (empfohlen)
```

Installer bauen:

```bash
npm run dist:win     # Windows (.exe, NSIS + portable)
npm run dist:linux   # Linux (AppImage + .deb)
```

Ohne Electron kann man `src/index.html` auch im Browser öffnen (`npm run web`). Dann blockieren aber manche Quellen die Anfragen (CORS): Flüge, einige News-Feeds, Schiffe und die automatische Benutzername-Prüfung gehen nur in der Desktop-App.

## Was drin ist

| Bereich | Inhalt | Quelle | Schlüssel |
|---|---|---|---|
| Karte | 2D (Leaflet) und 3D-Globus (globe.gl), umschaltbar | Esri, CARTO, OSM | – |
| Satellit | VIIRS/MODIS-Tagesbilder, Nachtlichter, Sentinel-2 wolkenfrei (10 m) | NASA GIBS, EOX | – |
| Satellit aktuell | Sentinel-2 der letzten 30 Tage | Copernicus Data Space (Sentinel Hub) | Instance-ID |
| Wetter | GOES-East/-West, Himawari (10-Minuten-Takt), Regenradar | NASA GIBS, RainViewer | – |
| Flugzeuge | Live-ADS-B, Spur, Route, Halter, Foto, Notfall-Squawks | adsb.lol (ODbL), adsbdb | – |
| Schiffe | Live-AIS im Kartenausschnitt | aisstream.io | ja (kostenlos) |
| Satelliten | ISS, Raumstationen, hellste und Wettersatelliten mit Umlaufbahn | CelesTrak + satellite.js | – |
| Ereignisse | Erdbeben (24 h), Feuer, Stürme, Vulkane | USGS, NASA EONET, VIIRS | – |
| Livecams | Kuratierte Liste, ~1 800 Verkehrskameras, Windy-Webcams, eigene | YouTube, TfL, NYC DOT, Windy | Windy optional |
| OSINT | Domain (RDAP, DNS, Subdomains), IP, Benutzername (~30 Plattformen), öffentliche Person, Bild-EXIF/GPS | rdap.org, Cloudflare DoH, crt.sh, ipwho.is, Wikipedia | – |
| News | Ticker und Stichwort-Alarm, Nachrichten zu einem Ort | Tagesschau, DW, BBC, Al Jazeera, NASA, GDELT | – |

### Bedienung

- **Suche** (Taste `/`): Ort, Koordinaten (`52.52, 13.40` oder DMS), Flug (`DLH400`), Kennzeichen (`D-AIMA`), ICAO-Hex, MMSI, Domain, IP, `@benutzername`, Name.
- **Klick auf die Karte**: Ortsinfos, Wetter, Ortszeit, Satellitenbild, Kameras und Ereignisse in der Nähe, News.
- **Zeitleiste**: LIVE oder bis zu 7 Tage zurück. Satellitenbilder, Erdbeben, Naturereignisse und Satellitenpositionen folgen der Zeit; Flüge werden ab App-Start mitgeschnitten und lassen sich zurückspulen.
- **Kameras**: in frei verschiebbaren Fenstern (Snapshot, Mini-Karte, Wetter, Ortszeit) oder auf der **Video-Wand** mit frei wählbarem Raster. Kameras per Drag & Drop auf die Wand ziehen.
- **Modi**: Weltlage, Luftraum, Seeverkehr, Katastrophen, Orbit, Kameras – oder jede Ebene einzeln mit Transparenz-Regler.
- **Alarme**: Erdbeben ab Magnitude X, Geofence-Zonen (Flug/Schiff betritt Zone), News-Stichwörter – als Desktop-Benachrichtigung.
- **Fälle**: Notizen, angeheftete Funde, Favoriten, Screenshots, PDF-Bericht, JSON-Export.
- **Einstellungen**: Sprache DE/EN, fünf Farbthemes, API-Schlüssel, Speichern an/aus.

### Speichern

Standard ist **aus**: nichts wird gespeichert. Wer in den Einstellungen „Daten lokal speichern“ einschaltet, behält Favoriten, Fälle, Kameras, Schlüssel und Einstellungen lokal auf dem Rechner. API-Schlüssel werden nie mit exportiert.

## Projektaufbau

```
electron/main.js     Hauptprozess: Fenster, Netzwerk ohne CORS, Dateien, Screenshot, PDF, AIS-WebSocket
electron/preload.js  sichere Brücke (contextIsolation, kein Node im Dashboard)
src/index.html       Dashboard
src/css/app.css      Sci-Fi-Design, Themes über data-accent
src/js/              Module: map, layers, timeline, cams, intel, osint, search, cases, alerts, i18n, store …
```

## Rechtliches

- Nur öffentlich zugängliche, offizielle Quellen und Kameras, die ihre Betreiber selbst veröffentlichen. **Keine** ungeschützten privaten Kameras, kein Umgehen von Logins oder Zugriffsschutz.
- Die Personensuche liefert nur Wikipedia-/Wikidata-Treffer und Suchlinks. Sie baut keine Profile über Privatpersonen. Bitte DSGVO und Persönlichkeitsrechte beachten.
- Jede Quelle hat eigene Nutzungsbedingungen (z. B. Namensnennung bei adsb.lol/ODbL, OSM, Esri, EOX, NASA). Für kommerzielle Nutzung die Bedingungen der jeweiligen Dienste prüfen.
