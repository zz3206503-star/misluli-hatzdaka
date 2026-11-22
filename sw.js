// Network-first service worker: online visitors receive the latest deployed files.
const VERSION='maslul-live-auto-20261122-v10';
const FILES=['./','./index.html','./browser-link.html','./styles.css','./app.js','./i18n.js','./places.json','./manifest.webmanifest','./icon-64.png','./icon-192.png','./icon-512.png','./comparison.html','./review/','./review/index.html','./review/style.css','./review/ui.js','./review/data.js','./review/photos/1.webp','./review/photos/10.webp','./review/photos/11.webp','./review/photos/12.webp','./review/photos/13.webp','./review/photos/14.webp','./review/photos/15.webp','./review/photos/16.webp','./review/photos/17.webp','./review/photos/18.webp','./review/photos/19.webp','./review/photos/2.webp','./review/photos/20.webp','./review/photos/21.webp','./review/photos/22.webp','./review/photos/23.webp','./review/photos/24.webp','./review/photos/25.webp','./review/photos/26.webp','./review/photos/27.webp','./review/photos/28.webp','./review/photos/29.webp','./review/photos/3.webp','./review/photos/30.webp','./review/photos/31.webp','./review/photos/32.webp','./review/photos/33.webp','./review/photos/34.webp','./review/photos/35.webp','./review/photos/36.webp','./review/photos/37.webp','./review/photos/38.webp','./review/photos/39.webp','./review/photos/4.webp','./review/photos/40.webp','./review/photos/41.webp','./review/photos/42.webp','./review/photos/43.webp','./review/photos/44.webp','./review/photos/5.webp','./review/photos/6.webp','./review/photos/7.webp','./review/photos/8.webp','./review/photos/9.webp'];
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
   const cached=await cache.match(request,{ignoreSearch:true});
   if(cached)return cached;
   if(request.mode==='navigate'){
    const home=await cache.match('./index.html');if(home)return home;
   }
   throw err;
  }
 })());
});
