// hearth.js — ОЧАГ по MECHANICS (2026-07-16..17). Движок engine.js — как есть (+extinguish быстрый выдох).
// ДВА КОНЦА (юзер-тест №6): таймер решил закончить → мягкий рассвет (церемония). Я решил → быстрый выдох (3-5с).
// Церемония хороша, только когда решение НЕ моё. Стоп — первичный жест, всегда доступен, всегда отвечает мгновенно.
// Жесты (сценарии S1–S6, MECHANICS §3):
//   клик в покое = старт · клик в сессии = пауза/продолжить · «завершить» (видна всю сессию) = быстрый выдох
//   клик во время ЛЮБОГО угасания (рассвет/выдох) = оборвать в тишину сейчас (не ждать)
//   кручение = ТОЛЬКО завод в покое; в сессии скролл не перехватывается.

const el = {};
['orb', 'setarc', 'num', 'wrap', 'stage', 'embers', 'ash', 'home', 'pip', 'volume', 'fast', 'premium', 'energy', 'masking', 'harmony', 'finish', 'knob']
  .forEach((id) => { el[id] = document.getElementById(id); });

const ORB_MIN = 14, ORB_MAX = 84;
const RING_C = 2 * Math.PI * 90;
const TAU_GROW = 2100;                    // тело жара: 25 мин → ~0.5 полноты · 50 → 0.76 · 90 → 0.92 (fast: 35 с)
const SLEEP_AFTER = 10 * 60;             // забытая пауза → очаг засыпает (сек; fast делит на 20)
const WHEEL_STEP_PX = 60;                // порог аккумулятора завода (свайп ≠ шквал)
const QUENCH = () => (el.fast.checked ? 1.5 : 4);   // быстрый выдох ручного «завершить»

let dialMin = +(localStorage.getItem('hearth.dial') || 25);
let infinite = localStorage.getItem('hearth.dial') === 'Infinity';
if (infinite) dialMin = Infinity;
let twisting = false, downAt = 0, sleepTimer = null, wheelAcc = 0, pendingEmber = null;
let lastGrown = 0, grownAtDawn = 0, grownAtExt = 0, lastPhase = 'off';

const engine = new AudioEngine(render);
engine.GATHER = 3; engine.DAWN = 4;      // fast-стенд; applyFast() переключает на прод-длины

const inSession = (p) => ['собирание', 'ткань', 'ниточка'].includes(p);   // рабочие фазы (без угасаний)
const fading = (p) => p === 'рассвет' || p === 'угасание';                // любой уход в тишину
const unit = () => (el.fast.checked ? 1 : 60);
const nowS = () => performance.now() / 1000;
const elapsedS = () => (engine.phase === 'ниточка' ? engine.pausedAt : (engine.sessionStart ? nowS() - engine.sessionStart : 0));

