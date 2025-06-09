// sw.js - Service Worker file

// List of assets to cache (image URLs for your setup images)
const CACHE_NAME = 'scouting-app-cache';
const assetsToCache = [
  'https://raw.githubusercontent.com/Elixtion/elixtion.github.io/refs/heads/main/images/redSetupImage.png',
  'https://raw.githubusercontent.com/Elixtion/elixtion.github.io/refs/heads/main/images/blueSetupImage.png',
];

// Install the service worker and cache images
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching assets');
        return cache.addAll(assetsToCache);
      })
  );
});

// Intercept fetch requests to serve cached images
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return the cached image or fetch from the network
      return cachedResponse || fetch(event.request);
    })
  );
});
