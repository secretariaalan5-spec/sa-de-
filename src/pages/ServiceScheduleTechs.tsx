import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { ServiceCalendar } from '@/components/service-schedule/ServiceCalendar';
import { CreditsStatsTable } from '@/components/service-schedule/CreditsStatsTable';

export default function ServiceScheduleTechs() {
    const { getTechs } = useServiceProfessionals();
    const { getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const { 
        entries, 
        addEntry, 
        removeEntry, 
        getEntriesForDate,
        allEntries,
    } = useServiceSchedule('tech');

    const techs = getTechs();

    // Calculate stats with credits from leave requests
    const stats = techs.map(prof => {
        const profEntries = allEntries.filter(e => e.professionalId === prof.id);
        const weekendEntries = profEntries.filter(e => e.isWeekend);
        const creditsGenerated = weekendEntries.length * 2;
        const creditsUsed = getTotalCreditsUsedByProfessional(prof.id);

        return {
            professionalId: prof.id,
            professionalName: prof.name,
            category: prof.category,
            workedDays: profEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
            creditsUsed,
            creditsBalance: creditsGenerated - creditsUsed,
        };
    });

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
