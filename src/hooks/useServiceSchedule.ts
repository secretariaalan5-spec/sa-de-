import { useState, useEffect } from 'react';
import { ServiceScheduleEntry, ServiceScheduleStats } from '@/types/serviceSchedule';
import { Professional } from '@/types';

const STORAGE_KEY_NURSES = 'serviceSchedule_nurses';
const STORAGE_KEY_TECHS = 'serviceSchedule_techs';

export function useServiceSchedule(type: 'nurse' | 'tech') {
    const storageKey = type === 'nurse' ? STORAGE_KEY_NURSES : STORAGE_KEY_TECHS;

    const [entries, setEntries] = useState<ServiceScheduleEntry[]>(() => {
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(entries));
    }, [entries, storageKey]);

    const addEntry = (professionalId: string, date: string, status?: ServiceScheduleEntry['status']) => {
        const newEntry: ServiceScheduleEntry = {
            id: crypto.randomUUID(),
            professionalId,
            date,
            type,
            status: status || 'normal',
        };
        setEntries(prev => [...prev, newEntry]);
    };

    const removeEntry = (entryId: string) => {
        setEntries(prev => prev.filter(e => e.id !== entryId));
    };

    const getEntriesForDate = (date: string) => {
        return entries.filter(e => e.date === date);
    };

    const getEntriesForMonth = (year: number, month: number) => {
        return entries.filter(e => {
            const entryDate = new Date(e.date);
            return entryDate.getFullYear() === year && entryDate.getMonth() === month;
        });
    };

    const calculateStats = (professionals: Professional[]): ServiceScheduleStats[] => {
        return professionals.map(prof => {
            const profEntries = entries.filter(e => e.professionalId === prof.id);
            const workedDays = profEntries.length;
            const daysOffDue = workedDays * 2;

            return {
                professionalId: prof.id,
                professionalName: prof.name,
                workedDays,
                daysOffDue,
                daysOffTaken: 0, // TODO: implementar contagem de folgas
                remainingDaysOff: daysOffDue,
            };
        });
    };

    return {
        entries,
        addEntry,
        removeEntry,
        getEntriesForDate,
        getEntriesForMonth,
        calculateStats,
    };
}
