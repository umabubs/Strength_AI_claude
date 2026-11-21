// My Strength AI service worker: keeps the app working offline.
// It only touches its own caches (names starting "strength-ai-"), so it never clears Strength Log's.
const VERSION="strength-ai-v0-1";
const PRECACHE=[
 "./",
 "index.html",
 "manifest.webmanifest",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/apple-touch-icon.png",
 "img/ab_roller.webp",
 "img/ankle.webp",
 "img/back_squat.webp",
 "img/bear.webp",
 "img/bench_press.webp",
 "img/biceps_curl.webp",
 "img/bike.webp",
 "img/birddog.webp",
 "img/bulgarian_split_squat.webp",
 "img/cable_crunch.webp",
 "img/catcow.webp",
 "img/chestdoor.webp",
 "img/child.webp",
 "img/db_overhead_press.webp",
 "img/face_pull.webp",
 "img/gbhold.webp",
 "img/hamstr.webp",
 "img/hbss.webp",
 "img/hip9090.webp",
 "img/hip_thrust.webp",
 "img/hipflex.webp",
 "img/hollow.webp",
 "img/hplank.webp",
 "img/hpush.webp",
 "img/hsquat.webp",
 "img/incline_db_press.webp",
 "img/lat_pulldown.webp",
 "img/lateral_raise.webp",
 "img/leg_curl.webp",
 "img/leg_extension.webp",
 "img/leg_press.webp",
 "img/oh_triceps_ext.webp",
 "img/one_arm_row.webp",
 "img/pallof_press.webp",
 "img/pigeon.webp",
 "img/plank.webp",
 "img/pull_up.webp",
 "img/push_up.webp",
 "img/rdl.webp",
 "img/reverse_lunge.webp",
 "img/rope_pushdown.webp",
 "img/seated_cable_row.webp",
 "img/seated_calf_raise.webp",
 "img/shcirc.webp",
 "img/slgb.webp",
 "img/splank.webp",
 "img/standing_calf_raise.webp",
 "img/superman.webp",
 "img/treadmill.webp",
 "img/wallsit.webp",
 "img/wgs.webp"
];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("strength-ai-")&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==location.origin&&!url.hostname.endsWith("gstatic.com")&&!url.hostname.endsWith("googleapis.com"))return; // recognition requests go straight to the network
  if(req.mode==="navigate"){e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(VERSION).then(x=>x.put("index.html",c));return r}).catch(()=>caches.open(VERSION).then(x=>x.match("index.html"))));return}
  e.respondWith(caches.open(VERSION).then(x=>x.match(req)).then(hit=>hit||fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(VERSION).then(x=>x.put(req,c))}return r})));
});
