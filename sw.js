// Solo guarda la "cascara" de la app para abrir rapido. NUNCA guarda respuestas de la API (datos financieros).
const V = "v1", CASCARA = ["./", "styles.css", "app.js", "config.js"];
self.addEventListener("install", e => e.waitUntil(caches.open(V).then(c => c.addAll(CASCARA))));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== V).map(n => caches.delete(n))))));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
