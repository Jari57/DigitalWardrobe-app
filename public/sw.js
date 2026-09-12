// Deliberately network-only for customer content. Never cache app HTML or APIs.
const CACHE='wardrobe-public-v1';
const PUBLIC=['/offline.html','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('wardrobe-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>await caches.match('/offline.html')||Response.error()));return;
  }
  if(PUBLIC.includes(url.pathname)&&!url.search)event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
