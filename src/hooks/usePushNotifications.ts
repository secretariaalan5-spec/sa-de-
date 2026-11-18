import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inscreve no Web Push e salva na tabela push_subscriptions
  const registerPush = useCallback(async (userTriggered = false, forceRenew = false) => {
    if (!user) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (userTriggered) {
        toast.error('Seu navegador não suporta notificações Push.');
      }
      return false;
    }

    try {
      setLoading(true);

      // Garante registro do Service Worker
      let registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      swRegistration.current = registration;

      // Pede permissão se foi acionado pelo usuário ou se ainda é default
      let currentPerm = Notification.permission;
      if (userTriggered || currentPerm === 'default') {
        currentPerm = await Notification.requestPermission();
        setPermission(currentPerm);
      }

      if (currentPerm !== 'granted') {
        if (userTriggered) {
          toast.warning('Permissão de notificações não foi concedida no navegador.');
        }
        return false;
      }

      // Obtém assinatura de push existente
      let subscription = await registration.pushManager.getSubscription();

      // Se forçar renovação ou se não houver assinatura, recria
      if (forceRenew && subscription) {
        try {
          await subscription.unsubscribe();
        } catch { /* ignore */ }
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const rawKey = subscription.getKey('p256dh');
      const rawAuth = subscription.getKey('auth');
      if (!rawKey || !rawAuth) {
        throw new Error('Chaves de criptografia não disponíveis');
      }

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const authKey = btoa(String.fromCharCode(...new Uint8Array(rawAuth)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Salva no banco de dados na tabela push_subscriptions
      const { error: upsertErr } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth_key: authKey,
      }, {
        onConflict: 'user_id,endpoint',
      });

      if (upsertErr) {
        console.error('[Push] Erro ao salvar subscrição no banco:', upsertErr);
        throw upsertErr;
      }

      setIsSubscribed(true);
      if (userTriggered) {
        toast.success('Notificações no aparelho ativadas com sucesso! Você receberá alertas mesmo com o app fechado.');
      }
      return true;
    } catch (err: any) {
      console.warn('[Push] Falha ao registrar push:', err);
      if (userTriggered) {
        toast.error('Erro ao ativar notificações: ' + (err.message || 'Erro desconhecido'));
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Se a permissão já estiver concedida, sincroniza a assinatura automaticamente em segundo plano
  useEffect(() => {
    if (user && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      registerPush(false);
    }
  }, [user, registerPush]);

  // Dispara uma notificação de teste real pelo servidor Web Push (para testar no Windows/celular)
  const testPushNotification = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Garante que o push está registrado e renovado neste navegador
      await registerPush(false, true);

      // Invoca a Edge Function de envio de push
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          user_id: user.id,
          title: '🔔 Notificação de Teste - Saúde+',
          message: 'Seu computador está configurado para receber notificações do Saúde+ no Windows!',
          url: '/folgas',
        },
      });

      if (error) {
        toast.error('Erro ao enviar teste: ' + error.message);
        return;
      }

      if (data?.sent && data.sent > 0) {
        toast.success('Notificação nativa enviada ao Windows! Verifique o canto inferior direito da tela.');
      } else {
        toast.warning('Disparo enviado, mas nenhum dispositivo ativo confirmou a entrega.');
      }
    } catch (err: any) {
      toast.error('Falha no teste: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, [user, registerPush]);

  // Send a local notification via Service Worker
  const showLocalPush = useCallback(async (title: string, body: string, url?: string) => {
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
        vibrate: [200, 100, 200],
        tag: 'saude-local-' + Date.now(),
        renotify: true,
        requireInteraction: true, // Notificação persistente até o usuário fechar
      });
    } catch (e) {
      console.error('[Push] Error showing local notification:', e);
    }
  }, []);

  return { showLocalPush, registerPush, testPushNotification, permission, isSubscribed, loading, swRegistration };
}
