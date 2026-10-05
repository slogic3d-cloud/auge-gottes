// Netzwerk: In der Desktop-App laufen Anfragen über den Hauptprozess (keine CORS-Grenzen).
// Im Browser wird normales fetch benutzt – manche Quellen gehen dann nicht.
GE.net = (() => {
  const desktop = !!(window.godseye && window.godseye.isElectron);
  const sourceState = {};
  const listeners = [];

  async function request(url, opts = {}) {
    if (desktop) {
      const r = await window.godseye.fetch(url, opts);
      if (r.error && opts.type !== 'status') { const e = new Error(r.error); e.status = r.status; throw e; }
      return r;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 20000);
    try {
      const res = await fetch(url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body, signal: ctrl.signal });
      if (opts.type === 'status') return { status: res.status, url: res.url };
      if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      if (opts.type === 'text') return { data: await res.text(), status: res.status };
      if (opts.type === 'dataurl') {
        const blob = await res.blob();
        const data = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
        return { data, status: res.status };
      }
      return { data: await res.json(), status: res.status };
    } finally { clearTimeout(timer); }
  }

  return {
    desktop,
    async json(url, opts = {}) { return (await request(url, Object.assign({}, opts, { type: 'json' }))).data; },
    async text(url, opts = {}) { return (await request(url, Object.assign({}, opts, { type: 'text' }))).data; },
    async dataUrl(url, opts = {}) { return (await request(url, Object.assign({}, opts, { type: 'dataurl' }))).data; },
    async raw(url, opts = {}) { return request(url, opts); },
    // Sammelt den Zustand jeder Quelle für die Statusleiste
    source(name, state) { sourceState[name] = state; listeners.forEach((fn) => fn(sourceState)); },
    onSource(fn) { listeners.push(fn); },
    get sources() { return sourceState; }
  };
})();
