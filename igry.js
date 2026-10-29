/* Игровые темы Юнитки для Склеек и Конкурентов (29.10.2026, Андрей: «соник, пасьянс, энгри и фаркрай на всех 3 должны быть такими же»).
   Перенесено из Код\unitka\site\index.html (sonicDeco, soliDeco, birdsDeco, музыка Соника) — те же карточки-баннеры: на лице живая сцена,
   название сервиса — кнопка, нажал — карточка переворачивается, на обороте игра (sonic-game.js, solitaire.js, ab-game.js + planck.min.js).
   Игры, картинки и музыка берутся из /unitka/ (рядом с этим файлом), прогресс и звук игр — те же ключи unitka.*, что в Юнитке.
   Правишь тему в Юнитке — перенеси правку сюда (и в igry.css).
   API: IGRY.apply(тема | null, {name:'Склейки', wrap:элемент для баннера, onSound}) · IGRY.setSound(off) · IGRY.soundOff() · IGRY.has(тема) */
(function () {
"use strict";
const BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
const $ = s => document.querySelector(s);
const LS = {   // общие с Юниткой ключи игр: прогресс, звук
  get(k, d) { try { const v = localStorage.getItem("unitka." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("unitka." + k, JSON.stringify(v)); } catch (e) {} }
};
const isPhone = () => matchMedia("(max-width: 860px)").matches;
const noMotion = () => false;   // игровые темы двигаются всегда (Андрей 24.10, как в Юнитке)
const THEMES = ["farcry", "sonic", "solitaire", "birds"];
const TFONT = { farcry: "Rubik+Dirt&family=Roboto+Condensed:wght@400;500;600;700", sonic: "Exo+2:ital,wght@0,400;0,500;0,600;0,700;0,800;1,800;1,900&family=Russo+One",
  solitaire: "Forum&family=Montserrat:wght@400;500;600;700;800", birds: "Rubik:wght@400;500;600;700;800;900" };
let CUR = null, OPT = { name: "Юнитка" };
const NAME = () => String(OPT.name || "").toUpperCase();
const tk = n => Math.min(1, 6.5 / Math.max(1, n)).toFixed(3);   // длинное название («КОНКУРЕНТЫ») — мельче, чтобы влезло как «ЮНИТКА»
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function font(t) {
  if (!TFONT[t] || document.getElementById("tf-" + t)) return;
  const l = document.createElement("link"); l.id = "tf-" + t; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + TFONT[t] + "&display=swap"; document.head.appendChild(l);
}
function script(id, src, cb) {
  if (document.getElementById(id)) { const s = document.getElementById(id); if (s._ok) return cb(); s.addEventListener("load", cb, { once: true }); return; }
  const s = document.createElement("script"); s.id = id; s.src = BASE + src; s.onload = () => { s._ok = true; cb(); }; document.head.appendChild(s);
}
const ICO = {
  mute: '<svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg><svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
  big: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-2"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  deal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3.5v4.6h-4.6"/><rect x="9.3" y="8.6" width="5.4" height="7.2" rx="1.1"/></svg>',
  music: '<svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg><svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M3 3l18 18"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.3 1.1 2.2h5c0-.9.3-1.6 1.1-2.2A6 6 0 0 0 12 3Z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'
};
function mountCard(el) { const w = OPT.wrap || $("main"); w.prepend(el); }
function hdrH() {   // высота шапки страницы — для «стола» пасьянса во весь рост
  const h = document.querySelector(".svc-hdr"), n = document.querySelector("#tabbar,nav.tabbar");
  document.documentElement.style.setProperty("--igh", (h ? h.offsetHeight : 60) + "px");
  document.documentElement.style.setProperty("--ign", (n && n.offsetParent ? n.offsetHeight : 0) + "px");
}
addEventListener("resize", () => { if (CUR) hdrH(); });

/* ═════ звук: кнопки в играх и кнопка звука в шапке страницы — одна настройка ═════ */
const SND = {
  sonic: { off: () => LS.get("sxMute", 0) == 1, set: off => { LS.set("sxMute", off ? 1 : 0); if (window.SonicGame) SonicGame.mute(off); } },
  solitaire: { off: () => LS.get("ptMute", 0) == 1 && LS.get("ptMusic", 1) == 0,
    set: off => { LS.set("ptMute", off ? 1 : 0); LS.set("ptMusic", off ? 0 : 1); const g = $("#ptCard") && $("#ptCard")._game; if (g) { g.mute(off); g.music(!off); } } },
  birds: { off: () => LS.get("abMute", 0) == 1, set: off => { LS.set("abMute", off ? 1 : 0); if (window.BirdsGame) BirdsGame.mute(off); } }
};
function syncBtns() {
  document.querySelectorAll('[data-sx="mute"]').forEach(x => x.setAttribute("aria-pressed", LS.get("sxMute", 0) == 1));
  document.querySelectorAll('[data-ab="mute"]').forEach(x => x.setAttribute("aria-pressed", LS.get("abMute", 0) == 1));
  document.querySelectorAll('[data-pt="mute"]').forEach(x => x.setAttribute("aria-pressed", LS.get("ptMute", 0) == 1));
  document.querySelectorAll('[data-pt="music"]').forEach(x => x.setAttribute("aria-pressed", LS.get("ptMusic", 1) == 0));
}
const told = () => { syncBtns(); if (OPT.onSound) OPT.onSound(); };
/* музыка Соника (свой трек NeuralBox Suno, бесшовная петля) — играет, пока открыта игра; гасят кнопка в шапке и кнопка в игре */
const TMU = { a: null, b: {}, ld: {}, src: null, g: null, cur: null, want: null }, TMV = { sonic: 0.3 };
function tmCtx() {
  if (!TMU.a) {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    try { TMU.a = window.__ptAC || (window.__ptAC = new (window.AudioContext || window.webkitAudioContext)()); } catch (e) { TMU.a = null; }
  }
  if (TMU.a && TMU.a.state === "suspended" && !document.hidden) TMU.a.resume();
  return TMU.a;
}
function tmEdges(b) {
  const d = b.getChannelData(0), n = d.length, lim = b.sampleRate * 0.2; let i = 0, j = n - 1;
  while (i < lim && Math.abs(d[i]) < 1e-4) i++;
  while (j > n - lim && Math.abs(d[j]) < 1e-4) j--;
  return [i / b.sampleRate, (j + 1) / b.sampleRate];
}
function tmWant() {
  if (!TMV[CUR] || SND[CUR].off()) return null;
  if (CUR === "sonic") { const c = $("#sxCard"); return c && c.classList.contains("flip") ? "sonic" : null; }
  return CUR;
}
function tmSync() {
  const name = TMU.want = tmWant(), a = TMU.a; if (!a) return;
  if (TMU.cur && TMU.cur !== name) {
    const s = TMU.src, g = TMU.g, t = a.currentTime; TMU.src = TMU.g = TMU.cur = null;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.5); s.stop(t + 0.55);
  }
  if (!name || TMU.cur === name) return;
  const b = TMU.b[name];
  if (!b) {
    if (!TMU.ld[name]) { TMU.ld[name] = 1; fetch(BASE + name + "-music.mp3").then(r => r.arrayBuffer()).then(d => new Promise((ok, no) => a.decodeAudioData(d, ok, no)))
      .then(x => { TMU.b[name] = x; if (TMU.want === name) tmSync(); }).catch(() => { TMU.ld[name] = 0; }); }
    return;
  }
  const [ls, le] = tmEdges(b), s = a.createBufferSource(), g = a.createGain(), t = a.currentTime;
  s.buffer = b; s.loop = true; s.loopStart = ls; s.loopEnd = le;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(TMV[name], t + 1.6);
  s.connect(g); g.connect(a.destination); s.start(t, ls); TMU.src = s; TMU.g = g; TMU.cur = name;
}
["pointerdown", "pointerup", "touchend", "keydown"].forEach(k => document.addEventListener(k, () => {
  try { if (navigator.audioSession && SND[CUR]) navigator.audioSession.type = "playback"; } catch (e) {}
  if (tmWant()) { tmCtx(); tmSync(); }
}, true));
function tmWake() {
  if (!TMU.a || document.hidden) return;
  if (tmWant() && TMU.a.state !== "running") TMU.a.resume().then(() => tmSync()).catch(() => {});
  else if (tmWant() && !TMU.cur) tmSync();
}
document.addEventListener("visibilitychange", () => { if (!TMU.a || !TMU.cur) return; if (document.hidden) TMU.a.suspend(); else tmWake(); });
setInterval(tmWake, 2000); addEventListener("focus", tmWake); addEventListener("pageshow", tmWake);
function ptAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
  try { if (!window.__ptAC) window.__ptAC = new (window.AudioContext || window.webkitAudioContext)(); window.__ptAC.resume(); } catch (e) {}
}

/* ═════ «Соник» ═════ */
function sxPrize() {
  const p = +LS.get("sxProg", 0) || 0;
  return ["🎁 Пройди игру — получи ценный приз!", "🎁 Приз уже ближе — остался акт 2!", "🎁 До приза — только босс!",
    "🎁 Приз совсем рядом — секретный этап!", "🏆 Приз получен — играй Супер Соником!"][Math.min(4, p)];
}
const loadSonic = cb => window.SonicGame ? cb() : script("sxjs", "sonic-game.js?v=6", cb);
function sxMap(cw, ch) {
  const m = isPhone(), ix0 = m ? 570 : 0, iw = m ? 2598 : 3168, ih = 1344, px = m ? 0.55 : 0.5, py = 0.42, s = Math.max(cw / iw, ch / ih);
  return { ix0, s, ox: (cw - iw * s) * px, oy: (ch - ih * s) * py };
}
function sxBig(el, on) {
  el.classList.toggle("big", on); document.documentElement.classList.toggle("sx-big", on);
  if (on && el.requestFullscreen && !document.fullscreenElement)
    el.requestFullscreen({ navigationUI: "hide" }).then(() => { try { screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} }).catch(() => {});
  if (!on) { try { screen.orientation.unlock(); } catch (e) {} if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
}
document.addEventListener("fullscreenchange", () => { const el = $("#sxCard"); if (el && !document.fullscreenElement && el.classList.contains("big")) { el.classList.remove("big"); document.documentElement.classList.remove("sx-big"); } });
document.addEventListener("keydown", e => { const el = $("#sxCard"); if (el && e.key === "Escape" && el.classList.contains("big")) sxBig(el, false); });
function sxFlip(el, on) {
  if (on === el.classList.contains("flip")) return;
  if (noMotion()) el.classList.toggle("flip", on);
  else {
    el.classList.add("anim"); void el.offsetWidth; el.classList.add("tr"); void el.offsetWidth;
    el.classList.toggle("flip", on);
    const inner = el.querySelector(".sxin"), done = e => { if (e && e.target !== inner) return; clearTimeout(el._ft); inner.removeEventListener("transitionend", done); el.classList.remove("anim", "tr"); };
    inner.addEventListener("transitionend", done); el._ft = setTimeout(done, 1200);
  }
  if (on) loadSonic(() => {
    if (!el.isConnected) return;
    if (!el._game) el._game = SonicGame.mount(el.querySelector(".sxgame"));
    el._game.resume(); if (el._run) el._run.pause(true); document.documentElement.classList.add("sx-play");
    if (el._game.menu) el._game.menu(true);
    setTimeout(() => { if (el.classList.contains("flip")) el.querySelector(".sxgame").focus({ preventScroll: true }); }, 900);
  });
  else {
    if (el._game) el._game.pause(); if (el._run) el._run.pause(false); sxBig(el, false); document.documentElement.classList.remove("sx-play");
    const pz = el.querySelector(".sxprize"); if (pz) pz.textContent = sxPrize();
  }
  if (on) tmCtx(); tmSync();
}
function sonicDeco(on) {
  const d = $("#sxDeco"), c = $("#sxCard");
  if (!on) {
    if (d) d.remove();
    if (c) { if (c._run) c._run.destroy(); if (c._game) c._game.destroy(); sxBig(c, false); c.remove(); }
    document.documentElement.classList.remove("sx-play", "sx-big");
    return;
  }
  const ring = (st, dl) => `<i class="sl" style="${st};animation-delay:${dl}s"><b class="rg" style="animation-delay:${dl}s"></b></i>`;
  if (!d) {
    const el = document.createElement("div"); el.id = "sxDeco"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<div class="sxp cl"><i class="sxc far"></i><i class="sxc near"></i></div><i class="sxh"></i><div class="sxp rn">' +
      [["2.5%", "30%"], ["94.5%", "21%"], ["4%", "64%"], ["93%", "55%"]].map(([x, y], i) => ring(`left:${x};top:${y}`, -i * 0.7)).join("") + "</div>";
    document.body.appendChild(el);
  }
  if (!c) {
    const el = document.createElement("div"); el.id = "sxCard";
    el.innerHTML = '<div class="sxin"><div class="sxf sxfr">' +
      [[54, 140, 0], [63, 90, -.9], [71, 170, -1.6], [80, 110, -2.3], [89, 130, -2.9]].map(([y, w, dl]) => `<i class="sp" style="top:${y}%;width:${w}px;animation-delay:${dl}s"></i>`).join("") +
      '<canvas class="sxrun" aria-hidden="true"></canvas>' +
      `<button class="sxtitle" type="button" aria-label="Играть в Соника" style="--tk:${tk(NAME().length)}"><span class="sxt">${esc(NAME())}</span><span class="sxgo">▶ ИГРАТЬ</span></button>` +
      `<button class="sxsub sxprize" type="button" style="--tk:${tk(NAME().length)}">${sxPrize()}</button></div>` +
      '<div class="sxf sxbk"><canvas class="sxgame" tabindex="0" aria-label="Игра «Соник»: бежит сам (тап — прыжок) или управляю сам — одним пальцем или стрелками и пробелом"></canvas>' +
      `<div class="sxbtns"><button type="button" data-sx="pause" aria-label="Пауза: продолжить, начать заново, сменить режим">${ICO.pause}</button>` +
      `<button type="button" data-sx="mute" aria-label="Звук" aria-pressed="${LS.get("sxMute", 0) == 1}">${ICO.mute}</button>` +
      `<button type="button" data-sx="big" aria-label="Во весь экран">${ICO.big}</button><button type="button" data-sx="back" aria-label="Перевернуть обратно">${ICO.back}</button></div></div></div>`;
    mountCard(el);
    el.querySelector(".sxtitle").onclick = () => sxFlip(el, true);
    el.querySelector(".sxprize").onclick = () => sxFlip(el, true);
    el.querySelector(".sxbtns").addEventListener("click", e => {
      const b = e.target.closest("[data-sx]"); if (!b) return;
      if (b.dataset.sx === "pause") { if (el._game) el._game.menu(); }
      else if (b.dataset.sx === "back") sxFlip(el, false);
      else if (b.dataset.sx === "big") sxBig(el, !el.classList.contains("big"));
      else if (b.dataset.sx === "mute") { const off = b.getAttribute("aria-pressed") !== "true"; if (!off) tmCtx(); SND.sonic.set(off); told(); tmSync(); }
    });
    new IntersectionObserver(es => { if (el.classList.contains("flip") && el._game && !el.classList.contains("big")) es[0].isIntersecting ? el._game.resume() : el._game.pause(); }).observe(el);
    loadSonic(() => { if (el.isConnected && !el._run) el._run = SonicGame.runner(el.querySelector(".sxrun"), { map: sxMap }); });
  }
}

/* ═════ «Пасьянс» ═════ */
const loadSoli = cb => window.Solitaire ? cb() : script("ptjs", "solitaire.js?v=4", cb);
function ptTurn(el, on, done) {
  if (noMotion()) { el.classList.toggle("flip", on); return done && done(); }
  el.classList.add("anim"); void el.offsetWidth; el.classList.add("tr"); void el.offsetWidth;
  el.classList.toggle("flip", on);
  const inner = el.querySelector(".ptin"), fin = e => { if (e && e.target !== inner) return; clearTimeout(el._pt); inner.removeEventListener("transitionend", fin); el.classList.remove("anim", "tr"); done && done(); };
  inner.addEventListener("transitionend", fin); el._pt = setTimeout(fin, 1100);
}
function ptTall(el, on, done) {
  if (on === el.classList.contains("tall")) return done && done();
  el.classList.toggle("tall", on);
  if (noMotion()) return done && done();
  let ok = false; const fin = e => { if (ok || (e && (e.target !== el || e.propertyName !== "height"))) return; ok = true; el.removeEventListener("transitionend", fin); done && done(); };
  el.addEventListener("transitionend", fin); setTimeout(fin, 650);
}
function ptBig(el, on) {
  el.classList.toggle("big", on); document.documentElement.classList.toggle("pt-big", on);
  if (on && el.requestFullscreen && !document.fullscreenElement && isPhone()) el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function ptVid(el, play) {
  const v = el.querySelector(".ptvid"); if (!v || noMotion()) return;
  if (play && !el.classList.contains("flip") && el._vis !== false && !document.hidden) { v.muted = true; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); } else v.pause();
}
function ptOpen(el, on) {
  if (el._busy || on === el.classList.contains("flip")) return;
  el._busy = true;
  if (on) {
    ptAudio(); ptVid(el, false); document.documentElement.classList.add("pt-play"); hdrH();
    ptTurn(el, true, () => ptTall(el, true, () => {
      el._busy = false;
      const top = el.getBoundingClientRect().top; if (top < 0 || top > innerHeight * 0.35) scrollTo({ top: scrollY + top - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--igh")) || 60) - 12, behavior: "smooth" });
      loadSoli(() => {
        if (!el.isConnected) return;
        if (!el._game) el._game = Solitaire.mount(el.querySelector(".ptgame"), { onStat: s => ptStat(el, s) });
        el._game.resume(); el.querySelector('[data-pt="back"]').focus({ preventScroll: true });
      });
    }));
  } else {
    if (el._game) el._game.pause();
    ptBig(el, false);
    ptTall(el, false, () => ptTurn(el, false, () => { el._busy = false; document.documentElement.classList.remove("pt-play"); ptVid(el, true); }));
  }
}
function ptStat(el, s) {
  el.querySelector(".ptstat").innerHTML = s.time + " · " + s.moves + ' <span class="w">' + (s.moves % 10 === 1 && s.moves % 100 !== 11 ? "ход" : s.moves % 10 >= 2 && s.moves % 10 <= 4 && (s.moves % 100 < 12 || s.moves % 100 > 14) ? "хода" : "ходов") + "</span>";
  el.querySelector('[data-pt="auto"]').classList.toggle("hidden", !s.canAuto);
  el.querySelector('[data-pt="undo"]').disabled = !s.canUndo;
}
function ptBulbs(el) {
  const box = el.querySelector(".ptbulbs"); if (!box) return;
  const [c1, c2] = box.querySelectorAll("canvas"), W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, devicePixelRatio || 1), small = W < 560, bw = small ? 10 : 14, r = small ? 2.3 : 3.2, step = small ? 17 : 24, R = 16;
  const ins = bw / 2, w = W - bw, h = H - bw, rr = R - ins, per = 2 * (w + h) - 8 * rr + 2 * Math.PI * rr, n = Math.max(8, Math.round(per / step) & ~1), pts = [];
  for (let i = 0; i < n; i++) {
    let d = i * per / n; const seg = [w - 2 * rr, Math.PI * rr / 2, h - 2 * rr, Math.PI * rr / 2, w - 2 * rr, Math.PI * rr / 2, h - 2 * rr, Math.PI * rr / 2];
    let k = 0; while (d > seg[k]) { d -= seg[k]; k++; }
    const cx = [ins + w - rr, ins + w - rr, ins + rr, ins + rr], cy = [ins + rr, ins + h - rr, ins + h - rr, ins + rr];
    if (k === 0) pts.push([ins + rr + d, ins]); else if (k === 2) pts.push([ins + w, ins + rr + d]); else if (k === 4) pts.push([ins + w - rr - d, ins + h]); else if (k === 6) pts.push([ins, ins + h - rr - d]);
    else { const q = (k - 1) / 2, a = -Math.PI / 2 + q * Math.PI / 2 + d / rr; pts.push([cx[q] + Math.cos(a) * rr, cy[q] + Math.sin(a) * rr]); }
  }
  const bulb = (g, x, y, on) => {
    if (on) { const gl = g.createRadialGradient(x, y, 0, x, y, r * 3.4); gl.addColorStop(0, "rgba(255,226,140,.75)"); gl.addColorStop(1, "rgba(255,190,80,0)"); g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 3.4, 0, 7); g.fill(); }
    const b = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); b.addColorStop(0, on ? "#fffbe8" : "#8a6a30"); b.addColorStop(0.6, on ? "#ffd56a" : "#5a4218"); b.addColorStop(1, on ? "#d79a2a" : "#2e2009");
    g.fillStyle = b; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  };
  [c1, c2].forEach((c, li) => {
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (li === 0) {
      g.lineWidth = bw; g.strokeStyle = "rgba(20,12,3,.82)"; g.beginPath(); g.roundRect(ins, ins, w, h, rr); g.stroke();
      g.lineWidth = 1.2; g.strokeStyle = "rgba(232,194,96,.85)"; g.beginPath(); g.roundRect(bw - 0.5, bw - 0.5, W - 2 * bw + 1, H - 2 * bw + 1, Math.max(2, R - bw)); g.stroke();
    }
    pts.forEach(([x, y], i) => bulb(g, x, y, li === 0 ? i % 2 === 1 : i % 2 === 0));
  });
}
function soliDeco(on) {
  const d = $("#ptDeco"), c = $("#ptCard");
  if (!on) {
    if (d) d.remove();
    if (c) { if (c._game) c._game.destroy(); const v = c.querySelector(".ptvid"); if (v) { v.pause(); v.removeAttribute("src"); v.load(); } c.remove(); }
    document.documentElement.classList.remove("pt-play", "pt-big");
    return;
  }
  if (!d) {
    const el = document.createElement("div"); el.id = "ptDeco"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = [["2%", "16%", 110, 0, .9, 26, "40px,-30px"], ["89%", "10%", 84, 1, .85, 31, "-30px,40px"], ["5%", "64%", 64, 2, .55, 23, "30px,30px"],
      ["86%", "56%", 120, 4, .9, 34, "-40px,-20px"], ["44%", "86%", 58, 5, .5, 28, "20px,-40px"], ["63%", "28%", 46, 3, .4, 25, "-20px,30px"]]
      .map(([x, y, z, k, o, t, dd]) => { const [dx, dy] = dd.split(","); return `<i style="left:${x};top:${y};--z:${z}px;--c:${k * 20}%;--o:${o};--d:${t}s;--dx:${dx};--dy:${dy}"></i>`; }).join("");
    document.body.appendChild(el);
  }
  if (!c) {
    const el = document.createElement("div"); el.id = "ptCard";
    const ph = isPhone() ? "-m" : "", nm = NAME();
    el.innerHTML = '<div class="ptin"><div class="ptf ptfr">' +
      `<video class="ptvid" src="${BASE}pasyans-live${ph}.mp4?v=3" poster="${BASE}pasyans-live${ph}.webp?v=3" muted playsinline loop autoplay disablepictureinpicture aria-hidden="true"></video>` +
      '<div class="ptshade" aria-hidden="true"></div><div class="ptbulbs" aria-hidden="true"><canvas class="b1"></canvas><canvas class="b2"></canvas></div>' +
      `<button class="pttitle" type="button" aria-label="Сыграть в пасьянс" style="--tk:${tk(nm.length + 1)}"><span class="ptt">${esc(nm)}</span><span class="ptgo">♠ Сыграть<span class="ptgo2">&nbsp;в пасьянс</span></span></button>` +
      `<div class="ptsub" aria-hidden="true">«Косынка» · казино «${esc(OPT.name || "")}» открыто</div>` +
      '<button class="pthost" type="button" aria-label="Ведущая казино приглашает сыграть в пасьянс"></button><div class="ptbub" aria-hidden="true">Сыграем партию? 😉</div></div>' +
      '<div class="ptf ptbk"><div class="ptbar">' +
      `<button type="button" data-pt="back" aria-label="Закрыть пасьянс">${ICO.back}<span class="lbl">Назад</span></button>` +
      `<button type="button" data-pt="new" aria-label="Новая раскладка">${ICO.deal}<span class="lbl">Новая</span></button>` +
      `<button type="button" data-pt="undo" aria-label="Отменить ход" disabled>${ICO.undo}<span class="lbl">Отменить</span></button>` +
      `<button type="button" data-pt="hint" aria-label="Подсказка">${ICO.hint}<span class="lbl">Подсказка</span></button>` +
      `<button type="button" data-pt="auto" class="pri hidden" aria-label="Собрать карты в дома">${ICO.auto}<span class="lbl">Собрать</span></button>` +
      `<button type="button" data-pt="music" aria-label="Музыка" aria-pressed="${LS.get("ptMusic", 1) == 0}">${ICO.music}</button>` +
      `<button type="button" data-pt="mute" aria-label="Звуки карт и фишек" aria-pressed="${LS.get("ptMute", 0) == 1}">${ICO.mute}</button>` +
      `<button type="button" data-pt="big" aria-label="Во весь экран">${ICO.big}</button>` +
      '<span class="ptstat">0:00 · 0 ходов</span></div><canvas class="ptgame" aria-label="Пасьянс «Косынка»: перетаскивай карты или нажимай — карта сама уйдёт, куда можно"></canvas></div></div>';
    mountCard(el);
    el.querySelector(".pttitle").onclick = () => ptOpen(el, true);
    el.querySelector(".pthost").onclick = () => ptOpen(el, true);
    const nb = el.querySelector('[data-pt="new"]'), nbl = nb.querySelector(".lbl");
    const unask = () => { clearTimeout(el._ask); nb.classList.remove("ask"); nbl.textContent = "Новая"; };
    el.querySelector(".ptbar").addEventListener("click", e => {
      const b = e.target.closest("[data-pt]"); if (!b) return;
      const k = b.dataset.pt, g = el._game;
      if (k === "back") ptOpen(el, false);
      else if (k === "big") ptBig(el, !el.classList.contains("big"));
      else if (!g) return;
      else if (k === "new") {
        if (!g.started || nb.classList.contains("ask")) { unask(); g.newGame(); }
        else { nb.classList.add("ask"); nbl.textContent = "Новая?"; el._ask = setTimeout(unask, 3000); }
      }
      else if (k === "undo") g.undo();
      else if (k === "hint") g.hint();
      else if (k === "auto") g.auto();
      else if (k === "mute") { const off = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", off); LS.set("ptMute", off ? 1 : 0); g.mute(off); told(); }
      else if (k === "music") { const off = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", off); LS.set("ptMusic", off ? 0 : 1); g.music(!off); told(); }
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && el.classList.contains("big") && el.isConnected) ptBig(el, false); });
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && el.classList.contains("big") && isPhone()) ptBig(el, false); });
    new IntersectionObserver(es => { el._vis = es[0].isIntersecting; ptVid(el, el._vis); }).observe(el);
    document.addEventListener("visibilitychange", () => { if (el.isConnected) ptVid(el, !document.hidden); });
    new ResizeObserver(() => ptBulbs(el)).observe(el.querySelector(".ptfr"));
    ptVid(el, true);
  }
}

