import { useState, useEffect, useCallback } from 'react';
import { ServiceScheduleEntry } from '@/types/serviceSchedule';
import { isWeekend, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const BASE_STORAGE_KEY_ENTRIES = 'serviceSchedule_entries';

export function useServiceSchedule(type: 'nurse' | 'tech') {
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id || null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const storageKey = userId ? `${BASE_STORAGE_KEY_ENTRIES}:${userId}` : BASE_STORAGE_KEY_ENTRIES;

    const [allEntries, setAllEntries] = useState<ServiceScheduleEntry[]>(() => {
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : [];
    });

    // Filter entries by type
    const entries = allEntries.filter(e => e.type === type);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(allEntries));
    }, [allEntries, storageKey]);

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
            id: crypto.randomUUID(),
            professionalId,
            date,
            type,
            status: status || 'normal',
            isWeekend: isWeekendDay,
        };

        setAllEntries(prev => [...prev, newEntry]);
        return true;
    }, [allEntries, type]);

    const removeEntry = useCallback((entryId: string) => {
        setAllEntries(prev => prev.filter(e => e.id !== entryId));
    }, []);

    const getEntriesForDate = useCallback((date: string) => {
        return entries.filter(e => e.date === date);
    }, [entries]);

    return {
        entries,
        allEntries,
        addEntry,
        removeEntry,
        getEntriesForDate,
    };
}
