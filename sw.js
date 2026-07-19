const CACHE_NAME = 'promptvault-cache-v1.2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

const DYNAMIC_CACHE_URL = 'prompts.json';

// Install event - Cache static assets and skipWaiting immediately
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing version:', CACHE_NAME);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Activate event - Delete old caches and claim clients immediately
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating version:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network First strategy for instant updates when online, fallback to cache when offline
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  if (requestUrl.pathname.endsWith(DYNAMIC_CACHE_URL)) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, cacheCopy);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Strategy for app assets: Network First with Cache Fallback for instant updates on mobile!
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse.status === 200 && requestUrl.origin === self.location.origin) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, cacheCopy);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

// Handle update skipWaiting command
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
