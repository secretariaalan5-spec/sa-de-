import { useState, useEffect, useCallback } from 'react';
import { LeaveRequest } from '@/types/serviceSchedule';

const STORAGE_KEY = 'leaveRequests';

export function useLeaveRequests() {
    const [requests, setRequests] = useState<LeaveRequest[]>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    }, [requests]);

    const addRequest = useCallback((request: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => {
        const newRequest: LeaveRequest = {
            ...request,
            id: crypto.randomUUID(),
            status: 'approved', // Auto-approved since it's manual registration
            createdAt: new Date().toISOString(),
        };
        setRequests(prev => [...prev, newRequest]);
        return newRequest;
    }, []);

    const updateRequest = useCallback((id: string, updates: Partial<LeaveRequest>) => {
        setRequests(prev => 
            prev.map(r => r.id === id ? { ...r, ...updates } : r)
        );
    }, []);

    const deleteRequest = useCallback((id: string) => {
        setRequests(prev => prev.filter(r => r.id !== id));
    }, []);

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
        addRequest,
        updateRequest,
        deleteRequest,
        getRequestsByProfessional,
        getTotalCreditsUsedByProfessional,
    };
}
