import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
    updateServiceState: (updater: (prev: ServiceState) => ServiceState) => void;
    deleteProfessional: (id: string) => void;
    deleteEntry: (id: string) => void;
    deleteRequest: (id: string) => void;
    loading: boolean;
    userId: string | null;
}

// ── Estado inicial ─────────────────────────────────────────────────────────

const INITIAL_SERVICE_STATE: ServiceState = {
    professionals: [],
    entries: [],
    requests: [],
};

const DEBOUNCE_MS = 1500;

// ── Context ────────────────────────────────────────────────────────────────

const ServiceStateContext = createContext<ServiceStateContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export function ServiceStateProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [state, setState] = useState<ServiceState>(INITIAL_SERVICE_STATE);
    const [loading, setLoading] = useState(true);

    // Refs para debounce
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestStateRef = useRef<ServiceState>(INITIAL_SERVICE_STATE);

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
                const { data: adminData, error } = await supabase
                    .from('admin_states')
                    .select('service_state')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (error) throw error;

                if (adminData?.service_state) {
                    const loadedState = adminData.service_state as unknown as ServiceState;
                    const s = {
                        professionals: loadedState.professionals || [],
                        entries: loadedState.entries || [],
                        requests: loadedState.requests || [],
                    };
                    setState(s);
                    latestStateRef.current = s;
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

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    /** Persiste o estado de serviços com debounce de 1.5s */
    const debouncedSaveServiceState = useCallback((newState: ServiceState) => {
        latestStateRef.current = newState;

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        saveTimerRef.current = setTimeout(async () => {
            if (!userId) return;
            try {
                const { error } = await supabase
                    .from('admin_states')
                    .upsert({
                        user_id: userId,
                        service_state: latestStateRef.current as any,
                        updated_at: new Date().toISOString(),
                    });
                if (error) throw error;
            } catch (err) {
                console.error('Erro ao salvar estado de serviços:', err);
                toast.error('Erro ao sincronizar dados de serviços com a nuvem.');
            }
        }, DEBOUNCE_MS);
    }, [userId]);

    /** Aplica o updater ao estado local e dispara a persistência com debounce. */
    const updateServiceState = useCallback((updater: (prev: ServiceState) => ServiceState) => {
        setState(prev => {
            const next = updater(prev);
            debouncedSaveServiceState(next);
            return next;
        });
    }, [debouncedSaveServiceState]);

    const deleteProfessional = useCallback((id: string) => {
        updateServiceState(prev => ({
            ...prev,
            professionals: prev.professionals.filter(p => p.id !== id),
            entries: prev.entries.filter(e => e.professionalId !== id),
            requests: prev.requests.filter(r => r.professionalId !== id),
        }));
    }, [updateServiceState]);

    const deleteEntry = useCallback((id: string) => {
        updateServiceState(prev => ({
            ...prev,
            entries: prev.entries.filter(e => e.id !== id),
        }));
    }, [updateServiceState]);

    const deleteRequest = useCallback((id: string) => {
        updateServiceState(prev => ({
            ...prev,
            requests: prev.requests.filter(r => r.id !== id),
        }));
    }, [updateServiceState]);

    return (
        <ServiceStateContext.Provider value={{
            state,
            updateServiceState,
            deleteProfessional,
            deleteEntry,
            deleteRequest,
            loading,
            userId
        }}>
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
