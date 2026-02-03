import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { ServiceCalendar } from '@/components/service-schedule/ServiceCalendar';
import { CreditsStatsTable } from '@/components/service-schedule/CreditsStatsTable';
import { parseISO } from 'date-fns';

export default function ServiceScheduleNurses() {
    const { professionals, getNurses } = useServiceProfessionals();
    const { getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const {
        entries,
        addEntry,
        removeEntry,
        getEntriesForDate,
        allEntries,
    } = useServiceSchedule('nurse');

    const nurses = getNurses();

    // Calculate stats with credits from leave requests
    const stats = nurses.map(prof => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const profEntries = allEntries.filter(e => e.professionalId === prof.id);

        // Apenas contar créditos de dias já trabalhados (passados ou hoje)
        const pastEntries = profEntries.filter(e => {
            const entryDate = parseISO(e.date);
            return entryDate <= today;
        });

        const weekendEntries = pastEntries.filter(e => e.isWeekend);
        const creditsGenerated = weekendEntries.length * 2;
        const creditsUsed = getTotalCreditsUsedByProfessional(prof.id);

        return {
            professionalId: prof.id,
            professionalName: prof.name,
            category: prof.category,
            workedDays: pastEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
            creditsUsed,
            creditsBalance: creditsGenerated - creditsUsed,
        };
    });

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Escala de Serviço - Enfermeiros"
                description="Gerenciamento de escalas mensais e controle de créditos de folga para enfermeiros"
            />

            <ServiceCalendar
                type="nurse"
                typeLabel="Enfermeiro"
                professionals={nurses}
                entries={entries}
                onAddEntry={addEntry}
                onRemoveEntry={removeEntry}
                getEntriesForDate={getEntriesForDate}
            />

            <CreditsStatsTable
                stats={stats}
                title="Estatísticas de Créditos - Enfermeiros"
            />
        </div>
    );
}
