// ═══════════════════════════════════════════════════════════════════════════
// Saúde+ — Service Worker v7 (Offline-First)
// ═══════════════════════════════════════════════════════════════════════════
//
// Estratégias de cache por tipo de recurso:
//
// ┌─────────────────────────────┬──────────────────────────────────────────┐
// │ Recurso                     │ Estratégia                               │
// ├─────────────────────────────┼──────────────────────────────────────────┤
// │ JS / CSS / Fonts (assets/)  │ Cache First → serve do cache; atualiza   │
// │                             │ em background (stale-while-revalidate)   │
// ├─────────────────────────────┼──────────────────────────────────────────┤
// │ Imagens / ícones            │ Cache First → TTL 7 dias                 │
// ├─────────────────────────────┼──────────────────────────────────────────┤
// │ Navegação SPA (HTML)        │ Network First → fallback para cache/     │
// │                             │ offline.html se sem internet             │
// ├─────────────────────────────┼──────────────────────────────────────────┤
// │ API Supabase / Auth / WS    │ Network Only (nunca cacheia — seguro)    │
// ├─────────────────────────────┼──────────────────────────────────────────┤
// │ Fontes Google               │ Cache First → TTL 30 dias                │
// └─────────────────────────────┴──────────────────────────────────────────┘
//
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v15';
const SHELL_CACHE   = `saude-shell-${CACHE_VERSION}`;
const ASSETS_CACHE  = `saude-assets-${CACHE_VERSION}`;
const IMAGE_CACHE   = `saude-images-${CACHE_VERSION}`;
const FONT_CACHE    = `saude-fonts-${CACHE_VERSION}`;

// Recursos críticos do shell — sempre em cache
const SHELL_ASSETS = [
    '/',
    '/manifest.json',
    '/favicon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/logo-saude.png',
    '/logo-saude-emblem.png',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => {
            // addAll falha silenciosamente em itens individuais
            return Promise.allSettled(
                SHELL_ASSETS.map(url => cache.add(url).catch(() => {}))
            );
        })
    );
});

// ─── ACTIVATE (limpa caches antigas) ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
    const validCaches = [SHELL_CACHE, ASSETS_CACHE, IMAGE_CACHE, FONT_CACHE];
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((name) => !validCaches.includes(name))
                    .map((name) => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica se a resposta é válida para cachear */
function isValidResponse(response) {
    return response && response.status === 200 && response.type !== 'error';
}

/** Cache First: serve do cache; se não houver, busca na rede e cacheia */
async function cacheFirst(request, cacheName, ttlDays = 7) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
        // Revalida em background (stale-while-revalidate)
        fetch(request).then((response) => {
            if (isValidResponse(response)) cache.put(request, response);
        }).catch(() => {});
        return cached;
    }

    try {
        const response = await fetch(request);
        if (isValidResponse(response)) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('', { status: 503, statusText: 'Offline' });
    }
}

