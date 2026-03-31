/**
 * sw.js — CrowdScout Service Worker
 * Strategy:
 *   - Static assets (HTML, CSS, JS, fonts, images): StaleWhileRevalidate
 *   - TBA / Statbotics API calls: NetworkFirst with cache fallback
 *   - Everything else: NetworkFirst
 */

const CACHE_VERSION = "cs-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  "/",
  "/landing.html",
  "/home.html",
  "/events.html",
  "/event.html",
  "/scout.html",
  "/scout-match.html",
  "/scout-history.html",
  "/teams.html",
  "/team.html",
  "/profile.html",
  "/profile-setup.html",
  "/export.html",
  "/styles.css",
  "/auth.css",
  "/auth.js",
  "/lib/supabase-client.js",
  "/lib/tba.js",
  "/lib/offline.js",
  "/lib/reliability.js",
  "/lib/schema2026.js",
  "/lib/ui.js",
  "/images/Untitled design (3).png",
];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // addAll fails silently on individual errors via Promise.allSettled pattern
      return Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url).catch(() => {})));
    })
  );
});

// ── Activate — clean up old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("cs-") && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // TBA / Statbotics API → NetworkFirst with 5-min cache fallback
  if (
    url.hostname === "www.thebluealliance.com" ||
    url.hostname === "api.statbotics.io"
  ) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Supabase → NetworkOnly (real-time data, auth tokens)
  if (url.hostname.includes("supabase.co")) return;

  // Static assets → StaleWhileRevalidate
  if (
    url.hostname === self.location.hostname ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "cdn.tailwindcss.com" ||
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "raw.githubusercontent.com"
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Default → NetworkFirst
  event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
});

// ── Strategies ─────────────────────────────────────────────────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((res) => {
      if (res && res.status === 200) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await networkFetch) || new Response("Offline", { status: 503 });
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res && res.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
