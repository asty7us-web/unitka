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
   API: SonicGame.mount(canvas) → {resume, pause, destroy, dbg}; SonicGame.runner(canvas, {map}) → {pause, destroy}. */
(function () {
"use strict";
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sgn = v => (v < 0 ? -1 : 1);
const P = { acc: 0.046875, dec: 0.5, top: 6, slp: 0.125, grv: 0.21875, jmp: 6.5, cut: 4, air: 0.09375, fall: 16 };
const OL = "#0a1a4a";
const C = { blue: "#1f5fe6", blue2: "#1240b8", peach: "#f7c48a", peach2: "#d99a5e", red: "#e8262b", red2: "#b5161d",
  gold: "#ffcf26", gold2: "#9a5800", gold3: "#fff3a6", glove2: "#cdd8ee" };
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const FONT = '"Exo 2","Russo One",system-ui,sans-serif';
const IMG = {};
function pic(k, src) { if (!IMG[k]) { IMG[k] = new Image(); IMG[k].src = src; } return IMG[k]; }

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
  function sonicAt(o) {                    // в уже повёрнутой/отражённой системе координат ног
    const ball = o.pose === "ball" || o.pose === "charge", n = 24;
    const i = ((Math.round((ball ? o.rot : o.ph) / TAU * n) % n) + n) % n;
    const key = "s" + o.pose + i + (o.blink ? "b" : "") + (o.eyesX ? "x" : "");
    const c = sprite(key, 70, 56, 30, 50, g => sonic(g, Object.assign({}, o, ball ? { rot: i * TAU / n } : { ph: i * TAU / n })));
    ctx.drawImage(c, -30, -50, 70, 56);
  }
  const G = { state: "title", act: 0, score: 0, lives: 3, L: null, ents: [], rings: [], sr: [], fx: [], cam: { x: 0, y: 0 }, t: 0, time: 0, st: 0, held: false, tap: false, boss: null, hint: 0, lifeAt: 100 };
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
      g.lineJoin = "round"; g.lineCap = "butt"; g.strokeStyle = "#155c08"; g.lineWidth = 15; g.stroke(); g.strokeStyle = "#3fbf1c"; g.lineWidth = 11; g.stroke();
      g.save(); g.translate(0, -3.6); g.strokeStyle = "#9ce94d"; g.lineWidth = 2.6; g.stroke(); g.restore();
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
    const w = 1200, h = H + 60, c = document.createElement("canvas"); c.width = Math.round(w * SC); c.height = Math.round(h * SC);
    const g = c.getContext("2d"); g.setTransform(SC, 0, 0, SC, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0046e0"); gr.addColorStop(0.55, "#2d84fb"); gr.addColorStop(1, "#9fd6ff"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const base = 30 + H * 0.6;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, base - 30 - 26 * Math.sin(x * TAU / 600) - 18 * Math.sin(x * TAU / 240 + 1.3) - 10 * Math.sin(x * TAU / 100));
    g.lineTo(w, h); g.closePath(); g.fillStyle = "#6f8ff0"; g.fill(); g.strokeStyle = "#4b67c9"; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = "#28a6f2"; g.fillRect(0, base, w, h - base);
    c.base = base - 30; back = c; return c;
  }

  /* ───── состояние ───── */
  function startAct(i, fromCp) {
    G.act = i; const L = ACTS[i](); G.L = L;
    G.ents = L.ents.map(e => Object.assign({ alive: true, t: 0, dir: -1, x0: e.x - 64, x1: e.x + 64, vx: 0, fire: 0, cool: 0 }, e, e.type === "buzz" ? { vx: -1, y0: e.y } : {},
      e.type === "mon" && e.kind === "life" && G.lifeUsed && G.lifeUsed[i + ":" + e.x] ? { broken: true } : {}));
    G.rings = L.rg.map(r => ({ x: r.x, y: r.y, got: false }));
    G.sr = []; G.fx = []; G.boss = null; G.hint = i === 0 && !fromCp ? 400 : 0;
    const cp = fromCp && G.cp && G.cp.act === i ? G.cp : null;
    if (!cp) G.cp = null;
    Object.assign(S, { x: cp ? cp.x : 64, y: 0, xsp: 0, ysp: 0, gsp: 0, ang: 0, on: "floor", plat: null, lp: null, th: 0, dir: 1, ball: false, jumping: false,
      canHome: false, homing: 0, ht: null, hurt: false, dead: 0, inv: 0, shield: false, shoes: 0, star: 0, rings: 0, push: false, ctrl: true,
      rot: 0, ph: 0, chain: 0, py: 0, spr: 0, blink: 0, last: [] });
    S.y = L.gy(S.x); S.py = S.y;
    if (cp) { G.time = cp.time; G.ents.forEach(e => { if (e.type === "post" && e.x <= cp.x) e.on = true; }); } else G.time = 0;
    G.cam.x = S.x - W * 0.32; G.cam.y = S.y - H * 0.62;
    G.state = "card"; G.st = 0;
  }
  function newGame() { G.score = 0; G.lives = 3; G.lifeAt = 100; G.cp = null; G.lifeUsed = {}; startAct(0); }
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
    if (!force && (S.inv > 0 || S.star > 0)) return;
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
    Object.assign(S, { on: null, plat: null, lp: null, ball: true, jumping: true, canHome: true }); SFX.jump(); G.hint = Math.min(G.hint, 30);
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
    G.t++; T++;
    if (G.state === "card") { if (++G.st > 140) { G.state = "play"; G.tap = false; } camera(true); return; }
    if (G.state === "clear") { tally(); return; }
    if (G.state === "over" || G.state === "win") { G.st++; return; }
    if (G.state !== "play") return;
    const L = G.L, tap = G.tap; G.tap = false;
    const held = G.held || (dbg.bot && G.botHold > 0);
    if (dbg.bot) bot();
    const botTap = G.botTap; G.botTap = false;
    const pressed = tap || botTap;
    G.time++; if (G.hint > 0) G.hint--;
    if (G.time >= 36000 && !S.dead) die();
    if (S.inv > 0) S.inv--; if (S.shoes > 0) S.shoes--; if (S.star > 0) S.star--; if (S.spr > 0) S.spr--;
    if (--S.blink < -200) S.blink = 8;
    const mult = S.shoes > 0 ? 2 : 1;
    S.py = S.y;
    if (S.dead) {
      S.ysp += P.grv; S.y += S.ysp; S.dead++;
      if (S.dead > 150) { G.lives--; if (G.lives <= 0) { G.state = "over"; G.st = 0; } else startAct(G.act, true); }
      return;
    }
    if (S.on === "loop") loopStep(mult);
    else if (S.on) groundStep(mult, pressed);
    else airStep(mult, pressed, held);
    if (S.y > L.bottom + 60 && !S.dead) { die(); S.ysp = -4; }
    S.ph += Math.max(0.12, Math.min(0.62, Math.abs(S.on ? S.gsp : S.xsp) * 0.075));
    S.rot += (S.on ? S.gsp : (S.xsp || 1) * 1.2) * 0.07 + (S.homing ? 0.5 * S.dir : 0);
    if (S.shoes > 0 || Math.abs(S.gsp) > 8.5 || S.homing) { S.last.unshift([S.x, S.y, S.on === "loop" ? -S.th : S.ang]); if (S.last.length > 2) S.last.pop(); } else S.last.length = 0;
    interact();
    updEnts();
    camera(false);
  }
  function groundStep(mult, pressed) {
    const L = G.L, top = P.top * mult, acc = P.acc * mult * (G.boss ? 2.5 : 1);         // на арене разворот у стены быстрее
    if (S.on === "plat") { const p = S.plat; S.x += p.vx; S.y = p.cy; }
    if (S.ctrl) {
      if (S.dir > 0) { if (S.gsp < top) S.gsp = Math.min(top, S.gsp + (S.gsp < 0 ? P.dec : acc)); }
      else if (S.gsp > -top) S.gsp = Math.max(-top, S.gsp - (S.gsp > 0 ? P.dec : acc));
    } else S.gsp -= Math.min(Math.abs(S.gsp), P.acc * 2) * sgn(S.gsp);
    if (Math.abs(S.gsp) > top) S.gsp -= sgn(S.gsp) * 0.035;
    if (S.on === "floor") S.gsp -= P.slp * Math.sin(S.ang);
    if (pressed && S.ctrl) { jump(); return; }
    const nx = S.x + S.gsp * Math.cos(S.ang), sd = sgn(S.gsp);
    // уступ впереди — стена: стоим и упираемся (на арене — разворот)
    const wy = L.gy(nx + 9 * sd);
    let wall = wy !== null && wy < S.y - 14;
    if (L.arena && S.x > L.arena.x0) { if (nx > L.arena.x1 - 14 && sd > 0) wall = true; if (nx < L.arena.x0 + 14 && sd < 0) wall = true; }
    if (wall) { S.gsp = 0; S.push = Math.abs(S.ctrl ? 1 : 0) > 0; if (L.arena && S.x > L.arena.x0 + 8) { S.dir = -S.dir; S.push = false; } }
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
  function airStep(mult, pressed, held) {
    const L = G.L;
    if (pressed) airTap();
    if (S.homing > 0 && S.ht) {
      S.homing--; const [cx, cy] = sCenter(), dx = S.ht.x - cx, dy = S.ht.y - cy, d = Math.hypot(dx, dy) || 1;
      S.xsp = dx / d * 9; S.ysp = dy / d * 9; if (d < 6) S.homing = 0;
    } else {
      if (S.jumping && !held && S.ysp < -P.cut) S.ysp = -P.cut;
      if (S.ctrl) { const t = P.top * mult; if (S.dir > 0 ? S.xsp < t : S.xsp > -t) S.xsp += P.air * mult * S.dir; }
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
    const [cx, cy] = sCenter(), R = S.ball ? 13 : 14, atk = S.ball || S.star > 0 || S.homing > 0;
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
    if ((G.st > 80 && !G.tb && !G.rb && G.st > 260) || G.skip) { G.score += G.tb + G.rb; G.tb = G.rb = 0; G.skip = false; if (G.act + 1 < ACTS.length) startAct(G.act + 1); else { G.state = "win"; G.st = 0; } }
  }

  /* ───── арена и босс: яйцелёт доктора с шаром на цепи; 8 попаданий ───── */
  function arena() {
    const a = G.L.arena;
    if (!G.boss && S.x > a.x0 + 120 && !S.dead) {
      G.boss = { x: a.x1 + 80, y: a.y - 230, hp: 8, st: "enter", t: 0, flash: 0, ang: 0, bx: 0, by: 0, base: a.y - 128, cx: (a.x0 + a.x1) / 2 };
      G.bossRing = 0;
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
    } else if (b.st === "flee") { b.x += 2.6; b.y -= 1.4; if (b.t % 8 === 0) fx({ k: "puff", x: b.x - 20, y: b.y + 8, max: 30 }); if (b.t > 140) { b.st = "gone"; G.state = "win"; G.st = 0; G.score += 1000; SFX.clear(); } }
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
    const off = ((c.x * 0.16) % 1200 + 1200) % 1200;
    for (let x = -off; x < W; x += 1200) ctx.drawImage(bk, x, -30 - vy, 1200, H + 60);
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
    const pose = S.dead ? "dead" : S.hurt ? "hurt" : S.spr > 0 && S.ysp < 0 ? "spring" : S.ball || S.homing ? "ball" : S.push ? "push" : (G.state === "win") ? "win" : poseFor(S.on ? S.gsp : S.xsp, false);
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
    const blink = S.rings === 0 && T % 40 < 20, key = [G.score, Math.floor(G.time / 60), S.rings, blink, G.lives, fs, dpr].join("|");
    const w = Math.ceil(pad + fs * 10), h = Math.ceil(pad + fs * 3.6 + 10), lh = Math.ceil(fs * 1.9);
    if (hudC.key !== key) {
      hudC.key = key;
      const c = hudC.c || (hudC.c = document.createElement("canvas")); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const lab = (s, i) => txt(s, pad, pad + fs + i * (fs + 4), fs, "#ffd21f", 0, 0, g);
      const val = (s, i, red) => txt(s, pad + fs * 4.6, pad + fs + i * (fs + 4), fs, red ? "#ff5a5a" : "#fff", 0, 0, g);
      lab("ОЧКИ", 0); val(String(G.score), 0); lab("ВРЕМЯ", 1); val(fmtTime(G.time), 1); lab("КОЛЬЦА", 2); val(String(S.rings), 2, blink);
      const l = hudC.l || (hudC.l = document.createElement("canvas")); l.width = Math.ceil(w * dpr); l.height = Math.ceil(lh * dpr);
      const q = l.getContext("2d"); q.setTransform(dpr, 0, 0, dpr, 0, 0);
      q.save(); q.translate(pad + fs * 0.6, lh - fs * 0.25); q.scale(fs / 30, fs / 30); q.translate(0, 26); head(q, {}); q.restore();
      txt("× " + G.lives, pad + fs * 1.5, lh - fs * 0.2, fs, "#fff", 0, 0, q);
    }
    ctx.drawImage(hudC.c, 0, 0, hudC.c.width / dpr, hudC.c.height / dpr);
    ctx.drawImage(hudC.l, 0, cssH - pad - lh + fs * 0.05, hudC.l.width / dpr, hudC.l.height / dpr);
  }
  function overlay() {
    const fs = clamp(Math.round(cssH * 0.07), 11, 18), pad = Math.round(fs * 0.7);
    if (G.state === "title") return titleScreen();
    hud(fs, pad);
    if (G.boss && G.boss.st !== "gone") {
      const n = 8, w = fs * 0.9, x = cssW / 2 - n * w / 2;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < G.boss.hp ? "#ff3d3d" : "rgba(10,26,74,.5)"; ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + i * w, pad, w - 3, fs * 0.6, 3); ctx.fill(); ctx.stroke(); }
    }
    if (G.hint > 0 && G.state === "play") { ctx.globalAlpha = Math.min(1, G.hint / 30); txt("Тап — прыжок · держи — выше · тап в прыжке — атака", cssW / 2, cssH - pad, Math.max(10, fs * 0.8), "#fff", "center"); ctx.globalAlpha = 1; }
    if (G.state === "card") titleCard(); else if (G.state === "clear") clearScreen(); else if (G.state === "over") bigMsg("ИГРА ОКОНЧЕНА", "Нажми, чтобы начать заново");
    else if (G.state === "win") bigMsg("ПОБЕДА!", "Доктор улетел… Очки: " + G.score + " · нажми, чтобы сыграть ещё");
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
    const im = pic("char", "sonic-char.webp"), narrow = cssW < 560;
    if (im.complete && im.naturalWidth) { const h = cssH * (narrow ? 0.84 : 0.92), w = h * im.naturalWidth / im.naturalHeight, x = Math.max(cssW * 0.5, cssW - w * 0.97) + Math.sin(T * 0.05) * 3, y = cssH - h + Math.sin(T * 0.08) * 3; ctx.drawImage(im, x, y, w, h); }
    const fs = clamp(cssH * 0.17, 22, 64), x = Math.max(14, cssW * 0.04), y = cssH * 0.3;
    txt("СОНИК", x, y, fs, "#ffd21f");
    const s2 = Math.max(10.5, fs * 0.27), y2 = y + fs * 0.25;
    txt("Зона зелёных холмов", x, y2 + s2 * 1.5, s2 * 1.05, "#fff");
    txt("2 акта и босс", x, y2 + s2 * 2.8, s2, "#bfe3ff");
    txt("Тап — прыжок (держи — выше)", x, y2 + s2 * 4.1, s2, "#fff");
    txt("Тап в прыжке — атака", x, y2 + s2 * 5.3, s2, "#fff");
    if (T % 60 < 40) txt("▶ НАЖМИ, ЧТОБЫ НАЧАТЬ", x, cssH - Math.max(14, cssH * 0.08), Math.max(12, fs * 0.36), "#ffd21f");
  }

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
    if (G.state === "title") { newGame(); return; }
    if (G.state === "over" || G.state === "win") { if (G.st > 40) toTitle(); return; }
    if (G.state === "clear") { if (G.st > 90) G.skip = true; return; }
    G.tap = true; G.held = true;
  }
  const onDown = e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} press(); };
  const onUp = () => { G.held = false; };
  const keyOk = e => !(e.target && /input|textarea|select/i.test(e.target.tagName)) && running && cv.isConnected && cv.getBoundingClientRect().height > 0;
  const onKey = e => { if (!keyOk(e)) return; if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter" || e.code === "KeyW") { e.preventDefault(); if (!e.repeat) press(); } };
  const onKeyUp = e => { if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter" || e.code === "KeyW") G.held = false; };
  cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp); cv.addEventListener("lostpointercapture", onUp);
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); }); ro.observe(cv);
  const onVis = () => { if (document.hidden && running) { inst.pause(); inst._hid = true; } else if (!document.hidden && inst._hid) { inst._hid = false; inst.resume(); } };
  document.addEventListener("visibilitychange", onVis);
  resize();
  try { document.fonts && document.fonts.load("italic 900 16px \"Exo 2\""); } catch (e) {}
  pic("char", "sonic-char.webp"); pic("clouds", "sonic-clouds.svg").onload = () => { cloudsR = null; }; pic("hills", "sonic-hills.svg").onload = () => { hillsR = null; };
  const inst = {
    resume() { if (running) return; running = true; last = performance.now(); accT = 0; raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); G.held = false; },
    destroy() { inst.pause(); ro.disconnect(); window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); document.removeEventListener("visibilitychange", onVis); },
    get running() { return running; },
    dbg: Object.assign(dbg, {
      G, S, newGame, startAct, step, draw,
      run(n) { for (let i = 0; i < n; i++) step(); },
      warp(act, x) { startAct(act); G.state = "play"; S.x = x; S.y = G.L.gy(x); camera(true); },
      press,
    }),
  };
  draw();
  return inst;
}

