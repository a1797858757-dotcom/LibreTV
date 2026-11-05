/* 正版CCTV · PWA Service Worker
 *
 * 设计原则（针对影视聚合站的特殊性）：
 * 1) 只缓存「壳」：HTML / JS / CSS / 字体 / 图标。视频流(m3u8/ts/mp4)一律不缓存；
 * 2) 页面走 network-first：上线新版本立刻生效，不会长期卡在旧壳；
 * 3) 跨域请求（片源接口、豆瓣图床）直接放行，不接管、不改写，避免 CORS 与防盗链问题；
 * 4) Range 请求放行：拖拽进度条时不能走 SW 缓存，否则会整段重下。
 */

const VERSION = 'zbcctv-v1';
const SHELL_CACHE = VERSION + '-shell';
const ASSET_CACHE = VERSION + '-asset';

// 安装时预缓存：只放稳定的壳资源，任何一条失败都不影响 SW 安装成功
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 页面超时阈值：超过就走缓存壳（弱网/被墙时至少能打开界面）
const NAV_TIMEOUT = 4000;

// 视频与流媒体后缀，命中直接交给浏览器原生处理
const MEDIA_RE = /\.(m3u8|m3u|ts|m4s|mp4|mkv|flv|avi|mov|webm|mp3|m4a|aac|key)(\?|$)/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (e) {
            /* 单条失败忽略 */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 清掉旧版本缓存，避免升级后磁盘越堆越大
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  if (url.origin !== self.location.origin) return; // 跨域：不接管
  if (req.headers.has('range')) return; // 拖拽播放：不接管
  if (MEDIA_RE.test(url.pathname)) return; // 视频流：不接管
  if (url.pathname === '/sw.js') return; // SW 自身永远取网络
  if (url.pathname.startsWith('/api/')) return; // 业务接口：不接管

  // 页面导航：network-first，弱网/离线回退到缓存壳
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNav(req));
    return;
  }

  // 带 hash 的构建产物与图标：cache-first（文件名变了自然会换）
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|webp|svg|avif|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }

  // 其它同源 GET：先用缓存立刻返回，同时后台更新
  event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
});

async function networkFirstNav(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetchWithTimeout(req, NAV_TIMEOUT);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const cached = (await cache.match(req)) || (await cache.match('/'));
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const OFFLINE_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>离线 - 正版CCTV</title>
<style>
html,body{height:100%;margin:0;background:#0b101a;color:#e8edf7;
display:flex;align-items:center;justify-content:center;
font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.box{text-align:center;padding:24px}
h1{font-size:18px;font-weight:600;margin:0 0 8px}
p{font-size:13px;color:#8b96a8;margin:0 0 18px}
button{background:#2b6cf6;color:#fff;border:0;border-radius:10px;
padding:10px 20px;font-size:14px}
</style></head><body><div class="box">
<h1>当前处于离线状态</h1>
<p>网络恢复后即可继续观看</p>
<button onclick="location.reload()">重新加载</button>
</div></body></html>`;
