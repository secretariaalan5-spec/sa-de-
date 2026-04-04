import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';

/**
 * Hook flexível e à prova de "Infinite Loops" (tela branca) para recarregar dados
 * sempre que o Supabase acionar uma atualização em realtime em qualquer tabela.
 */
export function useDataSubscription(tables: string[], onUpdate: (payload?: any) => void) {
  // Salva o onUpdate mais recente em um ref fixo
  // Isso impede que useEffect entre em loop infinito caso
  // o desenvolvedor se esqueça de usar useCallback na função de 'load'.
  const savedCallback = useRef(onUpdate);

  useEffect(() => {
    savedCallback.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    // Inicia ouvindo cada tabela listada via WebSocket
    const channels = tables.map(table => {
      return supabase.channel(`public:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            savedCallback.current(payload);
          }
        )
        .subscribe();
    });

    // Fallback Discreto: Atualização forçada a cada 2 segundos (se a aba estiver ativa)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(',')]);
}
