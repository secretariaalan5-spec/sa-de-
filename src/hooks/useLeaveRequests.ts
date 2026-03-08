import { useCallback, useMemo } from 'react';
import { LeaveRequest } from '@/types/serviceSchedule';
import { useServiceState } from './useServiceState';
import { generateId } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';

export function useLeaveRequests() {
    const { state, updateServiceState, loading } = useServiceState();
    const requests = useMemo(() => state?.requests || [], [state?.requests]);

    /** Retorna datas conflitantes já aprovadas para um profissional */
    const getConflictingDates = useCallback((professionalId: string, dates: string[]): string[] => {
        const approvedDates = new Set(
            requests
                .filter(r => r.professionalId === professionalId && r.status === 'approved')
                .flatMap(r => r.leaveDates)
        );
        return dates.filter(d => approvedDates.has(d));
    }, [requests]);

    const addRequest = useCallback((request: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => {
        // Check for conflicts
        const conflicts = getConflictingDates(request.professionalId, request.leaveDates);
        if (conflicts.length > 0) {
            const formatted = conflicts.map(d => {
                const [y, m, day] = d.split('-');
                return `${day}/${m}`;
            }).join(', ');
            return { error: `Já existe afastamento aprovado nas datas: ${formatted}` };
        }

        const newRequest: LeaveRequest = {
            ...request,
            id: generateId(),
            status: 'approved',
            createdAt: new Date().toISOString(),
        };
        updateServiceState(prev => ({
            ...prev,
            requests: [...prev.requests, newRequest]
        }));
        return newRequest;
    }, [updateServiceState, getConflictingDates]);

    const updateRequest = useCallback((id: string, updates: Partial<LeaveRequest>) => {
        updateServiceState(prev => ({
            ...prev,
            requests: prev.requests.map(r => r.id === id ? { ...r, ...updates } : r)
        }));
    }, [updateServiceState]);

    /** Remove o pedido local e, se veio do portal, apaga também da tabela professional_leave_requests */
    const deleteRequest = useCallback((id: string) => {
        const target = requests.find(r => r.id === id);

        // Se o pedido tem origem no portal, apaga do Supabase para sincronizar com o portal
        if (target?.portalLeaveId) {
            supabase
                .from('professional_leave_requests' as any)
                .delete()
                .eq('id', target.portalLeaveId)
                .then(({ error }) => {
                    if (error) console.error('Erro ao apagar pedido do portal:', error);
                });
        }

        updateServiceState(prev => ({
            ...prev,
            requests: prev.requests.filter(r => r.id !== id)
        }));
    }, [updateServiceState, requests]);

    const getRequestsByProfessional = useCallback((professionalId: string) => {
        return requests.filter(r => r.professionalId === professionalId);
    }, [requests]);

    const getTotalCreditsUsedByProfessional = useCallback((professionalId: string) => {
        return requests
            .filter(r => r.professionalId === professionalId && r.status === 'approved' && r.leaveType === 'folga_credito')
            .reduce((sum, r) => sum + r.daysRequested, 0);
    }, [requests]);

    return {
        requests,
        loading,
        addRequest,
        updateRequest,
        deleteRequest,
        getRequestsByProfessional,
        getTotalCreditsUsedByProfessional,
    };
}
