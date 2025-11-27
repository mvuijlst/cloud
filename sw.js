self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('timebeat-store').then((cache) => cache.addAll([
      './',
      './index.html',
      './timebeat.png',
      './IBMPlexMono-Regular.ttf',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});