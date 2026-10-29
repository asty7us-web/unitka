/* Юнитка · тема «Соник» — живой Соник на баннере и игра на обороте карточки (23.10.2026, по Андрею: «соник не двигается и не с
   картинкой… кнопка на названии, карточка переворачивается, игра как Соник: 2 уровня и босс, управление одним пальцем»).
   Всё нарисовано кодом на canvas (векторы с учётом devicePixelRatio — чётко на любом экране), без чужих спрайтов; пейзаж баннера и
   Соник на заставке игры — свои картинки NeuralBox (Код\unitka\sonic). Грузится только в теме «Соник» (index.html → loadSonic).
   Физика и пропорции — по Sonic Physics Guide (info.sonicretro.org): разгон 0.046875 px/кадр², макс. скорость 6, гравитация 0.21875,
   прыжок 6.5 (отпустил раньше — скорость вверх режется до 4), уклон 0.125, разгон в воздухе 0.09375; 60 кадров/с; экран высотой
   224 px, как на Mega Drive, — Соник (рост ~40) и уровень в тех же пропорциях, по ширине видно больше.
   Управление одним пальцем — как в SEGA Sonic Runners: бежит сам; тап — прыжок (держишь — выше); тап в прыжке — самонаводящаяся
   атака по ближайшему врагу, монитору или боссу, а если рядом никого — рывок вперёд. Клавиатура: пробел, ↑, Enter.
   Есть: кольца (удар — кольца разлетаются, часть можно поймать; 100 колец — жизнь), мониторы (10 колец, щит, кроссовки, неуязвимость,
   жизнь), пружины, ускорители, петли, шипы, ямы, уступы, бадники (жук, оса и краб стреляют), чекпоинт, табличка конца акта с бонусами
   за время и кольца, 2 акта и босс (8 попаданий), жизни, «игра окончена».
   С 23.10 (вечер): Соник — кадры NeuralBox (sonic-run/poses.webp); режимы «бежит сам» / «управляю сам» (одним пальцем в любом месте:
   вбок — скорость, тап/вверх — прыжок, вниз — присесть/клубок/спин-дэш; клавиши); после босса — секретный этап с Изумрудом Хаоса,
   награда — Супер Соник в игре и на обложке.
   API: SonicGame.mount(canvas) → {resume, pause, destroy, dbg}; SonicGame.runner(canvas, {map}) → {pause, destroy}. */
(function () {
"use strict";
// картинки — рядом с этим файлом (/unitka/), а не со страницей: игру подключают и Склейки с Конкурентами (29.10)
const BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sgn = v => (v < 0 ? -1 : 1);
// frc — трение без кнопок; roll* — клубком (трение, торможение кнопкой назад, уклон вверх/вниз); autoTop — потолок в режиме «бежит сам»
const P = { acc: 0.046875, dec: 0.5, frc: 0.046875, top: 6, slp: 0.125, grv: 0.21875, jmp: 6.5, cut: 4, air: 0.09375, fall: 16,
  rollFrc: 0.0234375, rollDec: 0.125, rollUp: 0.078125, rollDown: 0.3125, rollTop: 16, autoTop: 5 };
const LSG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const LSS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
// Супер Соник — секретный бонус: открывается Изумрудом Хаоса на секретном этапе; золотой и в игре, и на обложке (ok — открыт, on — включён)
const SUP = { ok: LSG("unitka.sxSuper") === "1", on: LSG("unitka.sxSuper") === "1" && LSG("unitka.sxSuperOn") !== "0" };
const OL = "#0a1a4a";
const C = { blue: "#1f5fe6", blue2: "#1240b8", peach: "#f7c48a", peach2: "#d99a5e", red: "#e8262b", red2: "#b5161d",
  gold: "#ffcf26", gold2: "#9a5800", gold3: "#fff3a6", glove2: "#cdd8ee" };
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const reduced = () => false;   // игра двигается всегда, «меньше анимации» Windows не глушит (Андрей 24.10)
const FONT = '"Exo 2","Russo One",system-ui,sans-serif';
const IMG = {};
function pic(k, src) { if (!IMG[k]) { IMG[k] = new Image(); IMG[k].src = BASE + src; } return IMG[k]; }

/* ═════════ звук: короткие синтезированные эффекты (WebAudio, без файлов), включаются после первого касания ═════════ */
const AU = { a: null, on: (() => { try { return localStorage.getItem("unitka.sxMute") !== "1"; } catch (e) { return true; } })() };
function ac() { if (!AU.a) { try { AU.a = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AU.a = null; } } if (AU.a && AU.a.state === "suspended") AU.a.resume(); return AU.a; }
function tone(f1, f2, dur, type, vol, delay) {
  if (!AU.on) return; const a = ac(); if (!a) return;
  const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || "square"; o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, vol, delay) {
  if (!AU.on) return; const a = ac(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), g = a.createGain(), t = a.currentTime + (delay || 0); s.buffer = b; g.gain.value = vol || 0.08;
  s.connect(g); g.connect(a.destination); s.start(t);
}
const SFX = {
  ring: () => { tone(1318, 0, 0.06, "square", 0.035); tone(1976, 0, 0.18, "square", 0.035, 0.055); },
  jump: () => tone(240, 780, 0.17, "square", 0.035),
  spring: () => tone(180, 1300, 0.32, "triangle", 0.09),
  pop: () => { noise(0.2, 0.09); tone(520, 110, 0.2, "square", 0.03); },
  hurt: () => { noise(0.25, 0.08); tone(700, 120, 0.35, "sawtooth", 0.03); },
  lose: () => { for (let i = 0; i < 7; i++) tone(1700 - i * 90, 0, 0.05, "square", 0.025, i * 0.035); },
  boost: () => tone(300, 1500, 0.28, "sawtooth", 0.025),
  dash: () => tone(500, 1800, 0.18, "triangle", 0.05),
  rev: () => tone(420, 1500, 0.16, "sawtooth", 0.03),
  roll: () => tone(900, 300, 0.12, "triangle", 0.04),
  item: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, 0.12, "square", 0.03, i * 0.07)),
  check: () => [880, 1320].forEach((f, i) => tone(f, 0, 0.15, "triangle", 0.06, i * 0.1)),
  hit: () => { noise(0.22, 0.12); tone(150, 55, 0.3, "square", 0.06); },
  boom: () => { noise(0.5, 0.12); tone(90, 40, 0.5, "sawtooth", 0.05); },
  die: () => { tone(500, 90, 0.7, "square", 0.045); },
  clear: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0, 0.16, "square", 0.035, i * 0.13)),
  life: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0, 0.14, "triangle", 0.06, i * 0.1)),
};

/* ═════════ рисунок Соника: «скелет» в единицах игры (ноги в начале координат, смотрит вправо, рост ~40) ═════════ */
function line(ctx, pts, w, col) {                         // ломаная с обводкой: сначала контур, потом цвет — суставы без швов
  ctx.lineCap = ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = OL; ctx.lineWidth = w + 2.2; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
function ell(ctx, x, y, rx, ry, rot, fill, lw) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OL; ctx.stroke(); }
}
function shoe(ctx, x, y, r, far) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(r);
  ctx.beginPath(); ctx.moveTo(-4.4, -2.8); ctx.quadraticCurveTo(-5.8, 2.6, -2, 2.6); ctx.lineTo(8.6, 2.6);
  ctx.quadraticCurveTo(12, 2.4, 11, -0.8); ctx.quadraticCurveTo(9.6, -4, 3.2, -3.6); ctx.closePath();
  ctx.fillStyle = far ? C.red2 : C.red; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = far ? "#d5d9e6" : "#fff"; ctx.fillRect(-0.8, -4, 3, 7);
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(3, -3.6, 6, 1.3); ctx.restore();
  ctx.lineWidth = 1.1; ctx.strokeStyle = OL; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3.4, 2.2); ctx.lineTo(9.5, 2.2); ctx.strokeStyle = "#c3c6d4"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = C.gold; ctx.fillRect(0.1, -1.6, 1.4, 1.9);
  ctx.restore();
}
function leg(ctx, hx, hy, a, bend, far) {
  const kx = hx + Math.sin(a) * 4.4, ky = hy + Math.cos(a) * 4.4, b = a - bend, ax = kx + Math.sin(b) * 4.4, ay = ky + Math.cos(b) * 4.4;
  line(ctx, [hx, hy, kx, ky, ax, ay], 2.7, far ? C.blue2 : C.blue);
  shoe(ctx, ax, ay, clamp(-b * 0.85, -1.15, 1.15), far);
}
function arm(ctx, sx, sy, a, bend, far) {
  const ex = sx + Math.sin(a) * 4.3, ey = sy + Math.cos(a) * 4.3, b = a + bend, wx = ex + Math.sin(b) * 4, wy = ey + Math.cos(b) * 4;
  line(ctx, [sx, sy, ex, ey, wx, wy], 2, far ? C.peach2 : C.peach);
  ell(ctx, wx + Math.sin(b) * 1.7, wy + Math.cos(b) * 1.7, 3.3, 3.1, 0, far ? C.glove2 : "#fff", 1.1);
  ell(ctx, wx, wy, 2.3, 1.3, -b, far ? C.glove2 : "#fff", 0.9);
}
function quills(ctx) {
  ctx.beginPath(); ctx.moveTo(-3, -36.6); ctx.lineTo(-18.6, -37.8); ctx.lineTo(-8.6, -31.6); ctx.lineTo(-20.8, -27.2);
  ctx.lineTo(-8.9, -24.4); ctx.lineTo(-17.6, -16.4); ctx.lineTo(-5.4, -19.4); ctx.lineTo(-1.5, -26); ctx.closePath();
  ctx.fillStyle = C.blue; ctx.fill(); ctx.lineJoin = "round"; ctx.lineWidth = 1.2; ctx.strokeStyle = OL; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, -34.8); ctx.lineTo(-8, -32.6); ctx.moveTo(-16, -27); ctx.lineTo(-9.4, -25.8);
  ctx.strokeStyle = C.blue2; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6.4, -17.4); ctx.lineTo(-12.6, -12.4); ctx.lineTo(-5.4, -12); ctx.closePath();
  ctx.fillStyle = C.blue; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = OL; ctx.stroke();
}
function head(ctx, o) {
  ell(ctx, 1, -27.6, 10.7, 10.2, 0, C.blue, 1.2);
  ctx.beginPath(); ctx.arc(1, -27.6, 8, PI * 1.12, PI * 1.5); ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3.2, -35.2); ctx.lineTo(0.2, -43.2); ctx.lineTo(4.6, -35.6); ctx.closePath();
  ctx.fillStyle = C.blue; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = OL; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.9, -36.2); ctx.lineTo(0.5, -40.4); ctx.lineTo(2.6, -36.4); ctx.closePath(); ctx.fillStyle = C.peach; ctx.fill();
  ell(ctx, 8.4, -22.8, 6.4, 4.6, -0.12, C.peach, 1.1);                         // мордочка
  ctx.beginPath(); ctx.ellipse(4.6, -29.6, 3.9, 5.7, -0.12, 0, TAU); ctx.ellipse(9.3, -29.2, 3.1, 5.1, 0.12, 0, TAU);
  ctx.lineWidth = 2.2; ctx.strokeStyle = OL; ctx.stroke(); ctx.fillStyle = "#fff"; ctx.fill();
  if (o.eyesX) {
    ctx.beginPath(); for (const [x, y] of [[5, -29.5], [9.6, -29]]) { ctx.moveTo(x - 1.7, y - 1.7); ctx.lineTo(x + 1.7, y + 1.7); ctx.moveTo(x + 1.7, y - 1.7); ctx.lineTo(x - 1.7, y + 1.7); }
    ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.stroke();
  } else if (o.blink) {
    ctx.beginPath(); ctx.moveTo(2.2, -29); ctx.lineTo(7.2, -28.6); ctx.moveTo(7.6, -28.6); ctx.lineTo(11.6, -28.4); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
  } else {
    ell(ctx, 6.3, -28.9, 1.8, 2.9, 0, "#27a33d", 0); ell(ctx, 10.3, -28.7, 1.45, 2.6, 0, "#27a33d", 0);
    ell(ctx, 6.6, -28.7, 1, 1.9, 0, OL, 0); ell(ctx, 10.5, -28.5, 0.85, 1.7, 0, OL, 0);
    ell(ctx, 5.9, -30.3, 0.55, 0.7, 0, "#fff", 0); ell(ctx, 9.9, -30.1, 0.5, 0.6, 0, "#fff", 0);
  }
  ell(ctx, 14.4, -25.6, 2.2, 1.75, 0, OL, 0); ell(ctx, 13.8, -26.2, 0.7, 0.5, 0, "#6f86c9", 0);
  ctx.beginPath(); ctx.moveTo(7, -20.6); ctx.quadraticCurveTo(10.2, -18.4, 12.8, -21.4); ctx.strokeStyle = OL; ctx.lineWidth = 0.9; ctx.stroke();
}
function dashLegs(ctx, hx, hy, ph) {
  ctx.save(); ctx.translate(hx + 1.5, hy + 4.4); ctx.lineCap = "round";
  ctx.beginPath(); for (let i = 0; i <= 36; i++) { const t = i / 36 * TAU, x = 8.8 * Math.sin(t), y = 3.6 * Math.sin(2 * t); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.globalAlpha = 0.5; ctx.strokeStyle = C.red; ctx.lineWidth = 6.8; ctx.stroke();
  ctx.globalAlpha = 0.75; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalAlpha = 1;
  for (const k of [PI, 0]) { const t = ph * 2 + k; shoe(ctx, 8.8 * Math.sin(t) - 2.4, 3.6 * Math.sin(2 * t) - 1.2, 0.25 * Math.cos(t), k > 0); }
  ctx.restore();
}
function sonicBall(ctx, o) {
  const r = o.rot || 0;
  ctx.save(); ctx.translate(0, -14);
  if (o.pose === "charge") ctx.scale(1.1, 0.9);
  ctx.rotate(r);
  ell(ctx, 0, 0, 13.6, 13.6, 0, C.blue, 1.4);
  ctx.fillStyle = C.blue2;
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5);
    ctx.quadraticCurveTo(Math.cos(a + 0.5) * 11, Math.sin(a + 0.5) * 11, Math.cos(a + 1.2) * 13.3, Math.sin(a + 1.2) * 13.3);
    ctx.quadraticCurveTo(Math.cos(a + 0.75) * 7.5, Math.sin(a + 0.75) * 7.5, Math.cos(a + 0.35) * 2.5, Math.sin(a + 0.35) * 2.5); ctx.fill();
  }
  ell(ctx, 7.6, 2.4, 3.6, 2.7, 0.4, C.peach, 0.8);
  ctx.rotate(-r);
  ctx.beginPath(); ctx.arc(-3.4, -3.8, 7.6, PI * 1.05, PI * 1.55); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.restore();
}
/* pose: stand walk run dash ball charge push spring hurt dead tap win; ph — фаза бега; rot — поворот клубка */
function sonic(ctx, o) {
  const pose = o.pose, ph = o.ph || 0;
  if (pose === "ball" || pose === "charge") return sonicBall(ctx, o);
  let lean = 0, bob = 0, L = [0.08, -0.06], K = [0.05, 0], A = [0.25, -0.08], E = [0.45, 0.4], dash = false;
  const s = Math.sin(ph);
  if (pose === "stand") bob = -0.4 * Math.sin(ph * 0.5);
  else if (pose === "walk") { L = [0.6 * s, -0.6 * s]; K = [0.5 + 0.4 * Math.max(0, -s), 0.5 + 0.4 * Math.max(0, s)]; A = [-0.7 * s, 0.7 * s]; E = [0.6, 0.6]; lean = 0.12; bob = -1.2 * Math.abs(Math.cos(ph)); }
  else if (pose === "run") { L = [s + 0.25, -s + 0.25]; K = [0.9 + 0.8 * Math.max(0, -s), 0.9 + 0.8 * Math.max(0, s)]; A = [-1.15 * s, 1.15 * s]; E = [1.3, 1.3]; lean = 0.3; bob = -1.7 * Math.abs(Math.cos(ph)); }
  else if (pose === "dash") { dash = true; A = [-1.95, -1.6]; E = [0.35, 0.25]; lean = 0.44; bob = -0.7 * Math.abs(Math.sin(ph * 2)); }
  else if (pose === "push") { L = [0.4 + 0.15 * s, -0.8 - 0.1 * s]; K = [1.1, 0.2]; A = [1.5, 1.4]; E = [-0.15, -0.15]; lean = 0.62; }
  else if (pose === "spring") { L = [0.05, -0.05]; K = [0, 0]; A = [2.95, 2.75]; E = [0.1, 0.1]; }
  else if (pose === "hurt") { L = [0.75, 0.35]; K = [0.3, 0.5]; A = [2.4, 2.0]; E = [0.5, 0.5]; lean = -0.35; }
  else if (pose === "dead") { L = [0.8, -0.5]; K = [0.2, 0.2]; A = [2.7, 2.3]; E = [0.4, 0.4]; }
  else if (pose === "tap") { const u = Math.max(0, s); L = [0.2 + 0.14 * u, -0.08]; K = [0.3 * u, 0]; A = [0.7, 0.4]; E = [2.1, 2.2]; }
  else if (pose === "win") { L = [0.15, -0.1]; A = [-0.25, 2.25]; E = [1.4, -1.0]; }
  ctx.save(); ctx.translate(0, bob); ctx.rotate(lean);
  const hx = -1, hy = -9.4, sx = 0.6, sy = -19;
  arm(ctx, sx - 1.5, sy, A[0], E[0], true);
  if (!dash) leg(ctx, hx - 1, hy, L[0], K[0], true);
  quills(ctx);
  ell(ctx, -1, -14.6, 6.3, 6.9, 0, C.blue, 1.15); ell(ctx, 1.8, -13.8, 3.9, 4.9, 0, C.peach, 0);
  if (dash) dashLegs(ctx, hx, hy, ph); else leg(ctx, hx + 0.6, hy, L[1], K[1], false);
  head(ctx, o);
  arm(ctx, sx, sy, A[1], E[1], false);
  ctx.restore();
}
/* Соник в позе по скорости и состоянию (общий для игры и баннера) */
function poseFor(spd, ball) { if (ball) return "ball"; const v = Math.abs(spd); return v < 0.05 ? "stand" : v < 4 ? "walk" : v < 8.5 ? "run" : "dash"; }

/* ═════════ Соник кадрами (23.10.2026, «сделай максимально похожим на оригинал»): полосы NeuralBox по образцу (Код\unitka\sonic\make_sprites.py)
   sonic-run.webp — 8 кадров бега; sonic-poses.webp — стоит, стучит ногой, «восьмёрка» ×2, клубок, пружина, удар, победа; -gold — Супер Соник.
   Кадр 320×320, ноги в (160, 310), рост стоя 280 px = 40 единиц игры; клубок — центр (160, 160). Не загрузились — рисуем векторами. */
const SU = 40 / 280;
const PF = { stand: 0, tap: 1, ball: 4, spring: 5, hurt: 6, dead: 6, win: 7 };
function strips(gold) { return gold ? [pic("runG", "sonic-run-gold.webp"), pic("posG", "sonic-poses-gold.webp")] : [pic("run", "sonic-run.webp"), pic("pos", "sonic-poses.webp")]; }
function sprPick(o, gold) {                       // какой кадр какой полосы: {im, f, ball, k}
  const [run, pos] = strips(gold), pose = o.pose;
  let im = pos, f = 0, ball = false;
  if (pose === "ball" || pose === "charge" || pose === "crouch") { f = 4; ball = true; }
  else if (pose === "walk" || pose === "run" || pose === "push") { im = run; f = ((Math.floor((o.ph || 0) / TAU * 8) % 8) + 8) % 8; }
  else if (pose === "skid") { im = run; f = 0; }
  else if (pose === "dash") f = 2 + (((Math.floor((o.ph || 0) * 0.9)) % 2) + 2) % 2;
  else f = PF[pose] || 0;
  return { im, f, ball, ok: im.complete && im.naturalWidth > 0, k: (gold ? "g" : "") + (im === run ? "r" : "p") + f };
}
/* рисует кадр в системе координат ног (как sonic()); cache(q) → готовый холст кадра нужного размера, иначе режем полосу на лету.
   Кадры ещё грузятся — false (рисуем векторами). */
function sonicSpr(ctx, o, gold, cache) {
  const q = sprPick(o, gold), pose = o.pose;
  if (!q.ok) return false;
  ctx.save();
  if (q.ball) { ctx.translate(0, -14); if (pose !== "crouch") ctx.rotate(o.rot || 0); if (pose === "charge") ctx.scale(1.08, 0.92); }
  else if (pose === "push") ctx.rotate(0.28);
  else if (pose === "skid") ctx.rotate(-0.26);
  const cy = q.ball ? 160 : 310, s = 320 * SU;
  if (cache) ctx.drawImage(cache(q), -160 * SU, -cy * SU, s, s);
  else ctx.drawImage(q.im, q.f * 320, 0, 320, 320, -160 * SU, -cy * SU, s, s);
  ctx.restore();
  return true;
}

