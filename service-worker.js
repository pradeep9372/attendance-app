const CACHE_NAME = "attendance-shell-v3"; // bumped again: forces every phone to drop old cached files
const SHELL_FILES = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// App shell: network-first, and we explicitly tell the browser to skip
// its own HTTP cache too (cache: "no-store"). This guarantees that any
// update you push (new style.css, new app.js, etc.) reaches phones on
// the very next visit — no manual "clear cache" needed ever again.
// Only if there's truly no internet does it fall back to the last
// cached copy, which is what makes the app still open while offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace("./", "/")));

  if (event.request.method !== "GET" || !isShellFile) {
    return; // let it hit the network normally, uncached
  }

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
