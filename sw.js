
const CACHE_NAME = 'goal-unbox-v7';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './index.js',
  './App.js',
  './types.js',
  './utils/fileUtils.js',
  './utils/timeUtils.js',
  './utils/dataSyncUtils.js',
  './services/geminiService.js',
  './services/authService.js',
  './services/goalStateService.js',
  './services/planService.js',
  './components/Alert.js',
  './components/Auth.js',
  './components/ApiKeyPrompt.js',
  './components/CameraCapture.js',
  './components/ChatBox.js',
  './components/CodeUploader.js',
  './components/DataSyncModal.js',
  './components/QrScanner.js',
  './components/GoalSetter.js',
  './components/TodaysPlan.js',
  './components/Header.js',
  './components/ProofUploader.js',
  './components/Spinner.js',
  './components/VerificationResult.js',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching app shell');
        // Use { cache: 'reload' } to bypass browser cache for the app shell files
        const requests = URLS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
    // We only want to handle GET requests for our app's assets.
    // This avoids interfering with other requests, like API calls to Google.
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200) {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});
