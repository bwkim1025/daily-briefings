// Daily Briefings only: Cache Storage is shared by all GitHub Pages apps on this origin.
const CACHE_PREFIX = 'daily-briefings-';
const CACHE_VERSION = CACHE_PREFIX + 'v28';
const BASE = new URL(self.registration.scope).pathname;
const PRECACHE = ['', 'index.html', 'manifest.json?v=28', 'favicon-v3.ico?v=28', 'favicon-v3-32.png?v=28', 'apple-touch-icon-v3.png?v=28', 'icon-v3-192.png?v=28', 'icon-v3-512.png?v=28', 'icon-v3-maskable-512.png?v=28', 'assets/briefings.css?v=28', 'assets/fonts/pretendard/pretendardvariable-dynamic-subset.css?v=28', 'assets/content-visuals.js?v=28', 'assets/content-visuals.css?v=28', 'assets/briefing-core.js?v=28', 'assets/briefings.js?v=28', 'assets/briefing-index.json', 'financial/', 'international/', 'sports/', 'health/', 'tech/', 'weather/', 'medical/', 'assets/icons/fin.svg', 'assets/icons/globe.svg', 'assets/icons/sport.svg', 'assets/icons/health.svg', 'assets/icons/tech.svg', 'assets/icons/weather.svg', 'assets/icons/sun.svg', 'assets/icons/cloud.svg', 'assets/icons/rain.svg', 'assets/icons/wind.svg', 'assets/icons/pm10.svg', 'assets/icons/pm25.svg'].map(path=>BASE+path);
// v3: medical/ stays in PRECACHE only (old links keep working; it is no longer listed). New category shells are required.
const REQUIRED = ['', 'index.html', 'financial/', 'international/', 'sports/', 'health/', 'tech/', 'weather/', 'assets/briefing-core.js?v=28', 'assets/briefings.js?v=28', 'assets/briefings.css?v=28', 'assets/fonts/pretendard/pretendardvariable-dynamic-subset.css?v=28', 'assets/content-visuals.js?v=28', 'assets/content-visuals.css?v=28'].map(path=>BASE+path);
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_VERSION);
    // An incomplete new renderer must never replace the working previous worker.
    await cache.addAll(REQUIRED.map(url=>new Request(new URL(url,self.location.origin),{cache:'reload'})));
    await Promise.all(PRECACHE.filter(url=>!REQUIRED.includes(url)).map(url=>cache.add(new Request(new URL(url,self.location.origin),{cache:'reload'})).catch(()=>{})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  // v27: 읽은 브리핑 본문(.md)은 이제 이 캐시만 오프라인 사본이다(앱이 localStorage 사본을 지움).
  // 그래서 옛 버전 캐시를 지우기 전에 본문만 새 캐시로 옮긴다(화면 파일은 새 버전으로 다시 받았으므로 옮기지 않음).
  const isArticle=url=>/\/briefings\/\d{4}-\d{2}-\d{2}[^/]*\.md$/.test(new URL(url).pathname);
  event.waitUntil(caches.keys().then(async keys=>{
    const old=keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_VERSION);
    const cur=await caches.open(CACHE_VERSION);
    for(const key of old){try{const c=await caches.open(key);for(const req of await c.keys()){if(!isArticle(req.url)||await cur.match(req))continue;const res=await c.match(req);if(res)await cur.put(req,res);}}catch{}}
    await Promise.all(old.map(key=>caches.delete(key)));
  }).catch(()=>{}).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  const own=url.origin===self.location.origin&&url.pathname.startsWith(BASE);
  const raw=url.origin==='https://raw.githubusercontent.com'&&url.pathname.startsWith('/bwkim1025/daily-briefings/main/');
  if(!own&&!raw)return;
  // Network-first also for JS, CSS, manifest, and icons: updated assets must not remain stale indefinitely.
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_VERSION).catch(()=>null);
    const read=async(key,options)=>cache?cache.match(key,options).catch(()=>undefined):undefined;
    try{
      const response=await fetch(request);
      if(response.ok&&cache)await cache.put(request,response.clone()).catch(()=>{});
      // An explicit 404 is not an offline response: don't resurrect a removed article.
      return response;
    }catch{
      const cached=await read(request,{ignoreSearch:request.mode==='navigate'});
      if(cached)return cached;
      if(request.mode==='navigate'){
        const path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
        const shell=await read(path)||await read(path.replace(/index\.html$/,''));
        if(shell)return shell;
        return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><title>오프라인</title><body><h1>연결을 확인해 주세요</h1><p>아직 저장되지 않은 화면입니다. 온라인에서 한 번 열어 주세요.</p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
      return new Response('',{status:503,statusText:'Offline'});
    }
  })());
});
