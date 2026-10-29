/* Юнитка · тема «Пасьянс» (23.10.2026, Андрей: «сделай тему пасьянса и игру пасьянс — плавно, объёмно, красиво, чтобы менялась вся тема»).
   Пасьянс «Косынка» (Klondike): 7 столбцов, колода, сброс, 4 дома. Карты нарисованы кодом на canvas (чётко на любом экране, с тенью —
   объём), каждая карта плавно едет к своему месту (пружина), переворачивается в 3D (сжатие по ширине + подъём), при перетаскивании
   стопка тянется за пальцем «верёвочкой». Тап по карте — сама уходит туда, куда можно (сначала в дом); тап по колоде — сдача по 1
   (выбор «по 1 / по 3» Андрей убрал 23.10);
   «Отменить» без ограничений, «Подсказка», «Собрать» (когда все открыты), победа — каскад прыгающих карт, как в старом Windows.
   Партия сохраняется (localStorage unitka.ptGame) — вернулся, продолжил. Веер карт (Solitaire.fan) с 23.10 на баннере не стоит —
   там живое видео ведущей; функция оставлена.
   API: Solitaire.mount(canvas, {onStat}) → {resume, pause, destroy, newGame, undo, hint, auto, mute, music, musicOn, started, dbg};
        Solitaire.fan(canvas, {map}) → {pause, destroy}. */
(function () {
"use strict";
// звуки и картинки — рядом с этим файлом (/unitka/), а не со страницей: игру подключают и Склейки с Конкурентами (29.10)
const BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const reduced = () => false;   // игра двигается всегда, «меньше анимации» Windows не глушит (Андрей 24.10)
const LSG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const LSS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const SUITS = ["s", "h", "d", "c"];                      // пики, червы, бубны, трефы
const RED = { h: 1, d: 1 };
const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const FONT_H = '"Forum",Georgia,"Times New Roman",serif';
const FONT = '"Montserrat",system-ui,sans-serif';
const INK = "#1b1d22", RED_C = "#c41230", GOLD = "#d7b45a";

/* ═════════ звук (23.10, Андрей: «звук казино игр покера на айфоне, музыка»): настоящие записи карт и фишек — набор Kenney
   «Casino Audio» (CC0), один файл site\pasyans-sfx.mp3 с отрезками SFX (Код\unitka\pasyans\make_sfx.py); музыка — лаунж-джаз казино
   NeuralBox Suno, бесшовная петля site\pasyans-music.mp3 (make_music.py), играет только пока открыта игра. Всё через WebAudio;
   на iPhone сессия «playback» — слышно и в беззвучном режиме. Пока файлы не догрузились — мягкий шорох кодом. ═════════ */
const SFX = {"shuffle":[[0.12,3.0602]],"fan":[[3.3002,0.7208],[4.141,1.3054]],"slide":[[5.5664,0.388],[6.0744,0.584],[6.7783,0.5977],[7.4961,0.4565],[8.0726,0.6005],[8.793,0.5018]],"place":[[9.4149,0.607],[10.1418,0.3159],[10.5777,0.8727],[11.5704,0.6008]],"shove":[[12.2911,0.7659],[13.177,0.7668]],"chip":[[14.0638,0.1336],[14.3174,0.1279],[14.5652,0.3708],[15.0561,0.1877]],"chiplay":[[15.3637,0.1316],[15.6154,0.2271]],"chips":[[15.9624,0.58],[16.6624,0.8337],[17.6161,0.1221],[17.8582,0.1306]]};
const AU = { a: null, on: LSG("unitka.ptMute") !== "1", mus: LSG("unitka.ptMusic") !== "0", sfx: null, ld: false, mb: null, ml: false, src: null, mg: null, want: false, off: 0, t0: 0 };
function ac() {
  if (!AU.a) {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    try { AU.a = window.__ptAC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AU.a = null; }   // __ptAC — создан по нажатию «Сыграть»
  }
  if (AU.a && AU.a.state === "suspended" && !document.hidden) AU.a.resume();
  if (AU.a && !AU.ld) { AU.ld = true; buf("pasyans-sfx.mp3", b => { AU.sfx = b; }); }
  return AU.a;
}
function buf(url, cb) { fetch(BASE + url).then(r => r.arrayBuffer()).then(d => new Promise((ok, no) => AU.a.decodeAudioData(d, ok, no))).then(cb).catch(() => {}); }
function seg(name, vol, at, dur) {                        // случайный отрезок из SFX[name]
  const a = AU.a, list = SFX[name]; if (!a || !AU.sfx || !list) return false;
  const [o, d] = list[Math.floor(Math.random() * list.length)], s = a.createBufferSource(), g = a.createGain(), t = a.currentTime + (at || 0), len = Math.min(d, dur || d);
  s.buffer = AU.sfx; s.playbackRate.value = 0.96 + Math.random() * 0.08; g.gain.setValueAtTime(vol, t);
  if (len < d) g.gain.linearRampToValueAtTime(0, t + len);                    // обрезанный (тасовка) — плавно гаснет
  s.connect(g); g.connect(a.destination); s.start(t, o, len + 0.02); return true;
}
function edges(b) {                                       // у mp3 по краям тишина-заглушка — петля между первым и последним звуком
  const d = b.getChannelData(0), n = d.length, lim = b.sampleRate * 0.2; let i = 0, j = n - 1;
  while (i < lim && Math.abs(d[i]) < 1e-4) i++;
  while (j > n - lim && Math.abs(d[j]) < 1e-4) j--;
  return [i / b.sampleRate, (j + 1) / b.sampleRate];
}
function music(on) {                                      // фоновая музыка: плавно входит, при паузе — гаснет и продолжает с того же места
  AU.want = on; const a = AU.a; if (!a) return;
  if (on && AU.mus) {
    if (!AU.mb) { if (!AU.ml) { AU.ml = true; buf("pasyans-music.mp3", b => { AU.mb = b; if (AU.want) music(true); }); } return; }
    if (AU.src) return;
    const [ls, le] = edges(AU.mb), s = a.createBufferSource(), g = a.createGain(), t = a.currentTime;
    s.buffer = AU.mb; s.loop = true; s.loopStart = ls; s.loopEnd = le;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 1.6);
    s.connect(g); g.connect(a.destination); s.start(t, ls + AU.off); AU.src = s; AU.mg = g; AU.t0 = t - AU.off; AU.len = le - ls;
  } else if (AU.src) {
    const s = AU.src, g = AU.mg, t = a.currentTime; AU.src = null; AU.off = (t - AU.t0) % AU.len;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.5); s.stop(t + 0.55);
  }
}
document.addEventListener("visibilitychange", () => { if (!AU.a) return; if (document.hidden) AU.a.suspend(); else if (AU.want) AU.a.resume(); });
function snd(kind) {
  if (!AU.on) return; const a = ac(); if (!a) return;
  const t = a.currentTime;
  if (kind === "win") {
    for (let i = 0; i < 6; i++) seg("chips", 0.7, 0.15 + i * 0.32);                                   // выигрыш — горсть фишек
    [523, 659, 784, 1047, 1319].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.11); g.gain.exponentialRampToValueAtTime(0.06, t + i * 0.11 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.5); o.connect(g); g.connect(a.destination); o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.55); }); return;
  }
  if (kind === "deal" && seg("shuffle", 0.6, 0, 1.1)) { for (let i = 0; i < 9; i++) seg("slide", 0.32, 0.75 + i * 0.13); return; }   // тасовка, потом раздача
  if (kind === "home" && seg("place", 0.5)) { seg("chip", 0.6, 0.06); return; }                     // карта в дом — щелчок фишки
  if (kind === "recycle" && seg("fan", 0.55)) return;
  if (kind === "back" && seg("shove", 0.45)) return;
  if (kind === "hint" && seg("chiplay", 0.55)) return;
  if (kind === "flip" && seg("slide", 0.42)) return;
  if (kind === "place" && seg("place", 0.6)) return;
  if (kind === "hint") return;
  kind = kind === "home" ? "place" : kind === "recycle" || kind === "back" ? "deal" : kind;
  const dur = kind === "flip" ? 0.05 : kind === "deal" ? 0.035 : 0.07, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, kind === "place" ? 3 : 2);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = "bandpass"; f.frequency.value = kind === "place" ? 1800 : kind === "flip" ? 3200 : 2500; f.Q.value = 0.9;
  g.gain.value = kind === "place" ? 0.22 : 0.12; s.buffer = b; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
}

