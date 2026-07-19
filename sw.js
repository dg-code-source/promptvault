const CACHE_NAME = 'promptvault-cache-v1.2.5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

const DYNAMIC_CACHE_URL = 'prompts.json';
const FETCH_TIMEOUT = 5000;

// Helper to race fetch with a timeout promise
function fetchWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Fetch timeout'));
    }, FETCH_TIMEOUT);
    
    fetch(request)
      .then(response => {
        clearTimeout(timeout);
        resolve(response);
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

// Install event - Cache static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing version:', CACHE_NAME);
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

// Fetch event - Network First strategy with timeout fallback to cache
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  if (requestUrl.pathname.endsWith('/' + DYNAMIC_CACHE_URL)) {
    event.respondWith(
      fetchWithTimeout(event.request)
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
      fetchWithTimeout(event.request)
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
