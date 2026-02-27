import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppData, Professional, Unit, ProfessionalFunction, ScheduleEntry, Restriction, PERIODS } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateId } from '@/lib/uuid';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface AppDataContextType {
    data: AppData;
    loading: boolean;
    userId: string | null;
    updateData: (updater: AppData | ((prev: AppData) => AppData)) => void;
    addProfessional: (professional: Omit<Professional, 'id'>) => Professional;
    updateProfessional: (id: string, updates: Partial<Professional>) => void;
    deleteProfessional: (id: string) => void;
    addUnit: (unit: Omit<Unit, 'id'>) => Unit;
    updateUnit: (id: string, updates: Partial<Unit>) => void;
    deleteUnit: (id: string) => void;
    addFunction: (func: Omit<ProfessionalFunction, 'id'>) => ProfessionalFunction;
    updateFunction: (id: string, updates: Partial<ProfessionalFunction>) => void;
    deleteFunction: (id: string) => void;
    addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => ScheduleEntry;
    updateScheduleEntry: (id: string, updates: Partial<ScheduleEntry>) => void;
    deleteScheduleEntry: (id: string) => void;
    clearScheduleForProfessional: (professionalId: string, day?: string) => void;
    addRestriction: (restriction: Omit<Restriction, 'id'>) => Restriction;
    deleteRestriction: (id: string) => void;
    getWeeklyHoursUsed: (professionalId: string) => number;
    validateScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => string[];
    importData: (jsonString: string) => boolean;
    exportData: () => string;
    resetData: () => void;
    portalCodes: PortalCodes;
    updatePortalCodes: (codes: PortalCodes) => void;
    regeneratePortalCodes: () => void;
}

export interface PortalCodes {
    emult: string;
    nurse: string;
    tech: string;
}

// ── Geração de códigos exclusivos ──────────────────────────────────────────

/**
 * Gera um código de acesso único no formato PREFIX-XXXXXX.
 * Usa apenas caracteres sem ambiguidade (sem 0, 1, I, O).
 */
export function generatePortalCode(prefix: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    return `${prefix}-${code}`;
}

/** Gera um conjunto completo de códigos exclusivos para todos os grupos. */
export function generatePortalCodes(): PortalCodes {
    return {
        emult: generatePortalCode('EMT'),
        nurse: generatePortalCode('ENF'),
        tech: generatePortalCode('TEC'),
    };
}

// ── Dados iniciais ─────────────────────────────────────────────────────────

const DEFAULT_FUNCTIONS: ProfessionalFunction[] = [
    { id: '1', name: 'Psicólogo', color: '#8B5CF6' },
    { id: '2', name: 'Fisioterapeuta', color: '#06B6D4' },
    { id: '3', name: 'Nutricionista', color: '#10B981' },
    { id: '4', name: 'Assistente Social', color: '#F59E0B' },
    { id: '5', name: 'Educador Físico', color: '#EF4444' },
    { id: '6', name: 'Fonoaudiólogo', color: '#EC4899' },
];

const INITIAL_DATA: AppData = {
    professionals: [],
    units: [],
    functions: DEFAULT_FUNCTIONS,
    schedule: [],
    restrictions: [],
};

// Usado apenas como estado inicial enquanto os dados não são carregados
const PLACEHOLDER_CODES: PortalCodes = { emult: '...', nurse: '...', tech: '...' };

