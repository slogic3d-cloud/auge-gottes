// Speicher: Alles liegt im Arbeitsspeicher. Nur wenn "Daten lokal speichern" aktiv ist,
// wird es zusätzlich in localStorage geschrieben. Ist es aus, wird nichts gespeichert.
GE.store = (() => {
  const KEY = 'godseye.v1';
  let persist = false;
  let state = {};

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { state = JSON.parse(raw) || {}; persist = true; }
  } catch (_) { state = {}; }

  function flush() {
    if (!persist) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }

  let timer = null;
  function flushSoon() { clearTimeout(timer); timer = setTimeout(flush, 300); }

  return {
    get(key, def) { return key in state ? state[key] : def; },
    set(key, val) { state[key] = val; flushSoon(); },
    all() { return JSON.parse(JSON.stringify(state)); },
    load(obj) { state = Object.assign({}, state, obj); flush(); },
    get persist() { return persist; },
    setPersist(on) {
      persist = !!on;
      if (persist) flush();
      else { try { localStorage.removeItem(KEY); } catch (_) {} }
    },
    wipe() {
      state = {};
      try { localStorage.removeItem(KEY); } catch (_) {}
    }
  };
})();
