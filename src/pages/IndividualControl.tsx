import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { Stethoscope, Syringe, Calendar, TrendingUp, TrendingDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function IndividualControlPage() {
    const { professionals } = useServiceProfessionals();
    const { getTotalCreditsUsedByProfessional, getRequestsByProfessional } = useLeaveRequests();
    const { allEntries } = useServiceSchedule('nurse');

    const getStatsForProfessional = (professionalId: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const profEntries = allEntries.filter(e => e.professionalId === professionalId);
        
        // Apenas contar dias já trabalhados (passados ou hoje)
        const pastEntries = profEntries.filter(e => {
            const entryDate = parseISO(e.date);
            return entryDate <= today;
        });
        
        // Apenas fins de semana já trabalhados geram créditos
        const weekendEntries = pastEntries.filter(e => e.isWeekend);
        const creditsGenerated = weekendEntries.length * 2;
        const creditsUsed = getTotalCreditsUsedByProfessional(professionalId);
        const leaveRequests = getRequestsByProfessional(professionalId);

        return {
            totalWorkedDays: pastEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
            creditsUsed,
            creditsBalance: creditsGenerated - creditsUsed,
            leaveRequestsCount: leaveRequests.length,
            allEntries: profEntries,
            pastEntries,
            weekendEntries,
        };
    };

    const downloadIndividualReport = (prof: typeof professionals[0]) => {
        const stats = getStatsForProfessional(prof.id);
        const leaveRequests = getRequestsByProfessional(prof.id);
        
        const reportDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        
        let content = `CONTROLE INDIVIDUAL DE CRÉDITOS E FOLGAS\n`;
        content += `==========================================\n\n`;
        content += `Profissional: ${prof.name}\n`;
        content += `Categoria: ${prof.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}\n`;
        content += `Status: ${prof.active ? 'Ativo' : 'Inativo'}\n`;
        content += `Relatório gerado em: ${reportDate}\n\n`;
        
        content += `RESUMO DE CRÉDITOS\n`;
        content += `------------------\n`;
        content += `Dias trabalhados (total): ${stats.totalWorkedDays}\n`;
        content += `Dias em fins de semana: ${stats.weekendDays}\n`;
        content += `Créditos gerados: ${stats.creditsGenerated} dias\n`;
        content += `Créditos utilizados: ${stats.creditsUsed} dias\n`;
        content += `Saldo disponível: ${stats.creditsBalance} dias\n\n`;
        
        if (stats.weekendEntries.length > 0) {
            content += `FINS DE SEMANA TRABALHADOS\n`;
            content += `--------------------------\n`;
            stats.weekendEntries
                .sort((a, b) => a.date.localeCompare(b.date))
                .forEach(entry => {
                    const dateFormatted = format(parseISO(entry.date), "dd/MM/yyyy (EEEE)", { locale: ptBR });
                    content += `• ${dateFormatted}\n`;
                });
            content += `\n`;
        }
        
        if (leaveRequests.length > 0) {
            content += `HISTÓRICO DE FOLGAS UTILIZADAS\n`;
            content += `------------------------------\n`;
            leaveRequests
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .forEach(req => {
                    const requestDate = format(parseISO(req.requestDate), "dd/MM/yyyy", { locale: ptBR });
                    const leaveDates = req.leaveDates
                        .map(d => format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }))
                        .join(', ');
                    content += `• Pedido em ${requestDate}: ${req.daysRequested} dia(s)\n`;
                    content += `  Datas: ${leaveDates}\n`;
                    if (req.observations) {
                        content += `  Obs: ${req.observations}\n`;
                    }
                });
        }
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `controle-${prof.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const nurses = professionals.filter(p => p.category === 'nurse');
    const techs = professionals.filter(p => p.category === 'tech');

    const renderProfessionalCard = (prof: typeof professionals[0]) => {
        const stats = getStatsForProfessional(prof.id);

        return (
            <div key={prof.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {prof.category === 'nurse' ? (
                            <Stethoscope className="w-5 h-5 text-primary" />
                        ) : (
                            <Syringe className="w-5 h-5 text-primary" />
                        )}
                        <h3 className="font-semibold">{prof.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {!prof.active && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                                Inativo
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => downloadIndividualReport(prof)}
                            title="Baixar controle individual"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                            <Calendar className="w-3 h-3" />
                            Dias Trabalhados
                        </div>
                        <div className="text-xl font-bold">{stats.totalWorkedDays}</div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
                        <div className="text-amber-600 dark:text-amber-400 text-xs mb-1">
                            Fins de Semana
                        </div>
                        <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                            {stats.weekendDays}
                        </div>
                    </div>

                    <div className="bg-primary/5 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-primary text-xs mb-1">
                            <TrendingUp className="w-3 h-3" />
                            Créditos Gerados
                        </div>
                        <div className="text-xl font-bold text-primary">{stats.creditsGenerated}</div>
                    </div>

                    <div className="bg-destructive/5 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-destructive text-xs mb-1">
                            <TrendingDown className="w-3 h-3" />
                            Créditos Usados
                        </div>
                        <div className="text-xl font-bold text-destructive">{stats.creditsUsed}</div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Saldo Disponível</span>
                        <span className={cn(
                            "text-2xl font-bold",
                            stats.creditsBalance > 0 
                                ? "text-green-600 dark:text-green-400"
                                : stats.creditsBalance < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                        )}>
                            {stats.creditsBalance} dias
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Controle Individual"
                description="Visualize os créditos e folgas de cada profissional"
            />

            {/* Nurses */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Enfermeiros</h2>
                </div>
                {nurses.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum enfermeiro cadastrado.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {nurses.map(renderProfessionalCard)}
                    </div>
                )}
            </div>

            {/* Techs */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Syringe className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Técnicos</h2>
                </div>
                {techs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum técnico cadastrado.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {techs.map(renderProfessionalCard)}
                    </div>
                )}
            </div>
        </div>
    );
}
