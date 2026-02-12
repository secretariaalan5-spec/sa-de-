import { useState, useEffect, useCallback } from 'react';
import { ServiceProfessional } from '@/types/serviceSchedule';

const STORAGE_KEY = 'serviceProfessionals';

export function useServiceProfessionals() {
    const [professionals, setProfessionals] = useState<ServiceProfessional[]>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        const list: ServiceProfessional[] = stored ? JSON.parse(stored) : [];
        return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(professionals));
    }, [professionals]);

    const addProfessional = useCallback((professional: Omit<ServiceProfessional, 'id'>) => {
        const newProfessional: ServiceProfessional = {
            ...professional,
            id: crypto.randomUUID(),
        };
        setProfessionals(prev => [...prev, newProfessional].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
        return newProfessional;
    }, []);

    const updateProfessional = useCallback((id: string, updates: Partial<ServiceProfessional>) => {
        setProfessionals(prev => 
            prev.map(p => p.id === id ? { ...p, ...updates } : p).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        );
    }, []);

    const deleteProfessional = useCallback((id: string) => {
        setProfessionals(prev => prev.filter(p => p.id !== id));
    }, []);

    const getNurses = useCallback(() => {
        return professionals.filter(p => p.category === 'nurse' && p.active);
    }, [professionals]);

    const getTechs = useCallback(() => {
        return professionals.filter(p => p.category === 'tech' && p.active);
    }, [professionals]);

    return {
        professionals,
        addProfessional,
        updateProfessional,
        deleteProfessional,
        getNurses,
        getTechs,
    };
}