/** Network First: tenta rede; fallback para cache se offline */
async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);

    try {
        const response = await fetch(request);
        if (isValidResponse(response)) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;

        // Fallback: serve a raiz "/" para navegação SPA
        const root = await cache.match('/');
        if (root) return root;

        return new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sem conexão — Saúde+</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f4f8;color:#334155}div{text-align:center;padding:2rem}h1{font-size:1.5rem;font-weight:700;color:#1a56db}p{color:#64748b;margin:.5rem 0}button{margin-top:1.5rem;padding:.75rem 2rem;background:#1a56db;color:white;border:none;border-radius:9999px;font-size:1rem;font-weight:600;cursor:pointer}</style></head><body><div><h1>📡 Sem conexão</h1><p>O Saúde+ não consegue conectar agora.</p><p>Verifique sua internet e tente novamente.</p><button onclick="location.reload()">Tentar novamente</button></div></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const { method } = event.request;

    // ── 1. Apenas GET é cacheável ──────────────────────────────────────────
    if (method !== 'GET') return;

    // ── 2. Network Only: Supabase API, Auth, WebSocket ─────────────────────
    if (
        url.hostname.includes('supabase.co') ||
        url.pathname.includes('/~oauth') ||
        url.hostname.includes('onesignal') ||
        url.protocol === 'chrome-extension:'
    ) {
        return; // deixa o browser tratar normalmente
    }

    // ── 3. Google Fonts — Cache First, 30 dias ─────────────────────────────
    if (url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(cacheFirst(event.request, FONT_CACHE, 30));
        return;
    }

    // ── 4. Assets JS/CSS (Vite gera hashes únicos — Cache First é seguro) ──
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(cacheFirst(event.request, ASSETS_CACHE, 30));
        return;
    }

    // ── 5. Imagens e ícones — Cache First, 7 dias ──────────────────────────
    if (
        url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|gif)$/)
    ) {
        event.respondWith(cacheFirst(event.request, IMAGE_CACHE, 7));
        return;
    }

    // ── 6. Navegação SPA (HTML) — Network First com fallback offline ────────
    if (event.request.mode === 'navigate' ||
        event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirst(event.request, SHELL_CACHE));
        return;
    }

    // ── 7. Demais requests — Network First ─────────────────────────────────
    event.respondWith(networkFirst(event.request, SHELL_CACHE));
});

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
    // No Windows PC, quem notifica é exclusivamente o aplicativo Saúde+ Desktop.
    // Bloqueia notificações do Google Chrome no Windows e cancela a inscrição antiga do navegador.
    const ua = (self.navigator && self.navigator.userAgent) || '';
    const isWindowsPC = /Windows/i.test(ua) && !/Android|iPhone|iPad|iPod/i.test(ua);
    if (isWindowsPC) {
        event.waitUntil(
            self.registration.pushManager.getSubscription()
                .then((sub) => (sub ? sub.unsubscribe() : null))
                .catch(() => {})
        );
        return;
    }

    let data = { title: 'Saúde+', body: 'Nova notificação', icon: '/icon-192.png', url: '/' };

    if (event.data) {
        try {
            const json = event.data.json();
            data.title = json.title || json.headings?.en || data.title;
            data.body = json.body || json.alert || json.message || json.contents?.en || data.body;
            data.url = json.data?.url || json.url || data.url;
            data.tag = 'saude-plus-latest';
        } catch (e) {
            try { data.body = event.data.text(); } catch { /* ignore */ }
        }
    }

    // Mostra SEMPRE e IMEDIATAMENTE a notificação nativa (único estilo do sistema).
    // Usa tag fixa 'saude-plus-latest' para substituir o card anterior sem empilhar vários avisos antigos.
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: { url: data.url },
            vibrate: [200, 100, 200],
            tag: 'saude-plus-latest',
            renotify: true,
            requireInteraction: true, // Fica fixa na tela até o usuário interagir ou fechar no X
            silent: false,
        })
    );
});

// O navegador pode trocar o token de push a qualquer momento (expiração/rotação do FCM).
// Sem isso, o app parava de receber notificações com o sistema fechado até ser reaberto.
const SUPABASE_URL = 'https://qxpqzbswtdfatdrtqhrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cHF6YnN3dGRmYXRkcnRxaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzYwMjgsImV4cCI6MjA4NTk1MjAyOH0.BYsaBZE_3_doVSbO8D2rF4USqbZ-9_vr4dR-ILjyVlk';
const VAPID_PUBLIC_KEY = 'BBGLZRD35eG-gEMum5k69VTv0lQEo9euZUbvsHHyCzxpBbkrE-mYvCxCypoS2uynz7ZjHq7Xf-yhzM34p8RJCIM';

function b64UrlToUint8(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function bufToB64Url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil((async () => {
        try {
            const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
            const newSub = event.newSubscription || await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: b64UrlToUint8(VAPID_PUBLIC_KEY),
            });
            if (!oldEndpoint || !newSub) return;
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/rotate_push_subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    p_old_endpoint: oldEndpoint,
                    p_new_endpoint: newSub.endpoint,
                    p_p256dh: bufToB64Url(newSub.getKey('p256dh')),
                    p_auth_key: bufToB64Url(newSub.getKey('auth')),
                }),
            });
        } catch (e) {
            // Será sincronizado na próxima abertura do app
        }
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const rawUrl = event.notification.data?.url || '/';
    const urlWithFlag = rawUrl.includes('?') ? `${rawUrl}&from_notif=1` : `${rawUrl}?from_notif=1`;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.postMessage({ type: 'SAUDE_NOTIFICATION_CLICKED', route: rawUrl });
                    client.navigate(urlWithFlag).catch(() => {});
                    return client.focus();
                }
            }
            return self.clients.openWindow(urlWithFlag);
        })
    );
});

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
            requireInteraction: true, // Fica fixa até clicar ou fechar
        });
    }
});
