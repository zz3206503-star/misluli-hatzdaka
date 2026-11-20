// Network-first service worker: online visitors receive the latest deployed files.
const VERSION='maslul-live-auto-20261120-v5';
const FILES=['./','./index.html','./browser-link.html','./styles.css','./app.js','./i18n.js','./places.json','./manifest.webmanifest','./icon-64.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('maslul-live-')||key.startsWith('tzedaka-live-'))&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  try{
   const fresh=await fetch(request,{cache:'no-store'});
   if(fresh.ok)cache.put(request,fresh.clone()).catch(()=>{});
   return fresh;
  }catch(err){
   const cached=await cache.match(request,{ignoreSearch:request.mode==='navigate'});
   if(cached)return cached;
   if(request.mode==='navigate'){
    const home=await cache.match('./index.html');if(home)return home;
   }
   throw err;
  }
 })());
});
