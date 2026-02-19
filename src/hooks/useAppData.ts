import { useLocalStorage } from './useLocalStorage';
import {
  AppData,
  Professional,
  Unit,
  ProfessionalFunction,
  ScheduleEntry,
  Restriction,
  PERIODS
} from '@/types';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useAppData() {
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);

  // Sync with Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch from Supabase when userId is available
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
          .select('emult_state')
          .eq('user_id', userId)
          .maybeSingle() as any);

        if (error) throw error;
        if (stateData?.emult_state) {
          setData(stateData.emult_state as unknown as AppData);
        } else {
          setData(INITIAL_DATA);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do eMulti:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  // Save to Supabase helper
  const saveToSupabase = async (newData: AppData) => {
    if (!userId) return;
    try {
      const { error } = await (supabase
        .from('admin_states' as any)
        .upsert({
          user_id: userId,
          emult_state: newData as any,
          updated_at: new Date().toISOString()
        }) as any);
      if (error) throw error;
    } catch (err) {
      console.error('Erro ao salvar dados no Supabase:', err);
      toast.error('Erro ao sincronizar dados com a nuvem.');
    }
  };

  // Wrapped update function
  const updateData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
    setData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveToSupabase(next);
      return next;
    });
  }, [userId]);

  // Professionals
  const addProfessional = useCallback((professional: Omit<Professional, 'id'>) => {
    const newProfessional = { ...professional, id: crypto.randomUUID() };
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

  // Units
  const addUnit = useCallback((unit: Omit<Unit, 'id'>) => {
    const newUnit = { ...unit, id: crypto.randomUUID() };
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

  // Functions
  const addFunction = useCallback((func: Omit<ProfessionalFunction, 'id'>) => {
    const newFunc = { ...func, id: crypto.randomUUID() };
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

  // Schedule
  const addScheduleEntry = useCallback((entry: Omit<ScheduleEntry, 'id'>) => {
    const newEntry = { ...entry, id: crypto.randomUUID() };
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

  // Restrictions
  const addRestriction = useCallback((restriction: Omit<Restriction, 'id'>) => {
    const newRestriction = { ...restriction, id: crypto.randomUUID() };
    updateData(prev => ({ ...prev, restrictions: [...prev.restrictions, newRestriction] }));
    return newRestriction;
  }, [updateData]);

  const deleteRestriction = useCallback((id: string) => {
    updateData(prev => ({
      ...prev,
      restrictions: prev.restrictions.filter(r => r.id !== id)
    }));
  }, [updateData]);

  // Validation helpers
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

    if (!professional) {
      errors.push('Profissional não encontrado');
      return errors;
    }

    // Check unit restriction
    const unitRestriction = checkUnitRestriction(entry.professionalId, entry.unitId);
    if (unitRestriction) {
      errors.push(`${professional.name} não pode atuar nesta unidade: ${unitRestriction.reason || 'Restrição cadastrada'}`);
    }

    // Check weekly hours
    const currentHours = getWeeklyHoursUsed(entry.professionalId);
    const newPeriodHours = PERIODS.find(p => p.key === entry.period)?.hours || 0;
    if (currentHours + newPeriodHours > professional.weeklyHours) {
      errors.push(`Carga horária excedida. Atual: ${currentHours}h, Limite: ${professional.weeklyHours}h`);
    }

    // Check professional conflicts (same day, same period)
    const sameDayEntries = data.schedule.filter(
      s => s.dayOfWeek === entry.dayOfWeek &&
        s.unitId === entry.unitId &&
        s.professionalId !== entry.professionalId
    );

    for (const existing of sameDayEntries) {
      const restriction = checkProfessionalRestriction(entry.professionalId, existing.professionalId);
      if (restriction) {
        const otherProf = data.professionals.find(p => p.id === existing.professionalId);
        errors.push(`${professional.name} não pode trabalhar junto com ${otherProf?.name}: ${restriction.reason || 'Restrição cadastrada'}`);
      }
    }

    // Check for conflicting shifts (Integral vs others)
    const existingEntriesOnDay = data.schedule.filter(
      s => s.professionalId === entry.professionalId && s.dayOfWeek === entry.dayOfWeek
    );

    if (entry.period === 'integral' && existingEntriesOnDay.length > 0) {
      errors.push('Não é possível adicionar turno Integral pois já existem agendamentos neste dia.');
    } else if (existingEntriesOnDay.some(s => s.period === 'integral')) {
      errors.push('Não é possível adicionar turno pois já existe um agendamento Integral neste dia.');
    }

    return errors;
  }, [data.professionals, data.schedule, checkUnitRestriction, checkProfessionalRestriction, getWeeklyHoursUsed]);

  // Export/Import
  const exportData = useCallback(() => {
    return JSON.stringify(data, null, 2);
  }, [data]);

  const importData = useCallback((jsonString: string) => {
    try {
      const imported = JSON.parse(jsonString) as AppData;
      updateData(imported);
      return true;
    } catch {
      return false;
    }
  }, [updateData]);

  const resetData = useCallback(() => {
    updateData(INITIAL_DATA);
  }, [updateData]);

  return {
    data,
    loading,
    // Professionals
    addProfessional,
    updateProfessional,
    deleteProfessional,
    // Units
    addUnit,
    updateUnit,
    deleteUnit,
    // Functions
    addFunction,
    updateFunction,
    deleteFunction,
    // Schedule
    addScheduleEntry,
    updateScheduleEntry,
    deleteScheduleEntry,
    clearScheduleForProfessional,
    // Restrictions
    addRestriction,
    deleteRestriction,
    // Helpers
    getWeeklyHoursUsed,
    validateScheduleEntry,
    checkUnitRestriction,
    checkProfessionalRestriction,
    // Data management
    exportData,
    importData,
    resetData,
    userId
  };
}