/* ═════════ рисунок карт ═════════ */
function suitPath(g, s, x, y, k) {                        // масть по центру (x, y), высота ≈ k
  g.save(); g.translate(x, y); g.scale(k / 96, k / 96); g.beginPath();
  if (s === "h") { g.moveTo(0, 44); g.bezierCurveTo(-12, 32, -52, 10, -50, -16); g.bezierCurveTo(-48, -46, -12, -50, 0, -24); g.bezierCurveTo(12, -50, 48, -46, 50, -16); g.bezierCurveTo(52, 10, 12, 32, 0, 44); }
  else if (s === "d") { g.moveTo(0, -48); g.quadraticCurveTo(15, -20, 36, 0); g.quadraticCurveTo(15, 20, 0, 48); g.quadraticCurveTo(-15, 20, -36, 0); g.quadraticCurveTo(-15, -20, 0, -48); }
  else if (s === "s") { g.moveTo(0, -46); g.bezierCurveTo(12, -34, 50, -12, 48, 12); g.bezierCurveTo(46, 38, 14, 42, 5, 24); g.lineTo(13, 46); g.lineTo(-13, 46); g.lineTo(-5, 24); g.bezierCurveTo(-14, 42, -46, 38, -48, 12); g.bezierCurveTo(-50, -12, -12, -34, 0, -46); }
  else { g.arc(0, -21, 20, 0, TAU); g.moveTo(-1, 9); g.arc(-21, 9, 20, 0, TAU); g.moveTo(41, 9); g.arc(21, 9, 20, 0, TAU); g.moveTo(-5, 12); g.lineTo(-13, 46); g.lineTo(13, 46); g.lineTo(5, 12); g.closePath(); }
  g.fill(); g.restore();
}
function crown(g, x, y, w, col) {                        // корона для короля и дамы
  g.save(); g.translate(x, y); g.beginPath();
  g.moveTo(-w / 2, w * 0.3); g.lineTo(-w / 2, -w * 0.1); g.lineTo(-w / 4, w * 0.1); g.lineTo(0, -w * 0.3); g.lineTo(w / 4, w * 0.1); g.lineTo(w / 2, -w * 0.1); g.lineTo(w / 2, w * 0.3); g.closePath();
  g.fillStyle = GOLD; g.fill(); g.lineWidth = Math.max(1, w * 0.05); g.strokeStyle = col; g.stroke();
  for (const px of [-w / 2, 0, w / 2]) { g.beginPath(); g.arc(px, px === 0 ? -w * 0.3 : -w * 0.1, w * 0.07, 0, TAU); g.fillStyle = col; g.fill(); }
  g.restore();
}
const PIPS = {
  2: [[.5, .2], [.5, .8]], 3: [[.5, .2], [.5, .5], [.5, .8]], 4: [[.31, .2], [.69, .2], [.31, .8], [.69, .8]],
  5: [[.31, .2], [.69, .2], [.5, .5], [.31, .8], [.69, .8]], 6: [[.31, .2], [.69, .2], [.31, .5], [.69, .5], [.31, .8], [.69, .8]],
  7: [[.31, .2], [.69, .2], [.5, .35], [.31, .5], [.69, .5], [.31, .8], [.69, .8]],
  8: [[.31, .2], [.69, .2], [.5, .35], [.31, .5], [.69, .5], [.5, .65], [.31, .8], [.69, .8]],
  9: [[.31, .2], [.69, .2], [.31, .4], [.69, .4], [.5, .5], [.31, .6], [.69, .6], [.31, .8], [.69, .8]],
  10: [[.31, .2], [.69, .2], [.5, .3], [.31, .4], [.69, .4], [.31, .6], [.69, .6], [.5, .7], [.31, .8], [.69, .8]],
};
/* картинки королей, дам и вальтов — NeuralBox в классическом стиле (Код\unitka\pasyans\make_assets.py → site\pasyans-court.webp,
   три кадра K, Q, J); пока не загрузились — корона и буква кодом */
