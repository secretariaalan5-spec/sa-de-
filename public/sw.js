const CACHE_NAME = 'saude-plus-v6-push';
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

    // SPA navigation fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
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

// =========================================
// PUSH NOTIFICATIONS
// =========================================

// Handle push events from server
self.addEventListener('push', (event) => {
    let data = { title: 'Saúde+', body: 'Nova notificação', icon: '/icon-192.png', url: '/' };

    if (event.data) {
        try {
            const json = event.data.json();
            data.title = json.title || json.headings?.en || data.title;
            data.body = json.body || json.alert || json.message || json.contents?.en || data.body;
            data.url = json.data?.url || json.url || data.url;
        } catch (e) {
            try { data.body = event.data.text(); } catch (e2) { /* ignore */ }
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: { url: data.url },
            vibrate: [200, 100, 200],
            tag: 'saude-plus-' + Date.now(),
            renotify: true,
            requireInteraction: false,
            silent: false,
        })
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            // Focus existing window or open new one
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});

// Handle messages from the main app (for showing local push when app is in background)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, url } = event.data;
        self.registration.showNotification(title || 'Saúde+', {
            body: body || 'Nova notificação',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: { url: url || '/' },
            vibrate: [200, 100, 200],
            tag: 'saude-local-' + Date.now(),
            renotify: true,
        });
    }
});
