



const CACHE_NAME = 'goal-unbox-v15';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './index.js',
  './App.js',
  './types.js',
  './utils/fileUtils.js',
  './utils/timeUtils.js',
  './utils/defaultSchedule.js',
  './services/geminiService.js',
  './services/authService.js',
  './services/dataService.js',
  './services/firebaseService.js',
  './components/Alert.js',
  './components/Auth.js',
  './components/CameraCapture.js',
  './components/ChatBox.js',
  './components/CodeUploader.js',
  './components/DailyCommitment.js',
  './components/DistractionGatekeeper.js',
  './components/GoalHistory.js',
  './components/GoalSetter.js',
  './components/TodaysPlan.js',
  './components/TodoList.js',
  './components/WeeklyPlanView.js',
  './components/Header.js',
  './components/ProofUploader.js',
  './components/Spinner.js',
  './components/VerificationResult.js',
  './components/InstallPWA.js',
  './icon.svg',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching app shell');
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
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            if (!response || response.status !== 200) {
              return response;
            }
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