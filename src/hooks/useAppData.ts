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
import { useCallback } from 'react';

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
  const [data, setData] = useLocalStorage<AppData>('emult-escala-data', INITIAL_DATA);

  // Professionals
  const addProfessional = useCallback((professional: Omit<Professional, 'id'>) => {
    const newProfessional = { ...professional, id: crypto.randomUUID() };
    setData(prev => ({ ...prev, professionals: [...prev.professionals, newProfessional] }));
    return newProfessional;
  }, [setData]);

  const updateProfessional = useCallback((id: string, updates: Partial<Professional>) => {
    setData(prev => ({
      ...prev,
      professionals: prev.professionals.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  }, [setData]);

  const deleteProfessional = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      professionals: prev.professionals.filter(p => p.id !== id),
      schedule: prev.schedule.filter(s => s.professionalId !== id),
      restrictions: prev.restrictions.filter(r => r.professionalId !== id && r.targetId !== id)
    }));
  }, [setData]);

  // Units
  const addUnit = useCallback((unit: Omit<Unit, 'id'>) => {
    const newUnit = { ...unit, id: crypto.randomUUID() };
    setData(prev => ({ ...prev, units: [...prev.units, newUnit] }));
    return newUnit;
  }, [setData]);

  const updateUnit = useCallback((id: string, updates: Partial<Unit>) => {
    setData(prev => ({
      ...prev,
      units: prev.units.map(u => u.id === id ? { ...u, ...updates } : u)
    }));
  }, [setData]);

  const deleteUnit = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      units: prev.units.filter(u => u.id !== id),
      schedule: prev.schedule.filter(s => s.unitId !== id),
      restrictions: prev.restrictions.filter(r => r.targetId !== id)
    }));
  }, [setData]);

  // Functions
  const addFunction = useCallback((func: Omit<ProfessionalFunction, 'id'>) => {
    const newFunc = { ...func, id: crypto.randomUUID() };
    setData(prev => ({ ...prev, functions: [...prev.functions, newFunc] }));
    return newFunc;
  }, [setData]);

  const updateFunction = useCallback((id: string, updates: Partial<ProfessionalFunction>) => {
    setData(prev => ({
      ...prev,
      functions: prev.functions.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  }, [setData]);

  const deleteFunction = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      functions: prev.functions.filter(f => f.id !== id)
    }));
  }, [setData]);

  // Schedule
  const addScheduleEntry = useCallback((entry: Omit<ScheduleEntry, 'id'>) => {
    const newEntry = { ...entry, id: crypto.randomUUID() };
    setData(prev => ({ ...prev, schedule: [...prev.schedule, newEntry] }));
    return newEntry;
  }, [setData]);

  const updateScheduleEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
    setData(prev => ({
      ...prev,
      schedule: prev.schedule.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  }, [setData]);

  const deleteScheduleEntry = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      schedule: prev.schedule.filter(s => s.id !== id)
    }));
  }, [setData]);

  const clearScheduleForProfessional = useCallback((professionalId: string, day?: string) => {
    setData(prev => ({
      ...prev,
      schedule: prev.schedule.filter(s => 
        !(s.professionalId === professionalId && (!day || s.dayOfWeek === day))
      )
    }));
  }, [setData]);

  // Restrictions
  const addRestriction = useCallback((restriction: Omit<Restriction, 'id'>) => {
    const newRestriction = { ...restriction, id: crypto.randomUUID() };
    setData(prev => ({ ...prev, restrictions: [...prev.restrictions, newRestriction] }));
    return newRestriction;
  }, [setData]);

  const deleteRestriction = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      restrictions: prev.restrictions.filter(r => r.id !== id)
    }));
  }, [setData]);

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
      setData(imported);
      return true;
    } catch {
      return false;
    }
  }, [setData]);

  const resetData = useCallback(() => {
    setData(INITIAL_DATA);
  }, [setData]);

  return {
    data,
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
  };
}
