/* Gate-to-Gate – Offline-Zwischenspeicher für den Coach-Link
   Seite und Coach-Daten werden beim Öffnen gespeichert. Im Funkloch lädt der zuletzt
   gesehene Stand. Immer zuerst Netz (aktuellster Stand), nur bei Ausfall der Speicher.
   Videos werden NICHT hier gespeichert (zu gross / Streaming) – siehe «Videos offline» in der App. */
const CACHE='gtg-offline-v1';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil((async()=>{
  const keys=await caches.keys(); await Promise.all(keys.filter(k=>k.startsWith('gtg-offline-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim(); })()); });
function cacheable(req){ const u=new URL(req.url);
  if(req.method!=='GET' || u.origin!==self.location.origin) return false;
  if(req.mode==='navigate') return true;                                   // die App selbst (index.html)
  return /\/coach\/[^\/]+\.json$/.test(u.pathname) || /\/(og-image|icon-\d+)\.png$/.test(u.pathname) || /\/version\.json$/.test(u.pathname); }
function keyOf(req){ const u=new URL(req.url); return req.mode==='navigate' ? u.origin+u.pathname : u.origin+u.pathname; }   // ohne ?t=… / ?coach=…
self.addEventListener('fetch', e=>{ const req=e.request; if(!cacheable(req)) return;
  e.respondWith((async()=>{ const cache=await caches.open(CACHE), key=keyOf(req);
    try{ const res=await fetch(req); if(res && res.ok){ try{ await cache.put(key, res.clone()); }catch(_){} } return res; }
    catch(err){ const hit=await cache.match(key); if(hit) return hit; throw err; } })()); });
