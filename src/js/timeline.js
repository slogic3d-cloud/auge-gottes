// Zeitleiste: LIVE oder Rückblick bis 7 Tage. Wirkt auf alle Ebenen:
// Satellitenbilder (Tag/10-Minuten-Takt), Erdbeben, Naturereignisse, Satellitenpositionen,
// Regenradar (letzte 2 h) und mitgeschnittene Flugdaten.
GE.time = (() => {
  const { $, fmt } = GE.ui;
  const SPAN_MIN = 7 * 24 * 60;
  let live = true;
  let offsetMin = SPAN_MIN; // Minuten seit Beginn des Fensters
  let playing = null;
  const fns = [];

  const start = () => Date.now() - SPAN_MIN * 60000;
  function at() { return live ? null : new Date(start() + offsetMin * 60000); }

  function label() {
    const d = at();
    $('#timeLabel').textContent = d ? fmt.utc(d) : fmt.utc(Date.now()) + ' · ' + GE.t('live');
    $('#timeModeReadout').innerHTML = d ? `<span class="live-dot" style="background:var(--warn);box-shadow:0 0 8px var(--warn)"></span>${GE.t('replay')} · ${fmt.utc(d)}` : `<span class="live-dot"></span>${GE.t('live')}`;
    $('#btnLive').classList.toggle('is-live', live);
  }

  function emit() { label(); fns.forEach((fn) => fn(at())); }

  function ticks() {
    const box = $('#timelineTicks'); box.innerHTML = '';
    for (let d = 0; d <= 7; d++) {
      const ts = start() + d * 86400000;
      const s = document.createElement('span');
      s.style.left = (d / 7 * 100) + '%';
      s.textContent = d === 7 ? GE.t('live') : new Date(ts).toLocaleDateString(GE.i18n.lang === 'en' ? 'en-GB' : 'de-DE', { weekday: 'short', day: '2-digit' });
      box.append(s);
    }
  }

  function setLive() {
    live = true; offsetMin = SPAN_MIN; $('#timeSlider').value = SPAN_MIN; stop(); emit();
  }

  function stop() { if (playing) { clearInterval(playing); playing = null; } }

  function init() {
    const sl = $('#timeSlider');
    sl.max = SPAN_MIN;
    sl.addEventListener('input', () => { offsetMin = +sl.value; live = offsetMin >= SPAN_MIN - 5; label(); });
    sl.addEventListener('change', () => { if (live) setLive(); else emit(); });
    $('#btnLive').addEventListener('click', setLive);
    $('#btnPlay').addEventListener('click', () => {
      if (playing) { stop(); return; }
      if (live) { live = false; offsetMin = SPAN_MIN - 24 * 60; }
      playing = setInterval(() => {
        offsetMin += 60; // 1 Stunde pro Schritt
        if (offsetMin >= SPAN_MIN) { setLive(); return; }
        sl.value = offsetMin; emit();
      }, 1200);
    });
    ticks();
    GE.i18n.onChange(() => { ticks(); label(); });
    setInterval(() => { if (live) label(); }, 30000);
    label();
  }

  return { init, at, get isLive() { return live; }, onChange: (fn) => fns.push(fn), setLive };
})();
