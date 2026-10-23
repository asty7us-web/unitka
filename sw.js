/* Юнитка — service worker (23.10.2026, Андрей: «нельзя открыть на телефоне как приложение, не даёт через Chrome»).
   Нужен, чтобы Chrome предлагал «Установить приложение» (без обработчика fetch он не показывает предложение установки).
   Сеть — всегда первой (на телефоне сразу свежая версия сайта); нет сети — последняя сохранённая страница и картинки.
   Факт панелей и тарифы не кешируем: их сайт и так грузит каждый раз заново. */
const CACHE = "unitka-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || /fact\.enc\.json|tariffs\.json|unitka-ext\.zip/.test(u.pathname)) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok && (r.mode === "navigate" || /\.(html|js|css|png|svg|webp|webmanifest)$/.test(u.pathname))) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || (r.mode === "navigate" ? caches.match("./") : Response.error()))));
});
