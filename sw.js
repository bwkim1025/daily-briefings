// Daily Briefings only: Cache Storage is shared by all GitHub Pages apps on this origin.
const CACHE_PREFIX = 'daily-briefings-';
const CACHE_VERSION = CACHE_PREFIX + 'v9';
const BASE = new URL(self.registration.scope).pathname;
const PRECACHE = ['', 'index.html', 'manifest.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'assets/briefings.css?v=9', 'assets/content-visuals.js?v=9', 'assets/content-visuals.css?v=9', 'assets/briefing-core.js?v=9', 'assets/briefings.js?v=9', 'assets/briefing-index.json', 'financial/', 'international/', 'medical/', 'health/'].map(path=>BASE+path);
const REQUIRED = ['', 'index.html', 'financial/', 'international/', 'medical/', 'health/', 'assets/briefing-core.js?v=9', 'assets/briefings.js?v=9', 'assets/briefings.css?v=9', 'assets/content-visuals.js?v=9', 'assets/content-visuals.css?v=9'].map(path=>BASE+path);
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
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_VERSION).map(key=>caches.delete(key)))).catch(()=>{}).then(()=>self.clients.claim()));
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
