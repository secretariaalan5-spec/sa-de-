import { useState, useEffect, useCallback } from 'react';
import { ServiceScheduleEntry, ServiceScheduleStats, ServiceProfessional } from '@/types/serviceSchedule';
import { isWeekend, parseISO } from 'date-fns';

const STORAGE_KEY_ENTRIES = 'serviceSchedule_entries';
const STORAGE_KEY_CREDITS_USED = 'serviceSchedule_creditsUsed';

export function useServiceSchedule(type: 'nurse' | 'tech') {
    const [allEntries, setAllEntries] = useState<ServiceScheduleEntry[]>(() => {
        const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
        return stored ? JSON.parse(stored) : [];
    });

    const [creditsUsed, setCreditsUsed] = useState<Record<string, number>>(() => {
        const stored = localStorage.getItem(STORAGE_KEY_CREDITS_USED);
        return stored ? JSON.parse(stored) : {};
    });

    // Filter entries by type
    const entries = allEntries.filter(e => e.type === type);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(allEntries));
    }, [allEntries]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_CREDITS_USED, JSON.stringify(creditsUsed));
    }, [creditsUsed]);

    const addEntry = useCallback((professionalId: string, date: string, status?: ServiceScheduleEntry['status']) => {
        // Check if entry already exists for this professional on this date
        const exists = allEntries.some(e => 
            e.professionalId === professionalId && 
            e.date === date && 
            e.type === type
        );
        
        if (exists) {
            return false; // Prevent duplicate
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

    const getEntriesForMonth = useCallback((year: number, month: number) => {
        return entries.filter(e => {
            const entryDate = new Date(e.date);
            return entryDate.getFullYear() === year && entryDate.getMonth() === month;
        });
    }, [entries]);

    const useCredits = useCallback((professionalId: string, amount: number): boolean => {
        const stats = calculateStatsForProfessional(professionalId);
        if (stats && stats.creditsBalance >= amount) {
            setCreditsUsed(prev => ({
                ...prev,
                [professionalId]: (prev[professionalId] || 0) + amount
            }));
            return true;
        }
        return false;
    }, []);

    const calculateStatsForProfessional = useCallback((professionalId: string): ServiceScheduleStats | null => {
        const profEntries = allEntries.filter(e => e.professionalId === professionalId);
        const weekendEntries = profEntries.filter(e => e.isWeekend);
        const creditsGenerated = weekendEntries.length * 2;
        const used = creditsUsed[professionalId] || 0;

        return {
            professionalId,
            professionalName: '',
            category: type,
            workedDays: profEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
            creditsUsed: used,
            creditsBalance: creditsGenerated - used,
        };
    }, [allEntries, creditsUsed, type]);

    const calculateStats = useCallback((professionals: ServiceProfessional[]): ServiceScheduleStats[] => {
        return professionals.map(prof => {
            const profEntries = allEntries.filter(e => e.professionalId === prof.id);
            const weekendEntries = profEntries.filter(e => e.isWeekend);
            const creditsGenerated = weekendEntries.length * 2;
            const used = creditsUsed[prof.id] || 0;

            return {
                professionalId: prof.id,
                professionalName: prof.name,
                category: prof.category,
                workedDays: profEntries.length,
                weekendDays: weekendEntries.length,
                creditsGenerated,
                creditsUsed: used,
                creditsBalance: creditsGenerated - used,
            };
        });
    }, [allEntries, creditsUsed]);

    const getAllStats = useCallback((professionals: ServiceProfessional[]): ServiceScheduleStats[] => {
        return professionals.map(prof => {
            const profEntries = allEntries.filter(e => e.professionalId === prof.id);
            const weekendEntries = profEntries.filter(e => e.isWeekend);
            const creditsGenerated = weekendEntries.length * 2;
            const used = creditsUsed[prof.id] || 0;

            return {
                professionalId: prof.id,
                professionalName: prof.name,
                category: prof.category,
                workedDays: profEntries.length,
                weekendDays: weekendEntries.length,
                creditsGenerated,
                creditsUsed: used,
                creditsBalance: creditsGenerated - used,
            };
        });
    }, [allEntries, creditsUsed]);

    return {
        entries,
        allEntries,
        addEntry,
        removeEntry,
        getEntriesForDate,
        getEntriesForMonth,
        calculateStats,
        calculateStatsForProfessional,
        getAllStats,
        useCredits,
        creditsUsed,
    };
}
