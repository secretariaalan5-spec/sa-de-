import { useCallback } from 'react';
import { parseISO } from 'date-fns';
import { ServiceScheduleEntry, ServiceScheduleStats } from '@/types/serviceSchedule';

interface UseServiceStatsParams {
    allEntries: ServiceScheduleEntry[];
    getTotalCreditsUsedByProfessional: (professionalId: string) => number;
}

/**
 * Centralized stats calculation for service schedule credits.
 * Single source of truth for worked days, weekend days, credits generated/used/balance.
 * 
 * Rules:
 * - Only past or today entries count for credits (future entries are scheduled but not yet worked)
 * - Each weekend day worked generates 2 credits
 * - Credits used come from approved leave requests (useLeaveRequests hook)
 * - Balance = creditsGenerated - creditsUsed
 */
export function useServiceStats({ allEntries, getTotalCreditsUsedByProfessional }: UseServiceStatsParams) {
    const getStatsForProfessional = useCallback((
        professionalId: string,
        professionalName: string,
        category: 'nurse' | 'tech'
    ): ServiceScheduleStats => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const profEntries = allEntries.filter(e => e.professionalId === professionalId);

        // Only count past/today entries (already worked)
        const pastEntries = profEntries.filter(e => {
            const entryDate = parseISO(e.date);
            return entryDate <= today;
        });

        const weekendEntries = pastEntries.filter(e => e.isWeekend);
        const creditsGenerated = weekendEntries.length * 2;
        const creditsUsed = getTotalCreditsUsedByProfessional(professionalId);

        return {
            professionalId,
            professionalName,
            category,
            workedDays: pastEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
            creditsUsed,
            creditsBalance: creditsGenerated - creditsUsed,
        };
    }, [allEntries, getTotalCreditsUsedByProfessional]);

    const getStatsForProfessionals = useCallback((
        professionals: Array<{ id: string; name: string; category: 'nurse' | 'tech' }>
    ): ServiceScheduleStats[] => {
        return professionals.map(p => getStatsForProfessional(p.id, p.name, p.category));
    }, [getStatsForProfessional]);

    /**
     * Get available credits balance for a professional (used for leave request validation)
     */
    const getAvailableCredits = useCallback((professionalId: string): number => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const profEntries = allEntries.filter(e => e.professionalId === professionalId);
        const pastEntries = profEntries.filter(e => {
            const entryDate = parseISO(e.date);
            return entryDate <= today;
        });
        const weekendEntries = pastEntries.filter(e => e.isWeekend);
        const creditsGenerated = weekendEntries.length * 2;
        const creditsUsed = getTotalCreditsUsedByProfessional(professionalId);

        return creditsGenerated - creditsUsed;
    }, [allEntries, getTotalCreditsUsedByProfessional]);

    /**
     * Get monthly stats (filtered to a specific month)
     */
    const getMonthlyStatsForProfessional = useCallback((
        professionalId: string,
        professionalName: string,
        category: 'nurse' | 'tech',
        monthStart: Date,
        monthEnd: Date
    ): ServiceScheduleStats => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const profEntries = allEntries.filter(e => {
            const entryDate = new Date(e.date);
            return e.professionalId === professionalId &&
                   entryDate >= monthStart &&
                   entryDate <= monthEnd;
        });

        // Only count past weekend entries for credits
        const weekendEntries = profEntries.filter(e => e.isWeekend);
        const workedWeekendEntries = weekendEntries.filter(e => new Date(e.date) <= today);
        const creditsGenerated = workedWeekendEntries.length * 2;
        const creditsUsed = getTotalCreditsUsedByProfessional(professionalId);

        return {
            professionalId,
            professionalName,
            category,
            workedDays: profEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
            creditsUsed,
            creditsBalance: creditsGenerated - creditsUsed,
        };
    }, [allEntries, getTotalCreditsUsedByProfessional]);

    return {
        getStatsForProfessional,
        getStatsForProfessionals,
        getAvailableCredits,
        getMonthlyStatsForProfessional,
    };
}