// ---------- УГЛИ-СЛЕПКИ ----------
const embers = JSON.parse(localStorage.getItem('hearth.embers') || '[]');
const today = () => new Date().toDateString();
function dropEmber(focusSec) {
  const min = Math.max(0.2, focusSec / unit());
  embers.push({ ts: Date.now(), min: +min.toFixed(1) });
  localStorage.setItem('hearth.embers', JSON.stringify(embers));
  renderEmbers();
}
function renderEmbers() {
  const doc = el.embers.ownerDocument;
  el.embers.innerHTML = '';
  const day = embers.filter(e => new Date(e.ts).toDateString() === today());
  let x = 110 - (day.length - 1) * 11;
  day.forEach((e) => {
    const r = Math.min(9, 2 + Math.sqrt(e.min) * 1.35);
    const c = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', Math.max(14, Math.min(206, x))); c.setAttribute('cy', 236); c.setAttribute('r', r.toFixed(1));
    c.setAttribute('class', 'ember');
    el.embers.appendChild(c); x += 22;
  });
  const yMin = embers.filter(e => { const d = new Date(e.ts); const y = new Date(Date.now() - 864e5); return d.toDateString() === y.toDateString(); })
    .reduce((s, e) => s + e.min, 0);
  el.ash.setAttribute('x2', yMin ? Math.min(206, 110 + Math.min(96, yMin * 1.2)) : 110);
  el.ash.setAttribute('x1', yMin ? Math.max(14, 110 - Math.min(96, yMin * 1.2)) : 110);
  const tot = day.reduce((s, e) => s + e.min, 0);
  el.stage.title = day.length ? `${day.length} ${plural(day.length)} · ${fmt(tot)}` : '';
}
function plural(n) { return n % 10 === 1 && n % 100 !== 11 ? 'сессия' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'сессии' : 'сессий'); }
function fmt(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} ч ${m} м` : `${m} м`; }

// ---------- РЕНДЕР (тело = прожитое; кручение тело не трогает — модель v3) ----------
function render(st) {
  const phase = st ? st.phase : 'off';
  const on = !!(st && st.on);
  const depth = Math.max(0, Math.min(1, (st && st.depth) || 0.15));

  if (st && st.justEnded) {                                    // конец (рассвет ИЛИ выдох догорел) → уголь + тишина
    const focus = pendingEmber != null ? pendingEmber : Math.max(0, elapsedS() - engine.DAWN);
    dropEmber(Math.max(0, focus));
    pendingEmber = null;
    engine.turnOff();
    return;
  }
  if (phase !== lastPhase) {
    if (phase === 'рассвет') grownAtDawn = lastGrown;
    if (phase === 'угасание') grownAtExt = lastGrown;
    lastPhase = phase;
  }

  let grown = 0;
  if (inSession(phase)) {
    grown = 1 - Math.exp(-elapsedS() / (el.fast.checked ? 35 : TAU_GROW));
  } else if (phase === 'рассвет') {
    grown = grownAtDawn * Math.max(0, Math.min(1, (depth - 0.4) / 0.5));
  } else if (phase === 'угасание') {
    const p = Math.min(1, (nowS() - engine.phaseStart) / (engine._extDur || 1));
    grown = grownAtExt * (1 - p);                              // тело оседает синхронно с выдохом
  }
  el.orb.setAttribute('r', Math.sqrt(ORB_MIN * ORB_MIN + grown * (ORB_MAX * ORB_MAX - ORB_MIN * ORB_MIN)).toFixed(1));

  // дуга-остаток: видна в рабочей сессии (не ∞); гаснет в угасаниях и покое
  if (inSession(phase) && !infinite) {
    const frac = Math.max(0, Math.min(1, (st && st.remaining || 0) / Math.max(1, engine.sessionDur)));
    el.setarc.style.opacity = 0.3;
    el.setarc.style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(1);
  } else if (phase === 'off' || fading(phase)) {
    el.setarc.style.opacity = 0;
  }

  el.finish.hidden = !inSession(phase);                        // «завершить» — всю рабочую сессию (S5, всегда под рукой)
  placeKnob();                                                 // хваталка завода: видна в покое, спрятана в сессии

  const dim = phase === 'ниточка' ? 0.5 : 1;                   // пауза = глуше цвет; размер не трогаем
  const heat = on ? Math.min(1, (0.22 + grown * 0.55 + depth * 0.3)) * dim : 0.1;
  const r = Math.round(120 + heat * 135), g = Math.round(66 + heat * 120), b = Math.round(38 + heat * 66);
  el.orb.style.fill = `rgb(${r},${g},${b})`;
  el.orb.style.filter = `drop-shadow(0 0 ${(on ? 8 + heat * 26 : 6).toFixed(0)}px rgba(255,${(150 + heat * 60) | 0},${(60 + heat * 60) | 0},${(on ? 0.35 + heat * 0.4 : 0.12).toFixed(2)}))`;
}

// ---------- ЧИСЛО-ВСПЫШКА ----------
function flashNum(text) {
  el.num.textContent = text; el.num.style.opacity = 1;
  clearTimeout(flashNum._t);
  flashNum._t = setTimeout(() => { el.num.style.opacity = 0; }, 1100);
}

// ---------- ЗАВОД (покой) ----------
function placeKnob() {                                          // видимая хваталка на позиции завода; в сессии прячется
  const inSess = inSession(engine.phase) || fading(engine.phase);
  if (inSess) { el.knob.style.opacity = 0; return; }
  el.knob.style.opacity = 1;
  const m = infinite ? 116 : dialMin;                          // ∞ → почти полный круг (у верхней отсечки)
  const th = (m / 120) * 2 * Math.PI;
  el.knob.setAttribute('cx', (110 + 90 * Math.sin(th)).toFixed(1));
  el.knob.setAttribute('cy', (110 - 90 * Math.cos(th)).toFixed(1));
}
function showDial() {
  flashNum(infinite ? '∞' : dialMin + '′');
  el.setarc.style.opacity = 0.55;
  el.setarc.style.strokeDashoffset = infinite ? 0 : (RING_C * (1 - dialMin / 120)).toFixed(1);
  placeKnob();
}
function setDial(min) {
  infinite = min > 90;
  dialMin = infinite ? Infinity : Math.max(5, Math.min(90, Math.round(min / 5) * 5));
  localStorage.setItem('hearth.dial', infinite ? 'Infinity' : dialMin);
  showDial();
}
function geo(e) {
  const box = el.wrap.getBoundingClientRect();
  const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.width / 2);
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360;
  return { dist: Math.hypot(dx, dy) / (box.width / 220), ang };
}

// ---------- СТОП: быстрый выдох + мгновенный уголь+тишина ----------
function quench() {                                            // ручное «завершить» (S5/S6): выдох QUENCH сек
  clearTimeout(sleepTimer);
  pendingEmber = Math.max(0, elapsedS());                     // честный слепок отработанного (без вычета рассвета)
  engine.extinguish(QUENCH());
}
function killNow() {                                          // клик во время угасания: оборвать в тишину СЕЙЧАС
  const focus = pendingEmber != null ? pendingEmber : Math.max(0, elapsedS() - engine.DAWN);
  pendingEmber = null;
  dropEmber(Math.max(0, focus));
  engine.turnOff();
}

// ---------- КЛИК — контекстный ----------
function start() {
  el.setarc.style.opacity = 0;
  engine.turnOn();
  engine.startSession(infinite ? 9e7 : dialMin * unit() + engine.DAWN);
}
function hearthClick() {
  const p = engine.phase;
  if (p === 'off' || p === 'ручей') start();
  else if (p === 'собирание' || p === 'ткань') {              // пауза (тишина сразу, жар глуше)
    engine.pause();
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {                           // забыл вернуться → очаг тихо уснул, слепок честен
      if (engine.phase === 'ниточка') { dropEmber(Math.max(0, engine.pausedAt)); engine.turnOff(); }
    }, (el.fast.checked ? SLEEP_AFTER / 20 : SLEEP_AFTER) * 1000);
  }
  else if (p === 'ниточка') { clearTimeout(sleepTimer); engine.resume(); }
  else if (fading(p)) killNow();                              // рассвет/выдох + клик = оборвать сейчас (отклик всегда есть)
}

// жесты самодостаточны на wrap (едут в PiP; el.* — живые ссылки в любом документе)
el.wrap.addEventListener('pointerdown', (e) => {
  const g = geo(e);
  if (g.dist > 55 && !inSession(engine.phase) && !fading(engine.phase)) { twisting = true; el.wrap.setPointerCapture(e.pointerId); setDial(g.ang / 360 * 120); }
  else if (g.dist <= 55) downAt = performance.now();
});
el.wrap.addEventListener('pointermove', (e) => { if (twisting) setDial(geo(e).ang / 360 * 120); });
el.wrap.addEventListener('pointerup', () => {
  if (twisting) twisting = false;
  else if (downAt) { downAt = 0; hearthClick(); }
});
// колесо: ТОЛЬКО завод в покое. В сессии/угасании скролл не перехватывается (юзер-тест №4).
el.wrap.addEventListener('wheel', (e) => {
  if (inSession(engine.phase) || fading(engine.phase)) return;
  e.preventDefault();
  wheelAcc += e.deltaY;
  let steps = 0;
  while (wheelAcc <= -WHEEL_STEP_PX) { steps++; wheelAcc += WHEEL_STEP_PX; }
  while (wheelAcc >= WHEEL_STEP_PX) { steps--; wheelAcc -= WHEEL_STEP_PX; }
  if (steps) setDial((infinite ? 95 : dialMin) + steps * 5);
}, { passive: false });

// «завершить» (S5/S6): всегда под рукой в сессии; клики не протекают в wrap
['pointerdown', 'pointerup'].forEach((t) => el.finish.addEventListener(t, (e) => e.stopPropagation()));
el.finish.addEventListener('click', quench);

// ---------- ГРОМКОСТЬ ----------
function paintVol(v) { const p = (v * 100).toFixed(0); el.volume.style.background = `linear-gradient(90deg, #e8b25c 0%, #b9702a ${p}%, #2a2119 ${p}%)`; }
el.volume.addEventListener('input', () => { const v = +el.volume.value; engine.setChar({ volume: v }); paintVol(v); });
paintVol(+el.volume.value);

// ---------- PiP-ВЫНОС ----------
if (!('documentPictureInPicture' in window)) { el.pip.textContent = 'PiP недоступен в этом браузере'; el.pip.disabled = true; }
el.pip.addEventListener('click', async () => {
  if (window.__pipWin) { window.__pipWin.close(); return; }
  try {
    const w = +localStorage.getItem('hearth.pipW') || 230, h = +localStorage.getItem('hearth.pipH') || 260;
    const pip = await documentPictureInPicture.requestWindow({ width: w, height: h });
    window.__pipWin = pip;
    document.querySelectorAll('style').forEach(s => pip.document.head.appendChild(s.cloneNode(true)));
    pip.document.body.style.cssText = 'margin:0;background:#0e0b08;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    pip.document.body.appendChild(el.stage);
    el.pip.textContent = 'вернуть жар';
    pip.addEventListener('resize', () => { localStorage.setItem('hearth.pipW', pip.innerWidth); localStorage.setItem('hearth.pipH', pip.innerHeight); });
    pip.addEventListener('pagehide', () => { el.home.appendChild(el.stage); window.__pipWin = null; el.pip.textContent = 'вынести жар'; });
  } catch (err) { el.pip.textContent = 'PiP: ' + err.message; console.error('PiP:', err); }
});

// ---------- дев-подвал стенда ----------
function applyFast() { if (el.fast.checked) { engine.GATHER = 3; engine.DAWN = 4; } else { engine.GATHER = 90; engine.DAWN = 40; } }
el.fast.addEventListener('change', applyFast); applyFast();
['energy', 'masking'].forEach((k) => el[k].addEventListener('input', () => engine.setChar({ [k]: +el[k].value })));
el.premium.addEventListener('change', () => engine.setTier(el.premium.checked ? 'premium' : 'basic'));
el.harmony.addEventListener('input', () => engine.setHarmony(+el.harmony.value));

renderEmbers();
render(null);
