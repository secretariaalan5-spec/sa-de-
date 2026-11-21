import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = 'BBGLZRD35eG-gEMum5k69VTv0lQEo9euZUbvsHHyCzxpBbkrE-mYvCxCypoS2uynz7ZjHq7Xf-yhzM34p8RJCIM';
const RESYNC_INTERVAL_MS = 10 * 60 * 1000; // re-sincroniza no máx. a cada 10 min por aba

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

function bufToB64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Verifica se a inscrição existente foi criada com a NOSSA chave VAPID (inscrições antigas
 *  do OneSignal usam outra chave e o FCM rejeita com 403 → nunca chegam com o app fechado). */
function isSameVapidKey(sub: PushSubscription): boolean {
  const key = sub.options?.applicationServerKey;
  if (!key) return true; // navegador não expõe → assume ok
  return bufToB64Url(key as ArrayBuffer) === VAPID_PUBLIC_KEY;
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing) {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  return navigator.serviceWorker.ready;
}

// Evita várias chamadas simultâneas (Sino + Sync + Hook) criando corridas no pushManager
let inFlight: Promise<boolean> | null = null;
let lastSync: { userId: string; endpoint: string; at: number } | null = null;

/** No Windows PC, as notificações são exibidas exclusivamente pelo aplicativo Saúde+ Desktop.
 *  Bloqueamos e removemos qualquer inscrição Web Push do Google Chrome no Windows para nunca duplicar. */
function isWindowsDesktopEnv(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return false;
  return /Windows/i.test(ua);
}

async function disableWindowsBrowserPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg || !reg.pushManager) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try { await sub.unsubscribe(); } catch {}
      try { await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint); } catch {}
    }
  } catch {}
}

async function syncSubscription(userId: string, askPermission: boolean): Promise<boolean> {
  if (isWindowsDesktopEnv()) {
    await disableWindowsBrowserPush();
    return false;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }

  let perm = Notification.permission;
  if (perm === 'default' && askPermission) {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') return false;

  const registration = await getSwRegistration();
  let subscription = await registration.pushManager.getSubscription();

  // Inscrição de chave antiga (OneSignal) → recria com a chave correta
  if (subscription && !isSameVapidKey(subscription)) {
    try { await subscription.unsubscribe(); } catch { /* ignore */ }
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  if (
    lastSync &&
    lastSync.userId === userId &&
    lastSync.endpoint === subscription.endpoint &&
    Date.now() - lastSync.at < RESYNC_INTERVAL_MS
  ) {
    return true;
  }

  const rawKey = subscription.getKey('p256dh');
  const rawAuth = subscription.getKey('auth');
  if (!rawKey || !rawAuth) throw new Error('Chaves de criptografia não disponíveis');

  // Vincula ESTE aparelho à conta logada no momento
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: bufToB64Url(rawKey),
    auth_key: bufToB64Url(rawAuth),
  }, { onConflict: 'user_id,endpoint' });

  if (error) throw error;

  lastSync = { userId, endpoint: subscription.endpoint, at: Date.now() };
  return true;
}

export function usePushNotifications() {
  const { user } = useAuthContext();
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inscreve no Web Push e salva na tabela push_subscriptions.
  // (o 2º parâmetro é mantido só por compatibilidade; NUNCA cancelamos a inscrição,
  //  pois isso invalidava o token de outras contas usadas no mesmo navegador)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const registerPush = useCallback(async (userTriggered = false, _forceRenew = false) => {
    if (!user) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (userTriggered) toast.error('Seu navegador não suporta notificações Push.');
      return false;
    }

    try {
      if (userTriggered) setLoading(true);
      if (!inFlight) {
        inFlight = syncSubscription(user.id, true).finally(() => { inFlight = null; });
      }
      const ok = await inFlight;
      if ('Notification' in window) setPermission(Notification.permission);
      setIsSubscribed(ok);

      if (userTriggered) {
        if (ok) toast.success('Notificações ativadas! Você receberá alertas mesmo com o app fechado.');
        else toast.warning('Permissão de notificações não foi concedida no navegador.');
      }
      return ok;
    } catch (err: any) {
      console.warn('[Push] Falha ao registrar push:', err);
      if (userTriggered) toast.error('Erro ao ativar notificações: ' + (err?.message || 'Erro desconhecido'));
      return false;
    } finally {
      if (userTriggered) setLoading(false);
    }
  }, [user]);

  // Sincronização automática: ao logar/trocar de conta, ao voltar para a aba
  // e quando a permissão do navegador muda — sem nenhum botão.
  useEffect(() => {
    if (!user || typeof window === 'undefined' || !('Notification' in window)) return;

    const run = () => {
      if (Notification.permission === 'granted') registerPush(false);
    };
    run();

    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);

    let permStatus: PermissionStatus | null = null;
    const onPermChange = () => {
      setPermission(Notification.permission);
      run();
    };
    navigator.permissions?.query({ name: 'notifications' as PermissionName })
      .then((s) => { permStatus = s; s.addEventListener('change', onPermChange); })
      .catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      permStatus?.removeEventListener('change', onPermChange);
    };
  }, [user, registerPush]);

  // Send a local notification via Service Worker
  const showLocalPush = useCallback(async (title: string, body: string, url?: string) => {
    if (isWindowsDesktopEnv()) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      let reg = swRegistration.current || await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        reg = await navigator.serviceWorker.ready;
      }
      await reg.showNotification(title || 'Saúde+', {
        body: body || 'Nova notificação',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: url || '/' },
        tag: 'saude-alert-latest',
        renotify: true,
        requireInteraction: true,
      } as NotificationOptions);
    } catch (e) {
      console.error('[Push] Error showing local notification:', e);
    }
  }, []);

  return { showLocalPush, registerPush, permission, isSubscribed, loading, swRegistration };
}
