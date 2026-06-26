const CACHE_NAME = 'zombie-rts-v4';

const NETWORK_FIRST_EXTENSIONS = ['.json', '.wasm'];
const STALE_WHILE_REVALIDATE_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.glb',
    '.mp3', '.ogg', '.wav',
];

function classify(url) {
    let path = new URL(url).pathname;
    // TICKET-165 Phase 1: pre-compressed brotli siblings (`foo.glb.br`,
    // `foo.json.br`) follow the same caching strategy as their source files.
    if (path.endsWith('.br')) path = path.slice(0, -3);
    if (NETWORK_FIRST_EXTENSIONS.some(ext => path.endsWith(ext))) return 'network-first';
    if (STALE_WHILE_REVALIDATE_EXTENSIONS.some(ext => path.endsWith(ext))) return 'swr';
    return 'passthrough';
}

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const strategy = classify(event.request.url);
    if (strategy === 'passthrough') return;

    if (strategy === 'network-first') {
        // `cache: 'reload'` tells the browser to bypass its own HTTP cache
        // and round-trip to the server. Without this, the SW would treat a
        // browser-cached response as fresh and store stale wasm/json in
        // CACHE_NAME — players keep loading the previous build.
        event.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                fetch(event.request, { cache: 'reload' }).then(response => {
                    if (response.ok) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                }).catch(() => cache.match(event.request))
            )
        );
        return;
    }

    // stale-while-revalidate for static media. Use `cache: 'no-cache'` so the
    // background revalidation actually re-checks the server (with If-None-Match
    // / If-Modified-Since) instead of trusting the browser's HTTP cache.
    event.respondWith(
        caches.open(CACHE_NAME).then(cache =>
            cache.match(event.request).then(cached => {
                const networkFetch = fetch(event.request, { cache: 'no-cache' }).then(response => {
                    if (response.ok) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                });
                return cached || networkFetch;
            })
        )
    );
});