/* ═════════ кольцо, искры, предметы и враги ═════════ */
function ring(ctx, x, y, ph, sc) {
  const w = Math.max(0.12, Math.abs(Math.cos(ph))) * (sc || 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(w, sc || 1);
  ctx.beginPath(); ctx.arc(0, 0, 6.4, 0, TAU); ctx.lineWidth = 4.8; ctx.strokeStyle = C.gold2; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = C.gold; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 6.4, PI * 1.05, PI * 1.45); ctx.lineWidth = 1.3; ctx.strokeStyle = C.gold3; ctx.stroke();
  ctx.restore();
}
function star(ctx, x, y, r, col, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a || 0); ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r, t = i * PI / 4; ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
}
function moto(ctx, e, t) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.dir < 0 ? 1 : -1, 1);
  ctx.save(); ctx.translate(3, -6); ell(ctx, 0, 0, 6, 6, 0, "#5c6178", 1.1); ctx.rotate(-e.x * 0.18 * (e.dir < 0 ? 1 : -1));
  ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * PI / 3; ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(-Math.cos(a) * 5, -Math.sin(a) * 5); }
  ctx.strokeStyle = "#c9cfdd"; ctx.lineWidth = 1.2; ctx.stroke(); ell(ctx, 0, 0, 1.8, 1.8, 0, "#ffcf26", 0.8); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-15, -9); ctx.quadraticCurveTo(-16, -29, 3, -29); ctx.quadraticCurveTo(18, -29, 16.5, -12); ctx.lineTo(16, -9); ctx.closePath();
  ctx.fillStyle = "#e3262b"; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = OL; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -29); ctx.lineTo(3, -9); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
  ell(ctx, 9, -21, 2.4, 2.4, 0, OL, 0); ell(ctx, -3, -22, 2.2, 2.2, 0, OL, 0); ell(ctx, 10, -14, 1.8, 1.8, 0, OL, 0);
  ctx.beginPath(); ctx.arc(1, -24, 9, PI * 1.1, PI * 1.45); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.stroke();
  ell(ctx, -15, -16, 5, 7, 0, "#3a4058", 1.1); ell(ctx, -16.2, -18, 2.4, 2.9, 0, "#fff", 0); ell(ctx, -17, -17.8, 1.1, 1.6, 0, "#e3262b", 0);
  ctx.beginPath(); ctx.moveTo(-12, -27); ctx.quadraticCurveTo(-14, -34, -9, -35); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke(); ell(ctx, -9, -35, 1.6, 1.6, 0, "#ffcf26", 0.8);
  if (Math.floor(t / 6) % 4 === 0) { ell(ctx, 19, -12, 2.4, 2, 0, "rgba(200,205,220,.8)", 0); ell(ctx, 23, -14, 1.6, 1.4, 0, "rgba(200,205,220,.6)", 0); }
  ctx.restore();
}
function buzz(ctx, e, t) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.dir < 0 ? 1 : -1, 1);
  const f = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.9));
  ctx.save(); ctx.scale(1, f); ell(ctx, 2, -9, 9, 7, -0.3, "rgba(220,240,255,.75)", 0.9); ell(ctx, 10, -8, 7, 5, 0.3, "rgba(220,240,255,.6)", 0.9); ctx.restore();
  ctx.beginPath(); ctx.ellipse(4, 0, 13, 5.6, 0, 0, TAU); ctx.fillStyle = "#ffcf26"; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = OL; for (const x of [2, 8, 14]) ctx.fillRect(x, -6, 3, 12); ctx.restore();
  ctx.lineWidth = 1.2; ctx.strokeStyle = OL; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(19, 9); ctx.lineTo(13, 6); ctx.closePath(); ctx.fillStyle = "#9aa3b8"; ctx.fill(); ctx.stroke();
  ell(ctx, -10, -1, 6, 5.4, 0, "#3a4058", 1.2); ell(ctx, -12, -2, 2.6, 2.6, 0, "#e3262b", 0); ell(ctx, -12.6, -2.6, 0.8, 0.8, 0, "#fff", 0);
  ctx.restore();
}
function crab(ctx, e, t) {
  ctx.save(); ctx.translate(e.x, e.y);
  const up = e.fire > 0 ? 1 : 0, w = Math.sin(t * 0.25) * (e.vx ? 1 : 0);
  ctx.strokeStyle = OL; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  for (const sx of [-1, 1]) for (const k of [0, 1]) { ctx.beginPath(); const bx = sx * (5 + k * 6); ctx.moveTo(bx, -10); ctx.lineTo(bx + sx * 4, -5 + (k ? w : -w) * 2); ctx.lineTo(bx + sx * 5, 0); ctx.stroke(); }
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 14, -16); ctx.rotate(sx * (up ? -0.9 : -0.2));
    line(ctx, [0, 0, sx * 4, -6], 2.4, "#d84a1c");
    ctx.translate(sx * 5, -11); ell(ctx, 0, 0, 5.2, 4.4, 0, "#e8572a", 1.1);
    ctx.beginPath(); ctx.moveTo(sx * 1, -1); ctx.lineTo(sx * 6, -4); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  }
  ell(ctx, 0, -15, 15, 8.5, 0, "#e8572a", 1.3);
  ctx.beginPath(); ctx.arc(-2, -17, 9, PI * 1.1, PI * 1.5); ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2; ctx.stroke();
  for (const sx of [-1, 1]) { line(ctx, [sx * 4, -21, sx * 5, -26], 1.4, "#e8572a"); ell(ctx, sx * 5, -27.5, 2.6, 2.6, 0, "#fff", 1); ell(ctx, sx * 5.4, -27.5, 1.1, 1.3, 0, OL, 0); }
  ctx.restore();
}
function monitor(ctx, m, t) {
  ctx.save(); ctx.translate(m.x, m.y);
  if (m.broken) { ctx.fillStyle = "#8d95ab"; ctx.fillRect(-12, -5, 24, 5); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.strokeRect(-12, -5, 24, 5); ctx.restore(); return; }
  ctx.fillStyle = "#cfd5e3"; ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.roundRect(-13, -30, 26, 26, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#8d95ab"; ctx.fillRect(-10, -4, 20, 4); ctx.strokeRect(-10, -4, 20, 4);
  ctx.fillStyle = "#13204a"; ctx.fillRect(-10, -27, 20, 18);
  if (Math.floor(t / 4) % 8 !== 0) monIcon(ctx, m.kind, 0, -18, 1);
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(-10, -27, 20, 5);
  ctx.restore();
}
function monIcon(ctx, k, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (k === "ring") { ring(ctx, -2.5, 0.5, 0, 0.75); ring(ctx, 2.5, -0.5, 0, 0.75); }
  else if (k === "shield") { ell(ctx, 0, 0, 6.5, 6.5, 0, "rgba(90,170,255,.55)", 0); ctx.strokeStyle = "#bfe3ff"; ctx.lineWidth = 1.4; ctx.stroke(); ell(ctx, -2, -2.5, 1.6, 1.2, -0.5, "#fff", 0); }
  else if (k === "shoes") shoe(ctx, -3.4, 1.4, 0, false);
  else if (k === "star") { star(ctx, 0, 0, 7, "#ffcf26", 0); }
  else if (k === "life") { ctx.scale(0.42, 0.42); ctx.translate(-2, 26); head(ctx, {}); }
  ctx.restore();
}
function spring(ctx, sp) {
  ctx.save(); ctx.translate(sp.x, sp.y); if (sp.diag) ctx.rotate(PI / 4);
  const h = sp.t > 0 ? 5 : 11;
  ctx.fillStyle = "#9aa3b8"; ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.fillRect(-13, -4, 26, 4); ctx.strokeRect(-13, -4, 26, 4);
  ctx.beginPath(); for (let i = 0; i <= 4; i++) ctx.lineTo(i % 2 ? 6 : -6, -4 - i * (h - 4) / 4); ctx.strokeStyle = "#5c6178"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = sp.k === "r" ? "#e3262b" : "#ffcf26"; ctx.beginPath(); ctx.roundRect(-14, -h - 4, 28, 5, 2); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}
function spikes(ctx, s) {
  ctx.save(); ctx.translate(s.x, s.y); const w = s.w, n = Math.round(w / 8);
  ctx.fillStyle = "#8d95ab"; ctx.fillRect(-w / 2, -4, w, 4); ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.strokeRect(-w / 2, -4, w, 4);
  for (let i = 0; i < n; i++) { const x = -w / 2 + i * 8; ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x + 4, -16); ctx.lineTo(x + 8, -4); ctx.closePath();
    const g = ctx.createLinearGradient(x, 0, x + 8, 0); g.addColorStop(0, "#f2f4fa"); g.addColorStop(1, "#8d95ab"); ctx.fillStyle = g; ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function booster(ctx, b, t) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = "#3a4058"; ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.roundRect(-17, -5, 34, 5, 2); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.globalAlpha = (Math.floor(t / 5) % 3) === i ? 1 : 0.35; ctx.fillStyle = "#ffcf26";
    ctx.beginPath(); ctx.moveTo(-11 + i * 9, -4.4); ctx.lineTo(-6 + i * 9, -2.5); ctx.lineTo(-11 + i * 9, -0.6); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.restore();
}
function post(ctx, p, t) {
  ctx.save(); ctx.translate(p.x, p.y);
  line(ctx, [0, 0, 0, -40], 2.6, "#2b6fe8"); ctx.fillStyle = "#9aa3b8"; ctx.fillRect(-4, -3, 8, 3);
  const a = p.on ? t * 0.3 : 0; ell(ctx, Math.sin(a) * 2, -44, 4.4, 4.4, 0, p.on ? "#ff3d3d" : "#2b6fe8", 1.1);
  if (p.on) star(ctx, Math.sin(a) * 2, -44, 5, "rgba(255,255,255,.8)", t * 0.1);
  ctx.restore();
}
function signpost(ctx, s, t) {
  ctx.save(); ctx.translate(s.x, s.y);
  line(ctx, [0, 0, 0, -30], 2.4, "#9aa3b8");
  const spin = s.t > 0 ? s.t : 0, a = spin * 0.35, w = Math.cos(a), back = s.done && spin > 70;
  ctx.translate(0, -44); ctx.scale(Math.max(0.08, Math.abs(w)), 1);
  ctx.beginPath(); ctx.roundRect(-15, -15, 30, 30, 4); ctx.fillStyle = "#cfd5e3"; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = OL; ctx.stroke();
  if (back || (w < 0 && spin)) { ctx.save(); ctx.scale(0.62, 0.62); ctx.translate(-1, 26); head(ctx, {}); ctx.restore(); }
  else { ctx.font = "900 20px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#e3262b"; ctx.fillText("?", 0, 1.5); }
  ctx.restore();
}
function palm(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (let i = 0; i < 9; i++) { const yy = -i * 11; ctx.beginPath(); ctx.roundRect(-5 + i * 0.5, yy - 12, 10 - i * 0.2, 12, 3);
    ctx.fillStyle = i % 2 ? "#b47a00" : "#c88a10"; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = "#5c3a00"; ctx.stroke(); }
  ctx.translate(5, -104);
  const L = [[-46, 10, -32, -4, -54, -12, "#46b81c"], [50, 12, 38, -4, 58, -10, "#46b81c"], [-30, 30, -28, 14, -46, 20, "#2f9a12"], [36, 32, 36, 14, 52, 22, "#2f9a12"], [-18, -34, -4, -26, 0, -42, "#5fd02a"], [30, -32, 28, -18, 44, -22, "#5fd02a"]];
  ctx.lineJoin = "round"; ctx.lineWidth = 1.6; ctx.strokeStyle = "#155c08";
  for (const l of L) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.lineTo(l[4], l[5]); ctx.lineTo(l[0] * 0.3, l[1] * 0.3 - 12); ctx.closePath(); ctx.fillStyle = l[6]; ctx.fill(); ctx.stroke(); }
  ell(ctx, -3, 3, 4.6, 4.6, 0, "#8a5200", 1); ell(ctx, 5, 4, 4.6, 4.6, 0, "#8a5200", 1);
  ctx.restore();
}
function sunflower(ctx, x, y, t, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  line(ctx, [0, 0, 0, -30], 2, "#2f9a12");
  ctx.save(); ctx.translate(0, -36); ctx.rotate(Math.sin(t * 0.03) * 0.15);
  for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i * TAU / 10); ell(ctx, 0, -7, 2.6, 5, 0, "#ffd21f", 0.8); ctx.restore(); }
  ell(ctx, 0, 0, 5, 5, 0, "#7a3d0a", 1); ctx.restore(); ctx.restore();
}
function bird(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); if (p.vx < 0) ctx.scale(-1, 1);
  ell(ctx, 0, 0, 5, 4, 0, p.kind ? "#f4f4f8" : "#3f86ff", 1); ell(ctx, 3, -1.5, 1, 1, 0, OL, 0);
  ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(7, 0.6); ctx.lineTo(4.5, 1.2); ctx.fillStyle = "#ffb000"; ctx.fill();
  ctx.save(); ctx.translate(-1, -2); ctx.rotate(Math.sin(p.t * 0.6) * 0.8); ell(ctx, -2, -2, 4, 2, -0.5, p.kind ? "#ffc2d6" : "#7fb2ff", 0.8); ctx.restore();
  ctx.restore();
}

/* ═════════ уровень: земля участками (шаг 8), ямы, уступы, платформы, петли ═════════ */
function Lvl(act) { this.act = act; this.segs = []; this.plats = []; this.loops = []; this.ents = []; this.rg = []; this.deco = []; this.x = 0; this.y = 0; this.cur = null; this.arena = null; this.end = 0; }
Lvl.prototype.start = function (x, y) { this.x = x; this.y = y; this.cur = { x0: x, ys: [y] }; this.segs.push(this.cur); return this; };
Lvl.prototype.run = function (len, d, shape) {
  const n = Math.max(1, Math.round(len / 8)), y0 = this.y;
  for (let i = 1; i <= n; i++) { const t = i / n; this.cur.ys.push(shape === "hill" ? y0 - d * Math.sin(PI * t) : shape === "cos" ? y0 + d * (1 - Math.cos(PI * t)) / 2 : y0 + d * t); }
  this.x += n * 8; if (shape !== "hill") this.y = y0 + d; return this;
};
Lvl.prototype.flat = function (len) { return this.run(len, 0, "lin"); };
Lvl.prototype.slope = function (len, d) { return this.run(len, d, "cos"); };
Lvl.prototype.hill = function (len, h) { return this.run(len, h, "hill"); };
Lvl.prototype.close = function () { this.cur.x1 = this.cur.x0 + (this.cur.ys.length - 1) * 8; };
Lvl.prototype.gap = function (len) { this.close(); this.x += Math.round(len / 8) * 8; this.cur = { x0: this.x, ys: [this.y] }; this.segs.push(this.cur); return this; };
Lvl.prototype.step = function (d) { this.close(); this.y += d; this.cur = { x0: this.x, ys: [this.y] }; this.segs.push(this.cur); return this; };
Lvl.prototype.finish = function () { this.close(); this.bottom = Math.max(...this.segs.map(s => Math.max(...s.ys))) + 140; return this; };
Lvl.prototype.gy = function (x) {                         // высота земли под x (null — яма)
  const S = this.segs; let lo = 0, hi = S.length - 1, s = null;
  while (lo <= hi) { const m = (lo + hi) >> 1, g = S[m]; if (x < g.x0) hi = m - 1; else if (x >= (g.x1 === undefined ? g.x0 + (g.ys.length - 1) * 8 : g.x1)) lo = m + 1; else { s = g; break; } }
  if (!s) { const last = S[S.length - 1]; if (last && x === last.x1) s = last; else return null; }
  const f = (x - s.x0) / 8, i = Math.floor(f), j = Math.min(s.ys.length - 1, i + 1);
  return lerp(s.ys[i], s.ys[j], f - i);
};
Lvl.prototype.ang = function (x) { const a = this.gy(x - 4), b = this.gy(x + 4); return a === null || b === null ? 0 : Math.atan2(a - b, 8); };
Lvl.prototype.put = function (type, dx, o) { const x = this.x + dx; this.ents.push(Object.assign({ type, x, y: this.gy(x) }, o || {})); return this; };
Lvl.prototype.air = function (type, dx, h, o) { const x = this.x + dx; this.ents.push(Object.assign({ type, x, y: this.gy(x) - h }, o || {})); return this; };
Lvl.prototype.rings = function (dx, n, h, arc, sp) {
  sp = sp || 24; for (let i = 0; i < n; i++) { const x = this.x + dx + i * sp, g = this.gy(x); if (g === null) continue;
    this.rg.push({ x, y: g - h - (arc ? arc * Math.sin(PI * (n > 1 ? i / (n - 1) : 0.5)) : 0) }); } return this;
};
Lvl.prototype.ringsAt = function (x, y, n, sp, arc) { for (let i = 0; i < n; i++) this.rg.push({ x: x + i * (sp || 24), y: y - (arc ? arc * Math.sin(PI * (n > 1 ? i / (n - 1) : 0.5)) : 0) }); return this; };
Lvl.prototype.plat = function (dx, dy, w, mv) { this.plats.push({ x: this.x + dx, y: this.y + dy, w, mv: mv || null, cx: this.x + dx, cy: this.y + dy, vx: 0, vy: 0 }); return this; };
Lvl.prototype.loop = function (dx, r) {
  const x = this.x + dx, by = this.gy(x); this.loops.push({ x, by, r });
  for (let i = 1; i < 12; i++) { const th = i / 12 * TAU; this.rg.push({ x: x + (r - 16) * Math.sin(th), y: by - r + (r - 16) * Math.cos(th) }); }
  return this;
};
Lvl.prototype.deco1 = function (k, dx, s) { const x = this.x + dx; this.deco.push({ k, x, y: this.gy(x) + 2, s: s || 1 }); return this; };

function act1() {
  const L = new Lvl(1).start(0, 400);
  L.flat(512).deco1("palm", -440, 0.9).deco1("sun", -300, 0.8).deco1("sun", -268, 0.65).rings(-330, 6, 26);
  L.hill(384, 48).rings(-352, 8, 30, 44).deco1("palm", -200, 0.8);
  L.flat(256).put("moto", -110).deco1("sun", -230, 0.8);
  L.slope(320, -72).rings(-280, 5, 26);
  L.flat(192).put("mon", -110, { kind: "ring" });
  L.step(-40).flat(352).air("buzz", -170, 74).rings(-320, 5, 26).deco1("palm", -60, 1);
  L.slope(256, 56);
  L.gap(128).ringsAt(L.x - 128, L.y - 52, 5, 26, 30);
  L.flat(256).put("spk", -112, { w: 32 }).deco1("sun", -40, 0.8);
  L.slope(384, 136).rings(-360, 6, 26);
  L.flat(128).put("boost", -96);
  L.flat(448).loop(-288, 72).deco1("palm", -60, 0.9);
  L.flat(192).put("post", -120);
  L.flat(160).put("spr", -64, { k: "y" });
  const sx = L.x - 64;
  L.plat(40, -110, 96).plat(190, -150, 96).plat(340, -120, 96);
  L.ringsAt(sx + 60, L.y - 170, 6, 26, 40);
  L.ents.push({ type: "mon", x: L.x + 388, y: L.y - 120, kind: "life" });
  L.flat(512).put("moto", -300).put("crab", -120).deco1("palm", -400, 0.8);
  L.hill(320, 40).rings(-300, 7, 30, 40).deco1("sun", -160, 0.8);
  L.flat(192).put("spk", -112, { w: 48 }).deco1("sun", -40, 0.75);
  L.slope(256, -96);
  L.flat(96).put("mon", -40, { kind: "shield" });
  L.gap(176).plat(-112, 0, 56, { ax: 0, ay: 22, per: 150 });
  L.flat(320).air("buzz", -150, 70).rings(-280, 6, 26).deco1("palm", -40, 1);
  // вторая половина акта: холмы с крабом, вторая петля, лесенка уступов, пружина на платформы
  L.flat(256).put("crab", -120).rings(-220, 5, 26);
  L.hill(448, 64).rings(-420, 9, 30, 52).air("buzz", -220, 110).deco1("palm", -100, 0.9);
  L.slope(320, 96).deco1("sun", -60, 0.8);
  L.flat(128).put("boost", -96);
  L.flat(448).loop(-288, 72);
  L.flat(256).put("mon", -150, { kind: "ring" }).put("moto", -40);
  L.step(-32).flat(224).put("spk", -112, { w: 32 });
  L.step(-32).flat(256).rings(-220, 6, 26).air("buzz", -200, 92);
  L.gap(144).ringsAt(L.x - 144, L.y - 56, 5, 30, 32);
  L.flat(192).put("spr", -64, { k: "y" });
  L.plat(60, -120, 112).plat(260, -160, 112);
  L.ringsAt(L.x + 70, L.y - 150, 4, 26).ringsAt(L.x + 270, L.y - 190, 4, 26);
  L.flat(512).put("moto", -260).put("crab", -90).deco1("palm", -380, 0.85);
  L.slope(256, 64);
  L.flat(512).put("sign", -300).deco1("sun", -440, 0.8).deco1("palm", -180, 0.9);
  L.flat(480);
  L.end = L.x;
  return L.finish();
}
function act2() {
  const L = new Lvl(2).start(0, 420);
  L.flat(448).rings(-360, 6, 26).deco1("palm", -400, 0.9).deco1("sun", -200, 0.8);
  L.slope(256, -64);
  L.flat(128).put("mon", -64, { kind: "shoes" });
  L.step(-40).flat(320).put("moto", -240).put("moto", -90).rings(-300, 5, 26);
  L.gap(160).ringsAt(L.x - 160, L.y - 56, 6, 26, 32);
  L.flat(224).put("crab", -110).deco1("sun", -40, 0.8);
  L.hill(384, 56).rings(-352, 8, 30, 46).air("buzz", -200, 100);
  L.slope(320, 128).deco1("palm", -300, 0.9);
  L.flat(128).put("boost", -96);
  L.flat(448).loop(-288, 72);
  L.flat(160).put("spk", -96, { w: 32 });
  L.step(-48).flat(288).air("buzz", -160, 70).rings(-260, 5, 26);
  L.flat(224).put("spr", -64, { k: "r" }).put("mon", -170, { kind: "ring" });
  L.gap(320);
  L.ringsAt(L.x - 330, L.y - 300, 7, 32, 40);
  L.flat(256).put("post", -160).deco1("sun", -60, 0.8);
  L.slope(384, -96).put("crab", -300).put("crab", -120);
  L.flat(192).put("spk", -100, { w: 48 });
  L.flat(96).put("mon", -48, { kind: "star" });
  L.gap(128).ringsAt(L.x - 128, L.y - 52, 5, 26, 30);
  L.flat(320).put("moto", -220).air("buzz", -80, 72).deco1("palm", -300, 0.9);
  L.hill(320, 48).rings(-300, 7, 30, 40);
  // вторая половина: уступ, качающаяся платформа над ямой, высокий холм, лесенка платформ
  L.flat(224).put("crab", -100);
  L.step(-40).flat(192).put("mon", -96, { kind: "shield" });
  L.gap(160).plat(-112, 10, 64, { ax: 0, ay: 26, per: 130 }).ringsAt(L.x - 150, L.y - 60, 5, 30, 30);
  L.flat(256).air("buzz", -140, 76).put("spk", -40, { w: 32 });
  L.hill(448, 72).rings(-420, 9, 30, 56).put("moto", -60);
  L.flat(160).put("spr", -64, { k: "y" });
  L.plat(70, -130, 96).plat(240, -170, 96).plat(410, -130, 96);
  L.ringsAt(L.x + 80, L.y - 160, 3, 26).ringsAt(L.x + 250, L.y - 200, 3, 26).ringsAt(L.x + 420, L.y - 160, 3, 26);
  L.flat(512).put("crab", -300).put("moto", -100).deco1("palm", -200, 0.9);
  L.slope(384, 112).deco1("sun", -200, 0.8);
  L.flat(128).put("boost", -96);
  L.flat(448).loop(-288, 72);
  L.flat(320).rings(-280, 8, 26).deco1("palm", -100, 0.9);
  const ax = L.x; L.flat(896); L.arena = { x0: ax, x1: L.x, y: L.y };
  L.ringsAt(ax + 160, L.y - 26, 5, 24).ringsAt(ax + 600, L.y - 26, 5, 24);
  L.end = L.x;
  return L.finish();
}
const ACTS = [act1, act2];

