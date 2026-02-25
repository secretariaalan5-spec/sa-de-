import { useCallback } from 'react';
import { ServiceScheduleEntry } from '@/types/serviceSchedule';
import { isWeekend, parseISO } from 'date-fns';
import { useServiceState } from './useServiceState';
import { generateId } from '@/lib/uuid';

export function useServiceSchedule(type: 'nurse' | 'tech') {
    const { state, updateServiceState, loading } = useServiceState();
    const allEntries = state?.entries || [];

    // Filter entries by type
    const entries = allEntries.filter(e => e.type === type);


    const addEntry = useCallback((professionalId: string, date: string, status?: ServiceScheduleEntry['status']) => {
        // Check if entry already exists for this professional on this date
        const exists = allEntries.some(e =>
            e.professionalId === professionalId &&
            e.date === date &&
            e.type === type
        );

        if (exists) {
            return false;
        }

        const dateObj = parseISO(date);
        const isWeekendDay = isWeekend(dateObj);

        const newEntry: ServiceScheduleEntry = {
            id: generateId(),
            professionalId,
            date,
            type,
            status: status || 'normal',
            isWeekend: isWeekendDay,
        };

        updateServiceState(prev => ({
            ...prev,
            entries: [...prev.entries, newEntry]
        }));
        return true;
    }, [allEntries, type, updateServiceState]);

    const removeEntry = useCallback((entryId: string) => {
        updateServiceState(prev => ({
            ...prev,
            entries: prev.entries.filter(e => e.id !== entryId)
        }));
    }, [updateServiceState]);

    const getEntriesForDate = useCallback((date: string) => {
        return entries.filter(e => e.date === date);
    }, [entries]);

    return {
        entries,
        allEntries,
        loading,
        addEntry,
        removeEntry,
        getEntriesForDate,
    };
}
