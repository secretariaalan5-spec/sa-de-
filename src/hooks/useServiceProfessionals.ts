/**
 * Hook para gerenciar profissionais de serviço.
 * Filtra automaticamente por role via RLS na tabela professional_users.
 *
 * - Admin/RH: veem todos
 * - Chefe: vê apenas da sua categoria
 * - Gerente: vê apenas da sua unidade
 * - Profissional: vê apenas a si mesmo
 */
import { useCallback, useMemo, useState, useEffect } from 'react';
import { ServiceProfessional } from '@/types/serviceSchedule';
import { useServiceState } from './useServiceState';
import { useTeamPermissions } from './useTeamPermissions';
import { generateId } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';

export function useServiceProfessionals() {
    const { state, updateServiceState, deleteProfessional: contextDeleteProfessional, loading } = useServiceState();
    const { roleInfo } = useTeamPermissions();
    const allProfessionals = useMemo(() => state?.professionals || [], [state?.professionals]);

    // Set of professional IDs the current user is allowed to see (via RLS)
    const [allowedIds, setAllowedIds] = useState<Set<string> | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchAllowed() {
            // Admin and RH see everything — skip the filter
            if (roleInfo?.role === 'admin' || roleInfo?.role === 'rh') {
                setAllowedIds(null); // null = no filter
                return;
            }

            // For other roles, RLS on professional_users limits visibility
            const { data } = await supabase
                .from('professional_users')
                .select('professional_id');

            if (!cancelled && data) {
                const ids = new Set(
                    data
                        .map((r: any) => r.professional_id)
                        .filter(Boolean) as string[]
                );
                setAllowedIds(ids);
            }
        }

        if (roleInfo) {
            fetchAllowed();
        }

        return () => { cancelled = true; };
    }, [roleInfo]);

    // Filtered professionals based on role
    const professionals = useMemo(() => {
        if (allowedIds === null) return allProfessionals; // admin/rh: no filter
        return allProfessionals.filter(p => allowedIds.has(p.id));
    }, [allProfessionals, allowedIds]);

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

    /** Retorna profissionais ativos por categoria (slug). */
    const getProfessionalsByCategory = useCallback((categorySlug: string) =>
        professionals.filter(p => p.category === categorySlug && p.active),
        [professionals]);

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
        getProfessionalsByCategory,
        getNurses,
        getTechs,
    };
}
