const CACHE_NAME = 'saude-plus-v4';
const ASSETS_TO_CACHE = [
    '/',
    '/manifest.json',
    '/favicon.png',
    '/icon-192.png',
    '/icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache OAuth, Supabase, or OneSignal requests
    if (
        url.pathname.includes('/~oauth') ||
        url.hostname.includes('supabase') ||
        url.hostname.includes('onesignal') ||
        event.request.method !== 'GET'
    ) {
        return;
    }

    // SPA navigation fallback: always serve index.html for navigation requests
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // If we got a 404 for a navigation request, serve index.html instead
                    if (response.status === 404) {
                        return fetch('/');
                    }
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match('/') || new Response('Offline', { status: 503 });
                })
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Handle push events (from OneSignal or direct)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
        const data = event.data.json();
        const title = data.title || data.headings?.en || 'Saúde+';
        const body = data.alert || data.contents?.en || 'Nova atualização';
        const icon = '/icon-192.png';
        const badge = '/icon-192.png';

        event.waitUntil(
            self.registration.showNotification(title, {
                body,
                icon,
                badge,
                data: data.custom || data.data || {},
                vibrate: [200, 100, 200],
                tag: 'saude-plus-notification',
                renotify: true,
            })
        );
    } catch (e) {
        // Silent fail for non-JSON push
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
