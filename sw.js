/**
 * Service Worker for yunoxia.one
 * Provides offline support and caching strategies
 *
 * Features:
 * - Offline page support
 * - Cache-first strategy for static assets
 * - Network-first strategy for HTML pages
 * - Cache versioning for updates
 */

// Cache version - increment this to force cache update
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `yunoxia-${CACHE_VERSION}`;

// Files to cache immediately on install
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/works.html',
  '/log.html',
  '/links.html',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/partials/header.html',
  '/partials/footer.html',
  // Fonts are loaded from Google CDN, don't cache here
];

// Files to cache on first visit
const RUNTIME_CACHE = 'yunoxia-runtime';

// Offline fallback page
const OFFLINE_PAGE = '/index.html';

// =============================================================================
// Install Event - Cache static assets
// =============================================================================

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        // Force the waiting service worker to become active
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// =============================================================================
// Activate Event - Clean up old caches
// =============================================================================

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName.startsWith('yunoxia-') && cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// =============================================================================
// Fetch Event - Caching strategies
// =============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    handleFetch(request)
      .catch((error) => {
        console.error('[Service Worker] Fetch failed:', error);
        return caches.match(OFFLINE_PAGE);
      })
  );
});

/**
 * Handle fetch with appropriate caching strategy
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>}
 */
async function handleFetch(request) {
  const url = new URL(request.url);

  // Strategy 1: Cache-first for static assets (CSS, JS, images)
  if (isStaticAsset(url.pathname)) {
    return cacheFirst(request);
  }

  // Strategy 2: Network-first for HTML pages
  if (isHTMLPage(url.pathname)) {
    return networkFirst(request);
  }

  // Strategy 3: Network-first for partials
  if (url.pathname.startsWith('/partials/')) {
    return networkFirst(request);
  }

  // Default: Network-first
  return networkFirst(request);
}

/**
 * Cache-first strategy
 * Try cache first, fallback to network
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    console.log('[Service Worker] Cache hit:', request.url);
    return cached;
  }

  console.log('[Service Worker] Cache miss, fetching:', request.url);
  const response = await fetch(request);

  // Cache the new response
  if (response && response.status === 200) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}

/**
 * Network-first strategy
 * Try network first, fallback to cache
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match(OFFLINE_PAGE);
    }

    throw error;
  }
}

/**
 * Check if URL is a static asset
 * @param {string} pathname
 * @returns {boolean}
 */
function isStaticAsset(pathname) {
  const staticExtensions = ['.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

/**
 * Check if URL is an HTML page
 * @param {string} pathname
 * @returns {boolean}
 */
function isHTMLPage(pathname) {
  return pathname === '/' || pathname.endsWith('.html');
}

// =============================================================================
// Message Event - Handle messages from clients
// =============================================================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('yunoxia-')) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  }
});
