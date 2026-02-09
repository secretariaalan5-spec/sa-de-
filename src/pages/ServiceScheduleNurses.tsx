import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceStats } from '@/hooks/useServiceStats';
import { ServiceCalendar } from '@/components/service-schedule/ServiceCalendar';
import { CreditsStatsTable } from '@/components/service-schedule/CreditsStatsTable';

export default function ServiceScheduleNurses() {
    const { getNurses } = useServiceProfessionals();
    const { getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const {
        entries,
        allEntries,
        addEntry,
        removeEntry,
        getEntriesForDate,
    } = useServiceSchedule('nurse');

    const nurses = getNurses();
    const { getStatsForProfessionals } = useServiceStats({
        allEntries,
        getTotalCreditsUsedByProfessional,
    });

    const stats = getStatsForProfessionals(nurses);

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
