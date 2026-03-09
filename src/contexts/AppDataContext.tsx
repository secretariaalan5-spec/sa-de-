import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppData, Professional, Unit, ProfessionalFunction, ScheduleEntry, Restriction, PERIODS } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateId } from '@/lib/uuid';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface AppDataContextType {
    data: AppData;
    loading: boolean;
    userId: string | null;
    teamId: string | null;
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

export function generatePortalCode(prefix: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    return `${prefix}-${code}`;
}

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

const PLACEHOLDER_CODES: PortalCodes = { emult: '', nurse: '', tech: '' };

const DEBOUNCE_MS = 1500;

// ── Context ────────────────────────────────────────────────────────────────

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export function AppDataProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [teamId, setTeamId] = useState<string | null>(null);
    const [data, setData] = useState<AppData>(INITIAL_DATA);
    const [portalCodes, setPortalCodes] = useState<PortalCodes>(PLACEHOLDER_CODES);
    const [loading, setLoading] = useState(true);

    // Refs para debounce
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestDataRef = useRef<AppData>(INITIAL_DATA);
    const latestCodesRef = useRef<PortalCodes>(PLACEHOLDER_CODES);

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

                let currentTeamId = null;
                const { data: profileRecord } = await (supabase
                    .from('profiles' as any)
                    .select('team_id')
                    .eq('user_id', userId)
                    .maybeSingle() as any);

                if (profileRecord?.team_id) {
                    currentTeamId = profileRecord.team_id;
                } else {
                    const { data: teamRecord } = await (supabase
                        .from('teams' as any)
                        .select('id')
                        .eq('created_by', userId)
                        .maybeSingle() as any);

                    if (teamRecord?.id) {
                        currentTeamId = teamRecord.id;
                        await (supabase
                            .from('profiles' as any)
                            .upsert({ user_id: userId, team_id: currentTeamId, display_name: '' } as any) as any);
                    } else {
                        await new Promise(r => setTimeout(r, 1000));
                        const { data: retryProfile } = await (supabase
                            .from('profiles' as any)
                            .select('team_id')
                            .eq('user_id', userId)
                            .maybeSingle() as any);
                        if (retryProfile?.team_id) {
                            currentTeamId = retryProfile.team_id;
                        } else {
                            const { data: newTeam, error: teamError } = await (supabase
                                .from('teams' as any)
                                .insert({ created_by: userId, name: 'Equipe Principal' } as any)
                                .select('id')
                                .maybeSingle() as any);

                            if (teamError || !newTeam?.id) {
                                console.error('Não foi possível criar equipe padrão para o usuário.', teamError);
                                setLoading(false);
                                return;
                            }

                            currentTeamId = newTeam.id;
                            await (supabase
                                .from('profiles' as any)
                                .upsert({ user_id: userId, team_id: currentTeamId, display_name: '' } as any) as any);
                        }
                    }
                }

                setTeamId(currentTeamId);

                const approvedEmultRows = currentTeamId
                    ? (((await (supabase
                        .from('professional_users' as any)
                        .select('full_name, function_name, professional_id')
                        .eq('team_id', currentTeamId)
                        .eq('category', 'emult')
                        .eq('status', 'approved') as any)).data) || [])
                    : [];

                const loadedEmult = (stateData?.emult_state as any) || {};
                const mergedFunctions = [...((loadedEmult.functions && loadedEmult.functions.length > 0) ? loadedEmult.functions : DEFAULT_FUNCTIONS)];
                const mergedProfessionals = [...(loadedEmult.professionals || [])];

                const functionPalette = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
                const ensureFunctionId = (functionName?: string | null) => {
                    if (!functionName) return mergedFunctions[0]?.id || '1';
                    const normalized = functionName.toLowerCase().trim();
                    const existing = mergedFunctions.find((f: any) => f.name.toLowerCase().trim() === normalized);
                    if (existing) return existing.id;

                    const newFunction = {
                        id: generateId(),
                        name: functionName,
                        color: functionPalette[mergedFunctions.length % functionPalette.length],
                    };
                    mergedFunctions.push(newFunction);
                    return newFunction.id;
                };

                for (const row of approvedEmultRows as any[]) {
                    const fullName = (row.full_name || '').trim();
                    if (!fullName) continue;

                    const alreadyExists = mergedProfessionals.some((p: any) =>
                        (row.professional_id && p.id === row.professional_id) ||
                        p.name.toLowerCase().trim() === fullName.toLowerCase()
                    );
                    if (alreadyExists) continue;

                    mergedProfessionals.push({
                        id: row.professional_id || generateId(),
                        name: fullName,
                        functionId: ensureFunctionId(row.function_name),
                        team: '',
                        weeklyHours: 40,
                        active: true,
                    });
                }

                const mergedData: AppData = {
                    professionals: mergedProfessionals,
                    units: loadedEmult.units || [],
                    functions: mergedFunctions,
                    schedule: loadedEmult.schedule || [],
                    restrictions: loadedEmult.restrictions || [],
                };

                setData(mergedData);
                latestDataRef.current = mergedData;

                if (stateData?.portal_codes && Object.keys(stateData.portal_codes).length > 0) {
                    const codes = stateData.portal_codes as PortalCodes;
                    setPortalCodes(codes);
                    latestCodesRef.current = codes;
                } else {
                    const newCodes = generatePortalCodes();
                    setPortalCodes(newCodes);
                    latestCodesRef.current = newCodes;
                    await (supabase
                        .from('admin_states' as any)
                        .upsert({
                            user_id: userId,
                            emult_state: mergedData as any,
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

    const syncUnitsToTable = async (units: Unit[], currentTeamId: string | null) => {
        if (!currentTeamId) return;
        try {
            await (supabase.from('units' as any).delete().eq('team_id', currentTeamId) as any);
            if (units.length > 0) {
                const rows = units.map(u => ({
                    id: u.id,
                    team_id: currentTeamId,
                    name: u.name,
                    type: u.type || '',
                    active: u.active,
                }));
                await (supabase.from('units' as any).insert(rows as any) as any);
            }
        } catch (err) {
            console.error('Erro ao sincronizar unidades:', err);
        }
    };

    /** Persiste no Supabase com debounce de 1.5s */
    const debouncedSave = useCallback((newData: AppData, newCodes: PortalCodes) => {
        latestDataRef.current = newData;
        latestCodesRef.current = newCodes;

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        saveTimerRef.current = setTimeout(async () => {
            if (!userId) return;
            try {
                const { error } = await (supabase
                    .from('admin_states' as any)
                    .upsert({
                        user_id: userId,
                        emult_state: latestDataRef.current as any,
                        portal_codes: latestCodesRef.current as any,
                        updated_at: new Date().toISOString(),
                    }) as any);
                if (error) throw error;
                syncUnitsToTable(latestDataRef.current.units, teamId);
            } catch (err) {
                console.error('Erro ao salvar dados no Supabase:', err);
                toast.error('Erro ao sincronizar dados com a nuvem.');
            }
        }, DEBOUNCE_MS);
    }, [userId, teamId]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    const updateData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
        setData(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            debouncedSave(next, latestCodesRef.current);
            return next;
        });
    }, [debouncedSave]);

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

        // Send push notification to eMult professional (fire-and-forget)
        (async () => {
            try {
                const prof = data.professionals.find(p => p.id === entry.professionalId);
                if (!prof) return;
                const unit = data.units.find(u => u.id === entry.unitId);
                const dayLabel = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta' }[entry.dayOfWeek] || entry.dayOfWeek;
                const periodLabel = { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' }[entry.period] || entry.period;

                const { data: profUser } = await (supabase
                    .from('professional_users' as any)
                    .select('onesignal_player_id')
                    .eq('professional_id', entry.professionalId)
                    .eq('status', 'approved')
                    .maybeSingle() as any);

                const playerId = profUser?.onesignal_player_id;
                if (!playerId) return;

                await supabase.functions.invoke('send-push-notification', {
                    body: {
                        player_ids: [playerId],
                        title: '📋 Nova Escala eMult',
                        message: `${dayLabel} - ${periodLabel}${unit ? ` em ${unit.name}` : ''}`,
                        data: { type: 'emult_schedule_added', professionalId: entry.professionalId },
                    },
                });
            } catch (err) {
                console.error('eMult push notification failed:', err);
            }
        })();

        return newEntry;
    }, [updateData, data.professionals, data.units]);

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
        latestCodesRef.current = codes;
        debouncedSave(latestDataRef.current, codes);
    }, [debouncedSave]);

    const regeneratePortalCodes = useCallback(() => {
        const newCodes = generatePortalCodes();
        updatePortalCodes(newCodes);
        toast.info('Novos códigos gerados. Não esqueça de publicar para ativar!');
    }, [updatePortalCodes]);

    return (
        <AppDataContext.Provider value={{
            data, loading, userId, teamId, updateData,
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
