import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceStats } from '@/hooks/useServiceStats';
import { ServiceCalendar } from '@/components/service-schedule/ServiceCalendar';
import { CreditsStatsTable } from '@/components/service-schedule/CreditsStatsTable';

export default function ServiceScheduleTechs() {
    const { getTechs } = useServiceProfessionals();
    const { getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const {
        entries,
        allEntries,
        addEntry,
        removeEntry,
        getEntriesForDate,
    } = useServiceSchedule('tech');

    const techs = getTechs();
    const { getStatsForProfessionals } = useServiceStats({
        allEntries,
        getTotalCreditsUsedByProfessional,
    });

    const stats = getStatsForProfessionals(techs);

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Escala de Serviço - Técnicos"
                description="Gerenciamento de escalas mensais e controle de créditos de folga para técnicos"
            />

            <ServiceCalendar
                type="tech"
                typeLabel="Técnico"
                professionals={techs}
                entries={entries}
                onAddEntry={addEntry}
                onRemoveEntry={removeEntry}
                getEntriesForDate={getEntriesForDate}
            />

            <CreditsStatsTable
                stats={stats}
                title="Estatísticas de Créditos - Técnicos"
            />
        </div>
    );
}
