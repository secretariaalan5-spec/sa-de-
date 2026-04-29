import { useState, useEffect } from 'react';

/**
 * useNetworkStatus
 * ──────────────────────────────────────────────────────────────────────────────
 * Detecta o status de conexão do dispositivo em tempo real.
 * - isOnline: true/false (online/offline)
 * - connectionType: tipo de conexão ('4g', '3g', '2g', 'slow-2g', 'unknown')
 * - isSlowConnection: true se a conexão for 2g ou slow-2g
 */

type ConnectionType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

interface NetworkStatus {
  isOnline: boolean;
  connectionType: ConnectionType;
  isSlowConnection: boolean;
}

// Helper para ler o tipo de conexão da Network Information API (quando disponível)
function getConnectionType(): ConnectionType {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
    mozConnection?: { effectiveType?: string };
    webkitConnection?: { effectiveType?: string };
  };

  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const type = conn?.effectiveType;

  if (type === '4g') return '4g';
  if (type === '3g') return '3g';
  if (type === '2g') return '2g';
  if (type === 'slow-2g') return 'slow-2g';
  return 'unknown';
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [connectionType, setConnectionType] = useState<ConnectionType>(getConnectionType);

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleChange  = () => setConnectionType(getConnectionType());

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API (disponível no Chrome/Android)
    const nav = navigator as Navigator & {
      connection?: EventTarget;
    };
    nav.connection?.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      nav.connection?.removeEventListener('change', handleChange);
    };
  }, []);

  const isSlowConnection = connectionType === '2g' || connectionType === 'slow-2g';

  return { isOnline, connectionType, isSlowConnection };
}
