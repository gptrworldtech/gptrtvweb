self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Empty fetch handler allows the "Add to Homescreen" prompt to trigger.
});
