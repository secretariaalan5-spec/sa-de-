import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Calendar, Users, FileText} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function ServiceReportsPage() {
    const { professionals } = useServiceProfessionals();
    const { requests } = useLeaveRequests();
    const { allEntries } = useServiceSchedule('nurse');
    const { allEntries: techEntries } = useServiceSchedule('tech');

    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

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

    const getMonthlyStats = (professionalId: string, entries: typeof allEntries) => {
        const profEntries = entries.filter(e => {
            const entryDate = new Date(e.date);
            return e.professionalId === professionalId && 
                   entryDate >= monthStart && 
                   entryDate <= monthEnd;
        });
        const weekendEntries = profEntries.filter(e => e.isWeekend);
        const today = new Date();
        const workedWeekendEntries = weekendEntries.filter(e => new Date(e.date) <= today);
        const creditsGenerated = workedWeekendEntries.length * 2;

        return {
            totalWorkedDays: profEntries.length,
            weekendDays: weekendEntries.length,
            creditsGenerated,
        };
    };

    const getLeaveRequestsForMonth = (professionalId: string) => {
        return requests.filter(r => {
            if (r.professionalId !== professionalId) return false;
            return r.leaveDates.some(date => {
                const d = new Date(date);
                return d >= monthStart && d <= monthEnd;
            });
        });
    };

    const renderCalendar = (type: 'nurse' | 'tech') => {
        const profs = type === 'nurse' ? nurses : techs;
        const entries = type === 'nurse' ? allEntries : techEntries;
        const typeLabel = type === 'nurse' ? 'Enfermeiros' : 'Técnicos';

        return (
            <div className="print-section">
                <div className="mb-6 text-center border-b border-border pb-4">
                    <h2 className="text-xl font-bold text-primary">
                        Escala de {typeLabel}
                    </h2>
                    <p className="text-muted-foreground capitalize">
                        {format(monthStart, 'MMMM yyyy', { locale: ptBR })}
                    </p>
                </div>

                {/* Legenda */}
                <div className="flex gap-4 mb-4 text-sm no-print">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300" />
                        <span>Final de Semana</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-muted border border-border" />
                        <span>Dia Útil</span>
                    </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-7 bg-primary text-primary-foreground">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                            <div key={day} className="p-2 text-center font-semibold text-xs border-r border-primary-foreground/20 last:border-r-0">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {Array.from({ length: startDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[80px] border border-border bg-muted/30" />
                        ))}
                        {daysInMonth.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isWeekendDay = isWeekend(day);
                            const dayEntries = entries.filter(e => 
                                e.date === dateStr && 
                                profs.some(p => p.id === e.professionalId)
                            );

                            return (
                                <div 
                                    key={dateStr} 
                                    className={cn(
                                        "min-h-[80px] border border-border p-1",
                                        isWeekendDay ? "bg-amber-50 dark:bg-amber-900/10" : "bg-card"
                                    )}
                                >
                                    <div className={cn(
                                        "text-xs font-bold mb-1 px-1 py-0.5 rounded-sm inline-block",
                                        isWeekendDay ? "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100" : ""
                                    )}>
                                        {format(day, 'd')}
                                    </div>
                                    <div className="space-y-0.5">
                                        {dayEntries.map(entry => {
                                            const prof = profs.find(p => p.id === entry.professionalId);
                                            return (
                                                <div 
                                                    key={entry.id} 
                                                    className="text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded truncate"
                                                    title={prof?.name}
                                                >
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

                {/* Resumo da Escala */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {profs.map(prof => {
                        const stats = getMonthlyStats(prof.id, entries);
                        if (stats.totalWorkedDays === 0) return null;
                        return (
                            <div key={prof.id} className="bg-muted/50 rounded-lg p-3 border border-border">
                                <p className="font-medium text-sm truncate">{prof.name}</p>
                                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                                    <span>{stats.totalWorkedDays} dias</span>
                                    <span className="text-amber-600 dark:text-amber-400">{stats.weekendDays} FDS</span>
                                    <span className="text-primary font-medium">+{stats.creditsGenerated} créditos</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderLeaveReport = () => {
        const monthRequests = requests.filter(r => {
            return r.leaveDates.some(date => {
                const d = new Date(date);
                return d >= monthStart && d <= monthEnd;
            });
        });

        const groupedByProfessional = monthRequests.reduce((acc, req) => {
            if (!acc[req.professionalId]) {
                acc[req.professionalId] = [];
            }
            acc[req.professionalId].push(req);
            return acc;
        }, {} as Record<string, typeof requests>);

        return (
            <div className="print-section space-y-6">
                <div className="mb-6 text-center border-b border-border pb-4">
                    <h2 className="text-xl font-bold text-primary">
                        Relatório de Pedidos de Folga
                    </h2>
                    <p className="text-muted-foreground capitalize">
                        {format(monthStart, 'MMMM yyyy', { locale: ptBR })}
                    </p>
                </div>

                {Object.keys(groupedByProfessional).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhum pedido de folga registrado para este mês.
                    </div>
                ) : (
                    Object.entries(groupedByProfessional).map(([profId, profRequests]) => {
                        const prof = professionals.find(p => p.id === profId);
                        if (!prof) return null;

                        return (
                            <Card key={profId} className="overflow-hidden">
                                <CardHeader className="bg-muted/50 py-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        {prof.name}
                                        <span className="text-xs font-normal text-muted-foreground ml-2">
                                            ({prof.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'})
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[120px]">Data Pedido</TableHead>
                                                <TableHead>Datas da Folga</TableHead>
                                                <TableHead className="w-[80px] text-center">Dias</TableHead>
                                                <TableHead>Observações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {profRequests.map(req => (
                                                <TableRow key={req.id}>
                                                    <TableCell className="text-sm">
                                                        {format(new Date(req.requestDate), 'dd/MM/yyyy')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {req.leaveDates.map(date => (
                                                                <span 
                                                                    key={date} 
                                                                    className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                                                                >
                                                                    {format(new Date(date), 'dd/MM')}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">
                                                        {req.daysRequested}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {req.observations || '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        );
    };

    const renderCreditsReport = () => {
        const allProfs = [...nurses, ...techs];
        const nurseEntries = allEntries;

        return (
            <div className="print-section space-y-6">
                <div className="mb-6 text-center border-b border-border pb-4">
                    <h2 className="text-xl font-bold text-primary">
                        Relatório de Créditos e Folgas
                    </h2>
                    <p className="text-muted-foreground capitalize">
                        {format(monthStart, 'MMMM yyyy', { locale: ptBR })}
                    </p>
                </div>

                {/* Enfermeiros */}
                {nurses.length > 0 && (
                    <Card>
                        <CardHeader className="bg-primary/5 py-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                Enfermeiros
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Profissional</TableHead>
                                        <TableHead className="text-center w-[100px]">Dias Trab.</TableHead>
                                        <TableHead className="text-center w-[80px]">FDS</TableHead>
                                        <TableHead className="text-center w-[100px]">Créditos +</TableHead>
                                        <TableHead className="text-center w-[100px]">Créditos -</TableHead>
                                        <TableHead className="text-center w-[80px]">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {nurses.map(prof => {
                                        const stats = getMonthlyStats(prof.id, nurseEntries);
                                        const monthLeaves = getLeaveRequestsForMonth(prof.id);
                                        const creditsUsed = monthLeaves.reduce((sum, r) => sum + r.daysRequested, 0);
                                        const balance = stats.creditsGenerated - creditsUsed;

                                        return (
                                            <TableRow key={prof.id}>
                                                <TableCell className="font-medium">{prof.name}</TableCell>
                                                <TableCell className="text-center">{stats.totalWorkedDays}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded text-sm">
                                                        {stats.weekendDays}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center font-semibold text-green-600 dark:text-green-400">
                                                    +{stats.creditsGenerated}
                                                </TableCell>
                                                <TableCell className="text-center text-destructive">
                                                    {creditsUsed > 0 ? `-${creditsUsed}` : '0'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded font-bold",
                                                        balance > 0 
                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                                            : balance < 0
                                                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                                                : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {balance}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Técnicos */}
                {techs.length > 0 && (
                    <Card>
                        <CardHeader className="bg-primary/5 py-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                Técnicos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Profissional</TableHead>
                                        <TableHead className="text-center w-[100px]">Dias Trab.</TableHead>
                                        <TableHead className="text-center w-[80px]">FDS</TableHead>
                                        <TableHead className="text-center w-[100px]">Créditos +</TableHead>
                                        <TableHead className="text-center w-[100px]">Créditos -</TableHead>
                                        <TableHead className="text-center w-[80px]">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {techs.map(prof => {
                                        const stats = getMonthlyStats(prof.id, techEntries);
                                        const monthLeaves = getLeaveRequestsForMonth(prof.id);
                                        const creditsUsed = monthLeaves.reduce((sum, r) => sum + r.daysRequested, 0);
                                        const balance = stats.creditsGenerated - creditsUsed;

                                        return (
                                            <TableRow key={prof.id}>
                                                <TableCell className="font-medium">{prof.name}</TableCell>
                                                <TableCell className="text-center">{stats.totalWorkedDays}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded text-sm">
                                                        {stats.weekendDays}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center font-semibold text-green-600 dark:text-green-400">
                                                    +{stats.creditsGenerated}
                                                </TableCell>
                                                <TableCell className="text-center text-destructive">
                                                    {creditsUsed > 0 ? `-${creditsUsed}` : '0'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded font-bold",
                                                        balance > 0 
                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                                            : balance < 0
                                                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                                                : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {balance}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Relatórios"
                description="Gere e imprima relatórios de escalas, folgas e créditos"
            />

            <div className="flex flex-wrap gap-4 items-center no-print">
                <div>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="w-4 h-4" />
                    Imprimir
                </Button>
            </div>

            <Tabs defaultValue="nurses" className="space-y-4">
                <TabsList className="no-print grid w-full grid-cols-4">
                    <TabsTrigger value="nurses" className="gap-2">
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Escala</span> Enfermeiros
                    </TabsTrigger>
                    <TabsTrigger value="techs" className="gap-2">
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Escala</span> Técnicos
                    </TabsTrigger>
                    <TabsTrigger value="leaves" className="gap-2">
                        <FileText className="w-4 h-4" />
                        Folgas
                    </TabsTrigger>
                    <TabsTrigger value="credits" className="gap-2">
                        <Users className="w-4 h-4" />
                        Créditos
                    </TabsTrigger>
                </TabsList>

                <div className="bg-card rounded-xl border border-border shadow-sm p-6 print-area">
                    <TabsContent value="nurses" className="mt-0">
                        {renderCalendar('nurse')}
                    </TabsContent>
                    <TabsContent value="techs" className="mt-0">
                        {renderCalendar('tech')}
                    </TabsContent>
                    <TabsContent value="leaves" className="mt-0">
                        {renderLeaveReport()}
                    </TabsContent>
                    <TabsContent value="credits" className="mt-0">
                        {renderCreditsReport()}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
