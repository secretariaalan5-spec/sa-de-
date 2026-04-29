import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';

const VAPID_PUBLIC_KEY = 'BBGLZRD35eG-gEMum5k69VTv0lQEo9euZUbvsHHyCzxpBbkrE-mYvCxCypoS2uynz7ZjHq7Xf-yhzM34p8RJCIM';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuthContext();
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);
  const subscribed = useRef(false);

  // Register SW and subscribe to push
  const registerPush = useCallback(async () => {
    if (!user || subscribed.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      // Wait for SW registration
      const registration = await navigator.serviceWorker.ready;
      swRegistration.current = registration;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Subscribe to push
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      // Extract keys
      const rawKey = subscription.getKey('p256dh');
      const rawAuth = subscription.getKey('auth');
      if (!rawKey || !rawAuth) return;

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const authKey = btoa(String.fromCharCode(...new Uint8Array(rawAuth)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Save to Supabase (upsert to avoid duplicates)
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth_key: authKey,
      }, {
        onConflict: 'user_id,endpoint',
      });

      subscribed.current = true;
      console.log('[Push] Subscription saved successfully');
    } catch (err) {
      console.warn('[Push] Failed to register:', err);
    }
  }, [user]);

  // Send a local notification via Service Worker
  const showLocalPush = useCallback(async (title: string, body: string, url?: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || 'Saúde+', {
        body: body || 'Nova notificação',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: url || '/' },
        vibrate: [200, 100, 200],
        tag: 'saude-local-' + Date.now(),
        renotify: true,
      });
    } catch (e) {
      console.error('[Push] Error showing local notification:', e);
    }
  }, []);

  useEffect(() => {
    registerPush();
  }, [registerPush]);

  return { showLocalPush, swRegistration };
}
