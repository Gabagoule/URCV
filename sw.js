/* =====================================================================
   sw.js — fonctionnement hors-ligne (sous-sol, réseau capricieux)
   Stratégie « réseau d'abord » : en ligne, on prend toujours la dernière
   version publiée sur GitHub ; si le réseau ne répond pas en 3 s ou est
   coupé, on sert la copie gardée en cache.
   Tout fichier chargé une fois est mis en cache automatiquement, donc un
   nouveau protocole est disponible hors-ligne après une première ouverture.
   ===================================================================== */
const CACHE = "urcv-protocoles-v2";
const BASE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./protocoles/ilc.js",
  "./protocoles/bilan_vasc.js",
  "./protocoles/scores.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(BASE.map(u => c.add(u))))   // un fichier manquant ne bloque pas l'installation
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(reseauDabord(req));
});

async function reseauDabord(req) {
  const cache = await caches.open(CACHE);
  const reseau = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  const delai = new Promise(r => setTimeout(r, 3000, null));
  const premier = await Promise.race([reseau.catch(() => null), delai]);
  if (premier) return premier;
  const copie = await cache.match(req, { ignoreSearch: true });
  return copie || reseau;   // pas de copie : on attend quand même le réseau
}
