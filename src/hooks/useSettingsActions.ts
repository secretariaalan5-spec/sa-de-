import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppData } from './useAppData';
import { useServiceState } from './useServiceState';
import { toast } from 'sonner';

export function useSettingsActions() {
    const { resetData: resetEmultData, userId } = useAppData();
    const { updateServiceState } = useServiceState();

    const resetAllCloudData = useCallback(async () => {
        if (!userId) {
            toast.error('Você precisa estar logado para resetar os dados da nuvem.');
            return;
        }

        try {
            // 1. Reset eMult (AppData) local and trigger cloud update
            resetEmultData();

            // 2. Reset Service State cloud
            const emptyServiceState = { professionals: [], entries: [], requests: [] };

            const { error } = await (supabase
                .from('admin_states' as any)
                .upsert({
                    user_id: userId,
                    emult_state: {}, // Reset emult cloud
                    service_state: emptyServiceState,
                    updated_at: new Date().toISOString()
                }) as any);

            if (error) throw error;

            // 3. Update local service state to reflect change
            updateServiceState(() => emptyServiceState);

            toast.success('Todos os dados foram resetados na nuvem e localmente.');
        } catch (err) {
            console.error('Erro ao resetar dados:', err);
            toast.error('Erro ao resetar dados na nuvem.');
        }
    }, [userId, resetEmultData, updateServiceState]);

    return {
        resetAllCloudData
    };
}
