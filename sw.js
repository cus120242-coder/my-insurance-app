// 인터넷이 없어도 앱이 열리게 해 주는 도우미 (서비스 워커)
// 앱 파일만 기기에 보관해요. 보험 정보는 여기서 다루지 않고, 밖으로 보내지도 않아요.
// 앱 파일을 고치면 아래 숫자(v)를 index.html의 ?v= 숫자와 같이 올려요.
const CACHE = "app-v36";
const FILES = [
  "./", "./index.html", "./theme.js?v=35", "./privacy.html", "./styles.css?v=35",
  "./kcd.js?v=35", "./engine.js?v=35", "./sample-data.js?v=35", "./templates.js?v=35", "./avatars.js?v=35", "./app.js?v=35",
  "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 인터넷이 되면 새 파일, 안 되면 보관해 둔 파일
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-cache" }) // 브라우저에 남은 옛 파일 말고 늘 새 파일 확인
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }))
  );
});