const COURT = { im: null, cb: [] };
function court() {
  if (!COURT.im) { COURT.im = new Image(); COURT.im.onload = () => COURT.cb.forEach(f => f()); COURT.im.src = BASE + "pasyans-court.webp"; }
  return COURT.im.complete && COURT.im.naturalWidth ? COURT.im : null;
}
const IDX = 'Arial,"Helvetica Neue",Helvetica,sans-serif';
/* лицо карты w×h (css px) на g в (0,0) — как в старом Windows: белая, тонкая чёрная рамка, жирный индекс, классический расклад очков.
   big — крупный индекс (маленькие карты на телефоне: в столбце видна только верхняя полоска) */
function drawFace(g, c, w, h) {
  const col = RED[c.s] ? RED_C : "#000", r = Math.max(3, w * 0.07), big = w < 62;
  g.beginPath(); g.roundRect(0.5, 0.5, w - 1, h - 1, r); g.fillStyle = "#fff"; g.fill();
  g.lineWidth = 1; g.strokeStyle = "#1a1a1a"; g.stroke();
  g.fillStyle = col; g.textBaseline = "alphabetic";
  const art = c.r > 10 ? court() : null;
  if (big) {                                             // телефон: крупно ранг слева, масть справа; ниже — масть или картинка
    g.font = "700 " + Math.round(h * 0.27) + "px " + IDX; g.textAlign = "left";
    g.fillText(RANK[c.r], w * 0.07, h * 0.27, w * 0.64);
    suitPath(g, c.s, w * 0.81, h * 0.15, h * 0.16);
    if (art) { const k = 13 - c.r, sw = art.naturalWidth / 3; g.save(); g.beginPath(); g.rect(w * 0.12, h * 0.33, w * 0.76, h * 0.6); g.clip(); g.drawImage(art, k * sw, 0, sw, art.naturalHeight, w * 0.12, h * 0.33, w * 0.76, w * 0.76 * art.naturalHeight / sw); g.restore(); g.lineWidth = 1; g.strokeStyle = col; g.strokeRect(w * 0.12 + 0.5, h * 0.33 + 0.5, w * 0.76 - 1, h * 0.6 - 1); }
    else if (c.r > 10) { crown(g, w * 0.5, h * 0.5, w * 0.36, col); g.font = "700 " + Math.round(h * 0.3) + "px " + IDX; g.textAlign = "center"; g.fillText(RANK[c.r], w * 0.5, h * 0.86); }
    else suitPath(g, c.s, w * 0.5, h * 0.66, h * 0.4);
    return;
  }
  const idx = (rot) => {
    g.save(); if (rot) { g.translate(w, h); g.rotate(PI); }
    g.font = "700 " + Math.round(h * 0.14) + "px " + IDX; g.textAlign = "center";
    g.fillText(RANK[c.r], w * 0.12, h * 0.145, w * 0.22); suitPath(g, c.s, w * 0.12, h * 0.23, h * 0.085); g.restore();
  };
  idx(false); idx(true);
  if (c.r === 1) { suitPath(g, c.s, w * 0.5, h * 0.5, h * (c.s === "s" ? 0.42 : 0.3)); return; }
  if (c.r <= 10) {
    const ph = h * 0.135;
    for (const [px, py] of PIPS[c.r]) { if (py > 0.5) { g.save(); g.translate(w * px, h * py); g.rotate(PI); suitPath(g, c.s, 0, 0, ph); g.restore(); } else suitPath(g, c.s, w * px, h * py, ph); }
    return;
  }
  const fx = Math.round(w * 0.22) + 0.5, fy = Math.round(h * 0.12) + 0.5, fw = Math.round(w * 0.56), fh = Math.round(h * 0.76);
  if (art) {                                             // классическая двухголовая картинка в рамке, масти в углах рамки
    const k = 13 - c.r, sw = art.naturalWidth / 3, sh = art.naturalHeight, sc = Math.max(fw / sw, fh / sh);
    g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
    g.drawImage(art, k * sw, 0, sw, sh, fx + (fw - sw * sc) / 2, fy + (fh - sh * sc) / 2, sw * sc, sh * sc); g.restore();
    g.lineWidth = 1; g.strokeStyle = col; g.strokeRect(fx, fy, fw, fh);
    suitPath(g, c.s, fx + fw * 0.13, fy + fh * 0.08, fh * 0.09);
    g.save(); g.translate(fx + fw * 0.87, fy + fh * 0.92); g.rotate(PI); suitPath(g, c.s, 0, 0, fh * 0.09); g.restore();
    return;
  }
  g.lineWidth = 1; g.strokeStyle = col; g.strokeRect(fx, fy, fw, fh);
  if (c.r >= 12) crown(g, w * 0.5, fy + fh * 0.26, fw * (c.r === 13 ? 0.62 : 0.5), col);
  g.fillStyle = col; g.font = "700 " + Math.round(fh * 0.38) + "px " + IDX; g.textAlign = "center"; g.fillText(RANK[c.r], w * 0.5, fy + fh * 0.72);
  suitPath(g, c.s, w * 0.5, fy + fh * 0.86, fh * 0.12);
}
function drawBack(g, w, h) {                             // рубашка как в старом Windows: синяя сетка в белой кайме
  const r = Math.max(3, w * 0.07);
  g.beginPath(); g.roundRect(0.5, 0.5, w - 1, h - 1, r); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 1; g.strokeStyle = "#1a1a1a"; g.stroke();
  const m = Math.max(3, Math.round(w * 0.07)), iw = w - m * 2, ih = h - m * 2;
  g.save(); g.beginPath(); g.rect(m, m, iw, ih); g.clip();
  g.fillStyle = "#1747a6"; g.fillRect(m, m, iw, ih);
  g.strokeStyle = "rgba(160,200,255,.55)"; g.lineWidth = Math.max(1, w * 0.014); const st = Math.max(4, w * 0.09);
  for (let x = -h; x < w + h; x += st) { g.beginPath(); g.moveTo(x, m); g.lineTo(x + h, m + h); g.moveTo(x + h, m); g.lineTo(x, m + h); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,.85)";
  for (let y = m + st / 2; y < h; y += st) for (let x = m + st / 2 + ((Math.round((y - m) / st) % 2) ? st / 2 : 0); x < w; x += st) { g.beginPath(); g.arc(x, y, Math.max(0.6, w * 0.008), 0, TAU); g.fill(); }
  g.restore();
  g.lineWidth = 1; g.strokeStyle = "#0c2a66"; g.strokeRect(m + 0.5, m + 0.5, iw - 1, ih - 1);
}
/* кадры карт ровно в пикселях экрана (иначе мутно): Wd×Hd устройства, тень запечена в поля pd; на месте — копия 1:1 без масштаба */
function makeSprites() {
  const cache = new Map();
  return {
    get(key, w, h, dpr, fn) {
      const k = key + "|" + w + "|" + h + "|" + dpr; let c = cache.get(k); if (c) return c;
      const Wd = Math.round(w * dpr), Hd = Math.round(h * dpr), pd = Math.ceil(w * 0.12 * dpr);
      c = document.createElement("canvas"); c.width = Wd + pd * 2; c.height = Hd + pd * 2;
      const g = c.getContext("2d"); g.translate(pd, pd); g.scale(Wd / w, Hd / h);
      g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = w * 0.07 * dpr; g.shadowOffsetY = Math.max(1, w * 0.025) * dpr;
      g.beginPath(); g.roundRect(1, 1, w - 2, h - 2, Math.max(3, w * 0.07)); g.fillStyle = "#fff"; g.fill(); g.restore();
      fn(g); c.pd = pd; c.pad = pd / dpr; cache.set(k, c); if (cache.size > 140) cache.delete(cache.keys().next().value);
      return c;
    },
    clear() { cache.clear(); },
  };
}
function cardImg(spr, c, faceUp, w, h, dpr) {
  return faceUp ? spr.get(c.id, w, h, dpr, g => drawFace(g, c, w, h)) : spr.get("back", w, h, dpr, g => drawBack(g, w, h));
}
/* карта на холсте: x, y — левый верх; fl — переворот 0 (рубашка) … 1 (лицо); lift — приподнята (крупнее, тень дальше) */
function blitCard(ctx, spr, c, x, y, w, h, dpr, fl, lift, rot) {
  const face = fl >= 0.5, img = cardImg(spr, c, face, w, h, dpr);
  if ((fl === 0 || fl === 1) && !lift && !rot) {          // в покое и в полёте без поворота — пиксель в пиксель
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(img, Math.round(x * dpr) - img.pd, Math.round(y * dpr) - img.pd); ctx.restore();
    return;
  }
  const s = Math.abs(Math.cos(fl * PI)), pad = img.pad;
  const up = Math.sin(fl * PI) * h * 0.06 + (lift || 0) * h * 0.04, sc = 1 + Math.sin(fl * PI) * 0.06 + (lift || 0) * 0.05;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2 - up); if (rot) ctx.rotate(rot); ctx.scale(Math.max(0.02, s) * sc, sc);
  if (lift) { ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = h * 0.14 * lift; ctx.shadowOffsetY = h * 0.07 * lift; }
  ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, -w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  ctx.restore();
}

