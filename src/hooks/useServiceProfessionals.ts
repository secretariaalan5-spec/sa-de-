/**
 * Hook para gerenciar profissionais de serviço (enfermeiros e técnicos).
 * Todas as mutações são automaticamente persistidas na nuvem via ServiceStateContext.
 */
import { useCallback, useMemo } from 'react';
import { ServiceProfessional } from '@/types/serviceSchedule';
import { useServiceState } from './useServiceState';
import { generateId } from '@/lib/uuid';

export function useServiceProfessionals() {
    const { state, updateServiceState, deleteProfessional: contextDeleteProfessional, loading } = useServiceState();
    const professionals = useMemo(() => state?.professionals || [], [state?.professionals]);

    /** Adiciona um novo profissional, mantendo a lista ordenada por nome. */
    const addProfessional = useCallback((professional: Omit<ServiceProfessional, 'id'>) => {
        const newProfessional: ServiceProfessional = {
            ...professional,
            id: generateId(),
        };
        updateServiceState(prev => ({
            ...prev,
            professionals: [...prev.professionals, newProfessional]
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        }));
        return newProfessional;
    }, [updateServiceState]);

    /** Atualiza campos de um profissional existente pelo ID. */
    const updateProfessional = useCallback((id: string, updates: Partial<ServiceProfessional>) => {
        updateServiceState(prev => ({
            ...prev,
            professionals: prev.professionals
                .map(p => p.id === id ? { ...p, ...updates } : p)
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        }));
    }, [updateServiceState]);

    /** Remove um profissional pelo ID e limpa todos os seus dados. */
    const deleteProfessional = useCallback((id: string) => {
        const prof = professionals.find(p => p.id === id);
        if (!prof) return;

        if (confirm(`Excluir ${prof.name}? Toda a escala, folgas e créditos serão apagados definitivamente.`)) {
            contextDeleteProfessional(id);
        }
    }, [contextDeleteProfessional, professionals]);

    /** Retorna apenas os enfermeiros ativos. */
    const getNurses = useCallback(() =>
        professionals.filter(p => p.category === 'nurse' && p.active),
        [professionals]);

    /** Retorna apenas os técnicos ativos. */
    const getTechs = useCallback(() =>
        professionals.filter(p => p.category === 'tech' && p.active),
        [professionals]);

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
