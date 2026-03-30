import { useCallback, useMemo } from 'react';
import { ServiceScheduleEntry } from '@/types/serviceSchedule';
import { isWeekend, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServiceState } from './useServiceState';
import { generateId } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';

/** Send push to a professional when they are scheduled */
async function notifyProfessionalScheduled(professionalId: string, professionalName: string, date: string, type: string) {
    try {
        const { data: profUser } = await (supabase
            .from('professional_users' as any)
            .select('onesignal_player_id')
            .eq('professional_id', professionalId)
            .eq('status', 'approved')
            .maybeSingle() as any);

        const playerId = profUser?.onesignal_player_id;
        if (!playerId) return;

        const dateFormatted = format(parseISO(date), "dd 'de' MMMM", { locale: ptBR });

        await supabase.functions.invoke('send-push-notification', {
            body: {
                player_ids: [playerId],
                title: '📋 Nova Escala',
                message: `Você foi escalado(a) para ${dateFormatted}`,
                data: { type: 'schedule_added', date, professionalId },
            },
        });
    } catch (err) {
        console.error('Push notification failed:', err);
    }
}

export function useServiceSchedule(type: string) {
    const { state, updateServiceState, loading } = useServiceState();
    const allEntries = useMemo(() => state?.entries || [], [state?.entries]);
    const professionals = useMemo(() => state?.professionals || [], [state?.professionals]);

    // Filter entries by type
    const entries = useMemo(() => allEntries.filter(e => e.type === type), [allEntries, type]);


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

        // Send push notification (fire-and-forget)
        const prof = professionals.find(p => p.id === professionalId);
        notifyProfessionalScheduled(professionalId, prof?.name || '', date, type);

        return true;
    }, [allEntries, type, updateServiceState, professionals]);

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
