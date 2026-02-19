import { useCallback } from 'react';
import { LeaveRequest } from '@/types/serviceSchedule';
import { useServiceState } from './useServiceState';

export function useLeaveRequests() {
    const { state, updateServiceState, loading } = useServiceState();
    const requests = state.requests;

    const addRequest = useCallback((request: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => {
        const newRequest: LeaveRequest = {
            ...request,
            id: crypto.randomUUID(),
            status: 'approved', // Auto-approved since it's manual registration
            createdAt: new Date().toISOString(),
        };
        updateServiceState(prev => ({
            ...prev,
            requests: [...prev.requests, newRequest]
        }));
        return newRequest;
    }, [updateServiceState]);

    const updateRequest = useCallback((id: string, updates: Partial<LeaveRequest>) => {
        updateServiceState(prev => ({
            ...prev,
            requests: prev.requests.map(r => r.id === id ? { ...r, ...updates } : r)
        }));
    }, [updateServiceState]);

    const deleteRequest = useCallback((id: string) => {
        updateServiceState(prev => ({
            ...prev,
            requests: prev.requests.filter(r => r.id !== id)
        }));
    }, [updateServiceState]);

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