/* ═════════ игра ═════════ */
function mount(cv) {
  const ctx = cv.getContext("2d");
  let W = 400, H = 224, k = 1, dpr = 1, cssW = 0, cssH = 0, raf = 0, running = false, last = 0, accT = 0, T = 0;
  let cloudsR = null, hillsR = null, chk = null, back = null, SC = 1, TD = 512;
  const tiles = new Map(), hudC = {};      // неподвижное (земля, петли, пальмы) — плитками 512×256 один раз; табло — только когда меняются цифры
  const SPR = new Map();                   // готовые кадры: кольцо (16 фаз) и Соник (поза × 24 фазы бега / поворота клубка)
  function sprite(key, w, h, ox, oy, fn) {
    let c = SPR.get(key); if (c) return c;
    c = document.createElement("canvas"); c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC);
    const g = c.getContext("2d"); g.setTransform(SC, 0, 0, SC, ox * SC, oy * SC); fn(g);
    c.ox = ox; c.oy = oy; c.w = w; c.h = h; SPR.set(key, c); if (SPR.size > 500) SPR.delete(SPR.keys().next().value);
    return c;
  }
  function ringAt(x, y, ph) {
    const i = ((Math.round(ph / PI * 16) % 16) + 16) % 16, c = sprite("r" + i, 18, 18, 9, 9, g => ring(g, 0, 0, i * PI / 16));
    ctx.drawImage(c, x - 9, y - 9, 18, 18);
  }
  const frameC = q => sprite("S" + q.k, 320 * SU, 320 * SU, 0, 0, g => { g.imageSmoothingQuality = "high"; g.drawImage(q.im, q.f * 320, 0, 320, 320, 0, 0, 320 * SU, 320 * SU); });
  function sonicAt(o) {                    // в уже повёрнутой/отражённой системе координат ног
    if (sonicSpr(ctx, o, !!SUP.on, frameC)) return;
    const ball = o.pose === "ball" || o.pose === "charge", n = 24;
    const i = ((Math.round((ball ? o.rot : o.ph) / TAU * n) % n) + n) % n;
    const key = "s" + o.pose + i + (o.blink ? "b" : "") + (o.eyesX ? "x" : "");
    const c = sprite(key, 70, 56, 30, 50, g => sonic(g, Object.assign({}, o, ball ? { rot: i * TAU / n } : { ph: i * TAU / n })));
    ctx.drawImage(c, -30, -50, 70, 56);
  }
  const G = { state: "title", act: 0, score: 0, lives: 3, L: null, ents: [], rings: [], sr: [], fx: [], cam: { x: 0, y: 0 }, t: 0, time: 0, st: 0, held: false, tap: false, boss: null, hint: 0, lifeAt: 100,
    // режим: auto — бежит сам, тап — прыжок (как Sonic Runners); manual — сам одним пальцем в любом месте: тянешь вбок — скорость
    // (держится и после отпускания), тап или взмах вверх — прыжок, вниз — присесть / клубок, вниз и держать — спин-дэш; клавиши ← → ↓ пробел
    // pad — «кнопки» как в мобильных играх: джойстик появляется под левым пальцем (вбок — бег, вниз — присесть), правая половина — прыжок
    mode: ["manual", "pad"].includes(LSG("unitka.sxMode")) ? LSG("unitka.sxMode") : "auto", gest: null, cruise: 0, gDown: false, gHeld: false, fullJump: false,
    joy: null, pad: { x: 0, down: false }, padJ: new Set(), menu: false, flash: null, prog: +(LSG("unitka.sxProg") || 0) || 0,
    keys: { L: false, R: false, D: false, J: false }, kbd: false, ui: [] };
  const S = {};
  const dbg = { bot: false, god: false };

  function resize() {
    const r = cv.getBoundingClientRect(); cssW = Math.max(1, r.width); cssH = Math.max(1, r.height); dpr = DPR();
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    // масштаб (пикселей экрана на единицу игры): по высоте 224, на узком — по ширине 336; округлён так, чтобы плитка 512 была целой и чётной —
    // тогда плитки ложатся на пиксели без швов
    const sc0 = cssW / cssH >= 1.5 ? cv.height / 224 : cv.width / 336;
    TD = Math.max(64, Math.round(512 * sc0 / 8) * 8); SC = TD / 512;
    W = cv.width / SC; H = cv.height / SC; k = SC / dpr;
    chk = back = null; cloudsR = hillsR = null; tiles.clear(); SPR.clear(); hudC.key = "";
  }
  function checker(g) {
    if (!chk) {
      const n = Math.round(64 * SC), c = document.createElement("canvas"); c.width = c.height = n;
      const x = c.getContext("2d"), h = n / 2; x.fillStyle = "#cf6b16"; x.fillRect(0, 0, n, n); x.fillStyle = "#853409"; x.fillRect(0, 0, h, h); x.fillRect(h, h, h, h);
      x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(0, 0, n, n * 0.04); x.fillRect(0, h, n, n * 0.04); chk = c;
    }
    const p = g.createPattern(chk, "repeat"); p.setTransform(new DOMMatrix([64 / chk.width, 0, 0, 64 / chk.width, 0, 0])); return p;
  }
  function raster(im, hgt) {                               // svg-картинку слоя один раз в растр нужного размера
    if (!im.complete || !im.naturalWidth) return null;
    const h = Math.round(hgt * SC), w = Math.round(im.naturalWidth / im.naturalHeight * hgt * SC);
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(im, 0, 0, w, h); c.uw = w / SC; c.uh = hgt; return c;
  }
  /* плитка неподвижного мира: пальмы и подсолнухи, земля в клетку с травой, петли, неподвижные платформы */
  function tile(ix, iy) {
    const key = ix + "," + iy; let c = tiles.get(key);
    if (c !== undefined) { tiles.delete(key); tiles.set(key, c); return c; }
    const x0 = ix * 512, y0 = iy * 256, x1 = x0 + 512, y1 = y0 + 256, L = G.L;
    // пустое небо — без картинки
    const any = L.segs.some(s => s.x0 <= x1 + 16 && s.x0 + (s.ys.length - 1) * 8 >= x0 - 16 && Math.min(...s.ys) - 12 < y1) ||
      L.loops.some(l => Math.abs(l.x - x0 - 256) < 256 + l.r + 30 && l.by - 2 * l.r - 30 < y1 && l.by + 30 > y0) ||
      L.plats.some(p => !p.mv && p.x + p.w > x0 && p.x < x1 && p.y < y1 && p.y + 30 > y0) || L.deco.some(d => d.x > x0 - 70 && d.x < x1 + 70 && d.y > y0 - 10 && d.y - 140 < y1);
    if (!any) { tiles.set(key, null); return null; }
    c = document.createElement("canvas"); c.width = TD; c.height = TD / 2;
    const g = c.getContext("2d");
    g.setTransform(SC, 0, 0, SC, -x0 * SC, -y0 * SC);
    drawStatic(g, x0, x0 + 512, y0, y0 + 256);
    tiles.set(key, c); if (tiles.size > 18) tiles.delete(tiles.keys().next().value);
    return c;
  }
  function drawStatic(g, x0, x1, y0, y1) {
    const L = G.L, pt = checker(g), bottom = y1 + 40;
    for (const d of L.deco) if (d.x > x0 - 70 && d.x < x1 + 70 && d.y > y0 - 10 && d.y - 140 < y1) { if (d.k === "palm") palm(g, d.x, d.y, d.s * 0.62); else sunflower(g, d.x, d.y, 0, d.s); }
    for (const s of L.segs) {
      const sx1 = s.x0 + (s.ys.length - 1) * 8; if (sx1 < x0 - 8 || s.x0 > x1 + 8) continue;
      const i0 = Math.max(0, Math.floor((x0 - 16 - s.x0) / 8)), i1 = Math.min(s.ys.length - 1, Math.ceil((x1 + 16 - s.x0) / 8));
      let top = 1e9; for (let i = i0; i <= i1; i++) top = Math.min(top, s.ys[i]); if (top - 12 > y1) continue;
      g.beginPath(); g.moveTo(s.x0 + i0 * 8, Math.max(bottom, s.ys[i0] + 40));
      for (let i = i0; i <= i1; i++) g.lineTo(s.x0 + i * 8, s.ys[i]);
      g.lineTo(s.x0 + i1 * 8, Math.max(bottom, s.ys[i1] + 40)); g.closePath(); g.fillStyle = pt; g.fill();
      g.lineWidth = 2; g.strokeStyle = "#4a1c04"; g.stroke();
      g.beginPath(); for (let i = i0; i <= i1; i++) { const x = s.x0 + i * 8, y = s.ys[i] + 5; i === i0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.lineJoin = "round"; g.lineCap = "butt";
      g.save(); g.translate(0, 11); g.strokeStyle = "rgba(60,18,0,.32)"; g.lineWidth = 10; g.stroke(); g.restore();        // тень под травой — земля глубже
      g.strokeStyle = "#155c08"; g.lineWidth = 15; g.stroke(); g.strokeStyle = "#3fbf1c"; g.lineWidth = 11; g.stroke();
      g.save(); g.translate(0, -3.6); g.strokeStyle = "#9ce94d"; g.lineWidth = 2.6; g.stroke(); g.restore();
      // кустики травы над кромкой и редкие цветы (по координате — плитки совпадают при любой перерисовке)
      g.fillStyle = "#2b9612";
      for (let i = i0; i <= i1; i++) {
        const x = s.x0 + i * 8, y = s.ys[i] - 1, hs = ((x * 2654435761) >>> 0) % 997;
        if (hs % 3 === 0) { const t = 3 + hs % 4; g.beginPath(); g.moveTo(x - 4, y + 1); g.lineTo(x - 2, y - t); g.lineTo(x, y); g.lineTo(x + 1.5, y - t - 2); g.lineTo(x + 3, y); g.lineTo(x + 5, y - t + 1); g.lineTo(x + 6, y + 1); g.fill(); }
        if (hs % 23 === 0 && i > 0 && i < s.ys.length - 1 && Math.abs(s.ys[i + 1] - s.ys[i - 1]) < 6) {
          g.strokeStyle = "#1d7a0c"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x, y - 11); g.stroke();
          const pc = hs % 2 ? "#c04ce6" : "#ff5a7a";
          for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - PI / 2; ell(g, x + Math.cos(a) * 3, y - 13 + Math.sin(a) * 3, 2.2, 2.2, 0, pc, 0.6); }
          ell(g, x, y - 13, 1.8, 1.8, 0, "#ffd21f", 0.6); g.fillStyle = "#2b9612";
        }
      }
    }
    for (const l of L.loops) {
      if (l.x + l.r + 30 < x0 || l.x - l.r - 30 > x1) continue;
      const cy = l.by - l.r; g.beginPath(); g.arc(l.x, cy, l.r + 22, 0, TAU); g.arc(l.x, cy, l.r, 0, TAU, true);
      g.fillStyle = pt; g.fill(); g.lineWidth = 2; g.strokeStyle = "#4a1c04"; g.stroke();
      g.beginPath(); g.arc(l.x, cy, l.r + 3, 0, TAU); g.strokeStyle = "#155c08"; g.lineWidth = 9; g.stroke(); g.strokeStyle = "#3fbf1c"; g.lineWidth = 6; g.stroke();
      g.beginPath(); g.arc(l.x, cy, l.r + 1.2, 0, TAU); g.strokeStyle = "#9ce94d"; g.lineWidth = 1.6; g.stroke();
    }
    for (const p of L.plats) if (!p.mv && p.x + p.w > x0 && p.x < x1) platform(g, p, pt);
  }
  function platform(g, p, pt) {
    g.beginPath(); g.roundRect(p.cx, p.cy, p.w, 26, [2, 2, 12, 12]); g.fillStyle = pt; g.fill(); g.lineWidth = 1.8; g.strokeStyle = "#4a1c04"; g.stroke();
    g.beginPath(); g.moveTo(p.cx + 2, p.cy + 4); g.lineTo(p.cx + p.w - 2, p.cy + 4); g.lineCap = "round"; g.strokeStyle = "#155c08"; g.lineWidth = 11; g.stroke(); g.strokeStyle = "#3fbf1c"; g.lineWidth = 7.5; g.stroke();
  }
  /* небо, дальние горы и море — одной полосой шириной 1200 (горы — синусы с периодом, делящим 1200), рисуется сдвигом */
  function backdrop() {
    if (back) return back;
    // нарисованные море, остров и облака у горизонта — полоса с баннера (sonic-bg.webp, Код\unitka\sonic\make_bg.py; горизонт на 243 из 270);
    // пока грузится — горы синусами и ровное море
    const im = pic("bg", "sonic-bg.webp"), ok = im.complete && im.naturalWidth > 0, kk = 0.5;
    const w = ok ? im.naturalWidth * kk : 1200, h = H + 60, base = 30 + H * 0.6, c = document.createElement("canvas"); c.width = Math.round(w * SC); c.height = Math.round(h * SC);
    const g = c.getContext("2d"); g.setTransform(SC, 0, 0, SC, 0, 0);
    if (ok) {
      const top = base - 243 * kk, bot = top + im.naturalHeight * kk;
      const gr = g.createLinearGradient(0, 0, 0, top + 1); gr.addColorStop(0, "#0046e0"); gr.addColorStop(1, "#0173fe"); g.fillStyle = gr; g.fillRect(0, 0, w, top + 1);
      const sea = g.createLinearGradient(0, bot - 1, 0, h); sea.addColorStop(0, "#c4f1fc"); sea.addColorStop(1, "#6fcaf5"); g.fillStyle = sea; g.fillRect(0, bot - 1, w, h - bot + 1);
      g.imageSmoothingQuality = "high"; g.drawImage(im, 0, top, w, im.naturalHeight * kk);
    } else {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0046e0"); gr.addColorStop(0.55, "#2d84fb"); gr.addColorStop(1, "#9fd6ff"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, base - 30 - 26 * Math.sin(x * TAU / 600) - 18 * Math.sin(x * TAU / 240 + 1.3) - 10 * Math.sin(x * TAU / 100));
      g.lineTo(w, h); g.closePath(); g.fillStyle = "#6f8ff0"; g.fill(); g.strokeStyle = "#4b67c9"; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = "#28a6f2"; g.fillRect(0, base, w, h - base);
    }
    c.base = base - 30; c.uw = w; back = c; return c;
  }

  /* ───── состояние ───── */
  function startAct(i, fromCp) {
    G.act = i; const L = ACTS[i](); G.L = L;
    G.ents = L.ents.map(e => Object.assign({ alive: true, t: 0, dir: -1, x0: e.x - 64, x1: e.x + 64, vx: 0, fire: 0, cool: 0 }, e, e.type === "buzz" ? { vx: -1, y0: e.y } : {},
      e.type === "mon" && e.kind === "life" && G.lifeUsed && G.lifeUsed[i + ":" + e.x] ? { broken: true } : {}));
    G.rings = L.rg.map(r => ({ x: r.x, y: r.y, got: false }));
    G.sr = []; G.fx = []; G.boss = null; G.hint = i === 0 && !fromCp ? 400 : 0; G.cruise = 0;
    const cp = fromCp && G.cp && G.cp.act === i ? G.cp : null;
    if (!cp) G.cp = null;
    Object.assign(S, { x: cp ? cp.x : 64, y: 0, xsp: 0, ysp: 0, gsp: 0, ang: 0, on: "floor", plat: null, lp: null, th: 0, dir: 1, ball: false, jumping: false,
      canHome: false, homing: 0, ht: null, hurt: false, dead: 0, inv: 0, shield: false, shoes: 0, star: 0, rings: 0, push: false, ctrl: true,
      rot: 0, ph: 0, chain: 0, py: 0, spr: 0, blink: 0, last: [], crouch: false, spin: null, skid: false });
    S.y = L.gy(S.x); S.py = S.y;
    if (cp) { G.time = cp.time; G.ents.forEach(e => { if (e.type === "post" && e.x <= cp.x) e.on = true; }); } else G.time = 0;
    G.cam.x = S.x - W * 0.32; G.cam.y = S.y - H * 0.62;
    G.state = "card"; G.st = 0;
  }
  function newGame() { G.score = 0; G.lives = 3; G.lifeAt = 100; G.cp = null; G.lifeUsed = {}; G.tt = 0; startAct(0); }
  function toTitle() { G.cp = null; startAct(0); G.state = "title"; G.st = 0; S.x = 150; S.y = G.L.gy(150); camera(true); }

  /* ───── столкновения ───── */
  function sCenter() {
    if (S.on === "loop") { const l = S.lp, cy = l.by - l.r; return [l.x + (l.r - 15) * Math.sin(S.th), cy + (l.r - 15) * Math.cos(S.th)]; }
    return [S.x, S.y - (S.ball ? 14 : 18)];
  }
  function boxHit(cx, cy, r, bx, by, bw, bh) { const nx = clamp(cx, bx, bx + bw), ny = clamp(cy, by, by + bh); return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r; }
  function eBox(e) {
    switch (e.type) {
      case "moto": return [e.x - 15, e.y - 27, 30, 27];
      case "buzz": return [e.x - 14, e.y - 7, 30, 14];
      case "crab": return [e.x - 18, e.y - 24, 36, 24];
      case "mon": return [e.x - 13, e.y - 30, 26, 30];
      case "spr": return e.diag ? [e.x - 12, e.y - 16, 24, 16] : [e.x - 14, e.y - 15, 28, 15];
      case "spk": return [e.x - e.w / 2, e.y - 15, e.w, 15];
      case "boost": return [e.x - 17, e.y - 6, 34, 6];
      case "shot": return [e.x - 3.5, e.y - 3.5, 7, 7];
      default: return [e.x - 4, e.y - 48, 8, 48];
    }
  }
  const killable = e => e.alive && (e.type === "moto" || e.type === "buzz" || e.type === "crab");
  function fx(o) { G.fx.push(Object.assign({ t: 0, vx: 0, vy: 0 }, o)); }
  function addScore(n, x, y) { G.score += n; if (x !== undefined) fx({ k: "txt", x, y, vy: -0.8, max: 50, txt: String(n) }); }
  function gotRing() {
    S.rings++; SFX.ring();
    if (S.rings >= G.lifeAt) { G.lifeAt += 100; G.lives++; SFX.life(); }
  }
  function hurt(force) {
    if (S.dead || dbg.god) return;
    if (!force && (S.inv > 0 || S.star > 0 || SUP.on)) return;
    if (S.shield) { S.shield = false; }
    else if (S.rings > 0) {
      const n = Math.min(S.rings, 32); S.rings = 0; SFX.lose();
      let a = 101.25 * PI / 180, sp = 4, flip = false;
      for (let i = 0; i < n; i++) { G.sr.push({ x: S.x, y: S.y - 18, vx: Math.cos(a) * sp * (flip ? -1 : 1), vy: -Math.sin(a) * sp, t: 0 }); if (flip) a += 22.5 * PI / 180; flip = !flip; if (i === 15) { sp = 2; a = 101.25 * PI / 180; } }
    } else return die();
    SFX.hurt();
    Object.assign(S, { hurt: true, ctrl: false, on: null, plat: null, lp: null, ball: false, jumping: false, homing: 0, xsp: -2 * S.dir, ysp: -4, inv: 120 });
  }
  function die() { if (S.dead) return; SFX.die(); Object.assign(S, { dead: 1, on: null, plat: null, lp: null, ball: false, xsp: 0, ysp: -7, shield: false, star: 0 }); }
  function land(y, kind, plat) {
    S.y = y; S.ang = kind === "floor" ? G.L.ang(S.x) : 0; const a = S.ang;
    S.gsp = S.xsp * Math.cos(a) - S.ysp * Math.sin(a);
    if (S.ctrl === false && S.hurt) S.gsp = 0;
    Object.assign(S, { on: kind, plat: plat || null, ball: false, jumping: false, homing: 0, canHome: false, hurt: false, ctrl: true, chain: 0, spr: 0 });
  }
  function jump() {
    const a = S.ang; S.xsp = S.gsp * Math.cos(a) - P.jmp * Math.sin(a); S.ysp = -S.gsp * Math.sin(a) - P.jmp * Math.cos(a);
    Object.assign(S, { on: null, plat: null, lp: null, ball: true, jumping: true, canHome: true, noCut: G.fullJump }); SFX.jump(); G.hint = Math.min(G.hint, 30);
  }
  function homeTarget() {
    let best = null, bd = 1e9; const [cx, cy] = sCenter();
    const cand = G.ents.filter(e => (killable(e) || (e.type === "mon" && !e.broken)));
    if (G.boss && G.boss.st === "fight" && !G.boss.flash) cand.push({ x: G.boss.x, y: G.boss.y + 4, boss: true });
    for (const e of cand) {
      const ex = e.x, ey = e.boss ? e.y : e.type === "mon" ? e.y - 16 : e.type === "buzz" ? e.y : e.y - 14, dx = (ex - cx) * S.dir, dy = ey - cy;
      if (dx < -6 || dx > 190 || dy < -110 || dy > 170) continue;
      const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = { x: ex, y: ey }; }
    }
    return best;
  }
  function airTap() {
    if (!S.canHome || S.hurt || !S.ball) return;
    S.canHome = false; const t = homeTarget();
    if (t) { S.homing = 26; S.ht = t; SFX.dash(); }
    else { S.xsp = S.dir * Math.max(Math.abs(S.xsp), 8.5); S.ysp = Math.min(S.ysp, -2.6); SFX.dash(); fx({ k: "puff", x: S.x - S.dir * 10, y: S.y - 14, max: 18 }); }
  }
  function bounceOff(e) {
    if (S.homing) { S.homing = 0; S.ysp = -5.6; S.xsp = S.dir * 5; S.canHome = true; }      // в беге сам — после удара не теряем ход
    else if (S.on === null) { S.ysp = S.ysp > 0 ? -Math.max(S.ysp, 4) : S.ysp - 1; S.canHome = true; }
    S.chain++; const pts = [100, 200, 500, 1000][Math.min(3, S.chain - 1)];
    addScore(pts, e.x, e.y - 30);
  }
  function kill(e) {
    e.alive = false; SFX.pop();
    fx({ k: "boom", x: e.x, y: e.y - (e.type === "buzz" ? 0 : 14), max: 24 });
    fx({ k: "bird", x: e.x, y: e.y - 14, vx: S.dir * -0.4 + (Math.random() < 0.5 ? -1 : 1) * 1.6, vy: -3.2, max: 160, kind: Math.random() < 0.4 ? 1 : 0 });
  }
  function breakMon(m) {
    m.broken = true; SFX.pop(); fx({ k: "boom", x: m.x, y: m.y - 16, max: 22 }); fx({ k: "icon", x: m.x, y: m.y - 18, vy: -1.2, max: 40, kind: m.kind });
    addScore(10);
    if (m.kind === "ring") { for (let i = 0; i < 10; i++) gotRing(); }
    else if (m.kind === "shield") { S.shield = true; SFX.item(); }
    else if (m.kind === "shoes") { S.shoes = 1200; SFX.item(); }
    else if (m.kind === "star") { S.star = 1200; SFX.item(); }
    else if (m.kind === "life") { G.lives++; SFX.life(); G.lifeUsed = G.lifeUsed || {}; G.lifeUsed[G.act + ":" + m.x] = 1; }     // жизнь из монитора — одна за игру
  }

  /* ───── один кадр физики (60 в секунду) ───── */
  function step() {
    if (G.menu) { T++; return; }                     // пауза: мир стоит, меню поверх
    G.t++; T++;
    if (G.flash && ++G.flash.t > 170) G.flash = null;
    if (G.state === "card") { if (++G.st > 140) { G.state = "play"; G.tap = false; } camera(true); return; }
    if (G.state === "clear") { tally(); return; }
    if (G.state === "special") { ssStep(); return; }
    if (G.state === "teaser") { if (++G.st > 260) ssStart(); return; }
    if (G.state === "over" || G.state === "spres") { G.st++; return; }
    if (G.state !== "play") return;
    const L = G.L, tap = G.tap; G.tap = false;
    const man = G.mode !== "auto";
    const held = (G.mode === "pad" ? G.keys.J || G.padJ.size > 0 : man ? G.keys.J || G.gHeld : G.held) || (dbg.bot && G.botHold > 0);
    if (dbg.bot) bot();
    const botTap = G.botTap; G.botTap = false;
    const pressed = tap || botTap, inp = man ? input() : null;
    G.time++; if (G.hint > 0) G.hint--;
    if (G.time >= 36000 && !S.dead) die();
    if (S.inv > 0) S.inv--; if (S.shoes > 0) S.shoes--; if (S.star > 0) S.star--; if (S.spr > 0) S.spr--;
    if (--S.blink < -200) S.blink = 8;
    const mult = (S.shoes > 0 ? 2 : 1) * (SUP.on ? 1.2 : 1);           // Супер Соник (приз за прохождение) — на 20% быстрее
    if (SUP.on && G.t % 5 === 0 && !S.dead) fx({ k: "spark", x: S.x + (Math.random() - 0.5) * 26, y: S.y - 20 + (Math.random() - 0.5) * 34, max: 14 });
    S.py = S.y;
    if (S.dead) {
      S.ysp += P.grv; S.y += S.ysp; S.dead++;
      if (S.dead > 150) { G.lives--; if (G.lives <= 0) { G.state = "over"; G.st = 0; } else startAct(G.act, true); }
      return;
    }
    if (S.on === "loop") loopStep(mult);
    else if (S.on) groundStep(mult, pressed, inp);
    else airStep(mult, pressed, held, inp);
    if (S.y > L.bottom + 60 && !S.dead) { die(); S.ysp = -4; }
    S.ph += Math.max(0.12, Math.min(0.62, Math.abs(S.on ? S.gsp : S.xsp) * 0.075));
    S.rot += (S.on ? S.gsp : (S.xsp || 1) * 1.2) * 0.07 + (S.homing ? 0.5 * S.dir : 0) + (S.crouch && S.spin !== null ? (0.35 + S.spin * 0.06) * S.dir : 0);
    if (S.shoes > 0 || Math.abs(S.gsp) > 8.5 || S.homing) { S.last.unshift([S.x, S.y, S.on === "loop" ? -S.th : S.ang]); if (S.last.length > 2) S.last.pop(); } else S.last.length = 0;
    interact();
    updEnts();
    camera(false);
    G.fullJump = false;
  }
  /* «управляю сам»: клавиши → {x: −1/0/1}; палец → {target: заданная скорость (−1…1 от предельной)}; вниз — down */
  function input() {
    const pad = G.mode === "pad", l = G.keys.L || (pad && G.pad.x < 0), r = G.keys.R || (pad && G.pad.x > 0), d = G.keys.D || G.gDown || (pad && G.pad.down);
    if (dbg.bot) {                                   // автопилот: вперёд; на арене — от стены к стене, как в «бежит сам»
      const a = G.L.arena; G.botDir = G.botDir || 1;
      if (a && G.boss && S.x > a.x1 - 40) G.botDir = -1; else if (a && G.boss && S.x < a.x0 + 40) G.botDir = 1; else if (!G.boss) G.botDir = 1;
      const v = S.on ? S.gsp : S.xsp;                // как осторожный игрок: не гонит выше ~5
      return { x: !G.boss && v * G.botDir > 4.8 ? 0 : G.botDir, down: false };
    }
    const x = (r ? 1 : 0) - (l ? 1 : 0);
    if (x || pad) { G.cruise = 0; return { x, down: d }; }   // клавиши и джойстик — по-классике: отпустил — трение
    return { x: 0, down: d, target: G.cruise };
  }
  const toward = (v, t, a) => (v < t ? Math.min(t, v + a) : Math.max(t, v - a));
  /* классика по Sonic Physics Guide: разгон/торможение/трение, занос, клубок вниз на ходу, присед + прыжок — спин-дэш */
  function manualGround(mult, pressed, inp) {
    const x = S.ctrl ? inp.x : 0, top = P.top * mult, acc = P.acc * mult, floor = S.on === "floor";
    const tg = S.ctrl && inp.target !== undefined ? inp.target * top : null;
    if (S.crouch) {
      if (!inp.down || !S.ctrl) {
        S.crouch = false;
        if (S.spin !== null) { S.gsp = (8 + Math.floor(S.spin) / 2) * S.dir; S.ball = true; S.spin = null; SFX.boost(); fx({ k: "puff", x: S.x - S.dir * 12, y: S.y - 6, max: 20 }); }
      } else {
        // подкрутка: клавишей — прыжком; пальцем — сама, пока держишь вниз (отпустил — сорвался)
        const rev = pressed || (G.gDown && ++S.crouchT > 14 && S.crouchT % 10 === 5);
        if (rev) { S.spin = Math.min(8, (S.spin === null ? -2 : S.spin) + 2); SFX.rev(); fx({ k: "puff", x: S.x - S.dir * 14, y: S.y - 4, max: 16 }); }
        if (S.spin !== null) S.spin -= Math.floor(S.spin / 0.125) / 256;
        if (x) S.dir = x; else if (tg) S.dir = sgn(tg);
        S.gsp = 0; S.skid = false; return false;
      }
    }
    if (S.ball) {                                     // катится клубком: без разгона, своё трение, вниз по склону быстрее
      const back = x ? sgn(S.gsp) !== x : tg !== null && tg !== 0 && sgn(S.gsp) !== sgn(tg);
      if (back) S.gsp -= Math.min(Math.abs(S.gsp), P.rollDec) * sgn(S.gsp);
      S.gsp -= Math.min(Math.abs(S.gsp), P.rollFrc) * sgn(S.gsp);
      if (floor) { const s = Math.sin(S.ang); S.gsp -= (sgn(S.gsp) === sgn(s) ? P.rollUp : P.rollDown) * s; }
      S.gsp = clamp(S.gsp, -P.rollTop, P.rollTop);
      if (Math.abs(S.gsp) < 0.5) S.ball = false;
    } else {
      let w = x;                                      // куда «жмём» в этот кадр (для заноса и поворота)
      if (x < 0) { if (S.gsp > 0) { S.gsp -= P.dec; if (S.gsp <= 0) S.gsp = -0.5; } else if (S.gsp > -top) S.gsp = Math.max(-top, S.gsp - acc); }
      else if (x > 0) { if (S.gsp < 0) { S.gsp += P.dec; if (S.gsp >= 0) S.gsp = 0.5; } else if (S.gsp < top) S.gsp = Math.min(top, S.gsp + acc); }
      else if (tg !== null && tg !== 0) {             // палец: тянемся к заданной скорости; в обратную сторону — тормоз с заносом
        w = sgn(tg);
        if (S.gsp !== 0 && sgn(S.gsp) !== w) { S.gsp -= P.dec * sgn(S.gsp); if (sgn(S.gsp) === w) S.gsp = 0; }
        else S.gsp = toward(S.gsp, tg, Math.abs(tg) > Math.abs(S.gsp) ? acc : Math.max(P.frc, 0.07));
      }
      else S.gsp -= Math.min(Math.abs(S.gsp), P.frc) * sgn(S.gsp);
      if (Math.abs(S.gsp) > top) S.gsp -= sgn(S.gsp) * 0.035;          // после ускорителя скорость сходит плавно (в оригинале держится — играть тяжелее)
      if (floor && (Math.abs(S.gsp) > 0.01 || Math.abs(S.ang) > 0.4)) S.gsp -= P.slp * Math.sin(S.ang);
      S.skid = !!w && S.gsp !== 0 && sgn(S.gsp) !== w && Math.abs(S.gsp) > 2;
      if (w && !S.skid && (S.gsp === 0 || sgn(S.gsp) === w)) S.dir = w;
      if (inp.down && S.ctrl) {
        if (Math.abs(S.gsp) >= 1.03125) { S.ball = true; S.skid = false; SFX.roll(); }
        else if (floor || S.on === "plat") { S.crouch = true; S.crouchT = 0; S.gsp = 0; S.skid = false; return false; }
      }
    }
    if (pressed && S.ctrl) { S.skid = false; jump(); return true; }
    return false;
  }
  function groundStep(mult, pressed, inp) {
    const L = G.L;
    if (S.on === "plat") { const p = S.plat; S.x += p.vx; S.y = p.cy; }
    if (inp) { if (manualGround(mult, pressed, inp)) return; }
    else {
      const top = P.autoTop * mult, acc = P.acc * mult * (G.boss ? 2.5 : 1);         // на арене разворот у стены быстрее
      if (S.ctrl) {
        if (S.dir > 0) { if (S.gsp < top) S.gsp = Math.min(top, S.gsp + (S.gsp < 0 ? P.dec : acc)); }
        else if (S.gsp > -top) S.gsp = Math.max(-top, S.gsp - (S.gsp > 0 ? P.dec : acc));
      } else S.gsp -= Math.min(Math.abs(S.gsp), P.acc * 2) * sgn(S.gsp);
      if (Math.abs(S.gsp) > top) S.gsp -= sgn(S.gsp) * 0.035;
      if (S.on === "floor") S.gsp -= P.slp * Math.sin(S.ang);
      if (pressed && S.ctrl) { jump(); return; }
    }
    const nx = S.x + S.gsp * Math.cos(S.ang), sd = S.gsp !== 0 ? sgn(S.gsp) : (inp && inp.x) || S.dir;
    // уступ впереди — стена: стоим и упираемся (на арене в «бежит сам» — разворот)
    const wy = L.gy(nx + 9 * sd);
    let wall = wy !== null && wy < S.y - 14;
    if (L.arena && S.x > L.arena.x0) { if (nx > L.arena.x1 - 14 && sd > 0) wall = true; if (nx < L.arena.x0 + 14 && sd < 0) wall = true; }
    if (wall) {
      S.gsp = 0; S.push = inp ? inp.x === sd && !S.ball : S.ctrl;
      if (!inp && L.arena && S.x > L.arena.x0 + 8) { S.dir = -S.dir; S.push = false; }
    }
    else { S.x = nx; S.push = false; }
    // петля: на скорости — по кругу
    if (S.on === "floor" && S.dir > 0 && S.gsp >= 3) for (const lp of L.loops) if (S.x - S.gsp * Math.cos(S.ang) < lp.x && S.x >= lp.x) { S.on = "loop"; S.lp = lp; S.th = 0; S.x = lp.x; S.y = lp.by; return; }
    if (S.on === "plat") {
      const p = S.plat; if (S.x < p.cx - 4 || S.x > p.cx + p.w + 4) { S.on = null; S.plat = null; S.xsp = S.gsp; S.ysp = 0; return; }
      S.y = p.cy; S.ang = 0;
    } else {
      const g = L.gy(S.x);
      if (g === null || g > S.y + 16) { S.on = null; S.xsp = S.gsp * Math.cos(S.ang); S.ysp = -S.gsp * Math.sin(S.ang); return; }
      S.y = g; S.ang = L.ang(S.x);
    }
  }
  function loopStep(mult) {
    const l = S.lp, top = P.top * mult;
    if (S.gsp < top) S.gsp = Math.min(top, S.gsp + P.acc * mult);
    S.gsp -= P.grv * Math.sin(S.th);
    S.th += S.gsp / l.r;
    const cy = l.by - l.r;
    if (S.gsp < 2.3 && S.th > 0.9 && S.th < TAU - 0.9) {          // не хватило скорости — срывается
      S.on = null; S.lp = null; S.xsp = S.gsp * Math.cos(S.th); S.ysp = -S.gsp * Math.sin(S.th);
      S.x = l.x + l.r * Math.sin(S.th); S.y = cy + l.r * Math.cos(S.th); S.ball = true; S.jumping = false; return;
    }
    if (S.th >= TAU) { S.on = "floor"; S.lp = null; S.th = 0; S.x = l.x + 1; S.y = l.by; S.ang = 0; return; }
    S.x = l.x + l.r * Math.sin(S.th); S.y = cy + l.r * Math.cos(S.th);
  }
  function airStep(mult, pressed, held, inp) {
    const L = G.L;
    S.crouch = false; S.spin = null; S.skid = false;
    if (pressed) airTap();
    if (S.homing > 0 && S.ht) {
      S.homing--; const [cx, cy] = sCenter(), dx = S.ht.x - cx, dy = S.ht.y - cy, d = Math.hypot(dx, dy) || 1;
      S.xsp = dx / d * 9; S.ysp = dy / d * 9; if (d < 6) S.homing = 0;
    } else {
      if (S.jumping && !held && !S.noCut && S.ysp < -P.cut) S.ysp = -P.cut;      // короткий тап пальцем — прыжок в полную силу
      if (inp) {
        const t = P.top * mult, x = S.ctrl ? inp.x : 0;
        if (x) { S.dir = x; if (x > 0 ? S.xsp < t : S.xsp > -t) S.xsp += P.air * mult * x; }
        else if (S.ctrl && inp.target) { const tg = inp.target * t; S.dir = sgn(tg); if (Math.abs(tg) > Math.abs(S.xsp) || sgn(S.xsp) !== sgn(tg)) S.xsp = toward(S.xsp, tg, P.air * mult); }
      }
      else if (S.ctrl) { const t = P.autoTop * mult; if (S.dir > 0 ? S.xsp < t : S.xsp > -t) S.xsp += P.air * mult * S.dir; }
      if (S.ysp < 0 && S.ysp > -4) S.xsp -= S.xsp / 256 * 8 / 32;
      S.ysp = Math.min(P.fall, S.ysp + P.grv);
    }
    S.x += S.xsp; S.y += S.ysp;
    if (L.arena && S.x > L.arena.x0 - 20) { if (S.x > L.arena.x1 - 14) { S.x = L.arena.x1 - 14; S.xsp = -Math.abs(S.xsp) * 0.3; S.dir = -1; } if (S.x < L.arena.x0 + 14 && G.boss) { S.x = L.arena.x0 + 14; S.xsp = Math.abs(S.xsp) * 0.3; S.dir = 1; } }
    const sd = sgn(S.xsp), wy = L.gy(S.x + 9 * sd);
    if (wy !== null && wy < S.y - 16 && Math.abs(S.xsp) > 0) { const gyHere = L.gy(S.x); if (gyHere === null || gyHere > wy + 14) { S.x -= S.xsp; S.xsp = 0; } }
    if (S.ysp >= 0) {
      for (const p of L.plats) if (S.x >= p.cx - 2 && S.x <= p.cx + p.w + 2 && S.py <= p.cy + 3 && S.y >= p.cy) { land(p.cy, "plat", p); return; }
      const g = L.gy(S.x); if (g !== null && S.y >= g && S.py <= g + 16) land(g, "floor");
    }
  }
  function interact() {
    const [cx, cy] = sCenter(), R = S.ball ? 13 : 14, atk = S.ball || S.star > 0 || S.homing > 0 || SUP.on;
    // кольца
    const x0 = cx - 24, x1 = cx + 24;
    for (const r of G.rings) if (!r.got && r.x > x0 && r.x < x1 && Math.abs(r.y - cy) < 26 && (r.x - cx) ** 2 + (r.y - cy) ** 2 < 22 * 22) { r.got = true; gotRing(); fx({ k: "spark", x: r.x, y: r.y, max: 16 }); }
    for (const r of G.sr) if (r.t > 50 && !r.got && (r.x - cx) ** 2 + (r.y - cy) ** 2 < 20 * 20) { r.got = true; gotRing(); }
    if (S.dead) return;
    for (const e of G.ents) {
      if (!e.alive || Math.abs(e.x - cx) > 60) continue;
      const b = eBox(e);
      if (!boxHit(cx, cy, R, b[0], b[1], b[2], b[3])) continue;
      if (killable(e)) { if (atk) { kill(e); bounceOff(e); } else hurt(); }
      else if (e.type === "shot") { if (S.star <= 0) { e.alive = false; hurt(); } }
      else if (e.type === "mon" && !e.broken) {
        if (atk || (S.on === null && S.ysp > 0 && cy < e.y - 26)) { breakMon(e); if (S.on === null) { if (S.homing) { S.homing = 0; S.ysp = -5; S.canHome = true; } else if (S.ysp > 0) S.ysp = -S.ysp; } }
        else if (S.on) { S.x = e.x - S.dir * (13 + 9); S.gsp = 0; S.push = true; }
      }
      else if (e.type === "spr" && e.t <= 0) {
        const f = e.k === "r" ? 16 : 10; e.t = 12; SFX.spring();
        Object.assign(S, { on: null, plat: null, ball: false, jumping: false, homing: 0, canHome: true, spr: 40, hurt: false, ctrl: true });
        if (e.diag) { S.xsp = f * 0.75; S.ysp = -f * 0.75; } else { S.ysp = -f; S.xsp = S.dir * Math.max(Math.abs(S.gsp || S.xsp), 4); }
        S.y = Math.min(S.y, e.y - 15);
      }
      else if (e.type === "spk") { if (S.star <= 0) hurt(); }
      else if (e.type === "boost" && S.on === "floor") { if (Math.abs(S.gsp) < 12) { S.gsp = 12 * S.dir; SFX.boost(); } }
    }
    for (const e of G.ents) {
      if (e.type === "post" && !e.on && S.x >= e.x) { e.on = true; G.cp = { act: G.act, x: e.x + 24, time: G.time }; SFX.check(); }
      if (e.type === "sign" && !e.done && S.x >= e.x) { e.done = true; e.t = 1; S.ctrl = false; SFX.check(); }
    }
    if (G.boss) bossHit(cx, cy, R, atk);
  }
  function updEnts() {
    const L = G.L, sx = S.x;
    for (const e of G.ents) {
      if (!e.alive) continue;
      if (Math.abs(e.x - sx) > W * 1.4 && e.type !== "shot") continue;
      e.t++;
      if (e.type === "moto") {
        e.x += 0.7 * e.dir; const g = L.gy(e.x);
        if (e.x < e.x0 || e.x > e.x1 || g === null || Math.abs(g - e.y) > 10) { e.dir = -e.dir; e.x += 1.4 * e.dir; } else e.y = g;
      } else if (e.type === "crab") {
        if (e.fire > 0) { if (--e.fire === 30) { for (const s of [-1, 1]) G.ents.push({ type: "shot", alive: true, x: e.x + s * 16, y: e.y - 30, vx: s * 1.3, vy: -4, g: 0.14, t: 0 }); } e.vx = 0; }
        else { e.vx = 0.4 * e.dir; e.x += e.vx; const g = L.gy(e.x); if (e.x < e.x0 || e.x > e.x1 || g === null) { e.dir = -e.dir; e.x += 0.8 * e.dir; } else e.y = g;
          if (e.t % 170 === 0 && Math.abs(e.x - sx) < W * 0.7) e.fire = 60; }
      } else if (e.type === "buzz") {
        if (e.cool > 0) e.cool--;
        if (e.fire > 0) { if (--e.fire === 20) { const dx = S.x - e.x, dy = (S.y - 18) - e.y, d = Math.hypot(dx, dy) || 1; G.ents.push({ type: "shot", alive: true, x: e.x - 14 * e.dir * -1, y: e.y + 6, vx: dx / d * 2.4, vy: dy / d * 2.4, g: 0, t: 0 }); } }
        else { e.x += e.vx; e.y = e.y0 + Math.sin(e.t * 0.05) * 4; if (Math.abs(e.x - e.x0 - 64) > 120) { e.vx = -e.vx; } e.dir = e.vx < 0 ? -1 : 1;
          if (!e.cool && S.on && sx < e.x && e.x - sx < 150 && e.x - sx > 40) { e.fire = 50; e.cool = 200; } }     // стреляет, только пока Соник на земле — честно
      } else if (e.type === "shot") { e.x += e.vx; e.y += e.vy; e.vy += e.g || 0; if (e.t > 240) e.alive = false; }
      else if (e.type === "spr" && e.t > 0) e.t -= 2;
      else if (e.type === "sign" && e.done) {
        e.t++;
        if (e.t > 100 && Math.abs(S.gsp) < 0.1 && S.on) { G.state = "clear"; G.st = 0; G.tb = timeBonus(G.time); G.rb = S.rings * 100; SFX.clear(); }
      }
    }
    G.ents = G.ents.filter(e => e.type !== "shot" || e.alive);
    for (const p of L.plats) if (p.mv) { const t = G.t / p.mv.per * TAU, nx = p.x + p.mv.ax * Math.sin(t), ny = p.y + p.mv.ay * Math.sin(t); p.vx = nx - p.cx; p.vy = ny - p.cy; p.cx = nx; p.cy = ny; }
    for (const r of G.sr) { r.t++; r.vy += 0.09375; r.x += r.vx; r.y += r.vy; const g = L.gy(r.x); if (g !== null && r.y > g - 6 && r.vy > 0) { r.y = g - 6; r.vy *= -0.75; } }
    G.sr = G.sr.filter(r => !r.got && r.t < 256);
    for (const f of G.fx) { f.t++; f.x += f.vx; f.y += f.vy; if (f.k === "bird") { if (f.t > 20) { f.vy = Math.max(f.vy - 0.05, -1.4); } else f.vy += 0.2; } }
    G.fx = G.fx.filter(f => f.t < f.max);
    if (L.arena) arena();
  }
  function timeBonus(fr) { const s = fr / 60; return s < 30 ? 50000 : s < 45 ? 10000 : s < 60 ? 5000 : s < 90 ? 4000 : s < 120 ? 3000 : s < 180 ? 2000 : s < 240 ? 1000 : s < 300 ? 500 : 0; }
  function tally() {
    G.st++;
    if (G.st > 80) { for (const kk of ["tb", "rb"]) { const d = Math.min(G[kk], 100); G[kk] -= d; G.score += d; } }
    if ((G.st > 80 && !G.tb && !G.rb && G.st > 260) || G.skip) { G.score += G.tb + G.rb; G.tb = G.rb = 0; G.skip = false; if (G.act + 1 < ACTS.length) { G.tt = (G.tt || 0) + G.time; setProg(G.act + 1); startAct(G.act + 1); } else zoneDone(); }
  }

  /* ───── арена и босс: яйцелёт доктора с шаром на цепи; 8 попаданий ───── */
  function arena() {
    const a = G.L.arena;
    if (!G.boss && S.x > a.x0 + 120 && !S.dead) {
      G.boss = { x: a.x1 + 80, y: a.y - 230, hp: 8, st: "enter", t: 0, flash: 0, ang: 0, bx: 0, by: 0, base: a.y - 128, cx: (a.x0 + a.x1) / 2 };
      G.bossRing = 0; setProg(2); G.flash = { t: 0, txt: "ДО ПРИЗА — ТОЛЬКО БОСС!" };
    }
    const b = G.boss; if (!b) return;
    b.t++; if (b.flash > 0) b.flash--;
    if (b.st === "enter") { b.x = lerp(b.x, b.cx, 0.03); b.y = lerp(b.y, b.base, 0.03); if (b.t > 160) { b.st = "fight"; b.t = 0; } }
    else if (b.st === "fight") {
      const f = b.hp > 4 ? 1 : 1.35;
      b.ph = (b.ph || 0) + 0.011 * f; b.x = b.cx + ((a.x1 - a.x0) / 2 - 110) * Math.sin(b.ph); b.y = b.base + 6 * Math.sin(b.t * 0.05);
      b.ang = 0.95 * Math.sin(b.t * 0.034 * f);
      if (S.rings === 0 && G.t % 600 === 0) for (let i = 0; i < 5; i++) G.rings.push({ x: a.x0 + 120 + i * 140, y: a.y - 26, got: false });
    } else if (b.st === "boom") {
      if (b.t % 6 === 0) { fx({ k: "boom", x: b.x + (Math.random() - 0.5) * 50, y: b.y + (Math.random() - 0.5) * 34, max: 24 }); if (b.t % 18 === 0) SFX.boom(); }
      b.ang *= 0.95; if (b.t > 130) { b.st = "flee"; b.t = 0; }
    } else if (b.st === "flee") { b.x += 2.6; b.y -= 1.4; if (b.t % 8 === 0) fx({ k: "puff", x: b.x - 20, y: b.y + 8, max: 30 }); if (b.t > 140) { b.st = "gone"; G.score += 1000; zoneDone(); SFX.clear(); } }
    const chain = 94; b.bx = b.x + Math.sin(b.ang) * chain; b.by = b.y + 16 + Math.cos(b.ang) * chain;
  }
  function bossHit(cx, cy, R, atk) {
    const b = G.boss; if (b.st !== "fight" || S.dead) return;
    if ((b.bx - cx) ** 2 + (b.by - cy) ** 2 < (16 + R) ** 2) { if (S.star <= 0) hurt(); return; }
    if (boxHit(cx, cy, R, b.x - 28, b.y - 18, 56, 34)) {
      if (atk && !b.flash) {
        b.hp--; b.flash = 36; SFX.hit(); addScore(100, b.x, b.y - 30);
        S.homing = 0; S.ysp = -4.6; S.xsp = -sgn(b.x - cx) * 2.6; S.dir = sgn(S.xsp) || S.dir; S.canHome = true; S.on = null;
        if (b.hp <= 0) { b.st = "boom"; b.t = 0; }
      } else if (!atk) hurt();
    }
  }

  /* ───── камера ───── */
  function camera(snap) {
    const L = G.L; let tx, ty;
    if (L.arena && G.boss) { const a = L.arena, aw = a.x1 - a.x0; tx = aw > W ? clamp(S.x - W / 2, a.x0, a.x1 - W) : a.x0 + aw / 2 - W / 2; }
    else if (G.mode !== "auto") tx = S.x - W * 0.5 + clamp((S.on ? S.gsp : S.xsp) * 14, -W * 0.2, W * 0.2);     // сам: по центру, вперёд по скорости
    else tx = S.x - W * (S.dir > 0 ? 0.32 : 0.68);
    // по вертикали: на земле — Соник на 62% высоты; в прыжке камера стоит, пока он между 30% и 76% экрана (как в оригинале)
    if (S.on || snap) ty = S.y - H * 0.62; else ty = clamp(G.cam.y, S.y - H * 0.76, S.y - H * 0.3);
    if (L.arena && G.boss) ty = L.arena.y - H * 0.8;
    ty = Math.min(ty, L.bottom - 140 - H * 0.55);
    if (S.dead) ty = G.cam.y;
    const c = G.cam;
    if (snap) { c.x = tx; c.y = ty; }
    else { c.x += clamp(tx - c.x, -16, 16) * (Math.abs(S.gsp) > 7 ? 1 : 0.5); c.y += clamp(ty - c.y, -8, 8) * 0.35; }
    c.x = Math.max(-16, c.x);
  }

  /* ───── автопилот для проверки (dbg.bot): прыгает перед врагами, стенами, ямами, шипами; босса бьёт сверху ───── */
  function bot() {
    G.botHold = Math.max(0, (G.botHold || 0) - 1);
    if (S.dead || G.state !== "play") return;
    const L = G.L, look = Math.max(48, Math.abs(S.gsp) * 14);
    if (S.on && S.on !== "loop") {
      let need = false;
      for (let d = 12; d <= look; d += 8) { const g = L.gy(S.x + d * S.dir); if (g === null || g < S.y - 14) { need = d < look * 0.6 || g !== null; break; } }
      for (const e of G.ents) { if (!e.alive) continue; const dx = (e.x - S.x) * S.dir;
        if ((killable(e) || e.type === "spk" || (e.type === "mon" && !e.broken)) && dx > 0 && dx < look * 0.9 && Math.abs(e.y - S.y) < 60) need = true; }
      if (G.boss && G.boss.st === "fight") { const b = G.boss, dx = (b.x - S.x) * S.dir; if (dx > -10 && dx < 70) need = true; const bd = (b.bx - S.x) * S.dir; if (bd > 0 && bd < 90 && b.by > S.y - 50) need = true; }
      if (need) { G.botTap = true; G.botHold = 22; }
    } else if (S.on === null && S.ball && S.canHome && S.ysp > -1) {
      if (homeTarget()) G.botTap = true;
      else { for (let d = 0; d < 160; d += 16) if (L.gy(S.x + d * S.dir) === null && S.y > (L.gy(S.x - 40) || S.y) - 10) { G.botTap = true; break; } }
    }
  }

  /* ───── рисование ───── */
  function draw() {
    const sc = SC;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if ((G.state === "special" || G.state === "spres") && G.sp) { G.ui = []; drawSpecial(); return; }
    if (!cloudsR) cloudsR = raster(pic("clouds", "sonic-clouds.svg"), 96);
    if (!hillsR) hillsR = raster(pic("hills", "sonic-hills.svg"), H * 0.62);
    if (!G.L) toTitle();
    if (G.L !== G.tilesFor) { tiles.clear(); G.tilesFor = G.L; }
    const t0 = performance.now();
    background(sc);
    const t1 = performance.now();
    ctx.setTransform(sc, 0, 0, sc, -Math.round(G.cam.x * sc), -Math.round(G.cam.y * sc));      // сдвиг — целыми пикселями: плитки без швов
    world();
    const t2 = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlay();
    if (dbg.prof) { const p = dbg.prof, t3 = performance.now(); p.n++; p.bg += t1 - t0; p.world += t2 - t1; p.hud += t3 - t2; }
  }
  function background(sc) {
    const c = G.cam, bk = backdrop();
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    const vy = clamp((c.y - (G.L ? G.L.segs[0].ys[0] - H * 0.62 : 0)) * 0.08, -30, 30);
    const bw = bk.uw, off = ((c.x * 0.16) % bw + bw) % bw;
    for (let x = -off; x < W; x += bw) ctx.drawImage(bk, x, -30 - vy, bw, H + 60);
    if (cloudsR) { const w = cloudsR.uw, o = ((c.x * 0.12 + T * 0.15) % w + w) % w; for (let x = -o; x < W; x += w) ctx.drawImage(cloudsR, x, 6 - vy * 0.5, w, cloudsR.uh); }
    const base = bk.base - vy;                               // блики на море
    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 14; i++) { const x = ((i * 97 - c.x * 0.22 + Math.sin(T * 0.02 + i) * 6) % (W + 40) + W + 40) % (W + 40) - 20, y = base + 6 + (i * 37 % 40); ctx.fillRect(x, y, 10 + (i % 3) * 6, 1.3); }
    if (hillsR) { const w = hillsR.uw, o = ((c.x * 0.4) % w + w) % w, y = H - hillsR.uh + 18 - vy * 1.6; for (let x = -o; x < W; x += w) ctx.drawImage(hillsR, x, y, w, hillsR.uh); }
  }
  function world() {
    const L = G.L, c = G.cam, x0 = c.x - 40, x1 = c.x + W + 40;
    // неподвижное — готовыми плитками
    for (let iy = Math.floor(c.y / 256); iy <= Math.floor((c.y + H) / 256); iy++)
      for (let ix = Math.floor(c.x / 512); ix <= Math.floor((c.x + W) / 512); ix++) { const tl = tile(ix, iy); if (tl) ctx.drawImage(tl, ix * 512, iy * 256, 512, 256); }
    // движущиеся платформы
    let pt = null;
    for (const p of L.plats) if (p.mv && p.cx + p.w > x0 && p.cx < x1) platform(ctx, p, pt || (pt = checker(ctx)));    // предметы и враги
    for (const e of G.ents) {
      if (e.x < x0 - 40 || e.x > x1 + 40) continue;
      if (e.type === "mon") monitor(ctx, e, T);
      else if (e.type === "spr") spring(ctx, e);
      else if (e.type === "spk") spikes(ctx, e);
      else if (e.type === "boost") booster(ctx, e, T);
      else if (e.type === "post") post(ctx, e, T);
      else if (e.type === "sign") signpost(ctx, e, T);
      else if (!e.alive) continue;
      else if (e.type === "moto") moto(ctx, e, T);
      else if (e.type === "buzz") buzz(ctx, e, T);
      else if (e.type === "crab") crab(ctx, e, T);
      else if (e.type === "shot") { ell(ctx, e.x, e.y, 3.8, 3.8, 0, "#ff7a1a", 1); ell(ctx, e.x - 1, e.y - 1, 1.4, 1.4, 0, "#fff3a6", 0); }
    }
    // кольца
    const rph = T * 0.13;
    for (const r of G.rings) if (!r.got && r.x > x0 && r.x < x1) ringAt(r.x, r.y, rph);
    for (const r of G.sr) if (r.t < 200 || T % 4 < 2) ringAt(r.x, r.y, rph * 2);
    if (G.boss) drawBoss(G.boss);
    if (G.state !== "title") drawSonic();
    // эффекты
    for (const f of G.fx) {
      const q = f.t / f.max;
      if (f.k === "spark") { star(ctx, f.x, f.y, 7 * (1 - q) + 2, "#fff8c2", q * 2); }
      else if (f.k === "boom") { ctx.globalAlpha = 1 - q; ell(ctx, f.x, f.y, 6 + q * 18, 6 + q * 18, 0, q < 0.3 ? "#fff" : "#ffb020", 0); ell(ctx, f.x, f.y, 3 + q * 10, 3 + q * 10, 0, "#ff5a1a", 0); ctx.globalAlpha = 1; }
      else if (f.k === "puff") { ctx.globalAlpha = (1 - q) * 0.7; ell(ctx, f.x, f.y, 4 + q * 10, 3 + q * 6, 0, "#fff", 0); ctx.globalAlpha = 1; }
      else if (f.k === "bird") bird(ctx, f);
      else if (f.k === "icon") { ctx.globalAlpha = q > 0.8 ? (1 - q) * 5 : 1; monIcon(ctx, f.kind, f.x, f.y, 1.1); ctx.globalAlpha = 1; }
      else if (f.k === "txt") { ctx.font = "italic 900 9px " + FONT; ctx.textAlign = "center"; ctx.lineWidth = 2.5; ctx.strokeStyle = OL; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = "#fff"; ctx.fillText(f.txt, f.x, f.y); }
    }
  }
  function drawSonic() {
    if (S.inv > 0 && !S.dead && Math.floor(S.inv / 3) % 2) return;
    const pose = S.dead ? "dead" : S.hurt ? "hurt" : S.spr > 0 && S.ysp < 0 ? "spring" : S.ball || S.homing ? "ball" : S.crouch ? (S.spin !== null ? "charge" : "crouch") :
      S.push ? "push" : S.skid ? "skid" : (G.state === "teaser") ? "win" : poseFor(S.on ? S.gsp : S.xsp, false);
    const rot = S.on === "loop" ? -S.th : S.on ? S.ang * -1 : 0;
    for (let i = S.last.length - 1; i >= 0; i--) { const l = S.last[i]; ctx.save(); ctx.globalAlpha = 0.18 * (1 - i / 4); ctx.translate(l[0] - S.dir * (i + 1) * 4, l[1]); ctx.rotate(-l[2]); if (S.dir < 0) ctx.scale(-1, 1); sonicAt({ pose: S.ball ? "ball" : pose, ph: S.ph, rot: S.rot }); ctx.restore(); }
    ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(rot); if (S.dir < 0) ctx.scale(-1, 1);
    sonicAt({ pose, ph: S.ph, rot: S.rot, blink: S.blink > 0, eyesX: S.dead > 0 });
    ctx.restore();
    if (S.shield) { const [cx, cy] = sCenter(); ctx.globalAlpha = 0.35; ell(ctx, cx, cy, 21, 21, 0, "#5aaaff", 0); ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(cx, cy, 21, T * 0.05, T * 0.05 + 1.2); ctx.strokeStyle = "#e6f4ff"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalAlpha = 1; }
    if (S.star > 0) { const [cx, cy] = sCenter(); for (let i = 0; i < 4; i++) { const a = T * 0.15 + i * TAU / 4; star(ctx, cx + Math.cos(a) * 20, cy + Math.sin(a) * 20, 4.5, i % 2 ? "#fff" : "#ffd21f", a); } }
  }
  function drawBoss(b) {
    if (b.st === "gone") return;
    // цепь и шар
    ctx.strokeStyle = "#5c6178"; ctx.lineWidth = 1.4;
    for (let i = 1; i < 8; i++) { const t = i / 8; ell(ctx, lerp(b.x, b.bx, t), lerp(b.y + 16, b.by, t), 2.2, 2.2, 0, "#8d95ab", 1); }
    ctx.save(); ctx.translate(b.bx, b.by); ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.save(); ctx.clip();
    ctx.rotate(b.ang * 2); ctx.fillStyle = "#f2f4fa"; ctx.fillRect(-16, -16, 32, 32); ctx.fillStyle = "#23283d";
    for (let i = -2; i < 2; i++) for (let j = -2; j < 2; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 8, j * 8, 8, 8);
    ctx.restore(); ctx.lineWidth = 1.6; ctx.strokeStyle = OL; ctx.stroke();
    ctx.beginPath(); ctx.arc(-5, -5, 9, PI * 1.05, PI * 1.5); ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2.4; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(b.x, b.y); if (b.st === "boom") ctx.rotate(Math.sin(b.t * 0.5) * 0.15);
    // пламя
    const fl = 4 + Math.sin(T * 0.8) * 2; ctx.beginPath(); ctx.moveTo(-26, 2); ctx.lineTo(-34 - fl * 2, 6); ctx.lineTo(-26, 10); ctx.fillStyle = "#ffb020"; ctx.fill();
    // доктор
    ell(ctx, 4, -14, 11, 10, 0, "#e3262b", 1.2);
    ell(ctx, 6, -26, 8.5, 8, 0, "#f7c48a", 1.2);
    ell(ctx, 3, -27, 3.2, 3.2, 0, "rgba(160,220,255,.9)", 1); ell(ctx, 10, -27, 3.2, 3.2, 0, "rgba(160,220,255,.9)", 1);
    ctx.beginPath(); ctx.moveTo(2, -22); ctx.quadraticCurveTo(-8, -20, -10, -15); ctx.quadraticCurveTo(-2, -19, 6, -20); ctx.quadraticCurveTo(14, -19, 20, -15); ctx.quadraticCurveTo(18, -20, 10, -22); ctx.closePath();
    ctx.fillStyle = "#c8641a"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OL; ctx.stroke(); ell(ctx, 6, -23, 2.4, 2, 0, "#f2a07a", 0.8);
    // корпус-яйцо
    ctx.beginPath(); ctx.moveTo(-28, -6); ctx.quadraticCurveTo(-30, 18, 0, 18); ctx.quadraticCurveTo(30, 18, 28, -6); ctx.closePath();
    ctx.fillStyle = "#cfd5e3"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OL; ctx.stroke();
    ctx.fillStyle = "#ffcf26"; ctx.fillRect(-27, -7, 54, 4); ctx.strokeRect(-27, -7, 54, 4);
    ctx.beginPath(); ctx.arc(0, 4, 20, PI * 0.15, PI * 0.85); ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -8, 24, 22, 0, PI, TAU); ctx.fillStyle = "rgba(170,225,255,.28)"; ctx.fill(); ctx.strokeStyle = "rgba(10,26,74,.6)"; ctx.lineWidth = 1; ctx.stroke();
    if (b.flash && b.flash % 6 < 3) { ctx.globalAlpha = 0.65; ell(ctx, 0, -6, 31, 25, 0, "#fff", 0); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function txt(s, x, y, size, col, align, wgt, g) {
    g = g || ctx;
    g.font = (wgt || "italic 900 ") + size + "px " + FONT; g.textAlign = align || "left"; g.textBaseline = "alphabetic";
    g.lineJoin = "round"; g.lineWidth = Math.max(2.5, size * 0.22); g.strokeStyle = OL; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  }
  function fmtTime(fr) { const s = Math.floor(fr / 60); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  /* табло (очки, время, кольца, жизни) — в свою картинку, перерисовка только когда меняются цифры */
  function hud(fs, pad) {
    const blink = S.rings === 0 && T % 40 < 20, key = [G.score, Math.floor(G.time / 60), S.rings, blink, G.lives, fs, dpr, SUP.on, strips(SUP.on)[1].complete].join("|");
    const w = Math.ceil(pad + fs * 10), h = Math.ceil(pad + fs * 3.6 + 10), lh = Math.ceil(fs * 1.9), lw = Math.ceil(lh * 0.95 * 4 / 3 + fs * 2.6);
    if (hudC.key !== key) {
      hudC.key = key;
      const c = hudC.c || (hudC.c = document.createElement("canvas")); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const lab = (s, i) => txt(s, pad, pad + fs + i * (fs + 4), fs, "#ffd21f", 0, 0, g);
      const val = (s, i, red) => txt(s, pad + fs * 4.6, pad + fs + i * (fs + 4), fs, red ? "#ff5a5a" : "#fff", 0, 0, g);
      lab("ОЧКИ", 0); val(String(G.score), 0); lab("ВРЕМЯ", 1); val(fmtTime(G.time), 1); lab("КОЛЬЦА", 2); val(String(S.rings), 2, blink);
      const l = hudC.l || (hudC.l = document.createElement("canvas")); l.width = Math.ceil(lw * dpr); l.height = Math.ceil(lh * dpr);
      const q = l.getContext("2d"); q.setTransform(dpr, 0, 0, dpr, 0, 0); q.imageSmoothingQuality = "high";
      const [, pos] = strips(SUP.on), ih = lh * 0.95, iw = ih * 4 / 3;      // значок жизней — голова Соника из кадра «стоит»
      if (pos.complete && pos.naturalWidth) q.drawImage(pos, 60, 28, 200, 150, 0, lh - ih, iw, ih);
      else { q.save(); q.translate(fs * 0.6, lh - fs * 0.25); q.scale(fs / 30, fs / 30); q.translate(0, 26); head(q, {}); q.restore(); }
      txt("× " + G.lives, iw + fs * 0.15, lh - fs * 0.2, fs, "#fff", 0, 0, q);
    }
    ctx.drawImage(hudC.c, 0, 0, hudC.c.width / dpr, hudC.c.height / dpr);
    // жизни внизу слева; в «Кнопках» там джойстик — справа вверху, под кнопками карточки (пауза, звук, экран, назад)
    if (G.mode === "pad" && !G.kbd) ctx.drawImage(hudC.l, cssW - lw - pad * 0.5, 48, lw, lh);
    else ctx.drawImage(hudC.l, pad, cssH - pad - lh + fs * 0.05, lw, lh);
  }
  /* «управляю сам» одним пальцем (23.10, Андрей: «в любом месте нажал — и прыгнуть, и пригнуться, и ускориться, и медленно регулировать
     скорость оттяжкой в сторону»): под пальцем — от точки касания до пальца; внизу по центру — заданная скорость (держится без пальца) */
  const dragR = () => clamp(cssW * 0.3, 90, 240);        // столько пикселей вбок — от стоянки до полной скорости
  function drawGesture() {
    const c = G.cruise, w = Math.min(180, cssW * 0.42), cx = cssW / 2, y = cssH - Math.max(10, cssH * 0.05);
    ctx.fillStyle = "rgba(10,26,74,.55)"; ctx.beginPath(); ctx.roundRect(cx - w / 2 - 4, y - 6, w + 8, 12, 6); ctx.fill();
    const len = c * w / 2; ctx.fillStyle = Math.abs(c) > 0.85 ? "#ff7a1a" : "#ffd21f"; ctx.fillRect(Math.min(cx, cx + len), y - 3, Math.abs(len), 6);
    ctx.fillStyle = "#fff"; ctx.fillRect(cx - 1, y - 7, 2, 14);
    if (Math.abs(c) > 0.03) { const ex = cx + len, d = sgn(c); ctx.beginPath(); ctx.moveTo(ex + d * 7, y); ctx.lineTo(ex - d * 1, y - 6); ctx.lineTo(ex - d * 1, y + 6); ctx.closePath(); ctx.fill(); }
    const g = G.gest; if (!g || G.kbd) return;
    ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.arc(g.x0, g.y0, 16, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x0 + g.dx, g.y0 + g.dy); ctx.stroke();
    ctx.fillStyle = G.gDown ? "#5aaaff" : "#ffd21f"; ctx.beginPath(); ctx.arc(g.x0 + g.dx, g.y0 + g.dy, 10, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  /* «кнопки» как в мобильных играх (23.10, Андрей: «чтобы ощущения от управления были как в играх на телефоне Apple»):
     джойстик появляется там, где коснулся левый палец, и едет за ним; правая половина экрана — прыжок (держишь — выше) */
  const joyR = () => clamp(cssH * 0.16, 34, 62);
  function joyUpdate(j) {
    const R = joyR(); let dx = j.x - j.x0, dy = j.y - j.y0; const d = Math.hypot(dx, dy);
    if (d > R) { j.x0 = j.x - dx / d * R; j.y0 = j.y - dy / d * R; dx = j.x - j.x0; dy = j.y - j.y0; }     // основа тянется за пальцем
    G.pad.x = Math.abs(dx) > R * 0.28 ? sgn(dx) : 0;
    G.pad.down = dy > R * 0.5 && dy > Math.abs(dx) * 0.75;
  }
  function drawJoy() {
    if (G.kbd) return;
    const R = joyR(), m = Math.max(10, cssH * 0.05), j = G.joy, bx = j ? j.x0 : m + R, by = j ? j.y0 : cssH - m - R;
    ctx.globalAlpha = j ? 0.55 : 0.3;
    ell(ctx, bx, by, R, R, 0, "rgba(10,26,74,.6)", 0); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = "#fff";
    for (const [a, on] of [[PI, G.pad.x < 0], [0, G.pad.x > 0], [PI / 2, G.pad.down]]) {
      const tx = bx + Math.cos(a) * R * 0.72, ty = by + Math.sin(a) * R * 0.72, s = R * 0.16;
      ctx.fillStyle = on ? "#ffd21f" : "#fff"; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const t = a + i * TAU / 3; ctx[i ? "lineTo" : "moveTo"](tx + Math.cos(t) * s, ty + Math.sin(t) * s); } ctx.closePath(); ctx.fill();
    }
    const kx = j ? clamp(j.x, bx - R, bx + R) : bx, ky = j ? clamp(j.y, by - R, by + R) : by;
    ctx.globalAlpha = j ? 0.9 : 0.4; ell(ctx, kx, ky, R * 0.44, R * 0.44, 0, j && (G.pad.x || G.pad.down) ? "#ffd21f" : "#e9f0ff", 1.5);
    const jr = R * 0.82, jx = cssW - m - jr, jy = cssH - m - jr, on = G.padJ.size > 0;
    ctx.globalAlpha = on ? 0.85 : 0.35; ell(ctx, jx, jy, jr, jr, 0, on ? "#ffd21f" : "rgba(10,26,74,.6)", 0);
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(jx, jy, jr, 0, TAU); ctx.stroke();
    ctx.font = "italic 900 " + Math.round(jr * 0.9) + "px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.fillText("A", jx, jy + 1);
    ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
  }
  /* пауза (23.10, Андрей: «нужна возможность остановить игру и начать заново»): кнопка ⏸ на карточке, Esc или P */
  function drawMenu() {
    const f1 = clamp(cssH * 0.12, 18, 44), bh = clamp(cssH * 0.14, 30, 54), bw = Math.min(cssW * 0.7, 340), x = cssW / 2 - bw / 2;
    ctx.fillStyle = "rgba(10,26,74,.72)"; ctx.fillRect(0, 0, cssW, cssH);
    let y = Math.max(f1 + 6, cssH / 2 - bh * 1.9 - f1 * 0.3);
    txt("ПАУЗА", cssW / 2, y, f1, "#ffd21f", "center"); y += f1 * 0.45;
    uiBtn("m_go", x, y, bw, bh, "ПРОДОЛЖИТЬ", "", true); y += bh * 1.2;
    uiBtn("m_restart", x, y, bw, bh, "НАЧАТЬ ЗАНОВО", "", false); y += bh * 1.2;
    uiBtn("m_title", x, y, bw, bh, "СМЕНИТЬ РЕЖИМ", "", false);
  }
  function overlay() {
    const fs = clamp(Math.round(cssH * 0.07), 11, 18), pad = Math.round(fs * 0.7);
    G.ui = [];                                       // кнопки на холсте пересобираются каждый кадр
    if (G.state === "title") return titleScreen();
    hud(fs, pad);
    if (G.boss && G.boss.st !== "gone") {
      const n = 8, w = fs * 0.9, x = cssW / 2 - n * w / 2, by = cssW < 560 ? 50 : pad;      // на телефоне — под кнопками карточки
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < G.boss.hp ? "#ff3d3d" : "rgba(10,26,74,.5)"; ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + i * w, by, w - 3, fs * 0.6, 3); ctx.fill(); ctx.stroke(); }
    }
    const play = G.state === "play" || G.state === "card";
    if (G.mode === "manual" && play) drawGesture();
    if (G.mode === "pad" && play) drawJoy();
    if (G.hint > 0 && G.state === "play") {
      ctx.globalAlpha = Math.min(1, G.hint / 30);
      const ls = G.mode !== "auto" && G.kbd ? ["← → — бег · пробел — прыжок · ↓ на ходу — клубок · ↓ + пробел — спин-дэш"]
        : G.mode === "manual" ? ["Палец в любом месте: тяни вбок — скорость", "тап или вверх — прыжок · вниз — присесть, держи — спин-дэш"]
        : G.mode === "pad" ? ["Левый палец — джойстик: вбок — бег, вниз — присесть", "правый — прыжок (держи — выше) · присел + прыжок — спин-дэш"]
        : ["Тап — прыжок · держи — выше · тап в прыжке — атака"];
      const s0 = Math.min(...ls.map(s => fit(s, Math.max(10, fs * 0.8), cssW - 16)));
      ls.forEach((s, i) => txt(s, cssW / 2, cssH * 0.5 + i * s0 * 1.35, s0, "#fff", "center")); ctx.globalAlpha = 1;
    }
    if (G.flash && G.state === "play") {             // «приз всё ближе» посреди игры
      const t = G.flash.t, a = Math.min(1, t / 15, (170 - t) / 25), f = clamp(cssH * 0.1, 16, 40) * (1 + 0.15 * Math.max(0, 1 - t / 12));
      ctx.globalAlpha = Math.max(0, a); txt(G.flash.txt, cssW / 2, cssH * 0.36, fit(G.flash.txt, f, cssW - 20), "#ffe24a", "center"); ctx.globalAlpha = 1;
    }
    if (G.state === "card") titleCard(); else if (G.state === "clear") clearScreen(); else if (G.state === "over") bigMsg("ИГРА ОКОНЧЕНА", "Нажми, чтобы начать заново");
    else if (G.state === "teaser") teaserScreen();
    if (G.menu) drawMenu();
  }
  function fit(s, size, maxW, wgt) { ctx.font = (wgt || "italic 900 ") + size + "px " + FONT; const w = ctx.measureText(s).width; return w > maxW ? Math.max(7, size * maxW / w) : size; }
  function wrap(s, size, maxW, wgt) {                  // строки по ширине
    ctx.font = (wgt || "italic 900 ") + size + "px " + FONT; const out = []; let cur = "";
    for (const w of s.split(" ")) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function uiBtn(id, x, y, w, h, label, sub, on) {
    G.ui.push({ id, x, y, w, h });
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.3);
    ctx.fillStyle = on ? "rgba(255,200,20,.96)" : "rgba(10,26,74,.74)"; ctx.fill();
    ctx.lineWidth = on ? 3 : 1.6; ctx.strokeStyle = on ? "#fff" : "rgba(255,255,255,.7)"; ctx.stroke();
    const s = fit(label, h * (sub ? 0.38 : 0.46), w - h * 0.4);
    txt(label, x + w / 2, y + (sub ? h * 0.47 : h * 0.5 + s * 0.36), s, "#fff", "center");
    if (sub) { const s2 = fit(sub, h * 0.22, w - h * 0.3, "700 "); ctx.font = "700 " + s2 + "px " + FONT; ctx.textAlign = "center"; ctx.fillStyle = on ? "#0a1a4a" : "#bfe3ff"; ctx.fillText(sub, x + w / 2, y + h * 0.82); }
  }
  /* ═══ секретный бонус (23.10, Андрей: «не писать Бондареву, а просто пройди и получи секретный бонус… надо что-то интереснее»):
     после босса — секретный этап, как в Sonic 1: лабиринт вращается, Соник клубком катится под действием силы тяжести «вниз экрана»,
     кольца, отбойники, блоки R (разворачивают вращение), по краям GOAL (выкидывает с этапа). В центре — Изумруд Хаоса: достал →
     Супер Соник (золотой, на 20% быстрее, враги не страшны) — и в игре, и на обложке «Юнитки». Управление то же одним пальцем:
     тянешь вбок — катится, тап или взмах вверх — прыжок; клавиши ← → и пробел. 60 секунд, попыток сколько угодно. ═══ */
  function zoneDone() {
    G.tt = (G.tt || 0) + G.time;
    let best = null; try { best = JSON.parse(LSG("unitka.sxBest") || "null"); } catch (e) {}
    G.best = best; if (!best || G.score > best.score) LSS("unitka.sxBest", JSON.stringify({ score: G.score, tt: G.tt }));
    strips(true);                                    // золотые кадры — заранее, к награде
    setProg(3); G.state = "teaser"; G.st = 0;
  }
  function teaserScreen() {
    const fs = clamp(cssH * 0.11, 16, 42), x = cssW / 2;
    ctx.fillStyle = "rgba(10,26,74,.62)"; ctx.fillRect(0, 0, cssW, cssH);
    txt("ЗОНА ПРОЙДЕНА!", x, cssH * 0.24, fit("ЗОНА ПРОЙДЕНА!", fs, cssW - 24), "#ffd21f", "center");
    const st = "Очки " + G.score + " · время " + fmtTime(G.tt || 0) + (G.best && G.best.score > G.score ? " · рекорд " + G.best.score : "");
    txt(st, x, cssH * 0.24 + fs * 0.9, fit(st, fs * 0.42, cssW - 24), "#fff", "center");
    const tw = Math.min(cssW * 0.8, 420); prizeTrack(x - tw / 2, cssH * 0.47, tw, clamp(cssH * 0.06, 12, 24), 3);
    const s = "★ ПРИЗ СОВСЕМ БЛИЗКО — СЕКРЕТНЫЙ ЭТАП! ★", k = 1 + 0.06 * Math.sin(T * 0.12), s2 = fit(s, fs * 0.6 * k, cssW - 24);
    if (G.st > 50) txt(s, x, cssH * 0.68, s2, T % 30 < 20 ? "#ffe24a" : "#fff", "center");
    if (G.st > 90 && T % 60 < 42) txt("нажми, чтобы войти", x, cssH * 0.68 + fs * 0.75, Math.max(10, fs * 0.36), "#bfe3ff", "center");
  }
  // лабиринт 15×25 клеток по 32: четыре полки с проходами то слева, то справа; на стенах у полок — GOAL (качнуло к стене — вылетел),
  // внизу — Изумруд Хаоса и GOAL в углу. Лабиринт качается ±29° (период ~6 с); блок R разворачивает качание.
  const SS = { W: 15, H: 25, C: 32, R: 11 };
  const SS_GAPS = [[5, 6, 7], [10, 9, 10], [15, 4, 5], [19, 9, 10]];         // полка: ряд, проход — столбцы (от GOAL до места падения — 3–5 клеток)
  function ssMaze() {
    const { W, H } = SS, m = Array.from({ length: H }, () => Array(W).fill("."));
    for (let c = 0; c < W; c++) m[0][c] = m[H - 1][c] = "#";
    for (let r = 0; r < H; r++) m[r][0] = m[r][W - 1] = "#";
    for (const [r, a, b] of SS_GAPS) for (let c = 1; c < W - 1; c++) if (c < a || c > b) m[r][c] = "#";
    // на каждой полке GOAL — у стены с той стороны, где нет прохода: качнуло не туда и не удержал — вылетел
    m[3][W - 1] = m[4][W - 1] = "G"; m[8][0] = m[9][0] = "G"; m[13][W - 1] = m[14][W - 1] = "G"; m[17][0] = m[18][0] = "G";
    m[H - 2][1] = m[H - 2][W - 2] = "G";
    m[H - 2][7] = "E";
    for (const [r, c] of [[2, 2], [2, 12], [7, 9], [12, 3], [17, 8], [21, 3]]) m[r][c] = "B";
    m[4][0] = m[9][W - 1] = m[14][0] = m[18][W - 1] = "R";           // R — у стены напротив GOAL: докатился — качание развернётся
    for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (m[r][c] === "." && (r + c) % 2 === 0 && r > 3) m[r][c] = "o";
    return m;
  }
  function ssStart() {
    G.sp = { m: ssMaze(), th: 0, ph: 0, w: -0.018, x: 10.5 * SS.C, y: 2.5 * SS.C, vx: 0, vy: 0, rot: 0, rings: 0, time: 3600, intro: 200, end: null, endT: 0, ground: false, rcool: 0, mz: null };
    G.state = "special"; G.st = 0; G.gest = null; G.gDown = false; G.tap = false;
  }
  function ssAxis() {                                              // −1…1: клавиши или палец (от точки касания вбок)
    const k = (G.keys.R ? 1 : 0) - (G.keys.L ? 1 : 0); if (k) return k;
    const g = G.gest; if (g) return clamp(g.dx / (dragR() * 0.5), -1, 1);
    if (dbg.ssBot) {                                               // проверка: катим к проходу своей полки, внизу — к изумруду
      const sp = G.sp, row = sp.y / SS.C, lvl = SS_GAPS.findIndex(q => row < q[0]), tx = lvl < 0 ? 7.5 * SS.C : (SS_GAPS[lvl][1] + SS_GAPS[lvl][2] + 1) / 2 * SS.C;
      sp.stuck = sp.ground && Math.abs(sp.vx) < 0.3 && Math.abs(tx - sp.x) > 20 ? (sp.stuck || 0) + 1 : 0;
      if (sp.stuck > 25) { G.tap = true; sp.stuck = 0; }
      return clamp((tx - sp.x) / 30, -1, 1);
    }
    return 0;
  }
  function ssEnd(ok, why) {
    const sp = G.sp; sp.end = ok ? "win" : why; sp.endT = 0;
    G.score += sp.rings * 10 + (ok ? 5000 : 0);
    if (ok) {                                        // код приза (чили-дог от Андрея): из очков, времени и даты — показать Андрею
      setProg(4);
      const s = G.score + "|" + G.tt + "|" + new Date().toISOString().slice(0, 10); let h = 2166136261;
      for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
      G.code = "SONIC-" + h.toString(36).toUpperCase().padStart(5, "0").slice(0, 5); G.sent = "";
    }
    if (ok) { SFX.item(); if (!SUP.ok) sp.first = true; SUP.ok = true; SUP.on = true; LSS("unitka.sxSuper", "1"); LSS("unitka.sxSuperOn", "1"); strips(true); pic("charG", "sonic-char-gold.webp"); hudC.key = ""; }
    else SFX.lose();
  }
  function ssStep() {
    const sp = G.sp, tap = G.tap; G.tap = false; G.st++;
    if (sp.end) { if (++sp.endT > 100) { G.state = "spres"; G.st = 0; } return; }
    if (sp.intro > 0) { sp.intro--; if (tap && sp.intro < 150) sp.intro = 0; return; }
    if (--sp.time <= 0) return ssEnd(false, "time");
    sp.ph += sp.w; sp.th = 0.56 * Math.sin(sp.ph); if (sp.rcool > 0) sp.rcool--;
    const c = Math.cos(sp.th), s = Math.sin(sp.th), gx = s, gy = c, rx = c, ry = -s;     // «вниз» и «вправо» экрана в координатах лабиринта
    const ax = ssAxis();
    sp.vx += gx * 0.16 + rx * ax * 0.11; sp.vy += gy * 0.16 + ry * ax * 0.11;
    if ((tap || dbg.ssJump) && sp.ground) { sp.vx -= gx * 5.2; sp.vy -= gy * 5.2; SFX.jump(); }
    const v = Math.hypot(sp.vx, sp.vy); if (v > 8) { sp.vx *= 8 / v; sp.vy *= 8 / v; }
    sp.ground = false;
    for (let k = 0; k < 4 && !sp.end; k++) { sp.x += sp.vx / 4; sp.y += sp.vy / 4; ssCollide(sp, gx, gy); }   // по четверти шага — сквозь стену не проскочит
    sp.rot += (sp.vx * rx + sp.vy * ry) * 0.09;
  }
  function ssCollide(sp, gx, gy) {
    const C = SS.C, r = SS.R, m = sp.m;
    const i0 = Math.floor((sp.x - r) / C), i1 = Math.floor((sp.x + r) / C), j0 = Math.floor((sp.y - r) / C), j1 = Math.floor((sp.y + r) / C);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ch = m[j] && m[j][i]; if (!ch || ch === ".") continue;
      if (ch === "o") { const dx = (i + 0.5) * C - sp.x, dy = (j + 0.5) * C - sp.y; if (dx * dx + dy * dy < (r + 9) ** 2) { m[j][i] = "."; sp.rings++; SFX.ring(); } continue; }
      const qx = clamp(sp.x, i * C, i * C + C), qy = clamp(sp.y, j * C, j * C + C);
      let nx = sp.x - qx, ny = sp.y - qy, d = Math.hypot(nx, ny);
      if (d >= r) continue;
      if (ch === "E") return ssEnd(true);
      if (ch === "G") return ssEnd(false, "goal");
      if (d < 1e-6) { nx = -gx; ny = -gy; d = 1e-6; } else { nx /= d; ny /= d; }
      sp.x += nx * (r - d); sp.y += ny * (r - d);
      const vn = sp.vx * nx + sp.vy * ny;
      if (ch === "B") { sp.vx += (6.5 - vn) * nx; sp.vy += (6.5 - vn) * ny; SFX.spring(); continue; }
      if (ch === "R" && !sp.rcool) { sp.w = -sp.w; sp.rcool = 40; SFX.check(); }
      if (vn < 0) { sp.vx -= vn * nx; sp.vy -= vn * ny; }
      if (-(nx * gx + ny * gy) > 0.55) sp.ground = true;
    }
  }
  const ssZoom = () => cssH / 240;                                 // css-пикселей на единицу этапа: по высоте видно ~7–8 клеток
  function ssBlock(g, x, y, a, b) {
    g.fillStyle = a; g.fillRect(x, y, 32, 32); g.fillStyle = b;
    g.beginPath(); g.moveTo(x + 16, y + 5); g.lineTo(x + 27, y + 16); g.lineTo(x + 16, y + 27); g.lineTo(x + 5, y + 16); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, y, 32, 3); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x, y + 29, 32, 3);
    g.strokeStyle = OL; g.lineWidth = 1.2; g.strokeRect(x + 0.6, y + 0.6, 30.8, 30.8);
  }
  function ssStatic() {                                            // лабиринт без колец и изумруда — одной картинкой, пока не сменился размер
    const sp = G.sp, C = SS.C, z = Math.min(2.6, ssZoom() * dpr);
    if (sp.mz && sp.mz.z === z) return sp.mz;
    const c = document.createElement("canvas"); c.width = Math.ceil(SS.W * C * z); c.height = Math.ceil(SS.H * C * z); const g = c.getContext("2d"); g.scale(z, z);
    const col = [["#2f6df5", "#9cc2ff"], ["#e8457c", "#ffb3cf"], ["#f2b51b", "#fff0a8"], ["#26b35a", "#b6f5c8"], ["#8a4cf0", "#d6c2ff"]];
    for (let j = 0; j < SS.H; j++) for (let i = 0; i < SS.W; i++) {
      const ch = sp.m[j][i], x = i * C, y = j * C;
      if (ch === "#") { const [a, b] = col[Math.min(4, Math.floor(j / 5))]; ssBlock(g, x, y, a, b); }
      else if (ch === "R") { ssBlock(g, x, y, "#ff9a1a", "#ffd9a0"); g.font = "italic 900 18px " + FONT; g.textAlign = "center"; g.fillStyle = "#fff"; g.strokeStyle = OL; g.lineWidth = 2.5; g.strokeText("R", x + 16, y + 23); g.fillText("R", x + 16, y + 23); }
      else if (ch === "G") {
        g.fillStyle = "#fff"; g.fillRect(x, y, 32, 32); g.strokeStyle = "#e3262b"; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, 28, 28);
        g.font = "900 9px " + FONT; g.textAlign = "center"; g.fillStyle = "#e3262b"; g.fillText("GOAL", x + 16, y + 19);
      } else if (ch === "B") {
        ell(g, x + 16, y + 16, 14, 14, 0, "#f2f4fa", 1.4); ell(g, x + 16, y + 16, 9, 9, 0, "#e3262b", 0); star(g, x + 16, y + 16, 6, "#fff", 0);
      }
    }
    c.z = z; sp.mz = c; return c;
  }
  function ssGem(g, x, y, t) {                                     // Изумруд Хаоса
    g.save(); g.translate(x, y); g.scale(1 + 0.06 * Math.sin(t * 0.1), 1 + 0.06 * Math.sin(t * 0.1));
    g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 0.08); ell(g, 0, 0, 22, 22, 0, "#9dffb8", 0); g.globalAlpha = 1;
    g.beginPath(); g.moveTo(0, -14); g.lineTo(12, -4); g.lineTo(7, 12); g.lineTo(-7, 12); g.lineTo(-12, -4); g.closePath();
    g.fillStyle = "#1fd26a"; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OL; g.stroke();
    g.beginPath(); g.moveTo(0, -14); g.lineTo(5, -3); g.lineTo(-5, -3); g.closePath(); g.fillStyle = "#c8ffd9"; g.fill();
    g.beginPath(); g.moveTo(-5, -3); g.lineTo(5, -3); g.lineTo(3, 12); g.lineTo(-3, 12); g.closePath(); g.fillStyle = "#3ff08c"; g.fill();
    star(g, 8 * Math.cos(t * 0.07), -12 + 4 * Math.sin(t * 0.09), 4 + 2 * Math.sin(t * 0.2), "#fff", t * 0.05);
    g.restore();
  }
  function drawSpecial() {
    const sp = G.sp, z = ssZoom(), C = SS.C;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // фон: лиловая глубина и плывущие ромбы (как стаи на фоне Sonic 1)
    const bg = ctx.createRadialGradient(cssW / 2, cssH / 2, 10, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.8);
    bg.addColorStop(0, "#5a2bc4"); bg.addColorStop(1, "#0b1660"); ctx.fillStyle = bg; ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    for (let i = 0; i < 28; i++) { const x = ((i * 137 + T * (0.4 + (i % 3) * 0.2)) % (cssW + 60)) - 30, y = ((i * 89) % (cssH + 40)) - 20, r = 6 + (i % 4) * 3;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); }
    ctx.save(); ctx.translate(cssW / 2, cssH / 2); ctx.scale(z, z); ctx.rotate(sp.th); ctx.translate(-sp.x, -sp.y);
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(ssStatic(), 0, 0, SS.W * C, SS.H * C);
    const vr = Math.hypot(cssW, cssH) / z / 2 + C, ph = T * 0.13;
    for (let j = 0; j < SS.H; j++) for (let i = 0; i < SS.W; i++) {
      const ch = sp.m[j][i]; if (ch !== "o" && ch !== "E") continue;
      const x = (i + 0.5) * C, y = (j + 0.5) * C; if (Math.abs(x - sp.x) > vr || Math.abs(y - sp.y) > vr) continue;
      if (ch === "o") ring(ctx, x, y, ph); else if (sp.end !== "win") ssGem(ctx, x, y, T);
    }
    ctx.restore();
    // Соник клубком — в центре экрана
    if (sp.end !== "goal" || sp.endT < 20) {
      ctx.save(); ctx.translate(cssW / 2, cssH / 2); ctx.scale(z * SS.R / 14, z * SS.R / 14); ctx.translate(0, 14);
      if (!sonicSpr(ctx, { pose: "ball", rot: sp.rot }, SUP.on)) sonic(ctx, { pose: "ball", rot: sp.rot });
      ctx.restore();
    }
    // табло
    const fs = clamp(Math.round(cssH * 0.07), 11, 18), pad = Math.round(fs * 0.7);
    txt("КОЛЬЦА", pad, pad + fs, fs, "#ffd21f"); txt(String(sp.rings), pad + fs * 4.6, pad + fs, fs, "#fff");
    txt("ВРЕМЯ", pad, pad + fs * 2 + 4, fs, "#ffd21f"); txt(fmtTime(Math.max(0, sp.time)), pad + fs * 4.6, pad + fs * 2 + 4, fs, sp.time < 600 && T % 30 < 15 ? "#ff5a5a" : "#fff");
    const f1 = clamp(cssH * 0.1, 16, 40), cx = cssW / 2;
    if (sp.intro > 0) {
      const a = Math.min(1, sp.intro / 30); ctx.globalAlpha = a; ctx.fillStyle = "rgba(10,26,74,.6)"; ctx.fillRect(0, 0, cssW, cssH);
      txt("СЕКРЕТНЫЙ ЭТАП", cx, cssH * 0.28, fit("СЕКРЕТНЫЙ ЭТАП", f1, cssW - 24), "#ffe24a", "center");
      const ls = ["Лабиринт качается — спустись к Изумруду Хаоса на дне", "Не касайся блоков GOAL · 60 секунд",
        G.kbd ? "← → — катиться · пробел — прыжок" : "Тяни вбок — катиться · тап — прыжок"];
      const s2 = Math.min(...ls.map(s => fit(s, f1 * 0.42, cssW - 24)));
      ls.forEach((s, i) => txt(s, cx, cssH * 0.28 + f1 * 0.9 + i * s2 * 1.5, s2, i === 2 ? "#bfe3ff" : "#fff", "center"));
      ssGem(ctx, cx, cssH * 0.8, T);
      ctx.globalAlpha = 1;
    }
    if (sp.end && G.state !== "spres") {
      if (sp.end === "win") { ctx.globalAlpha = Math.max(0, 1 - sp.endT / 60); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }
      const msg = sp.end === "win" ? "ИЗУМРУД ХАОСА!" : sp.end === "goal" ? "GOAL — ВЫКИНУЛО!" : "ВРЕМЯ ВЫШЛО";
      txt(msg, cx, cssH * 0.45, fit(msg, f1, cssW - 24), sp.end === "win" ? "#1fd26a" : "#ffd21f", "center");
    }
    if (G.state === "spres") ssResult();
    if (G.menu) drawMenu();
  }
  function ssResult() {
    const sp = G.sp, ok = sp.end === "win";
    ctx.fillStyle = "rgba(10,26,74,.82)"; ctx.fillRect(0, 0, cssW, cssH);
    const narrow = cssW < 560, sh = cssH * (narrow ? 0.52 : 0.74), x = Math.max(12, cssW * 0.04), colW = cssW - x - (ok ? sh * 0.75 : 12);
    const f1 = clamp(cssH * 0.1, 15, 40), f2 = clamp(cssH * 0.055, 10, 19);
    if (ok) {
      const [, pos] = strips(true), k = sh / 280, sx = cssW - sh * 0.42, sy = cssH * 0.94 + Math.sin(T * 0.06) * 3;
      for (let i = 0; i < 8; i++) { const a = T * 0.03 + i * TAU / 8, r = sh * (0.42 + 0.08 * Math.sin(T * 0.07 + i)); star(ctx, sx + Math.cos(a) * r, sy - sh * 0.5 + Math.sin(a) * r, sh * 0.05, i % 2 ? "#fff" : "#ffd21f", a); }
      if (pos.complete && pos.naturalWidth) { ctx.save(); ctx.imageSmoothingQuality = "high"; ctx.drawImage(pos, 7 * 320, 0, 320, 320, sx - 160 * k, sy - 310 * k, 320 * k, 320 * k); ctx.restore(); }
      ssGem(ctx, sx - sh * 0.38, sy - sh * 0.82, T);
    }
    let y = cssH * 0.06 + f1;
    const h1 = ok ? "ЦЕННЫЙ ПРИЗ ТВОЙ!" : "ИЗУМРУД УСКОЛЬЗНУЛ…";
    txt(h1, x, y, fit(h1, f1, colW), ok ? "#ffe24a" : "#ffd21f");
    const para = (s, col) => { for (const l of wrap(s, f2, colW)) { y += f2 * 1.35; txt(l, x, y, f2, col); } };
    y += f2 * 0.4;
    if (ok) {                                        // приз (Андрей 23.10: «приз оставляем как есть — чили-дог») + Супер Соник
      para("★ Приз от Андрея — чили-дог, любимая еда Соника. Отправь ему код:", "#fff");
      y += f2 * 1.5; txt(G.code || "", x, y, fit(G.code || "", f2 * 1.5, colW), "#ffe24a");
      para("★ И Супер Соник: золотой, быстрее, враги не страшны — в игре и на обложке «Юнитки».", "#bfe3ff");
    } else {
      para(sp.end === "goal" ? "Блок GOAL выкинул тебя с этапа." : "60 секунд вышли.", "#fff");
      para("Приз совсем рядом — попробуй снова, попыток сколько угодно.", "#bfe3ff");
      y += f2 * 0.6; txt("Кольца на этапе: " + sp.rings + " · очки: " + G.score, x, y + f2 * 0.6, fit("Кольца на этапе: " + sp.rings + " · очки: " + G.score, f2 * 0.9, colW), "#ffd21f");
    }
    const bh = clamp(cssH * 0.13, 28, 50), bw = Math.min(colW * 0.56, 280), by = Math.min(cssH - bh - 8, y + f2 * 1.2);
    if (G.st > 40) {
      if (ok) { uiBtn("ss_share", x, by, bw, bh, "ОТПРАВИТЬ АНДРЕЮ", "", true); uiBtn("ss_title", x + bw + 8, by, Math.min(colW - bw - 8, bw * 0.7), bh, "ДАЛЬШЕ", "", false); }
      else { uiBtn("ss_again", x, by, bw, bh, "ЕЩЁ ПОПЫТКА", "", true); uiBtn("ss_title", x + bw + 8, by, Math.min(colW - bw - 8, bw * 0.7), bh, "НА ЗАСТАВКУ", "", false); }
      if (ok && G.sent) {
        const below = by + bh + f2 * 1.2 <= cssH - 3, s = fit(G.sent, f2 * 0.9, below ? colW : cssW - 16);
        if (!below) { ctx.fillStyle = "rgba(10,26,74,.92)"; ctx.fillRect(0, cssH - s * 1.7, cssW, s * 1.7); }
        txt(G.sent, below ? x : cssW / 2, below ? by + bh + f2 * 1.2 : cssH - s * 0.45, s, "#9cff7a", below ? "left" : "center");
      }
    }
  }
  // «Отправить Андрею»: на телефоне — системное «Поделиться» (Telegram и др.), на ПК — текст с кодом в буфер; новых окон не открываем
  function share() {
    const msg = "Андрей, я прошёл Соника в Юнитке и достал Изумруд Хаоса! Очки " + G.score + ", время " + fmtTime(G.tt || 0) + ". Код приза: " + G.code + " — с тебя чили-дог!";
    const copy = () => { try { navigator.clipboard.writeText(msg).then(() => { G.sent = "Скопировано — вставь Андрею в Telegram"; }, () => { G.sent = "Напиши Андрею код: " + G.code; }); } catch (e) { G.sent = "Напиши Андрею код: " + G.code; } };
    if (navigator.share && matchMedia("(pointer: coarse)").matches) navigator.share({ text: msg }).then(() => { G.sent = "Отправлено"; }, copy);
    else copy();
  }
  /* путь к призу: Акт 1 → Акт 2 → Босс → Секрет → подарок (лучший результат хранится — обложка и заставка подсказывают, что приз всё ближе) */
  const PROG = ["Акт 1", "Акт 2", "Босс", "Секрет"];
  function setProg(n) { if (n > G.prog) { G.prog = n; LSS("unitka.sxProg", String(n)); } }
  function prizeLine() {
    return ["★ Пройди и получи ЦЕННЫЙ ПРИЗ! ★", "★ Приз уже ближе — пройди акт 2!", "★ До приза — только босс!", "★ Приз совсем рядом — секретный этап!", "★ Ценный приз твой — играй Супер Соником"][Math.min(4, G.prog)];
  }
  function gift(g, x, y, s) {                         // подарок: коробка с золотой лентой
    g.save(); g.translate(x, y);
    g.fillStyle = "#e3262b"; g.strokeStyle = OL; g.lineWidth = Math.max(1, s * 0.09);
    g.beginPath(); g.rect(-s * 0.5, -s * 0.2, s, s * 0.7); g.fill(); g.stroke();
    g.beginPath(); g.rect(-s * 0.58, -s * 0.42, s * 1.16, s * 0.24); g.fill(); g.stroke();
    g.fillStyle = "#ffd21f"; g.fillRect(-s * 0.1, -s * 0.42, s * 0.2, s * 0.92);
    ell(g, -s * 0.18, -s * 0.52, s * 0.18, s * 0.12, -0.5, "#ffd21f", g.lineWidth); ell(g, s * 0.18, -s * 0.52, s * 0.18, s * 0.12, 0.5, "#ffd21f", g.lineWidth);
    g.restore();
  }
  function prizeTrack(x, y, w, h, now) {               // now — сколько шагов пройдено (подсвечиваются); последний — подарок
    const n = PROG.length, step = w / n, r = h * 0.32;
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = Math.max(2, h * 0.12); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - h * 0.5, y); ctx.stroke();
    ctx.font = "800 " + Math.max(8, Math.round(h * 0.55)) + "px " + FONT; ctx.textAlign = "center";
    for (let i = 0; i < n; i++) {
      const cx = x + r + i * step, done = i < now;
      ell(ctx, cx, y, r, r, 0, done ? "#ffd21f" : "rgba(10,26,74,.85)", 1.4);
      if (h >= 16) { ctx.fillStyle = done ? "#ffe24a" : "#bfe3ff"; ctx.fillText(PROG[i], cx, y + r + h * 0.62); }
    }
    gift(ctx, x + w - h * 0.35, y, h * (now >= n ? 1.05 + 0.08 * Math.sin(T * 0.15) : 0.85));
  }
  function titleCard() {
    const t = G.st, a = Math.min(1, t / 20), b = t > 115 ? (140 - t) / 25 : 1, e = Math.max(0, Math.min(a, b));
    ctx.save(); ctx.globalAlpha = e;
    ctx.fillStyle = "#1d5fe6"; ctx.fillRect(0, 0, cssW * 0.36 * e, cssH);
    ctx.fillStyle = "#ffcf26"; ctx.fillRect(0, cssH * 0.78, cssW * e, cssH * 0.22);
    ctx.fillStyle = "#e3262b"; ctx.fillRect(cssW * (1 - 0.5 * e), cssH * 0.18, cssW * 0.5, cssH * 0.1);
    const fs = clamp(cssH * 0.11, 16, 40);
    txt("ЗОНА ЗЕЛЁНЫХ ХОЛМОВ", cssW * 0.5 + (1 - e) * cssW * 0.3, cssH * 0.47, fs, "#fff", "center");
    txt("АКТ " + (G.act + 1), cssW * 0.5 + (1 - e) * cssW * 0.3, cssH * 0.47 + fs * 1.25, fs * 1.1, "#ffd21f", "center");
    ctx.restore();
  }
  function clearScreen() {
    const fs = clamp(cssH * 0.085, 12, 28), x = cssW / 2, y = cssH * 0.26;
    ctx.fillStyle = "rgba(10,26,74,.55)"; ctx.fillRect(0, 0, cssW, cssH);
    txt("СОНИК ПРОШЁЛ АКТ " + (G.act + 1), x, y, fs * 1.2, "#fff", "center");
    txt("БОНУС ЗА ВРЕМЯ   " + G.tb, x, y + fs * 1.8, fs, "#ffd21f", "center");
    txt("БОНУС ЗА КОЛЬЦА   " + G.rb, x, y + fs * 3, fs, "#ffd21f", "center");
    txt("ОЧКИ   " + G.score, x, y + fs * 4.4, fs, "#fff", "center");
    if (y + fs * 6.6 < cssH) {                        // после акта — «приз уже ближе»
      const s = "★ ПРИЗ УЖЕ БЛИЖЕ! ★", tw = Math.min(cssW * 0.7, 380);
      txt(s, x, y + fs * 5.7, fit(s, fs * (1 + 0.05 * Math.sin(T * 0.12)), cssW - 24), T % 30 < 20 ? "#ffe24a" : "#fff", "center");
      if (y + fs * 7.2 < cssH) prizeTrack(x - tw / 2, y + fs * 6.6, tw, clamp(fs * 0.7, 10, 20), G.act + 1);
    }
  }
  function bigMsg(a, b) {
    const fs = clamp(cssH * 0.12, 16, 44);
    ctx.fillStyle = "rgba(10,26,74,.55)"; ctx.fillRect(0, 0, cssW, cssH);
    txt(a, cssW / 2, cssH * 0.45, fs, "#ffd21f", "center");
    if (T % 60 < 42) txt(b, cssW / 2, cssH * 0.45 + fs * 1.1, Math.max(11, fs * 0.38), "#fff", "center");
  }
  function titleScreen() {
    const g = ctx.createLinearGradient(0, 0, cssW, 0); g.addColorStop(0, "rgba(10,26,74,.75)"); g.addColorStop(0.6, "rgba(10,26,74,.15)"); g.addColorStop(1, "rgba(10,26,74,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, cssW, cssH);
    const im = SUP.on && pic("charG", "sonic-char-gold.webp").complete ? pic("charG", "sonic-char-gold.webp") : pic("char", "sonic-char.webp"), narrow = cssW < 560;
    if (im.complete && im.naturalWidth) { const h = cssH * (narrow ? 0.84 : 0.92), w = h * im.naturalWidth / im.naturalHeight, x = Math.max(cssW * 0.5, cssW - w * 0.97) + Math.sin(T * 0.05) * 3, y = cssH - h + Math.sin(T * 0.08) * 3; ctx.drawImage(im, x, y, w, h); }
    // режим выбирает игрок (23.10, Андрей: «если он бегает сам, всегда сложно… надо, чтобы самому выбрать режим»)
    // три режима (23.10, Андрей: «тот режим не убирать, а добавить») и приманка «пройди — получи ценный приз» с дорожкой к призу
    const fs = clamp(cssH * 0.13, 22, 56), x = Math.max(12, cssW * 0.04), colW = Math.min(cssW * (cssW < 560 ? 0.62 : 0.42), 400), sel = G.sel || G.mode;
    let y = Math.max(8, cssH * 0.035) + fs * 0.85;
    const name = SUP.on ? "СУПЕР СОНИК" : "СОНИК";
    txt(name, x, y, fit(name, fs, colW), SUP.on ? "#ffe24a" : "#ffd21f");
    const pl = prizeLine(), s2 = fit(pl, Math.max(10, fs * 0.3) * (1 + 0.04 * Math.sin(T * 0.1)), colW);
    y += s2 * 1.55; txt(pl, x, y, s2, T % 40 < 26 || G.prog >= 4 ? "#ffe24a" : "#fff");
    const th = clamp(cssH * 0.045, 9, 20); y += th * 1.1; prizeTrack(x, y, Math.min(colW, 300), th, G.prog); y += th * (th >= 16 ? 1.9 : 0.9);
    const bh = clamp(cssH * 0.135, 27, 54), gap = bh * 0.18;
    uiBtn("auto", x, y, colW, bh, "БЕЖИТ САМ", "тап — прыжок · тап в прыжке — атака", sel === "auto"); y += bh + gap;
    uiBtn("pad", x, y, colW, bh, "КНОПКИ", G.kbd ? "← → бег · ↓ клубок · пробел — прыжок" : "джойстик под левым пальцем · прыжок — справа", sel === "pad"); y += bh + gap;
    uiBtn("manual", x, y, colW, bh, "ОДНИМ ПАЛЬЦЕМ", "вбок — скорость · тап — прыжок · вниз — присесть", sel === "manual"); y += bh + gap;
    if (SUP.ok) uiBtn("super", x, y, colW, bh * 0.7, "★ СУПЕР СОНИК: " + (SUP.on ? "ВКЛ" : "ВЫКЛ"), "", sel === "super");
  }
  function startMode(m) { G.mode = m; G.sel = null; LSS("unitka.sxMode", m); G.gest = null; G.gDown = false; G.joy = null; G.pad = { x: 0, down: false }; G.padJ.clear(); newGame(); }
  function uiAct(id) {
    if (id === "auto" || id === "manual" || id === "pad") startMode(id);
    else if (id === "super") { SUP.on = !SUP.on; LSS("unitka.sxSuperOn", SUP.on ? "1" : "0"); hudC.key = ""; if (SUP.on) strips(true); }
    else if (id === "ss_again") ssStart();
    else if (id === "ss_share") share();
    else if (id === "ss_title") toTitle();
    else if (id === "m_go") G.menu = false;
    else if (id === "m_restart") { G.menu = false; newGame(); }
    else if (id === "m_title") { G.menu = false; toTitle(); }
  }
  function menu(on) {                                // пауза — только когда идёт игра
    const can = ["play", "card", "clear", "special", "teaser"].includes(G.state);
    G.menu = can && (on === undefined ? !G.menu : !!on);
    G.gest = null; G.joy = null; G.pad = { x: 0, down: false }; G.padJ.clear(); G.gDown = false; G.gHeld = false; G.held = false;
    if (!running) draw();
    return G.menu;
  }
  const hitUi = (x, y) => { for (const b of G.ui) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id; return null; };

  /* ───── цикл, ввод ───── */
  function loop(now) {
    if (!running) return;
    const dt = Math.min(100, now - last); last = now; accT += dt; let n = 0;
    while (accT >= 1000 / 60 && n < 4) { step(); accT -= 1000 / 60; n++; }
    if (n === 4) accT = 0;
    draw(); raf = requestAnimationFrame(loop);
  }
  function press() {
    ac();
    if (G.state === "title") { startMode(["auto", "manual", "pad"].includes(G.sel) ? G.sel : G.mode); return; }
    if (G.state === "over") { if (G.st > 40) toTitle(); return; }
    if (G.state === "teaser") { if (G.st > 60) ssStart(); return; }
    if (G.state === "spres") return;                   // на итоге этапа — только кнопки
    if (G.state === "clear") { if (G.st > 90) G.skip = true; return; }
    G.tap = true; G.held = true;
  }
  const local = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cssW / (r.width || 1), (e.clientY - r.top) * cssH / (r.height || 1)]; };
  // жест одним пальцем: тап (коротко, почти на месте) — прыжок в полную силу; взмах вверх — прыжок (держишь — выше); вбок — скорость
  // от той, что была при касании (держится и без пальца); вниз — присесть / клубок, держишь присев — копится спин-дэш
  const gestOn = () => G.state === "special" || (G.mode === "manual" && (G.state === "play" || G.state === "card"));
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };   // лёгкая отдача на Android (iPhone вибрацию сайтам не даёт)
  const onDown = e => {
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    ac(); G.kbd = false;
    const [x, y] = local(e);
    if (G.menu) { const id = hitUi(x, y); if (id) uiAct(id); return; }
    if (G.state === "title") { const id = hitUi(x, y); if (id) uiAct(id); else press(); return; }
    if (G.state === "spres") return;                   // кнопки итога — по отпусканию (так браузер разрешает «Поделиться» и буфер)
    if (gestOn()) { if (!G.gest) G.gest = { id: e.pointerId, x0: x, y0: y, t0: performance.now(), dx: 0, dy: 0, c0: G.cruise, up: false, moved: 0 }; return; }
    if (G.mode === "pad" && (G.state === "play" || G.state === "card")) {
      if (x < cssW * 0.5) { if (!G.joy) { G.joy = { id: e.pointerId, x0: x, y0: y, x, y }; joyUpdate(G.joy); } }
      else { G.padJ.add(e.pointerId); G.tap = true; buzz(); G.hint = Math.min(G.hint, 30); }
      return;
    }
    press();
  };
  const onMove = e => {
    const j = G.joy; if (j && e.pointerId === j.id) { const [x, y] = local(e); j.x = x; j.y = y; joyUpdate(j); return; }
    const g = G.gest; if (!g || e.pointerId !== g.id) return;
    const [x, y] = local(e); g.dx = x - g.x0; g.dy = y - g.y0; g.moved = Math.max(g.moved, Math.hypot(g.dx, g.dy));
    const up = !g.up && g.dy < -26 && -g.dy > Math.abs(g.dx) * 1.1;
    if (G.state === "special") { if (up) { g.up = true; G.tap = true; } return; }
    const ex = Math.abs(g.dx) > 6 ? g.dx - sgn(g.dx) * 6 : 0;
    G.cruise = clamp(g.c0 + ex / dragR(), -1, 1);
    G.gDown = g.dy > (G.gDown ? 14 : 22) && g.dy > Math.abs(g.dx) * 0.7;
    if (up) { g.up = true; G.tap = true; G.gHeld = true; G.hint = Math.min(G.hint, 30); }
  };
  const onUp = e => {
    G.held = false; if (!e) return;
    if (G.joy && e.pointerId === G.joy.id) { G.joy = null; G.pad = { x: 0, down: false }; }
    G.padJ.delete(e.pointerId);
    if (e.type === "pointerup" && G.state === "spres" && !G.menu && G.st > 40) { const [x, y] = local(e), id = hitUi(x, y); if (id) uiAct(id); return; }
    const g = G.gest; if (!g || e.pointerId !== g.id) return;
    if (!g.up && g.moved < 14 && performance.now() - g.t0 < 260) { G.tap = true; G.fullJump = true; G.hint = Math.min(G.hint, 30); }
    G.gest = null; G.gDown = false; G.gHeld = false;
  };
  const keyOk = e => !(e.target && /input|textarea|select/i.test(e.target.tagName)) && running && cv.isConnected && cv.getBoundingClientRect().height > 0;
  const KJ = ["Space", "ArrowUp", "Enter", "KeyW", "KeyZ", "KeyX", "KeyJ", "KeyK"], KL = ["ArrowLeft", "KeyA"], KR = ["ArrowRight", "KeyD"], KD = ["ArrowDown", "KeyS"];
  const onKey = e => {
    if (!keyOk(e)) return; const c = e.code;
    if (c === "Escape" || c === "KeyP") { if (menu() !== undefined) e.preventDefault(); return; }
    if (G.menu) { if (c === "Enter" || c === "Space") { e.preventDefault(); G.menu = false; } return; }
    if (G.state === "title") {
      const opts = SUP.ok ? ["auto", "pad", "manual", "super"] : ["auto", "pad", "manual"], i = opts.indexOf(G.sel || G.mode);
      if (KL.includes(c) || KR.includes(c) || KD.includes(c) || c === "ArrowUp") { e.preventDefault(); G.kbd = true; G.sel = opts[(i + (KL.includes(c) || c === "ArrowUp" ? opts.length - 1 : 1)) % opts.length]; return; }
      if (c === "Space" || c === "Enter") { e.preventDefault(); if (!e.repeat) { ac(); if (G.sel === "super") uiAct("super"); else press(); } }
      return;
    }
    if (G.state === "spres") { if ((c === "Enter" || c === "Space") && G.st > 40 && G.ui[0]) { e.preventDefault(); uiAct(G.ui[0].id); } return; }
    const k = KL.includes(c) ? "L" : KR.includes(c) ? "R" : KD.includes(c) ? "D" : KJ.includes(c) ? "J" : null;
    if (!k) return;
    e.preventDefault(); G.kbd = true; G.keys[k] = true;
    if (k === "J" && !e.repeat) press();
  };
  const onKeyUp = e => {
    const c = e.code;
    if (KJ.includes(c)) { G.held = false; G.keys.J = false; }
    if (KL.includes(c)) G.keys.L = false; if (KR.includes(c)) G.keys.R = false; if (KD.includes(c)) G.keys.D = false;
  };
  cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp); cv.addEventListener("lostpointercapture", onUp);
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); }); ro.observe(cv);
  const onVis = () => { if (document.hidden && running) { inst.pause(); inst._hid = true; } else if (!document.hidden && inst._hid) { inst._hid = false; inst.resume(); } };
  document.addEventListener("visibilitychange", onVis);
  resize();
  try { document.fonts && document.fonts.load("italic 900 16px \"Exo 2\""); } catch (e) {}
  pic("char", "sonic-char.webp"); pic("clouds", "sonic-clouds.svg").onload = () => { cloudsR = null; }; pic("hills", "sonic-hills.svg").onload = () => { hillsR = null; };
  strips(false); if (SUP.ok) { strips(true); pic("charG", "sonic-char-gold.webp"); }
  { const b = pic("bg", "sonic-bg.webp"); if (!b.complete) b.addEventListener("load", () => { back = null; }); }
  const inst = {
    resume() { if (running) return; running = true; last = performance.now(); accT = 0; raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); G.held = false; G.gest = null; G.gDown = false; G.gHeld = false; G.joy = null; G.pad = { x: 0, down: false }; G.padJ.clear(); G.keys = { L: false, R: false, D: false, J: false }; },
    menu,                                            // menu() — пауза вкл/выкл, menu(true) — открыть (кнопка ⏸ на карточке)
    destroy() { inst.pause(); ro.disconnect(); window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); document.removeEventListener("visibilitychange", onVis); },
    get running() { return running; },
    dbg: Object.assign(dbg, {
      G, S, newGame, startAct, step, draw,
      run(n) { for (let i = 0; i < n; i++) step(); },
      warp(act, x) { startAct(act); G.state = "play"; S.x = x; S.y = G.L.gy(x); camera(true); },
      press, uiAct, zoneDone, ssStart, SUP, menu,
      gest: { down: (x, y, id) => onDown({ preventDefault() {}, pointerId: id || 7, clientX: x, clientY: y }), move: (x, y, id) => onMove({ pointerId: id || 7, clientX: x, clientY: y }), up: (x, y, id) => onUp({ type: "pointerup", pointerId: id || 7, clientX: x, clientY: y }) },
    }),
  };
  draw();
  return inst;
}