/* ═════ «Angry Birds» ═════ */
let abP = null;
function loadBirds(cb) {
  if (window.BirdsGame) return cb();
  if (!abP) abP = new Promise((ok, no) => script("abpl", "planck.min.js?v=1", () => script("abjs", "ab-game.js?v=2", ok))).catch(() => { abP = null; throw 0; });
  abP.then(cb).catch(() => {});
}
function abLure(el) {
  let got = 0; try { got = (JSON.parse(localStorage.getItem("unitka.abStars") || "[]") || []).reduce((a, b) => a + (+b || 0), 0); } catch (e) {}
  const t = got === 0 ? '⭐ <span class="lg">Сбей всех свиней — собери</span><span class="sm">Собери</span> 15 звёзд!' : got < 15 ? `⭐ ${got} из 15 звёзд<span class="lg"> — добей до трёх!</span>` : '🏆 Все 15 звёзд<span class="lg"> — Король свиней повержен!</span>';
  const b = el.querySelector(".abprize"); if (b) b.innerHTML = t;
}
function abBig(el, on) {
  el.classList.toggle("big", on); document.documentElement.classList.toggle("ab-big", on);
  if (on && el.requestFullscreen && !document.fullscreenElement)
    el.requestFullscreen({ navigationUI: "hide" }).then(() => { try { screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} }).catch(() => {});
  if (!on) { try { screen.orientation.unlock(); } catch (e) {} if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
}
function abFlip(el, on) {
  if (on === el.classList.contains("flip")) return;
  if (noMotion()) el.classList.toggle("flip", on);
  else {
    el.classList.add("anim"); void el.offsetWidth; el.classList.add("tr"); void el.offsetWidth;
    el.classList.toggle("flip", on);
    const inner = el.querySelector(".abin"), done = e => { if (e && e.target !== inner) return; clearTimeout(el._ft); inner.removeEventListener("transitionend", done); el.classList.remove("anim", "tr"); };
    inner.addEventListener("transitionend", done); el._ft = setTimeout(done, 1200);
  }
  if (on) {
    ptAudio();
    loadBirds(() => {
      if (!el.isConnected || !el.classList.contains("flip")) return;
      if (!el._game) el._game = BirdsGame.mount(el.querySelector(".abgame"), { onStars: () => abLure(el) });
      el._game.resume(); if (el._face) el._face.pause(true); document.documentElement.classList.add("ab-play");
      if (el._game.playing) el._game.menu(true);
      setTimeout(() => { if (el.classList.contains("flip")) el.querySelector(".abgame").focus({ preventScroll: true }); }, 900);
    });
  } else {
    if (el._game) el._game.pause(); if (el._face) el._face.pause(false); abBig(el, false); document.documentElement.classList.remove("ab-play"); abLure(el);
    if (el._tilt) el._tilt();
  }
}
function abTilt(el) {
  if (noMotion()) return;
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0, src = "", t0 = performance.now();
  const frame = now => {
    raf = 0; if (!el.isConnected) return;
    if (!src) { const t = (now - t0) / 1000; tx = Math.sin(t * 0.55) * 0.45; ty = Math.sin(t * 0.39 + 1) * 0.3; }
    x += (tx - x) * 0.07; y += (ty - y) * 0.07;
    el.style.setProperty("--tx", x.toFixed(3)); el.style.setProperty("--ty", y.toFixed(3));
    if (!el.classList.contains("flip") && el._vis !== false && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  el.addEventListener("pointermove", e => { if (e.pointerType !== "mouse" || el.classList.contains("flip")) return; const r = el.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; src = "m"; kick(); });
  el.addEventListener("pointerleave", () => { if (src === "m") src = ""; kick(); });
  const ori = e => { if (e.gamma == null || src === "m" || !el.isConnected) return; tx = Math.max(-1, Math.min(1, e.gamma / 22)); ty = Math.max(-1, Math.min(1, (e.beta - 40) / 22)); src = "o"; kick(); };
  window.addEventListener("deviceorientation", ori); el._unTilt = () => window.removeEventListener("deviceorientation", ori);
  new IntersectionObserver(es => { el._vis = es[0].isIntersecting; kick(); }).observe(el);
  document.addEventListener("visibilitychange", kick);
  el._tilt = kick; kick();
}
function abFly(d) {
  if (!d.isConnected || document.hidden || document.documentElement.classList.contains("ab-play") || noMotion()) return;
  const k = [["33.333% 0", 1], ["100% 0", 1], ["33.333% 50%", 0.8], ["66.667% 50%", 0.6]][(Math.random() * 4) | 0];
  const near = Math.random() < 0.35, z = Math.round((near ? 84 : 46) * k[1] + Math.random() * 18), W = innerWidth, H = innerHeight;
  const el = document.createElement("i"); el.className = "abfly"; el.style.cssText = `--z:${z}px;--c:${k[0]}`; d.appendChild(el);
  const y0 = H * (0.16 + Math.random() * 0.3), up = H * (0.1 + Math.random() * 0.16), fr = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; fr.push({ transform: `translate(${(-z + (W + 2 * z) * t).toFixed(1)}px,${(y0 - up * 4 * t * (1 - t) + (t > 0.5 ? (t - 0.5) * H * 0.25 : 0)).toFixed(1)}px) rotate(${(-22 + 50 * t).toFixed(1)}deg)` }); }
  const a = el.animate(fr, { duration: (near ? 4200 : 7200) + Math.random() * 1800, easing: "linear" });
  a.onfinish = () => el.remove();
}
function birdsDeco(on) {
  const d = $("#abDeco"), c = $("#abCard");
  if (!on) {
    if (d) { clearInterval(d._iv); window.removeEventListener("pointermove", d._pm); d.remove(); }
    if (c) { if (c._face) c._face.destroy(); if (c._game) c._game.destroy(); if (c._unTilt) c._unTilt(); abBig(c, false); c.remove(); }
    document.documentElement.classList.remove("ab-play", "ab-big");
    return;
  }
  if (!d) {
    const el = document.createElement("div"); el.id = "abDeco"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<div class="abscw"><i class="absc"></i></div>' + [["8%", 26, "#ffffff", 19, -3], ["23%", 18, "#e0241c", 23, -14], ["47%", 22, "#ffffff", 26, -8],
      ["71%", 16, "#ffd21f", 21, -17], ["88%", 24, "#ffffff", 24, -1], ["60%", 14, "#62b9ec", 28, -22]]
      .map(([x, z, col, t, dl]) => `<i class="abft" style="left:${x};--z:${z}px;--c:${col};--d:${t}s;--dl:${dl}s"></i>`).join("");
    document.body.appendChild(el);
    let raf = 0, mx = 0, my = 0;
    el._pm = e => { if (e.pointerType !== "mouse") return; mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty("--bx", (mx * 2).toFixed(3)); el.style.setProperty("--by", (my * 2).toFixed(3)); }); };
    window.addEventListener("pointermove", el._pm, { passive: true }); setTimeout(() => abFly(el), 1500); el._iv = setInterval(() => abFly(el), 6500);
  }
  if (!c) {
    const el = document.createElement("div"); el.id = "abCard";
    const R = [-7, 4, -3, 6, -4, 7], Y = [3, -4, 1, -3, 2, -2], nm = [...NAME()];   // буквы вразнобой, как логотип игры
    el.innerHTML = '<div class="abin"><div class="abf abfr"><div class="ab3d"><i class="absky" aria-hidden="true"></i><canvas class="abrun" aria-hidden="true"></canvas></div>' +
      `<button class="abtitle" type="button" aria-label="Играть в Angry Birds" style="--tk:${tk(nm.length)}"><span class="abt">` + nm.map((l, i) => `<b data-l="${esc(l)}" style="--r:${R[i % 6]}deg;--y:${Y[i % 6]}px">${esc(l)}</b>`).join("") +
      '</span><span class="abgo">▶ ИГРАТЬ</span></button><button class="abprize" type="button"></button></div>' +
      '<div class="abf abbk"><canvas class="abgame" tabindex="0" aria-label="Игра Angry Birds: тяни птицу назад и отпусти; в полёте нажми — умение птицы"></canvas>' +
      `<div class="abbtns"><button type="button" data-ab="pause" aria-label="Пауза: продолжить, заново, уровни">${ICO.pause}</button>` +
      `<button type="button" data-ab="mute" aria-label="Звук" aria-pressed="${LS.get("abMute", 0) == 1}">${ICO.mute}</button>` +
      `<button type="button" data-ab="big" aria-label="Во весь экран">${ICO.big}</button><button type="button" data-ab="back" aria-label="Перевернуть обратно">${ICO.back}</button></div></div></div>` +
      '<i class="abpop" aria-hidden="true"></i>';
    mountCard(el);
    abLure(el);
    el.querySelector(".abtitle").onclick = () => abFlip(el, true);
    el.querySelector(".abprize").onclick = () => abFlip(el, true);
    el.querySelector(".abbtns").addEventListener("click", e => {
      const b = e.target.closest("[data-ab]"); if (!b) return;
      if (b.dataset.ab === "pause") { if (el._game) el._game.menu(); }
      else if (b.dataset.ab === "back") abFlip(el, false);
      else if (b.dataset.ab === "big") abBig(el, !el.classList.contains("big"));
      else if (b.dataset.ab === "mute") { const off = b.getAttribute("aria-pressed") !== "true"; SND.birds.set(off); told(); }
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && el.classList.contains("big") && el.isConnected) abBig(el, false); });
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && el.classList.contains("big") && el.isConnected) { el.classList.remove("big"); document.documentElement.classList.remove("ab-big"); } });
    new IntersectionObserver(es => { if (el.classList.contains("flip") && el._game && !el.classList.contains("big")) es[0].isIntersecting ? el._game.resume() : el._game.pause(); }).observe(el);
    abTilt(el);
    const sky = el.querySelector(".absky");
    loadBirds(() => { if (el.isConnected && !el._face) el._face = BirdsGame.face(el.querySelector(".abrun"), {
      onMap: m => { sky.style.backgroundImage = `url("${m.src}")`; sky.style.backgroundSize = `${m.w.toFixed(1)}px ${m.h.toFixed(1)}px`; sky.style.backgroundPosition = `${m.x.toFixed(1)}px ${m.y.toFixed(1)}px`; } }); });
  }
}

