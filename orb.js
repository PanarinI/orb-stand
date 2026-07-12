// orb.js — Фаза 1: ДУША. Орб-присутствие. Формо-независимо (тот же орб поедет во floating).
// Движок engine.js — как есть. Метафора: УГОЛЁК костра.
// Модель (вычищена): один объект — орб+кольцо, без кнопок, без надписей-ярлыков.
//   • тап орба БЕЗ завода → дефолт 25 (спросовый ключ «25 minute timer»); порог входа снят
//   • крути кольцо → заводишь СВОЁ время (призрак-дуга + эфемерное число, Time Timer); тап стартует его
//   • тап орба — контекстный toggle: покой → старт · фокус → завершить
//   • завершение = мягкий РАССВЕТ, в котором орб ОПАДАЕТ в уголёк → тишина между сессиями
//   • ГРОМКОСТЬ — единственный видимый орган кроме орба (боль Tide «no volume control» → на поверхности)
// Паузы пока нет (в идеи: вернём отдельным модулем). Никаких резких границ.

const $ = (id) => document.getElementById(id);
const ORB_MIN = 14, ORB_MAX = 84;
const RING_C = 2 * Math.PI * 90;          // длина кольца (r=90) для дуги завода
let dialMin = 25;                          // дефолт спроса (тап без завода); в стенде — СЕКУНДЫ демо
let sessionSec = 0;
let twisting = false, orbDown = false;

const engine = new AudioEngine(render);
engine.GATHER = 3; engine.DAWN = 4;       // быстрый стенд: короткий вход + короткий рассвет-выдох

const inSession = (p) => ['собирание', 'ткань', 'ниточка', 'рассвет'].includes(p);

function render(st) {
  const phase = st ? st.phase : 'off';
  const on = !!(st && st.on);
  const depth = Math.max(0, Math.min(1, (st && st.depth) || 0.15));

  if (st && st.justEnded) { engine.turnOff(); return; }     // рассвет догорел → тишина

  // РОСТ в фокусе, СДУВАНИЕ в рассвете (мысль автора) — обе величины монотонны
  let grown = 0;
  if ((phase === 'собирание' || phase === 'ткань') && sessionSec > engine.DAWN) {
    grown = Math.max(0, Math.min(1, (sessionSec - (st.remaining || 0)) / (sessionSec - engine.DAWN)));  // полнота ровно к началу рассвета
  } else if (phase === 'рассвет') {
    grown = Math.max(0, Math.min(1, (depth - 0.4) / 0.5));  // с полноты опадает в уголёк — стыкуется без скачка
  }
  // радиус по ПЛОЩАДИ (площадь ∝ grown = равномерное наполнение; при линейном r орб «ускорялся» к концу)
  $('orb').setAttribute('r', Math.sqrt(ORB_MIN * ORB_MIN + grown * (ORB_MAX * ORB_MAX - ORB_MIN * ORB_MIN)).toFixed(1));

  // ЖАР уголька — тёплая палитра костра (тлеет в покое, разгорается с фокусом)
  const heat = on ? Math.min(1, 0.22 + grown * 0.55 + depth * 0.3) : 0.1;
  const r = Math.round(120 + heat * 135), g = Math.round(66 + heat * 120), b = Math.round(38 + heat * 66);
  $('orb').style.fill = `rgb(${r},${g},${b})`;
  $('orb').style.filter = `drop-shadow(0 0 ${(on ? 8 + heat * 26 : 6).toFixed(0)}px rgba(255,${(150 + heat * 60) | 0},${(60 + heat * 60) | 0},${(on ? 0.35 + heat * 0.4 : 0.12).toFixed(2)}))`;
  // дыхание — фиксированное (менять animation-duration на лету = скачки фазы = рывки)
}

// --- завод: призрак-дуга «сколько заведёшь» + эфемерное число ---
function showDial() {
  $('num').textContent = dialMin + '″';
  $('num').style.opacity = 1;
  const arc = $('setarc');
  arc.style.opacity = 0.55;
  arc.style.strokeDashoffset = (RING_C * (1 - dialMin / 120)).toFixed(1);
  clearTimeout(showDial._t);
  showDial._t = setTimeout(() => { $('num').style.opacity = 0; }, 1100);
}

function geo(e) {
  const box = $('wrap').getBoundingClientRect();
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  const dist = Math.hypot(dx, dy) / (box.width / 220);
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360;
  return { dist, ang };
}
function setDial(ang) { dialMin = Math.max(5, Math.min(120, Math.round(ang / 360 * 120 / 5) * 5)); showDial(); }

function startFromDial() {
  const unit = $('fast').checked ? 1 : 60;               // «быстрый» = секунды; иначе кольцо — это МИНУТЫ
  sessionSec = dialMin * unit + engine.DAWN;             // фокус (= заведённое) + рассвет-выдох СВЕРХ
  $('setarc').style.opacity = 0;
  engine.turnOn();            // будим движок: после рассвета AudioContext усыплён — resume + перезапуск тика
  engine.startSession(sessionSec);
}
function orbTap() {
  const p = engine.phase;
  if (p === 'off' || p === 'ручей') startFromDial();   // тап 1 — вкл
  else engine.turnOff();                                // тап 2 — выкл (плавный выдох из текущего)
}

$('wrap').addEventListener('pointerdown', (e) => {
  const g = geo(e);
  if (g.dist > 55 && !inSession(engine.phase)) { twisting = true; $('wrap').setPointerCapture(e.pointerId); setDial(g.ang); }
  else if (g.dist <= 55) { orbDown = true; }
});
window.addEventListener('pointermove', (e) => { if (twisting) setDial(geo(e).ang); });
window.addEventListener('pointerup', () => {
  if (twisting) { twisting = false; }        // завод зафиксирован (дуга висит) — запуск отдельным тапом орба
  else if (orbDown) { orbDown = false; orbTap(); }
});

// --- ГРОМКОСТЬ на поверхности (продуктовый орган, не дев) — заливка «по жару» до уголька-ручки ---
function paintVol(v) { const p = (v * 100).toFixed(0); $('volume').style.background = `linear-gradient(90deg, #e8b25c 0%, #b9702a ${p}%, #2a2119 ${p}%)`; }
$('volume').addEventListener('input', () => { const v = +$('volume').value; engine.setChar({ volume: v }); paintVol(v); });
paintVol(+$('volume').value);

// --- дев-подвал стенда (щупать звук; в проде этого нет) ---
function applyFast() { if ($('fast').checked) { engine.GATHER = 3; engine.DAWN = 4; } else { engine.GATHER = 60; engine.DAWN = 120; } }
$('fast').addEventListener('change', applyFast); applyFast();
['energy', 'masking'].forEach((k) => $(k).addEventListener('input', () => engine.setChar({ [k]: +$(k).value })));
$('premium').addEventListener('change', () => engine.setTier($('premium').checked ? 'premium' : 'basic'));
$('harmony').addEventListener('input', () => engine.setHarmony(+$('harmony').value));

render(null);
