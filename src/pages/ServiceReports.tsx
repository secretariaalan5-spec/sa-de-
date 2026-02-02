import { useState, useRef } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function ServiceReportsPage() {
    const { professionals } = useServiceProfessionals();
    const { getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const { allEntries, getEntriesForDate } = useServiceSchedule('nurse');

    const [reportType, setReportType] = useState<'nurses' | 'techs' | 'credits'>('nurses');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        window.print();
    };

    const nurses = professionals.filter(p => p.category === 'nurse' && p.active);
    const techs = professionals.filter(p => p.category === 'tech' && p.active);

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);

    const getStatsForProfessional = (professionalId: string) => {
        const profEntries = allEntries.filter(e => e.professionalId === professionalId);
        const weekendEntries = profEntries.filter(e => e.isWeekend);
        const creditsGenerated = weekendEntries.length * 2;
        const creditsUsed = getTotalCreditsUsedByProfessional(professionalId);

        return {
            totalWorkedDays: profEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
            creditsUsed,
            creditsBalance: creditsGenerated - creditsUsed,
        };
    };

    const renderCalendar = (type: 'nurse' | 'tech') => {
        const profs = type === 'nurse' ? nurses : techs;
        const typeLabel = type === 'nurse' ? 'Enfermeiros' : 'Técnicos';

        return (
            <div className="print-section">
                <h2 className="text-xl font-bold mb-4 text-center">
                    Escala de {typeLabel} - {format(monthStart, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-7 bg-primary text-primary-foreground">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                            <div key={day} className="p-2 text-center font-semibold text-xs">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {Array.from({ length: startDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[60px] border border-border bg-muted/30" />
                        ))}
                        {daysInMonth.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayEntries = allEntries.filter(e => 
                                e.date === dateStr && 
                                profs.some(p => p.id === e.professionalId)
                            );

                            return (
                                <div key={dateStr} className="min-h-[60px] border border-border p-1">
                                    <div className="text-xs font-semibold mb-1">{format(day, 'd')}</div>
                                    <div className="space-y-0.5">
                                        {dayEntries.map(entry => {
                                            const prof = profs.find(p => p.id === entry.professionalId);
                                            return (
                                                <div key={entry.id} className="text-[10px] truncate">
                                                    {prof?.name}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderCreditsReport = () => {
        const allProfs = [...nurses, ...techs];

        return (
            <div className="print-section">
                <h2 className="text-xl font-bold mb-4 text-center">
                    Relatório de Créditos e Folgas - {format(monthStart, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-primary text-primary-foreground">
                            <th className="p-2 text-left">Profissional</th>
                            <th className="p-2 text-center">Categoria</th>
                            <th className="p-2 text-center">Dias Trabalhados</th>
                            <th className="p-2 text-center">FDS</th>
                            <th className="p-2 text-center">Créditos Gerados</th>
                            <th className="p-2 text-center">Créditos Usados</th>
                            <th className="p-2 text-center">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allProfs.map(prof => {
                            const stats = getStatsForProfessional(prof.id);
                            return (
                                <tr key={prof.id} className="border-b">
                                    <td className="p-2 font-medium">{prof.name}</td>
                                    <td className="p-2 text-center">
                                        {prof.category === 'nurse' ? 'Enfermeiro' : 'Técnico'}
                                    </td>
                                    <td className="p-2 text-center">{stats.totalWorkedDays}</td>
                                    <td className="p-2 text-center">{stats.weekendDays}</td>
                                    <td className="p-2 text-center font-semibold text-primary">
                                        {stats.creditsGenerated}
                                    </td>
                                    <td className="p-2 text-center text-destructive">
                                        {stats.creditsUsed}
                                    </td>
                                    <td className={cn(
                                        "p-2 text-center font-bold",
                                        stats.creditsBalance > 0 ? "text-green-600" : 
                                        stats.creditsBalance < 0 ? "text-destructive" : ""
                                    )}>
                                        {stats.creditsBalance}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Relatórios"
                description="Gere e imprima relatórios de escalas e créditos"
            />

            <div className="flex flex-wrap gap-4 items-center no-print">
                <div>
                    <Select value={reportType} onValueChange={(v: typeof reportType) => setReportType(v)}>
                        <SelectTrigger className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="nurses">Escala de Enfermeiros</SelectItem>
                            <SelectItem value="techs">Escala de Técnicos</SelectItem>
                            <SelectItem value="credits">Relatório de Créditos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                </div>
                <Button onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                </Button>
            </div>

            <div ref={printRef} className="bg-card rounded-xl border border-border shadow-sm p-6 print-area">
                {reportType === 'nurses' && renderCalendar('nurse')}
                {reportType === 'techs' && renderCalendar('tech')}
                {reportType === 'credits' && renderCreditsReport()}
            </div>
        </div>
    );
}
