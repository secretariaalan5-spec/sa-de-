import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceStats } from '@/hooks/useServiceStats';
import { ServiceCalendar } from '@/components/service-schedule/ServiceCalendar';
import { CreditsStatsTable } from '@/components/service-schedule/CreditsStatsTable';

export default function ServiceScheduleACS() {
    const { getProfessionalsByCategory } = useServiceProfessionals();
    const { requests, getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const {
        entries,
        allEntries,
        addEntry,
        removeEntry,
        getEntriesForDate,
    } = useServiceSchedule('acs');

    const acsProfessionals = getProfessionalsByCategory('acs');
    const { getStatsForProfessionals } = useServiceStats({
        allEntries,
        getTotalCreditsUsedByProfessional,
    });

    const stats = getStatsForProfessionals(acsProfessionals);

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Escala de Serviço - ACS"
                description="Gerenciamento de escalas mensais e controle de créditos de folga para Agentes Comunitários de Saúde"
            />

            <ServiceCalendar
                type="acs"
                typeLabel="ACS"
                professionals={acsProfessionals}
                entries={entries}
                onAddEntry={addEntry}
                onRemoveEntry={removeEntry}
                getEntriesForDate={getEntriesForDate}
                leaveRequests={requests}
            />

            <CreditsStatsTable
                stats={stats}
                title="Estatísticas de Créditos - ACS"
            />
        </div>
    );
}
