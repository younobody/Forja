/**
 * FORJA Service Worker - v28.9 PWA cache
 *
 * Estratégia:
 * - Cache-first: HTML, CSS/JS da página, fontes do Google, Chart.js de CDN
 *   (sobrevive offline; invalida por versão no HTML)
 * - Network-only: chamadas ao Apps Script (sempre fresco, nunca servir data antiga)
 * - Fallback: página offline se o shell estiver cacheado
 *
 * v28.9: manifest agora e inline no HTML (nao existe mais manifest.json
 * separado - ver Fase 4), removido da lista de assets.
 */

const CACHE_VERSION = 'forja-v28.9.0';
const SHELL_CACHE = CACHE_VERSION + '-shell';
const ASSETS = [
  './',
  './forja28.9.0.html',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;600;800&display=swap',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => console.log('Skip cache:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(name => name.startsWith('forja-') && name !== SHELL_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Apps Script (nao cachear nunca — sempre fresco)
  if (url.hostname === 'script.google.com' || url.hostname.includes('script.google')) {
    return e.respondWith(fetch(request).catch(() =>
      caches.match('./forja28.9.0.html').then(r => r || new Response('Offline', { status: 503 }))
    ));
  }

  // Tudo o resto: cache-first (fontes, CDN, etc)
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res => {
      if (!res || res.status !== 200 || res.type === 'error') return res;
      const clone = res.clone();
      caches.open(SHELL_CACHE).then(cache => cache.put(request, clone));
      return res;
    })).catch(() =>
      caches.match('./forja28.9.0.html').then(r => r || new Response('Offline', { status: 503 }))
    )
  );
});
