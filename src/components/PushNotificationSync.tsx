import { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PushNotificationSync() {
  const { user } = useAuthContext();
  const { registerPush, permission } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const registeredUserIdRef = useRef<string | null>(null);

  // Sincronização automática para usuários que já concederam permissão no navegador (apenas Mobile/Mac, no Windows usa o App Desktop)
  useEffect(() => {
    if (!user || typeof window === 'undefined' || !('Notification' in window)) return;
    const ua = navigator.userAgent || '';
    if (/Windows/i.test(ua) && !/Android|iPhone|iPad|iPod/i.test(ua)) {
      registerPush(false, false);
      return;
    }

    // Garante que, ao trocar de usuário ou recarregar, o usuário atual seja registrado
    if (registeredUserIdRef.current !== user.id) {
      registeredUserIdRef.current = user.id;

      if (Notification.permission === 'granted') {
        registerPush(false, false);
      } else if (Notification.permission === 'default') {
        // Se a permissão ainda é default, aguarda 2s e sugere ativar
        const dismissedKey = `push_prompt_dismissed_${user.id}`;
        const isDismissed = localStorage.getItem(dismissedKey);
        if (!isDismissed) {
          const timer = setTimeout(() => setShowPrompt(true), 2000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [user, registerPush]);

  // Navegadores (principalmente iPhone/Safari) exigem um gesto do usuário para pedir permissão.
  // No primeiro clique/toque em qualquer lugar do sistema, pedimos e já registramos o aparelho.
  useEffect(() => {
    if (!user || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    const onFirstInteraction = () => {
      window.removeEventListener('pointerdown', onFirstInteraction);
      if (Notification.permission === 'default') {
        setShowPrompt(false);
        registerPush(false);
      }
    };
    window.addEventListener('pointerdown', onFirstInteraction, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstInteraction);
  }, [user, registerPush]);

  const handleEnable = async () => {
    setShowPrompt(false);
    await registerPush(true, false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (user) {
      localStorage.setItem(`push_prompt_dismissed_${user.id}`, 'true');
    }
  };

  if (!showPrompt || permission !== 'default') return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Bell size={16} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight truncate">Receber avisos com app fechado?</p>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5 truncate">
              Notificações de novas escalas e folgas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleEnable}
            className="h-7 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
          >
            Ativar
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Agora não"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
