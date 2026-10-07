// GOD'S EYE – Electron-Hauptprozess
// Aufgaben: Fenster öffnen, Netzwerkanfragen ohne CORS-Grenzen ausführen,
// Dateien speichern, Screenshots/PDF erzeugen, AIS-Schiffsdaten per WebSocket holen.
const { app, BrowserWindow, ipcMain, net, dialog, shell, Notification, session } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

let win = null;
let aisSocket = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#05070d',
    title: "GOD'S EYE",
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // Externe Links im Standardbrowser öffnen statt in der App
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // YouTube-Einbettungen verlangen einen Referer, sonst Fehler 153.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://godseye.app/';
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  stopAis();
  if (process.platform !== 'darwin') app.quit();
});

// ---------- Netzwerk ----------
// Der Renderer darf nur http(s) anfragen. Antworttyp: json | text | status | dataurl
ipcMain.handle('net:fetch', async (_e, url, opts = {}) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('Nur http(s)-Adressen erlaubt');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 20000);
  try {
    const res = await net.fetch(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'User-Agent': "GodsEye/0.1 (+https://github.com/slogic3d-cloud/auge-gottes)" }, opts.headers || {}),
      body: opts.body,
      redirect: opts.type === 'status' ? 'manual' : 'follow',
      signal: controller.signal
    });
    const type = opts.type || 'json';
    if (type === 'status') return { status: res.status, url: res.url, location: res.headers.get('location') };
    if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
    if (type === 'text') return { data: await res.text(), status: res.status };
    if (type === 'dataurl') {
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') || 'application/octet-stream';
      return { data: `data:${mime};base64,${buf.toString('base64')}`, status: res.status };
    }
    return { data: await res.json(), status: res.status };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'Zeitüberschreitung' : String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
});

// ---------- Dateien ----------
ipcMain.handle('file:save', async (_e, { name, data, encoding }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: name });
  if (canceled || !filePath) return { saved: false };
  if (encoding === 'dataurl') {
    fs.writeFileSync(filePath, Buffer.from(String(data).split(',')[1], 'base64'));
  } else {
    fs.writeFileSync(filePath, data, 'utf8');
  }
  return { saved: true, filePath };
});

ipcMain.handle('file:open', async (_e, { filters }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (canceled || !filePaths[0]) return null;
  return fs.readFileSync(filePaths[0], 'utf8');
});

// Screenshot eines Bereichs im Fenster (für Livecam-Snapshots auch bei iframes)
ipcMain.handle('capture', async (_e, rect) => {
  const r = rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : undefined;
  const img = await win.webContents.capturePage(r);
  return img.toDataURL();
});

// Bericht als PDF: HTML in unsichtbarem Fenster rendern und drucken
ipcMain.handle('pdf:report', async (_e, { html, name }) => {
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const pdf = await pdfWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  pdfWin.destroy();
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: name || 'bericht.pdf' });
  if (canceled || !filePath) return { saved: false };
  fs.writeFileSync(filePath, pdf);
  return { saved: true, filePath };
});

ipcMain.handle('notify', (_e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
  return true;
});

// Aktuellen Livestream eines YouTube-Kanals finden (die alte Kanal-Einbettung liefert oft "nicht verfügbar")
const ytCache = new Map();
ipcMain.handle('yt:live', async (_e, channel) => {
  if (!/^UC[\w-]{22}$/.test(String(channel))) return null;
  const hit = ytCache.get(channel);
  if (hit && Date.now() - hit.ts < 30 * 60000) return hit.id;
  try {
    const res = await net.fetch(`https://www.youtube.com/channel/${channel}/live`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Cookie': 'SOCS=CAI; CONSENT=YES+1', 'Accept-Language': 'en' }
    });
    const html = await res.text();
    const m = html.match(/"currentVideoEndpoint".{0,600}?"videoId":"([\w-]{11})"/);
    const id = m && /"isLive":true/.test(html) ? m[1] : null;
    ytCache.set(channel, { id, ts: Date.now() });
    return id;
  } catch (_) { return null; }
});

ipcMain.handle('open:external', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});

// ---------- AIS (Schiffe) über aisstream.io ----------
function stopAis() {
  if (aisSocket) { try { aisSocket.close(); } catch (_) {} aisSocket = null; }
}

ipcMain.handle('ais:start', (_e, { apiKey, bbox }) => {
  stopAis();
  if (!apiKey) return { error: 'Kein AISStream-Key hinterlegt' };
  aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');
  aisSocket.on('open', () => {
    aisSocket.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [bbox], // [[latMin, lonMin], [latMax, lonMax]]
      FilterMessageTypes: ['PositionReport', 'ShipStaticData']
    }));
    win && win.webContents.send('ais:status', 'online');
  });
  aisSocket.on('message', (raw) => {
    try { win && win.webContents.send('ais:msg', JSON.parse(raw.toString())); } catch (_) {}
  });
  aisSocket.on('error', (err) => win && win.webContents.send('ais:status', 'Fehler: ' + err.message));
  aisSocket.on('close', () => win && win.webContents.send('ais:status', 'offline'));
  return { ok: true };
});

ipcMain.handle('ais:stop', () => { stopAis(); return true; });
