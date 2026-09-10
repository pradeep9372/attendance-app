const CACHE_NAME = "attendance-shell-v2"; // bumped: invalidates the old broken cache on phones
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

// App shell: network-first. Always try to fetch the latest version
// (index.html, app.js, config.js, etc.) from the server first, so a
// change you push (like a fixed API URL) reaches devices immediately.
// Only fall back to the cached copy if there's no connection at all —
// that's what makes the app still open while offline.
//
// The JSONP calls to script.google.com are NOT shell files, so they
// always go straight to the network and are never cached — attendance
// data should never be served stale.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace("./", "/")));

  if (event.request.method !== "GET" || !isShellFile) {
    return; // let it hit the network normally, uncached
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
