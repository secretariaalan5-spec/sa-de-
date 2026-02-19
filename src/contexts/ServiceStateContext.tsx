import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ServiceProfessional, ServiceScheduleEntry, LeaveRequest } from '@/types/serviceSchedule';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ServiceState {
    professionals: ServiceProfessional[];
    entries: ServiceScheduleEntry[];
    requests: LeaveRequest[];
}

const INITIAL_SERVICE_STATE: ServiceState = {
    professionals: [],
    entries: [],
    requests: [],
};

interface ServiceStateContextType {
    state: ServiceState;
    updateServiceState: (updater: (prev: ServiceState) => ServiceState) => void;
    loading: boolean;
    userId: string | null;
}

const ServiceStateContext = createContext<ServiceStateContextType | undefined>(undefined);

export function ServiceStateProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [state, setState] = useState<ServiceState>(INITIAL_SERVICE_STATE);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id || null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!userId) {
            setState(INITIAL_SERVICE_STATE);
            setLoading(false);
            return;
        }

        const fetchServiceState = async () => {
            setLoading(true);
            try {
                const { data: adminData, error } = await (supabase
                    .from('admin_states' as any)
                    .select('service_state')
                    .eq('user_id', userId)
                    .maybeSingle() as any);

                if (error) throw error;
                if (adminData?.service_state) {
                    setState(adminData.service_state as ServiceState);
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

    const saveServiceState = async (newState: ServiceState) => {
        if (!userId) return;
        try {
            const { error } = await (supabase
                .from('admin_states' as any)
                .upsert({
                    user_id: userId,
                    service_state: newState as any,
                    updated_at: new Date().toISOString()
                }) as any);
            if (error) throw error;
        } catch (err) {
            console.error('Erro ao salvar estado de serviços:', err);
            toast.error('Erro ao sincronizar dados de serviços com a nuvem.');
        }
    };

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

export function useServiceStateContext() {
    const context = useContext(ServiceStateContext);
    if (context === undefined) throw new Error('useServiceStateContext must be used within ServiceStateProvider');
    return context;
}