// ── Context ────────────────────────────────────────────────────────────────

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export function AppDataProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [data, setData] = useState<AppData>(INITIAL_DATA);
    const [portalCodes, setPortalCodes] = useState<PortalCodes>(PLACEHOLDER_CODES);
    const [loading, setLoading] = useState(true);

    // Escuta mudanças de sessão
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id || null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Carrega dados do Supabase e garante códigos exclusivos para cada admin
    useEffect(() => {
        if (!userId) {
            setData(INITIAL_DATA);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: stateData, error } = await (supabase
                    .from('admin_states' as any)
                    .select('emult_state, portal_codes')
                    .eq('user_id', userId)
                    .maybeSingle() as any);

                if (error) throw error;

                if (stateData) {
                    // Restaura dados eMult com fallback para arrays vazios se campos estiverem faltando
                    if (stateData.emult_state) {
                        const loadedEmult = stateData.emult_state as any;
                        setData({
                            professionals: loadedEmult.professionals || [],
                            units: loadedEmult.units || [],
                            functions: loadedEmult.functions || DEFAULT_FUNCTIONS,
                            schedule: loadedEmult.schedule || [],
                            restrictions: loadedEmult.restrictions || [],
                        });
                    }


                    // Restaura códigos existentes ou gera novos exclusivos
                    if (stateData.portal_codes && Object.keys(stateData.portal_codes).length > 0) {
                        setPortalCodes(stateData.portal_codes as PortalCodes);
                    } else {
                        // Usuário existente sem códigos salvos → gera e persiste
                        const newCodes = generatePortalCodes();
                        setPortalCodes(newCodes);
                        await (supabase
                            .from('admin_states' as any)
                            .upsert({
                                user_id: userId,
                                portal_codes: newCodes as any,
                                updated_at: new Date().toISOString(),
                            }) as any);
                    }
                } else {
                    // Novo usuário → inicializa com dados padrão e gera códigos exclusivos
                    setData(INITIAL_DATA);
                    const newCodes = generatePortalCodes();
                    setPortalCodes(newCodes);
                    await (supabase
                        .from('admin_states' as any)
                        .upsert({
                            user_id: userId,
                            portal_codes: newCodes as any,
                            updated_at: new Date().toISOString(),
                        }) as any);
                }
            } catch (err) {
                console.error('Erro ao carregar dados do eMulti:', err);
                toast.error('Erro ao carregar dados da nuvem.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    const saveToSupabase = async (newData: AppData, newCodes?: PortalCodes) => {
        if (!userId) return;
        try {
            const { error } = await (supabase
                .from('admin_states' as any)
                .upsert({
                    user_id: userId,
                    emult_state: newData as any,
                    portal_codes: (newCodes || portalCodes) as any,
                    updated_at: new Date().toISOString(),
                }) as any);
            if (error) throw error;
        } catch (err) {
            console.error('Erro ao salvar dados no Supabase:', err);
            toast.error('Erro ao sincronizar dados com a nuvem.');
        }
    };

    const updateData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
        setData(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            saveToSupabase(next);
            return next;
        });
    }, [userId]);

    const addProfessional = useCallback((professional: Omit<Professional, 'id'>) => {
        const newProfessional = { ...professional, id: generateId() };
        updateData(prev => ({ ...prev, professionals: [...prev.professionals, newProfessional] }));
        return newProfessional;
    }, [updateData]);

    const updateProfessional = useCallback((id: string, updates: Partial<Professional>) => {
        updateData(prev => ({
            ...prev,
            professionals: prev.professionals.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
    }, [updateData]);

    const deleteProfessional = useCallback((id: string) => {
        updateData(prev => ({
            ...prev,
            professionals: prev.professionals.filter(p => p.id !== id),
            schedule: prev.schedule.filter(s => s.professionalId !== id),
            restrictions: prev.restrictions.filter(r => r.professionalId !== id && r.targetId !== id)
        }));
    }, [updateData]);

    const addUnit = useCallback((unit: Omit<Unit, 'id'>) => {
        const newUnit = { ...unit, id: generateId() };
        updateData(prev => ({ ...prev, units: [...prev.units, newUnit] }));
        return newUnit;
    }, [updateData]);

    const updateUnit = useCallback((id: string, updates: Partial<Unit>) => {
        updateData(prev => ({
            ...prev,
            units: prev.units.map(u => u.id === id ? { ...u, ...updates } : u)
        }));
    }, [updateData]);

    const deleteUnit = useCallback((id: string) => {
        updateData(prev => ({
            ...prev,
            units: prev.units.filter(u => u.id !== id),
            schedule: prev.schedule.filter(s => s.unitId !== id),
            restrictions: prev.restrictions.filter(r => r.targetId !== id)
        }));
    }, [updateData]);

    const addFunction = useCallback((func: Omit<ProfessionalFunction, 'id'>) => {
        const newFunc = { ...func, id: generateId() };
        updateData(prev => ({ ...prev, functions: [...prev.functions, newFunc] }));
        return newFunc;
    }, [updateData]);

    const updateFunction = useCallback((id: string, updates: Partial<ProfessionalFunction>) => {
        updateData(prev => ({
            ...prev,
            functions: prev.functions.map(f => f.id === id ? { ...f, ...updates } : f)
        }));
    }, [updateData]);

    const deleteFunction = useCallback((id: string) => {
        updateData(prev => ({
            ...prev,
            functions: prev.functions.filter(f => f.id !== id)
        }));
    }, [updateData]);

    const addScheduleEntry = useCallback((entry: Omit<ScheduleEntry, 'id'>) => {
        const newEntry = { ...entry, id: generateId() };
        updateData(prev => ({ ...prev, schedule: [...prev.schedule, newEntry] }));
        return newEntry;
    }, [updateData]);

    const updateScheduleEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
        updateData(prev => ({
            ...prev,
            schedule: prev.schedule.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
    }, [updateData]);

    const deleteScheduleEntry = useCallback((id: string) => {
        updateData(prev => ({
            ...prev,
            schedule: prev.schedule.filter(s => s.id !== id)
        }));
    }, [updateData]);

    const clearScheduleForProfessional = useCallback((professionalId: string, day?: string) => {
        updateData(prev => ({
            ...prev,
            schedule: prev.schedule.filter(s =>
                !(s.professionalId === professionalId && (!day || s.dayOfWeek === day))
            )
        }));
    }, [updateData]);

    const addRestriction = useCallback((restriction: Omit<Restriction, 'id'>) => {
        const newRestriction = { ...restriction, id: generateId() };
        updateData(prev => ({ ...prev, restrictions: [...prev.restrictions, newRestriction] }));
        return newRestriction;
    }, [updateData]);

    const deleteRestriction = useCallback((id: string) => {
        updateData(prev => ({
            ...prev,
            restrictions: prev.restrictions.filter(r => r.id !== id)
        }));
    }, [updateData]);

    const getWeeklyHoursUsed = useCallback((professionalId: string) => {
        return data.schedule
            .filter(s => s.professionalId === professionalId)
            .reduce((acc, entry) => {
                const period = PERIODS.find(p => p.key === entry.period);
                return acc + (period?.hours || 0);
            }, 0);
    }, [data.schedule]);

    const checkUnitRestriction = useCallback((professionalId: string, unitId: string) => {
        return data.restrictions.find(
            r => r.type === 'unit' && r.professionalId === professionalId && r.targetId === unitId
        );
    }, [data.restrictions]);

    const checkProfessionalRestriction = useCallback((prof1Id: string, prof2Id: string) => {
        return data.restrictions.find(
            r => r.type === 'professional' &&
                ((r.professionalId === prof1Id && r.targetId === prof2Id) ||
                    (r.professionalId === prof2Id && r.targetId === prof1Id))
        );
    }, [data.restrictions]);

    const validateScheduleEntry = useCallback((entry: Omit<ScheduleEntry, 'id'>) => {
        const errors: string[] = [];
        const professional = data.professionals.find(p => p.id === entry.professionalId);
        if (!professional) return ['Profissional não encontrado'];

        const unitRestriction = checkUnitRestriction(entry.professionalId, entry.unitId);
        if (unitRestriction) errors.push(`${professional.name} não pode atuar nesta unidade: ${unitRestriction.reason || 'Restrição'}`);

        const currentHours = getWeeklyHoursUsed(entry.professionalId);
        const newPeriodHours = PERIODS.find(p => p.key === entry.period)?.hours || 0;
        if (currentHours + newPeriodHours > professional.weeklyHours) {
            errors.push(`Carga horária excedida (${currentHours + newPeriodHours}h > ${professional.weeklyHours}h)`);
        }

        const sameDayEntries = data.schedule.filter(
            s => s.dayOfWeek === entry.dayOfWeek && s.unitId === entry.unitId && s.professionalId !== entry.professionalId
        );
        for (const existing of sameDayEntries) {
            const res = checkProfessionalRestriction(entry.professionalId, existing.professionalId);
            if (res) {
                const other = data.professionals.find(p => p.id === existing.professionalId);
                errors.push(`Conflito: ${professional.name} não trabalha com ${other?.name}`);
            }
        }
        return errors;
    }, [data.professionals, data.schedule, checkUnitRestriction, checkProfessionalRestriction, getWeeklyHoursUsed]);

    const exportData = useCallback(() => JSON.stringify(data, null, 2), [data]);

    const importData = useCallback((jsonString: string) => {
        try {
            const imported = JSON.parse(jsonString) as AppData;
            updateData(imported);
            return true;
        } catch { return false; }
    }, [updateData]);

    const resetData = useCallback(() => updateData(INITIAL_DATA), [updateData]);

    const updatePortalCodes = useCallback((codes: PortalCodes) => {
        setPortalCodes(codes);
        saveToSupabase(data, codes);
    }, [userId, data]);

    const regeneratePortalCodes = useCallback(() => {
        const newCodes = generatePortalCodes();
        updatePortalCodes(newCodes);
        toast.info('Novos códigos gerados. Não esqueça de publicar para ativar!');
    }, [updatePortalCodes]);

    return (
        <AppDataContext.Provider value={{
            data, loading, userId, updateData,
            addProfessional, updateProfessional, deleteProfessional,
            addUnit, updateUnit, deleteUnit,
            addFunction, updateFunction, deleteFunction,
            addScheduleEntry, updateScheduleEntry, deleteScheduleEntry,
            clearScheduleForProfessional, addRestriction, deleteRestriction,
            getWeeklyHoursUsed, validateScheduleEntry, importData, exportData, resetData,
            portalCodes, updatePortalCodes, regeneratePortalCodes,
        }}>
            {children}
        </AppDataContext.Provider>
    );
}

// ── Hook de consumo ────────────────────────────────────────────────────────

export function useAppDataContext() {
    const context = useContext(AppDataContext);
    if (context === undefined) throw new Error('useAppDataContext deve ser usado dentro de AppDataProvider');
    return context;
}
