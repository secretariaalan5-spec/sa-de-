import { useCallback } from 'react';
import { ServiceProfessional } from '@/types/serviceSchedule';
import { useServiceState } from './useServiceState';

export function useServiceProfessionals() {
    const { state, updateServiceState, loading } = useServiceState();
    const professionals = state.professionals;

    const addProfessional = useCallback((professional: Omit<ServiceProfessional, 'id'>) => {
        const newProfessional: ServiceProfessional = {
            ...professional,
            id: crypto.randomUUID(),
        };
        updateServiceState(prev => ({
            ...prev,
            professionals: [...prev.professionals, newProfessional].sort((a, b) =>
                a.name.localeCompare(b.name, 'pt-BR')
            )
        }));
        return newProfessional;
    }, [updateServiceState]);

    const updateProfessional = useCallback((id: string, updates: Partial<ServiceProfessional>) => {
        updateServiceState(prev => ({
            ...prev,
            professionals: prev.professionals.map(p => p.id === id ? { ...p, ...updates } : p)
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        }));
    }, [updateServiceState]);

    const deleteProfessional = useCallback((id: string) => {
        updateServiceState(prev => ({
            ...prev,
            professionals: prev.professionals.filter(p => p.id !== id)
        }));
    }, [updateServiceState]);

    const getNurses = useCallback(() => {
        return professionals.filter(p => p.category === 'nurse' && p.active);
    }, [professionals]);

    const getTechs = useCallback(() => {
        return professionals.filter(p => p.category === 'tech' && p.active);
    }, [professionals]);

    return {
        professionals,
        loading,
        addProfessional,
        updateProfessional,
        deleteProfessional,
        getNurses,
        getTechs,
    };
}
