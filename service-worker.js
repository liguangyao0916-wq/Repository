/* 卦阁 · 星命塔签 Service Worker v5
   策略：网络优先（在线永远拿最新，离线回退缓存）
   激活时清空所有旧缓存，彻底杜绝"旧 JS 缓存导致功能异常"
   ============================================================ */
const CACHE = 'guage-v28';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=28',
  './js/app.js?v=28',
  './js/intro.js?v=28',
  './js/intro-solar-v2.js?v=28',
  './js/ai.js?v=28',
  './js/bazi.js?v=28',
  './js/xingzuo.js?v=28',
  './js/tarot.js?v=28',
  './js/qian.js?v=28',
  './js/today.js?v=28',
  './js/data/xingzuo-data.js?v=28',
  './js/data/tarot-data.js?v=28',
  './js/data/tarot-minor-data.js?v=28',
  './js/data/tarot-domains-data.js?v=28',
  './js/data/qian-data.js?v=28',
  './js/data/today-data.js?v=28',
  './js/data/bazi-data.js?v=28',
  './js/data/bazi-schools-data.js?v=28',
  './lunar.js?v=28',
  './manifest.json?v=28',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // 无条件清空所有旧缓存（含 v3/v4 及未知缓存名）
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // AI 接口不缓存
  if (url.pathname.startsWith('/api/')) return;

  // 网络优先：在线拿最新，离线回退缓存（离线可用）
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