/* ═════ «Far Cry 3»: баннер — лагерь на пляже, название сервиса и вопрос Вааса ═════ */
function farcryDeco(on) {
  const c = $("#fcCard");
  if (!on) { if (c) c.remove(); return; }
  if (c) return;
  const el = document.createElement("div"); el.id = "fcCard"; el.setAttribute("aria-hidden", "true");
  el.style.setProperty("--tk", tk(NAME().length));
  el.innerHTML = `<b>${esc(NAME())}</b><i>«Знаешь, что такое безумие?»</i>`;
  mountCard(el);
}

function bg(on) {
  let b = $("#igBg");
  if (!on) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "igBg"; b.setAttribute("aria-hidden", "true"); document.body.prepend(b); }
}
window.IGRY = {
  THEMES,
  has: t => THEMES.includes(t),
  apply(t, o) {
    if (o) OPT = Object.assign({}, OPT, o);
    const nt = THEMES.includes(t) ? t : null;
    if (nt !== CUR) [["farcry", farcryDeco], ["sonic", sonicDeco], ["solitaire", soliDeco], ["birds", birdsDeco]].forEach(([k, f]) => { if (k !== nt) f(false); });
    CUR = nt;
    const r = document.documentElement;
    if (nt) { r.dataset.igra = nt; font(nt); hdrH(); } else delete r.dataset.igra;
    bg(!!nt);
    farcryDeco(nt === "farcry"); sonicDeco(nt === "sonic"); soliDeco(nt === "solitaire"); birdsDeco(nt === "birds");
    syncBtns(); tmSync();
  },
  hasSound: t => !!SND[t],
  soundOff: () => (SND[CUR] ? SND[CUR].off() : false),
  setSound(off) { const s = SND[CUR]; if (!s) return; if (!off) tmCtx(); s.set(off); syncBtns(); tmSync(); }
};
})();