/* ═════════ игра «Косынка» ═════════ */
function mount(cv, opts) {
  opts = opts || {};
  const ctx = cv.getContext("2d"), spr = makeSprites();
  let W = 300, H = 400, dpr = 1, raf = 0, running = false, last = 0;
  const cards = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) cards.push({ id: s + r, s, r, up: false, x: 0, y: 0, tx: 0, ty: 0, fl: 0, delay: 0, z: 0, pile: null });
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const G = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], draw: 1,
    moves: 0, time: 0, started: false, won: false, hist: [], drag: null, hintT: 0, hint: null, cascade: null, autoRun: false, L: null, shake: null };
  const dbg = {};

  /* ── раскладка: размер карт по экрану, столбцы по центру; веер в столбце сжимается, если не влезает ── */
  function layout() {                                       // все размеры и места — целые css-пиксели (чётко)
    const narrow = W < 560, gap = Math.max(4, Math.round(Math.min(W, H) * (narrow ? 0.014 : 0.018)));
    let cw = Math.floor((W - gap * 8) / 7), ch = Math.round(cw * 1.4);
    const maxCh = Math.floor((H - gap * 3) / (narrow ? 3.3 : 3.6)); if (ch > maxCh) { ch = maxCh; cw = Math.round(ch / 1.4); }
    ch = Math.max(28, ch); cw = Math.max(20, cw);           // пока карточка вытягивается, холст бывает совсем низким
    const bw = cw * 7 + gap * 6, x0 = Math.round((W - bw) / 2), top = gap + (narrow ? 2 : 6);
    G.L = { cw, ch, gap, x0, top, tabY: top + ch + gap * (narrow ? 2 : 3), colX: i => x0 + i * (cw + gap) };
    spr.clear();
  }
  function fanStep(col) {                                   // шаг веера в столбце (закрытые теснее)
    const L = G.L, avail = H - L.tabY - L.gap - L.ch; let dn = L.ch * 0.11, up = L.ch * (W < 560 ? 0.3 : 0.27);
    let need = 0; for (let i = 0; i < col.length - 1; i++) need += col[i].up ? up : dn;
    if (need > avail && need > 0) { const k = avail / need; dn *= k; up *= k; }
    return [dn, up];
  }
  /* куда ставить каждую карту (цели tx, ty, порядок рисования z) */
  function targets() {
    const L = G.L; let z = 0;
    for (const c of G.stock) { c.tx = L.colX(0); c.ty = L.top; c.z = z++; c.pile = "stock"; }
    const wn = G.waste.length;
    G.waste.forEach((c, i) => { const k = G.draw === 3 ? Math.max(0, i - (wn - 3)) : 0; c.tx = L.colX(1) + Math.round(k * L.cw * 0.28); c.ty = L.top; c.z = z++; c.pile = "waste"; });
    G.found.forEach((f, j) => f.forEach(c => { c.tx = L.colX(3 + j); c.ty = L.top; c.z = z++; c.pile = "f" + j; }));
    G.tab.forEach((col, j) => { const [dn, up] = fanStep(col); let y = L.tabY; col.forEach(c => { c.tx = L.colX(j); c.ty = Math.round(y); y += c.up ? up : dn; c.z = z++; c.pile = "t" + j; }); });
  }
  function pileOf(c) { const p = c.pile; return p === "stock" ? G.stock : p === "waste" ? G.waste : p[0] === "f" ? G.found[+p[1]] : G.tab[+p[1]]; }

  /* ── партия ── */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function newGame(silent) {
    const deck = shuffle(cards.slice());
    G.stock = []; G.waste = []; G.found = [[], [], [], []]; G.tab = [[], [], [], [], [], [], []];
    for (const c of deck) { c.up = false; c.fl = 0; c.delay = 0; }
    let k = 0;
    for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) { const c = deck[k++]; G.tab[j].push(c); }
    G.tab.forEach(col => { col[col.length - 1].up = true; });
    G.stock = deck.slice(k).reverse();
    Object.assign(G, { moves: 0, time: 0, started: false, won: false, hist: [], hint: null, cascade: null, autoRun: false });
    targets();
    // раздача: все из колоды, по очереди, с переворотом верхних
    const L = G.L; let d = silent || !AU.on ? 0 : 0.75;                 // со звуком — сначала тасовка, потом летят карты
    for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) { const c = G.tab[j][i]; c.x = L.colX(0); c.y = L.top; c.delay = silent ? 0 : d; d += 0.045; c.fl = 0; }
    for (const c of G.stock) { c.x = c.tx; c.y = c.ty; }
    if (!silent) snd("deal");
    save(); stat(); need();
  }
  function snapshot() { return JSON.stringify({ s: G.stock.map(c => c.id), w: G.waste.map(c => c.id), f: G.found.map(f => f.map(c => c.id)), t: G.tab.map(t => t.map(c => c.id)), u: cards.filter(c => c.up).map(c => c.id), m: G.moves }); }
  function restore(js, instant) {
    const o = JSON.parse(js), ids = a => a.map(i => byId[i]);
    G.stock = ids(o.s); G.waste = ids(o.w); G.found = o.f.map(ids); G.tab = o.t.map(ids); G.moves = o.m;
    const up = new Set(o.u); for (const c of cards) { c.up = up.has(c.id); c.fl = c.up ? 1 : 0; c.delay = 0; }
    targets(); if (instant) for (const c of cards) { c.x = c.tx; c.y = c.ty; }
  }
  function save() { LSS("unitka.ptGame", JSON.stringify({ v: 1, st: snapshot(), draw: G.draw, time: G.time, started: G.started, won: G.won })); }
  function load() {
    try { const o = JSON.parse(LSG("unitka.ptGame") || "null"); if (!o || o.v !== 1 || o.won) return false; restore(o.st, true); G.time = o.time || 0; G.started = !!o.started; return true; } catch (e) { return false; }
  }
  function commit() { G.moves++; if (!G.started) G.started = true; targets(); save(); stat(); checkWin(); need(); }
  function push() { G.hist.push(snapshot()); if (G.hist.length > 400) G.hist.shift(); }
  function undo() {
    if (G.cascade || G.autoRun || !G.hist.length) return;
    const prev = cards.map(c => [c, c.up]); restore(G.hist.pop(), false);
    for (const [c, was] of prev) if (was !== c.up) c.fl = was ? 1 : 0;           // переворот обратно — тоже плавно
    G.moves++; save(); stat(); need(); snd("back");
  }
  const canStack = (a, b) => b ? (b.up && !!RED[a.s] !== !!RED[b.s] && b.r === a.r + 1) : a.r === 13;   // a на b в столбце
  const canFound = (a, f) => f.length ? (f[f.length - 1].s === a.s && f[f.length - 1].r === a.r - 1) : a.r === 1;
  function flipTops() { for (const col of G.tab) { const t = col[col.length - 1]; if (t && !t.up) { t.up = true; snd("flip"); } } }
  function moveCards(list, dest) {
    const src = pileOf(list[0]); src.splice(src.indexOf(list[0]), list.length); dest.push(...list);
    flipTops(); snd(G.found.includes(dest) ? "home" : "place"); try { navigator.vibrate && navigator.vibrate(5); } catch (e) {}
  }
  function drawStock() {
    if (G.cascade || G.autoRun) return;
    push();
    if (!G.stock.length) { if (!G.waste.length) { G.hist.pop(); return; } G.stock = G.waste.reverse(); G.waste = []; for (const c of G.stock) c.up = false; snd("recycle"); }
    else { const n = Math.min(G.draw, G.stock.length); for (let i = 0; i < n; i++) { const c = G.stock.pop(); c.up = true; c.delay = i * 0.07; G.waste.push(c); } snd("flip"); }
    commit();
  }
  /* лучший ход для карты (тап): сначала в дом, потом в столбец (король — в пустой) */
  function bestMove(c) {
    const src = pileOf(c), i = src.indexOf(c), list = src.slice(i);
    if (list.length === 1) for (let j = 0; j < 4; j++) if (canFound(c, G.found[j])) return [list, G.found[j]];
    let empty = null; const pointless = G.tab.includes(src) && i === 0;      // король и так на пустом месте
    for (let j = 0; j < 7; j++) { const col = G.tab[j]; if (col === src) continue; const t = col[col.length - 1]; if (t && canStack(c, t)) return [list, col]; if (!t && c.r === 13 && !empty && !pointless) empty = col; }
    return empty ? [list, empty] : null;
  }
  function tryMove(list, dest) { push(); moveCards(list, dest); commit(); }
  function movable(c) {
    const p = pileOf(c); if (!c.up) return false;
    if (p === G.waste || G.found.includes(p)) return p[p.length - 1] === c;
    return G.tab.includes(p);
  }
  function checkWin() {
    if (G.won) return;
    if (G.found.every(f => f.length === 13)) {
      G.won = true; save(); snd("win");
      const st = JSON.parse(LSG("unitka.ptStats") || '{"w":0,"best":0}'); st.w++; if (!st.best || G.time < st.best) st.best = G.time; LSS("unitka.ptStats", JSON.stringify(st));
      setTimeout(startCascade, 500); stat();
    }
  }
  const canAuto = () => !G.won && !G.stock.length && !G.waste.length && G.tab.every(col => col.every(c => c.up)) && !G.autoRun;
  function auto() {                                         // «Собрать»: по одной карте в дом, пока не кончатся
    if (!canAuto()) return; G.autoRun = true; stat();
    const stepA = () => {
      let done = false;
      for (let r = 1; r <= 13 && !done; r++) for (let j = 0; j < 7 && !done; j++) { const col = G.tab[j], c = col[col.length - 1]; if (c && c.r === r) for (let f = 0; f < 4; f++) if (canFound(c, G.found[f])) { moveCards([c], G.found[f]); G.moves++; targets(); done = true; break; } }
      need(); if (done && !G.found.every(f => f.length === 13)) setTimeout(stepA, 90); else { G.autoRun = false; save(); stat(); checkWin(); }
    };
    stepA();
  }
  function findHint() {
    // 1) верх столбца или отбоя — в дом; 2) открытая стопка, под которой закрытая карта; 3) с отбоя в столбец; 4) колода
    const tops = G.tab.map(col => col[col.length - 1]).filter(Boolean); if (G.waste.length) tops.push(G.waste[G.waste.length - 1]);
    for (const c of tops) for (const f of G.found) if (canFound(c, f)) return { c, to: f };
    for (const col of G.tab) {
      const i = col.findIndex(c => c.up); if (i <= 0) continue; const c = col[i];
      for (const d of G.tab) if (d !== col && (d.length ? canStack(c, d[d.length - 1]) : c.r === 13)) return { c, to: d };
    }
    if (G.waste.length) { const c = G.waste[G.waste.length - 1]; for (const d of G.tab) if (d.length ? canStack(c, d[d.length - 1]) : c.r === 13) return { c, to: d }; }
    if (G.stock.length || G.waste.length) return { stock: true };
    return null;
  }
  function hint() { G.hint = findHint() || { none: true }; G.hintT = 1.6; snd("hint"); need(); }

  /* ── победа: каскад прыгающих карт со следом (как в старом Windows) ── */
  let trail = null;
  function startCascade() {
    trail = document.createElement("canvas"); trail.width = cv.width; trail.height = cv.height;
    G.cascade = { list: [], next: 0, t: 0, order: [], gone: new Set() };
    for (let r = 13; r >= 1; r--) for (let j = 0; j < 4; j++) G.cascade.order.push(G.found[j].find(c => c.r === r));
    need();
  }
  function stepCascade(dt) {
    const cs = G.cascade, L = G.L;
    if (!trail) { trail = document.createElement("canvas"); trail.width = cv.width; trail.height = cv.height; }
    const tg = trail.getContext("2d");
    cs.t += dt;
    if (cs.next < cs.order.length && cs.t > cs.next * 0.16) {
      const c = cs.order[cs.next++]; cs.gone.add(c); cs.list.push({ c, x: c.tx, y: c.ty, vx: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 220), vy: -Math.random() * 300 });
    }
    for (const b of cs.list) {
      b.vy += 1500 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H - L.ch) { b.y = H - L.ch; b.vy = -b.vy * 0.72; }
      tg.setTransform(dpr, 0, 0, dpr, 0, 0); const img = cardImg(spr, b.c, true, L.cw, L.ch, dpr); tg.drawImage(img, b.x - img.pad, b.y - img.pad, L.cw + img.pad * 2, L.ch + img.pad * 2);
    }
    cs.list = cs.list.filter(b => b.x > -L.cw * 1.5 && b.x < W + L.cw * 0.5);
    return cs.next < cs.order.length || cs.list.length > 0;
  }

  /* ── ввод: перетаскивание стопки, тап — авто-ход, тап по колоде — сдача ── */
  const local = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / (r.width || 1), (e.clientY - r.top) * H / (r.height || 1)]; };
  function hitCard(x, y) {
    const L = G.L, order = cards.slice().sort((a, b) => b.z - a.z);
    for (const c of order) if (x >= c.tx && x <= c.tx + L.cw && y >= c.ty && y <= c.ty + L.ch) return c;
    return null;
  }
  const onDown = e => {
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} ac();
    if (G.drag || G.autoRun) return;
    if (G.cascade) { if (G.cascade.next >= G.cascade.order.length) { trail = null; G.cascade = null; newGame(); } return; }
    const [x, y] = local(e), L = G.L;
    if (x >= L.colX(0) && x <= L.colX(0) + L.cw && y >= L.top && y <= L.top + L.ch) { drawStock(); return; }
    const c = hitCard(x, y); if (!c || !movable(c)) { if (c && !c.up) { G.shake = { c, t: 0.3 }; need(); } return; }
    const p = pileOf(c), list = p.slice(p.indexOf(c));
    G.drag = { id: e.pointerId, list, ox: x - c.x, oy: y - c.y, x0: x, y0: y, lx: x, vx: 0, moved: false, t0: performance.now() };
    for (const k of list) k.lift = 1;
    need();
  };
  const onMove = e => {
    const d = G.drag; if (!d || e.pointerId !== d.id) return;
    const [x, y] = local(e);
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 6) { d.moved = true; G.hint = null; }
    if (d.moved) { d.px = x; d.py = y; d.vx = d.vx * 0.6 + (x - d.lx) * 0.4; d.lx = x; need(); }
  };
  const onUp = e => {
    ac();                                                   // на iPhone звук разрешается только на отпускании пальца
    const d = G.drag; if (!d || e.pointerId !== d.id) return;
    G.drag = null; for (const k of d.list) k.lift = 0;
    const lead = d.list[0];
    if (!d.moved) {                                         // тап — сам туда, куда можно
      const mv = bestMove(lead); if (mv) tryMove(mv[0], mv[1]); else { G.shake = { c: lead, t: 0.3 }; }
      need(); return;
    }
    const L = G.L, cx = lead.x + L.cw / 2, cy = lead.y + L.ch / 2; let dest = null;
    if (cy < L.tabY - L.gap && d.list.length === 1) {       // над домами
      let best = 1e9; for (let j = 0; j < 4; j++) { const dx = Math.abs(cx - (L.colX(3 + j) + L.cw / 2)); if (dx < L.cw * 0.9 && dx < best && canFound(lead, G.found[j])) { best = dx; dest = G.found[j]; } }
    }
    if (!dest) {
      let best = 1e9;
      for (let j = 0; j < 7; j++) { const col = G.tab[j]; if (col.includes(lead)) continue; const dx = Math.abs(cx - (L.colX(j) + L.cw / 2)); const t = col[col.length - 1];
        if (dx < L.cw * 0.95 && dx < best && (t ? canStack(lead, t) : lead.r === 13)) { best = dx; dest = col; } }
    }
    if (dest) tryMove(d.list, dest); else { targets(); snd("back"); }
    need();
  };
  cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);

  /* ── кадр ── */
  function need() { if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0; if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let busy = upd(dt);
    if (G.cascade && stepCascade(dt)) busy = true;
    draw();
    if (busy || G.drag) raf = requestAnimationFrame(frame);
  }
  function upd(dt) {
    let busy = false; const k = 1 - Math.exp(-dt * 13), d = G.drag;
    if (d && d.moved) {                                     // стопка за пальцем «верёвочкой»: каждая следующая догоняет предыдущую
      d.vx *= Math.exp(-dt * 8);
      d.list.forEach((c, i) => { const txx = d.px - d.ox, tyy = d.py - d.oy + i * G.L.ch * 0.27; const kk = i === 0 ? 1 : 1 - Math.exp(-dt * 22); c.x += (txx - c.x) * kk; c.y += (tyy - c.y) * kk; });
      busy = true;
    }
    for (const c of cards) {
      if (d && d.moved && d.list.includes(c)) continue;
      if (c.delay > 0) { c.delay -= dt; busy = true; continue; }
      const dx = c.tx - c.x, dy = c.ty - c.y;
      if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) { c.x += dx * k; c.y += dy * k; busy = true; } else { c.x = c.tx; c.y = c.ty; }
      const fT = c.up ? 1 : 0; if (c.fl !== fT) { c.fl = fT > c.fl ? Math.min(1, c.fl + dt * 3.2) : Math.max(0, c.fl - dt * 3.2); busy = true; }
    }
    if (G.hintT > 0) { G.hintT -= dt; busy = true; if (G.hintT <= 0) G.hint = null; }
    if (G.shake) { G.shake.t -= dt; busy = true; if (G.shake.t <= 0) G.shake = null; }
    return busy;
  }
  function slot(x, y, w, h, mark) {
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, w * 0.09);
    ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.stroke();
    if (mark) { ctx.fillStyle = "rgba(255,255,255,.22)"; mark(); }
  }
  function draw() {
    const L = G.L;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (trail) { ctx.drawImage(trail, 0, 0); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // места: колода (круговая стрелка, когда пуста), отбой, дома (масть), столбцы
    slot(L.colX(0), L.top, L.cw, L.ch, G.stock.length ? null : () => { ctx.beginPath(); ctx.arc(L.colX(0) + L.cw / 2, L.top + L.ch / 2, L.cw * 0.22, -PI * 0.2, PI * 1.5); ctx.lineWidth = L.cw * 0.06; ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.stroke(); });
    for (let j = 0; j < 4; j++) slot(L.colX(3 + j), L.top, L.cw, L.ch, () => suitPath(ctx, SUITS[j], L.colX(3 + j) + L.cw / 2, L.top + L.ch / 2, L.ch * 0.34));
    for (let j = 0; j < 7; j++) slot(L.colX(j), L.tabY, L.cw, L.ch, null);
    const h = G.hint;
    if (h && !h.none) {                                     // подсказка: мягкое золотое свечение
      const a = 0.5 + 0.5 * Math.sin(G.hintT * 9);
      ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = "#ffd76a"; ctx.shadowColor = "#ffd76a"; ctx.shadowBlur = 14;
      const box = (x, y) => { ctx.beginPath(); ctx.roundRect(x - 2, y - 2, L.cw + 4, L.ch + 4, L.cw * 0.1); ctx.stroke(); };
      if (h.stock) box(L.colX(0), L.top);
      else { box(h.c.x, h.c.y); const t = h.to[h.to.length - 1]; if (t) box(t.tx, t.ty); else { const j = G.tab.indexOf(h.to); if (j >= 0) box(L.colX(j), L.tabY); } }
      ctx.restore();
    }
    const d = G.drag, order = cards.slice().sort((a, b) => (a.lift && d && d.moved ? 1000 : 0) + a.z - ((b.lift && d && d.moved ? 1000 : 0) + b.z));
    for (const c of order) {
      if (G.cascade && G.cascade.gone.has(c)) continue;
      let x = c.x; if (G.shake && G.shake.c === c) x += Math.sin(G.shake.t * 60) * 4 * (G.shake.t / 0.3);
      const up = c.lift && d && d.moved;                  // поднятая стопка: крупнее, тень дальше, наклон по ходу пальца
      blitCard(ctx, spr, c, x, c.y, L.cw, L.ch, dpr, c.fl, up ? 1 : 0, up ? clamp(d.vx * 0.012, -0.14, 0.14) : 0);
    }
    if (G.cascade && G.cascade.next >= G.cascade.order.length && G.cascade.list.length === 0) {
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 0, W, H);
      const st = JSON.parse(LSG("unitka.ptStats") || '{"w":0}'), f = clamp(W * 0.07, 28, 64), pw = Math.min(W - 24, f * 11), ph = f * 2.6;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 24; ctx.beginPath(); ctx.roundRect(W / 2 - pw / 2, H * 0.42 - f * 1.35, pw, ph, 16);
      const pg = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.6); pg.addColorStop(0, "#14382a"); pg.addColorStop(1, "#08180f"); ctx.fillStyle = pg; ctx.fill(); ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = GOLD; ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = "#f0c96a"; ctx.font = "400 " + Math.round(f) + "px " + FONT_H; ctx.fillText("Пасьянс сошёлся!", W / 2, H * 0.42, pw - 20);
      ctx.fillStyle = "#fff"; ctx.font = "600 " + Math.round(f * 0.36) + "px " + FONT;
      ctx.fillText("Время " + fmt(G.time) + " · ходов " + G.moves + " · побед " + (st.w || 1), W / 2, H * 0.42 + f * 0.8);
      ctx.fillStyle = "#e8c260"; ctx.fillText("Нажми — новая раскладка", W / 2, H * 0.42 + f * 1.4);
    }
  }
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  function stat() { if (opts.onStat) opts.onStat({ time: fmt(G.time), moves: G.moves, canAuto: canAuto(), canUndo: G.hist.length > 0, won: G.won }); }
  const tick = setInterval(() => { if (running && G.started && !G.won && !document.hidden) { G.time++; stat(); if (G.time % 5 === 0) save(); } }, 1000);
  function resize() {
    const r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = DPR();
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); layout(); targets();
    for (const c of cards) if (!c.delay) { c.x = c.tx; c.y = c.ty; }
    if (trail) { trail = null; }
    draw();
  }
  const ro = new ResizeObserver(resize); ro.observe(cv);
  resize();
  if (!load()) newGame(true); else { stat(); }
  court(); COURT.cb.push(() => { spr.clear(); draw(); });           // картинки королей, дам и вальтов догрузились — перерисовать
  try { document.fonts && document.fonts.load('400 20px "Forum"').then(() => draw()); } catch (e) {}
  const inst = {
    resume() { if (running) return; running = true; ac(); music(true); need(); draw(); },
    pause() { running = false; music(false); if (raf) cancelAnimationFrame(raf); raf = 0; G.drag = null; save(); },
    destroy() { inst.pause(); clearInterval(tick); ro.disconnect(); },
    newGame() { if (G.autoRun) return; trail = null; G.cascade = null; newGame(false); },
    undo, hint, auto,
    mute(off) { AU.on = !off; LSS("unitka.ptMute", off ? "1" : "0"); if (!off) ac(); },
    music(on) { AU.mus = on; LSS("unitka.ptMusic", on ? "1" : "0"); ac(); music(on && running); },
    get musicOn() { return AU.mus; },
    get running() { return running; },
    get started() { return G.started && !G.won; },
    dbg: Object.assign(dbg, { G, cards, byId, targets, draw, upd, drawStock, bestMove, tryMove, canAuto, findHint, startCascade, snapshot, restore, moveCards, pileOf, layout: () => G.L,
      audio: () => ({ ctx: AU.a && AU.a.state, sfx: !!AU.sfx, musicBuf: !!AU.mb, musicPlaying: !!AU.src, on: AU.on, mus: AU.mus }) }),
  };
  return inst;
}

