// Start und Verdrahtung aller Module.
GE.app = (() => {
  const { $, $$, toast, h } = GE.ui;
  const t = GE.t;

  function setView(v) {
    GE.map.setView(v);
    $$('#viewToggle .seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.view === v));
    GE.store.set('view', v);
  }

  function setAccent(name) {
    document.documentElement.dataset.accent = name;
    GE.store.set('accent', name);
    $$('.swatch').forEach((s) => s.classList.toggle('is-active', s.dataset.accent === name));
    GE.map.setAccent(GE.layers.accentHex());
    if (GE.layers.isOn('camsMap')) GE.layers.get('camsMap').redraw();
  }

  function statusbar() {
    const names = ['flights', 'ships', 'sats', 'quakes', 'eonet', 'radar', 'news'];
    const render = (s) => {
      const box = $('#sourceStatus'); box.innerHTML = '';
      names.forEach((n) => box.append(h('span.src.' + (s[n] || ''), { title: n }, h('i'), t('src.' + n))));
    };
    GE.net.onSource(render); render({});

    const clocks = [['UTC', 'UTC'], ['BER', 'Europe/Berlin'], ['NYC', 'America/New_York'], ['TYO', 'Asia/Tokyo']];
    const tick = () => {
      const now = Date.now();
      $('#clocks').innerHTML = clocks.map(([l, tz]) => `<span>${l}</span><b>${new Date(now).toLocaleTimeString('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: l === 'UTC' ? '2-digit' : undefined })}</b>`).join(' ');
    };
    tick(); setInterval(tick, 1000);

    const counts = () => {
      const c = GE.layers.counts();
      $('#counters').innerHTML = [['flights', c.flights], ['ships', c.ships], ['quakes', c.quakes], ['events', c.events], ['sats', c.sats]]
        .map(([k, v]) => `<span>${t('cnt.' + k)} <b>${GE.ui.fmt.num(v || 0)}</b></span>`).join('');
    };
    counts(); setInterval(counts, 2000);
  }

  function settings() {
    const modal = $('#settingsModal');
    $('#btnSettings').addEventListener('click', () => (modal.hidden = false));
    $('#btnSettingsClose').addEventListener('click', () => (modal.hidden = true));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true; });

    $$('.swatch').forEach((s) => s.addEventListener('click', () => setAccent(s.dataset.accent)));
    $('#setScanFx').checked = GE.store.get('scanFx', true);
    $('#setScanFx').addEventListener('change', (e) => GE.store.set('scanFx', e.target.checked));

    $('#setPersist').checked = GE.store.persist;
    $('#setPersist').addEventListener('change', (e) => {
      GE.store.setPersist(e.target.checked);
      toast(e.target.checked ? t('toast.saved') : t('toast.persistoff'), e.target.checked ? 'ok' : 'warn');
    });
    $('#btnWipe').addEventListener('click', () => {
      GE.store.wipe(); $('#setPersist').checked = false;
      ['keyWindy', 'keyAis', 'keySentinel'].forEach((k) => ($('#' + k).value = ''));
      GE.cases.render(); GE.cams.renderList();
      toast('✓', 'ok');
    });
    ['keyWindy', 'keyAis', 'keySentinel'].forEach((k) => {
      const el = $('#' + k);
      el.value = GE.store.get(k, '');
      el.addEventListener('change', () => GE.store.set(k, el.value.trim()));
    });
  }

  async function init() {
    // Klicks auf Marker sollen nicht zusätzlich als Kartenklick zählen
    L.Path.mergeOptions({ bubblingMouseEvents: false });

    GE.i18n.setLang(GE.store.get('lang', 'de'));
    $('#btnLang').textContent = GE.i18n.lang.toUpperCase();
    document.documentElement.dataset.accent = GE.store.get('accent', 'cyan');

    GE.map.init();
    GE.time.init();
    GE.cams.init();
    await GE.layers.init();
    GE.osint.init();
    GE.search.init();
    GE.cases.init();
    GE.alerts.init();
    settings();
    statusbar();
    setAccent(GE.store.get('accent', 'cyan'));

    GE.time.onChange(() => GE.layers.onTime());

    GE.map.onClick((lat, lon) => {
      if (GE.alerts.onMapClick(lat, lon)) return;
      GE.map.scan(lat, lon);
      GE.intel.showPlace(lat, lon);
    });

    $$('#viewToggle .seg-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#presetSelect').addEventListener('change', (e) => { if (e.target.value !== 'custom') GE.layers.applyPreset(e.target.value); });
    $('#btnLayersOff').addEventListener('click', () => GE.layers.allOff());
    $$('.tab').forEach((b) => b.addEventListener('click', () => GE.ui.showTab(b.dataset.tab)));
    $('#btnLang').addEventListener('click', () => {
      const l = GE.i18n.lang === 'de' ? 'en' : 'de';
      GE.i18n.setLang(l); GE.store.set('lang', l);
      $('#btnLang').textContent = l.toUpperCase();
    });

    if (GE.store.get('view', '2d') === '3d') setView('3d');
    if (!GE.net.desktop) toast('Browser-Modus: Einige Quellen (Schiffe, Benutzername-Prüfung, manche Feeds) brauchen die Desktop-App.', 'info', 6000);
  }

  return { init, setView, setAccent };
})();

window.addEventListener('DOMContentLoaded', () => GE.app.init());
