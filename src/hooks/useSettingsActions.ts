/**
 * Hook com ações de configuração que afetam dados globais (eMult + Serviços).
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAppData } from './useAppData';
import { useServiceState } from './useServiceState';
import { toast } from 'sonner';

export function useSettingsActions() {
    const { resetData: resetEmultData, userId } = useAppData();
    const { updateServiceState } = useServiceState();

    /**
     * Apaga todos os dados do usuário — local e na nuvem —
     * tanto os dados eMult quanto os de escalas de serviço.
     */
    const resetAllCloudData = useCallback(async () => {
        if (!userId) {
            toast.error('Você precisa estar logado para resetar os dados da nuvem.');
            return;
        }

        try {
            // 1. Reseta dados eMult localmente (o hook cuida de sincronizar com a nuvem)
            resetEmultData();

            // 2. Persiste o estado de serviços vazio diretamente na nuvem
            const emptyServiceState = { professionals: [], entries: [], requests: [] };

            const { error } = await (supabase
                .from('admin_states' as any)
                .upsert({
                    user_id: userId,
                    emult_state: {},
                    service_state: emptyServiceState,
                    updated_at: new Date().toISOString(),
                }) as any);

            if (error) throw error;

            // 3. Atualiza o estado local de serviços para refletir o reset
            updateServiceState(() => emptyServiceState);

            toast.success('Todos os dados foram resetados na nuvem e localmente.');
        } catch (err) {
            console.error('Erro ao resetar dados:', err);
            toast.error('Erro ao resetar dados na nuvem.');
        }
    }, [userId, resetEmultData, updateServiceState]);

    return { resetAllCloudData };
}
