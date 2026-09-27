/* WJRH service worker — shell caching only.

   Deliberately never caches:
     - the audio stream (it is live; a cached chunk is worse than nothing)
     - nowplaying.wjrh.org (must always be fresh)
   schedule.json uses network-first so an edit shows up on the next load,
   with the cached copy as the offline fallback. */

var CACHE = 'wjrh-v2-programme';
var SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.json',
  'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png',
  'fonts/barlow-condensed-extrabold.ttf'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.hostname === 'internetstreamer.lafayette.edu' || url.hostname === 'nowplaying.wjrh.org') return;

  if (url.pathname.endsWith('schedule.json')) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Network-first, cache as offline fallback.
  //
  // Deliberately NOT cache-first: with a constant cache name, a cache-first
  // worker keeps serving an old app.js after a redeploy until sw.js itself
  // changes, so people are shown a stale build and reloading doesn't help.
  // Network-first costs a little latency and always ships the current code.
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('index.html');
      });
    })
  );
});
