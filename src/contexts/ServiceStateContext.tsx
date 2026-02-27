import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ServiceProfessional, ServiceScheduleEntry, LeaveRequest } from '@/types/serviceSchedule';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface ServiceState {
    professionals: ServiceProfessional[];
    entries: ServiceScheduleEntry[];
    requests: LeaveRequest[];
}

interface ServiceStateContextType {
    state: ServiceState;
    /** Aplica uma atualização funcional ao estado e persiste na nuvem. */
    updateServiceState: (updater: (prev: ServiceState) => ServiceState) => void;
    loading: boolean;
    userId: string | null;
}

// ── Estado inicial ─────────────────────────────────────────────────────────

const INITIAL_SERVICE_STATE: ServiceState = {
    professionals: [],
    entries: [],
    requests: [],
};

// ── Context ────────────────────────────────────────────────────────────────

const ServiceStateContext = createContext<ServiceStateContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export function ServiceStateProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [state, setState] = useState<ServiceState>(INITIAL_SERVICE_STATE);
    const [loading, setLoading] = useState(true);

    // Escuta mudanças de sessão para obter o userId atual
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id || null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Busca o estado de serviços na nuvem sempre que o usuário muda
    useEffect(() => {
        if (!userId) {
            setState(INITIAL_SERVICE_STATE);
            setLoading(false);
            return;
        }

        const fetchServiceState = async () => {
            setLoading(true);
            try {
                const { data: adminData, error } = await supabase
                    .from('admin_states')
                    .select('service_state')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (error) throw error;

                if (adminData?.service_state) {
                    const loadedState = adminData.service_state as unknown as ServiceState;
                    setState({
                        professionals: loadedState.professionals || [],
                        entries: loadedState.entries || [],
                        requests: loadedState.requests || [],
                    });
                } else {
                    setState(INITIAL_SERVICE_STATE);
                }

            } catch (err) {
                console.error('Erro ao buscar estado de serviços:', err);
                toast.error('Erro ao buscar dados de serviços da nuvem.');
            } finally {
                setLoading(false);
            }
        };

        fetchServiceState();
    }, [userId]);

    /** Persiste o estado de serviços na tabela admin_states do Supabase. */
    const saveServiceState = async (newState: ServiceState) => {
        if (!userId) return;
        try {
            const { error } = await supabase
                .from('admin_states')
                .upsert({
                    user_id: userId,
                    service_state: newState as any,
                    updated_at: new Date().toISOString(),
                });
            if (error) throw error;
        } catch (err) {
            console.error('Erro ao salvar estado de serviços:', err);
            toast.error('Erro ao sincronizar dados de serviços com a nuvem.');
        }
    };

    /** Aplica o updater ao estado local e dispara a persistência em nuvem. */
    const updateServiceState = useCallback((updater: (prev: ServiceState) => ServiceState) => {
        setState(prev => {
            const next = updater(prev);
            saveServiceState(next);
            return next;
        });
    }, [userId]);

    return (
        <ServiceStateContext.Provider value={{ state, updateServiceState, loading, userId }}>
            {children}
        </ServiceStateContext.Provider>
    );
}

// ── Hook de consumo ────────────────────────────────────────────────────────

export function useServiceStateContext() {
    const context = useContext(ServiceStateContext);
    if (context === undefined) {
        throw new Error('useServiceStateContext deve ser usado dentro de ServiceStateProvider');
    }
    return context;
}
