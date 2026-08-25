const CACHE='oficin-ia-v26-18-0-frotista-20260825';
const ASSETS=[
  './checklist.html','./js/checklist.js','./js/config.js','./data/checklist-model.json',
  './checklist.webmanifest','./assets/icons/checklist-192.png','./assets/icons/checklist-512.png'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS).catch(()=>null)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('oficin-ia-')&&k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  const isFreshCode = req.mode==='navigate' || /\.(?:html?|js|css|json|webmanifest)$/i.test(url.pathname);
  if(isFreshCode){
    event.respondWith(fetch(req).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
      return res;
    }).catch(()=>caches.match(req).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))));
    return;
  }

  event.respondWith(caches.match(req).then(cached=>{
    const network=fetch(req).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
      return res;
    }).catch(()=>cached);
    return cached||network;
  }));
});