/* ═════════ лицо баннера: колода раздаёт веер красивых раскладов, веер «дышит», по картам пробегает блик ═════════ */
const HANDS = [["h10", "h11", "h12", "h13", "h1"], ["s1", "h1", "d1", "c1", "s13"], ["s10", "s11", "s12", "s13", "s1"], ["d7", "c7", "h7", "s12", "h12"], ["c10", "c11", "c12", "c13", "c1"]];
function fan(cv, opts) {
  opts = opts || {};
  const ctx = cv.getContext("2d"), spr = makeSprites(), red = reduced();
  let W = 0, H = 0, dpr = 1, raf = 0, on = false, paused = false, vis = true, last = 0, T = 0, hand = 0;
  const mk = id => ({ id, s: id[0], r: +id.slice(1) });
  let F = { st: "deal", t: 0, cards: HANDS[0].map(mk) };
  function geo() {
    // веер между надписью (слева) и ведущей (справа)
    const ch = Math.round(clamp(H * 0.56, 60, 240)), cw = Math.round(ch / 1.4), R = ch * 1.9;
    return { ch, cw, cx: W * 0.54, cy: H * 0.55 + R, R, spread: 0.14, deck: [W * 0.42, H * 0.8] };
  }
  function resize() { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; dpr = DPR(); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); spr.clear(); draw(); }
  function pose(i, n, g, t) {                              // место i-й карты в веере и угол
    const breathe = 1 + 0.06 * Math.sin(T * 1.2), a = (i - (n - 1) / 2) * g.spread * breathe;
    return [g.cx + Math.sin(a) * g.R - g.cw / 2, g.cy - Math.cos(a) * g.R - g.ch / 2 + Math.sin(T * 1.5 + i) * 2, a];
  }
  function upd(dt) {
    T += dt; F.t += dt;
    const n = F.cards.length;
    if (F.st === "deal" && F.t > n * 0.22 + 0.7) { F.st = "hold"; F.t = 0; }
    else if (F.st === "hold" && F.t > 6) { F.st = "gather"; F.t = 0; }
    else if (F.st === "gather" && F.t > 0.9) { hand = (hand + 1) % HANDS.length; F = { st: "deal", t: 0, cards: HANDS[hand].map(mk) }; }
  }
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  function draw() {
    if (!W) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = geo(), n = F.cards.length, back = { id: "b", s: "s", r: 1 };
    // колода
    for (let i = 0; i < 6; i++) blitCard(ctx, spr, back, g.deck[0] - g.cw / 2 + i * 0.6, g.deck[1] - g.ch / 2 - i * 0.8, g.cw, g.ch, dpr, 0, 0, -0.06);
    F.cards.forEach((c, i) => {
      const [px, py, a] = pose(i, n, g);
      let t = 1, fl = 1, x = px, y = py, rot = a;
      if (F.st === "deal") { t = ease((F.t - i * 0.22) / 0.55); fl = clamp((F.t - i * 0.22 - 0.2) / 0.45, 0, 1); }
      else if (F.st === "gather") { t = 1 - ease((F.t - (n - 1 - i) * 0.08) / 0.5); fl = t > 0.5 ? 1 : 0; }
      if (red) { t = 1; fl = 1; }
      if (t <= 0) return;
      x = g.deck[0] - g.cw / 2 + (px - (g.deck[0] - g.cw / 2)) * t; y = g.deck[1] - g.ch / 2 + (py - (g.deck[1] - g.ch / 2)) * t - Math.sin(t * PI) * g.ch * 0.35; rot = -0.06 + (a + 0.06) * t;
      blitCard(ctx, spr, c, x, y, g.cw, g.ch, dpr, fl, 0, rot);
    });
    // блик по вееру
    if (F.st === "hold" && !red) {
      const p = (F.t % 3) / 3; if (p < 0.45) {
        const sx = g.cx - g.R * 0.6 + p / 0.45 * g.R * 1.2;
        ctx.save(); ctx.globalCompositeOperation = "lighter"; const gr = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,240,.18)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gr; ctx.fillRect(sx - 40, 0, 80, H); ctx.restore();
      }
    }
  }
  function frame(now) { if (!on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; upd(dt); draw(); raf = requestAnimationFrame(frame); }
  function go() { const want = !paused && vis && !document.hidden && !red; if (want && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(frame); } else if (!want && on) { on = false; cancelAnimationFrame(raf); } }
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; go(); }); io.observe(cv);
  const ro = new ResizeObserver(resize); ro.observe(cv);
  const onVis = () => go(); document.addEventListener("visibilitychange", onVis);
  court(); COURT.cb.push(() => { spr.clear(); draw(); });
  resize(); if (red) { F.st = "hold"; draw(); } go();
  return { pause(p) { paused = !!p; go(); }, destroy() { on = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", onVis); } };
}

window.Solitaire = { mount, fan, drawFace, drawBack, suitPath };
})();