/* ═════════ живой Соник на лицевой стороне: бежит по дорожке картинки и проходит петлю (23.10: «пусть он пробегает прямо как на
   картинке по дорожке в колесо»), прыгает за кольцами, через раз встаёт перед петлёй и влетает в неё спин-дэшем ═════════ */
// путь в координатах исходника sonic_banner_nbpro.png (3168×1344): гребень левого холма, спуск, верх клетчатой дорожки — по ней в петлю.
// Внутренняя сторона петли — эллипс по контуру дырки (снят с картинки: центр 2537,795, полуоси 188×242, наклон 10.8°; ноги — на 8 глубже,
// на самой полосе); полный круг против часовой, выход низом петли вправо по берегу.
const HILL = [[-420, 1052], [0, 1020], [396, 984], [792, 946], [1109, 915], [1307, 903], [1450, 916], [1600, 958], [1750, 1032], [1900, 1102], [2050, 1158], [2200, 1190], [2350, 1203]];
const EXIT = [[2740, 1022], [2900, 1030], [3050, 1003], [3168, 975], [3700, 880]];
const LOOP = { cx: 2537, cy: 795, a: 196, b: 250, ux: 0.982, uy: -0.188, f0: -0.75, f1: 1.5 * PI };
function loopAt(f) { const L = LOOP, c = Math.cos(f), s = Math.sin(f); return [L.cx + L.a * c * L.ux + L.b * s * L.uy, L.cy + L.a * c * L.uy - L.b * s * L.ux]; }
function loopDir(f) { const L = LOOP, c = Math.cos(f), s = Math.sin(f), x = -L.a * s * L.ux + L.b * c * L.uy, y = -L.a * s * L.uy - L.b * c * L.ux, d = Math.hypot(x, y); return [x / d, y / d]; }
function catmull(pts, step) {                       // гладкая кривая через точки (Катмулл-Ром), точки через ~step
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  return out;
}
function runPath() {
  const pts = catmull(HILL, 20), e0 = HILL[HILL.length - 1], l0 = loopAt(LOOP.f0), d0 = loopDir(LOOP.f0);
  const b1 = [e0[0] + 150, e0[1]], b2 = [l0[0] - d0[0] * 130, l0[1] - d0[1] * 130];
  for (let k = 0; k < 24; k++) { const t = k / 24, u = 1 - t; pts.push([0, 1].map(j => u * u * u * e0[j] + 3 * u * u * t * b1[j] + 3 * u * t * t * b2[j] + t * t * t * l0[j])); }
  const i0 = pts.length, n = 110;
  for (let k = 0; k < n; k++) pts.push(loopAt(LOOP.f0 + (LOOP.f1 - LOOP.f0) * k / n));
  const i1 = pts.length;
  return { pts: pts.concat(catmull([loopAt(LOOP.f1)].concat(EXIT), 20), [EXIT[EXIT.length - 1]]), i0, i1 };
}
function runner(cv, opt) {
  const ctx = cv.getContext("2d"), red = reduced();
  let cw = 0, ch = 0, dpr = 1, raf = 0, on = false, paused = false, vis = true, last = 0, T = 0;
  const seg = [], RP = runPath(); let total = 0, sL0 = 0, sL1 = 0;
  for (let i = 1; i < RP.pts.length; i++) {
    const a = RP.pts[i - 1], b = RP.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-3) continue;
    if (i === RP.i0) sL0 = total; if (i === RP.i1) sL1 = total;
    seg.push({ a, b, l, s: total, i: seg.length }); total += l;
  }
  function find(s) { let lo = 0, hi = seg.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (seg[m].s <= s) lo = m; else hi = m - 1; } return seg[lo]; }
  // угол — плавно между соседними отрезками, чтобы в петле Соник поворачивался без рывков
  function at(s) {
    s = clamp(s, 0, total - 0.01); const g = find(s), t = (s - g.s) / g.l, n = seg[Math.min(seg.length - 1, g.i + 1)];
    const a1 = Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]); let a2 = Math.atan2(n.b[1] - n.a[1], n.b[0] - n.a[0]); while (a2 - a1 > PI) a2 -= TAU; while (a2 - a1 < -PI) a2 += TAU;
    return [lerp(g.a[0], g.b[0], t), lerp(g.a[1], g.b[1], t), lerp(a1, a2, t)];
  }
  const inLoop = s => s > sL0 - 40 && s < sL1 + 40;
  function sOfX(x) { for (const q of seg) if (x <= q.b[0]) return q.s + (x - q.a[0]) / (q.b[0] - q.a[0]) * q.l; return total; }
  let M = null;
  function resize() { const r = cv.getBoundingClientRect(); cw = r.width; ch = r.height; dpr = DPR(); cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); M = opt.map(cw, ch); draw(); }
  const toC = (x, y) => [(x - M.ix0) * M.s + M.ox, y * M.s + M.oy];
  // хореография: s — путь, v — скорость (единиц картинки в секунду), прыжок над пальмой за кольцами, петля
  const R = { st: "wait", w: 1.2, s: 0, v: 0, jump: null, n: 0, tap: 0, ph: 0, rot: 0, rings: [], spark: [], dust: [], last: [] };
  const J0 = sOfX(820), J1 = sOfX(1760), STOP = sOfX(2000);     // через раз тормозит с ~2000 — встаёт перед петлёй и влетает в неё клубком
  const HB = 125;                                              // рост Соника в единицах картинки: петля ≈ 3,5 роста, как в игре
  function reset() {
    R.s = sOfX(-380); R.v = 0; R.jump = null; R.n++; R.st = "run"; R.last = [];
    const pts = [0.18, 0.34, 0.5, 0.66, 0.82]; R.rings = pts.map(t => { const s = lerp(J0, J1, t), p = at(s); return { s, x: p[0], y: p[1] - 300 * 4 * t * (1 - t) - 70, got: false }; });
    for (const f of [0.25, 0.75, 1.25, 1.75, 2.25, 2.75]) { const p = loopAt(f), dx = LOOP.cx - p[0], dy = LOOP.cy - p[1], d = Math.hypot(dx, dy); R.rings.push({ x: p[0] + dx / d * 62, y: p[1] + dy / d * 62, got: false }); }
  }
  function upd(dt) {
    T += dt; const vis1 = M ? cw / M.s : 3168, vmax = vis1 / 2.1;        // по экрану ~2 секунды — как на скорости в игре
    if (R.st === "wait") { R.w -= dt; if (R.w <= 0) reset(); return; }
    if (R.st === "idle") { R.w -= dt; R.ph += dt * 6; if (R.w <= 0) { R.st = "charge"; R.w = 0.75; } return; }
    if (R.st === "charge") { R.w -= dt; R.rot += dt * 40; if (Math.random() < dt * 30) R.dust.push({ x: at(R.s)[0] - 40, y: at(R.s)[1], t: 0 }); if (R.w <= 0) { R.st = "blast"; R.v = vmax * 1.6; } return; }
    const ball = R.st === "blast";
    if (R.st === "run") R.v = Math.min(vmax * (R.s > J1 ? 1.35 : 1), R.v + vmax * dt * 0.9);
    R.s += R.v * dt;
    R.ph += dt * (R.v / vmax) * 22; R.rot += dt * (R.v / vmax) * 26;
    if (!R.jump && R.st === "run" && R.s >= J0 && R.s < J1) R.jump = { s0: J0, s1: J1 };
    if (R.jump && R.s >= R.jump.s1) { R.jump = null; R.dust.push({ x: at(R.s)[0], y: at(R.s)[1], t: 0 }); }
    if (R.n % 2 === 0 && R.st === "run" && R.s >= STOP) { R.v = Math.max(0, R.v - vmax * dt * 3.2); if (Math.random() < dt * 25) R.dust.push({ x: at(R.s)[0] + 20, y: at(R.s)[1], t: 0 }); if (R.v <= 0) { R.st = "idle"; R.w = 1.8; } }
    if (R.s >= total - 1) { R.st = "wait"; R.w = 2.6 + Math.random() * 1.5; }
    const p = pos(), bx = p[0] + Math.sin(p[2]) * HB * 0.45, by = p[1] - Math.cos(p[2]) * HB * 0.45;      // центр тела (в петле — к её середине)
    for (const r of R.rings) if (!r.got && Math.hypot(r.x - bx, r.y - by) < 95) { r.got = true; R.spark.push({ x: r.x, y: r.y, t: 0 }); }
    if (SUP.on && Math.random() < dt * 14) R.spark.push({ x: bx + (Math.random() - 0.5) * HB * 0.8, y: by + (Math.random() - 0.5) * HB, t: 0.15 });
    if (R.v > vmax * 1.1 || ball) { R.last.unshift(p); if (R.last.length > 4) R.last.pop(); } else R.last.length = 0;
  }
  function pos() {
    const p = at(R.s); if (R.jump) { const t = (R.s - R.jump.s0) / (R.jump.s1 - R.jump.s0); return [p[0], p[1] - 300 * 4 * t * (1 - t), 0, true]; }
    return [p[0], p[1], p[2], R.st === "blast"];
  }
  function draw() {
    if (!M) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    const sz = clamp(HB * M.s, 24, 64) / 40;              // в пропорции картинки; на телефоне не мельче 24 px
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingQuality = "high";
    for (const r of R.rings) if (!r.got) { const [x, y] = toC(r.x, r.y); ctx.save(); ctx.translate(x, y); ctx.scale(sz * 1.1, sz * 1.1); ring(ctx, 0, 0, T * 7.5); ctx.restore(); }
    for (const s of R.spark) { const [x, y] = toC(s.x, s.y); star(ctx, x, y, sz * (9 - s.t * 18), "#fff8c2", s.t * 6); }
    for (const d of R.dust) { const [x, y] = toC(d.x, d.y); ctx.globalAlpha = Math.max(0, 0.7 - d.t * 1.4); ell(ctx, x, y - 3 * sz, sz * (4 + d.t * 20), sz * (2.5 + d.t * 8), 0, "#fff", 0); ctx.globalAlpha = 1; }
    if (R.st === "wait") return;
    const p = pos(), [x, y] = toC(p[0], p[1]), ball = p[3] || R.st === "charge";
    // тень на земле (в петле — без тени)
    if (!inLoop(R.s)) {
      const g0 = at(R.s), [gx, gy] = toC(g0[0], g0[1]), hgt = Math.max(0, gy - y);
      ctx.globalAlpha = 0.28 * Math.max(0.25, 1 - hgt / (ch * 0.5)); ell(ctx, gx, gy + 1, sz * 13 * (1 - Math.min(0.6, hgt / ch)), sz * 3, 0, "#0a1a4a", 0); ctx.globalAlpha = 1;
    }
    const vmax = cw / M.s / 2.1;
    const pose = R.st === "idle" ? "tap" : R.st === "charge" ? "charge" : ball ? "ball" : R.v < 1e-3 ? "stand" : R.v / vmax < 0.45 ? "walk" : R.v > vmax * 1.5 ? "dash" : "run";
    // открыт секретный бонус — на обложке бегает золотой Супер Соник в искрах
    const fig = (o, ang, px, py) => { ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(sz, sz); if (!sonicSpr(ctx, o, SUP.on)) sonic(ctx, o); ctx.restore(); };
    for (let i = R.last.length - 1; i >= 0; i--) {                    // след на скорости — по касательной назад
      const q = R.last[i], [lx, ly] = toC(q[0], q[1]), k = (i + 1) * 4 * sz;
      ctx.globalAlpha = 0.16 * (1 - i / 4); fig({ pose: q[3] ? "ball" : "dash", ph: R.ph, rot: R.rot }, q[2], lx - Math.cos(q[2]) * k, ly - Math.sin(q[2]) * k);
    }
    ctx.globalAlpha = 1;
    fig({ pose, ph: R.ph, rot: R.rot }, p[2], x, y);
  }
  function frame(now) {
    if (!on) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    upd(dt); R.spark.forEach(s => s.t += dt); R.spark = R.spark.filter(s => s.t < 0.4); R.dust.forEach(d => d.t += dt); R.dust = R.dust.filter(d => d.t < 0.5);
    draw(); raf = requestAnimationFrame(frame);
  }
  function go() { const want = !paused && vis && !document.hidden && !red; if (want && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(frame); } else if (!want && on) { on = false; cancelAnimationFrame(raf); } }
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; go(); }); io.observe(cv);
  const ro = new ResizeObserver(resize); ro.observe(cv);
  const onVis = () => go(); document.addEventListener("visibilitychange", onVis);
  for (const im of strips(SUP.on)) if (!im.complete) im.addEventListener("load", () => { if (!on) draw(); });
  resize();
  if (red) { R.st = "idle"; R.s = sOfX(2150); R.rings = []; draw(); }       // без движения: Соник стоит перед петлёй
  else reset();
  go();
  return {
    pause(p) { paused = !!p; go(); },
    destroy() { on = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", onVis); },
    get st() { return R.st; }, _R: R, _step(dt) { upd(dt); draw(); }, _loop: [sL0, sL1, total],
  };
}

function mute(off) { AU.on = !off; try { localStorage.setItem("unitka.sxMute", off ? "1" : "0"); } catch (e) {} }
window.SonicGame = { mount, runner, mute, sonic, ring };
})();
