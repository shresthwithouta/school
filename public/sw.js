// Service worker for the SWM PWA.
//
// Strategy is deliberately conservative because the app is authenticated:
//  - Navigations: network-first, falling back to a static offline page. We never
//    cache authenticated HTML, so no user's pages can leak to the next session.
//  - Static assets (Next build output, icons, fonts): stale-while-revalidate for
//    instant loads and offline shell.
//  - API / auth requests: passed straight through, never cached.
const CACHE = "swm-cache-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|webmanifest)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Let API/auth traffic go straight to the network — never cache it.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
});

// ── Web Push ────────────────────────────────────────────────────────────────
// The server (src/lib/push.js) sends a JSON payload: { title, body, url, tag }.
// We turn it into a native OS notification. On a PWA/TWA this shows up in the
// phone's notification tray even when the app is closed.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Fall back to a plain-text payload if it isn't JSON.
    data = { body: event.data && event.data.text ? event.data.text() : "" };
  }

  const title = data.title || "SWM";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Same tag → a newer notification replaces the older one instead of stacking.
    tag: data.tag || "swm",
    renotify: !!data.tag,
    // Stash the deep-link so the click handler knows where to go.
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping a notification focuses an existing app window (navigating it to the
// target) or opens a new one if none is open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  const targetUrl = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        // Reuse any open app window — navigate it to the target and focus it.
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Cross-origin or detached client — just focus it as-is.
            }
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