/* ═════════ живой Соник на лицевой стороне: бежит по холму картинки, прыгает за кольцами, иногда стоит и срывается спин-дэшем ═════════ */
// путь по картинке баннера (координаты исходника sonic_banner_nbpro.png 3168×1344): гребень левого холма, спуск к озеру, берег, склон справа
const PATH = [[-420, 1052], [0, 1020], [396, 984], [792, 946], [1109, 915], [1307, 903], [1450, 916], [1600, 958], [1750, 1032], [1900, 1102], [2050, 1158],
  [2200, 1190], [2350, 1203], [2500, 1196], [2650, 1172], [2800, 1142], [2950, 1106], [3100, 1072], [3600, 980]];
function runner(cv, opt) {
  const ctx = cv.getContext("2d"), red = reduced();
  let cw = 0, ch = 0, dpr = 1, raf = 0, on = false, paused = false, vis = true, last = 0, T = 0;
  const seg = []; let total = 0;
  for (let i = 1; i < PATH.length; i++) { const a = PATH[i - 1], b = PATH[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push({ a, b, l, s: total }); total += l; }
  function at(s) { s = clamp(s, 0, total - 0.01); let g = seg[0]; for (const q of seg) if (q.s <= s) g = q; const t = (s - g.s) / g.l; return [lerp(g.a[0], g.b[0], t), lerp(g.a[1], g.b[1], t), Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0])]; }
  function sOfX(x) { for (const q of seg) if (x <= q.b[0]) return q.s + (x - q.a[0]) / (q.b[0] - q.a[0]) * q.l; return total; }
  let M = null;
  function resize() { const r = cv.getBoundingClientRect(); cw = r.width; ch = r.height; dpr = DPR(); cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); M = opt.map(cw, ch); draw(); }
  const toC = (x, y) => [(x - M.ix0) * M.s + M.ox, y * M.s + M.oy];
  // хореография: s — путь, v — скорость (единиц картинки в секунду), прыжок над пальмой за кольцами
  const R = { st: "wait", w: 1.2, s: 0, v: 0, jump: null, n: 0, tap: 0, ph: 0, rot: 0, rings: [], spark: [], dust: [], last: [] };
  const J0 = sOfX(820), J1 = sOfX(1760), STOP = sOfX(2000);     // тормозит с ~2000 — встаёт перед петлёй
  function reset() {
    R.s = sOfX(-380); R.v = 0; R.jump = null; R.n++; R.st = "run"; R.last = [];
    const pts = [0.18, 0.34, 0.5, 0.66, 0.82]; R.rings = pts.map(t => { const s = lerp(J0, J1, t), p = at(s); return { s, x: p[0], y: p[1] - 300 * 4 * t * (1 - t) - 70, got: false }; });
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
    const p = pos();
    for (const r of R.rings) if (!r.got && Math.hypot(r.x - p[0], r.y - (p[1] - 60)) < 110) { r.got = true; R.spark.push({ x: r.x, y: r.y, t: 0 }); }
    if (R.v > vmax * 1.1 || ball) { R.last.unshift(p); if (R.last.length > 4) R.last.pop(); } else R.last.length = 0;
  }
  function pos() {
    const p = at(R.s); if (R.jump) { const t = (R.s - R.jump.s0) / (R.jump.s1 - R.jump.s0); return [p[0], p[1] - 300 * 4 * t * (1 - t), 0, true]; }
    return [p[0], p[1], p[2], R.st === "blast"];
  }
  function draw() {
    if (!M) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    const sz = clamp(ch * 0.2, 30, 84) / 40;              // рост Соника ≈ 20% высоты баннера
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const r of R.rings) if (!r.got) { const [x, y] = toC(r.x, r.y); ctx.save(); ctx.translate(x, y); ctx.scale(sz * 1.3, sz * 1.3); ring(ctx, 0, 0, T * 7.5); ctx.restore(); }
    for (const s of R.spark) { const [x, y] = toC(s.x, s.y); star(ctx, x, y, sz * (9 - s.t * 18), "#fff8c2", s.t * 6); }
    for (const d of R.dust) { const [x, y] = toC(d.x, d.y); ctx.globalAlpha = Math.max(0, 0.7 - d.t * 1.4); ell(ctx, x, y - 3 * sz, sz * (4 + d.t * 20), sz * (2.5 + d.t * 8), 0, "#fff", 0); ctx.globalAlpha = 1; }
    if (R.st === "wait") return;
    const p = pos(), [x, y] = toC(p[0], p[1]), ball = p[3] || R.st === "charge";
    // тень на земле
    const g0 = at(R.s), [gx, gy] = toC(g0[0], g0[1]), hgt = Math.max(0, gy - y);
    ctx.globalAlpha = 0.28 * Math.max(0.25, 1 - hgt / (ch * 0.5)); ell(ctx, gx, gy + 1, sz * 13 * (1 - Math.min(0.6, hgt / ch)), sz * 3, 0, "#0a1a4a", 0); ctx.globalAlpha = 1;
    const pose = R.st === "idle" ? "tap" : R.st === "charge" ? "charge" : ball ? "ball" : R.v < 1e-3 ? "stand" : (R.v / (M ? cw / M.s / 2.1 : 1)) < 0.45 ? "walk" : R.v > (cw / M.s / 2.1) * 1.05 ? "dash" : "run";
    for (let i = R.last.length - 1; i >= 0; i--) { const q = R.last[i], [lx, ly] = toC(q[0], q[1]); ctx.save(); ctx.globalAlpha = 0.16 * (1 - i / 4); ctx.translate(lx - (i + 1) * 5 * sz, ly); ctx.rotate(q[2] * 0.85); ctx.scale(sz, sz); sonic(ctx, { pose: q[3] ? "ball" : "dash", ph: R.ph, rot: R.rot }); ctx.restore(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(ball ? 0 : p[2] * 0.85); ctx.scale(sz, sz);
    sonic(ctx, { pose, ph: R.ph, rot: R.rot, blink: R.st === "idle" && (T % 2.2) < 0.12 });
    ctx.restore();
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
  resize();
  if (red) { R.st = "idle"; R.s = sOfX(2380); R.rings = []; draw(); }       // без движения: Соник стоит на берегу
  else reset();
  go();
  return {
    pause(p) { paused = !!p; go(); },
    destroy() { on = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", onVis); },
    get st() { return R.st; }, _R: R,
  };
}

function mute(off) { AU.on = !off; try { localStorage.setItem("unitka.sxMute", off ? "1" : "0"); } catch (e) {} }
window.SonicGame = { mount, runner, mute, sonic, ring };
})();
