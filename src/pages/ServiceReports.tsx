import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Users, Stethoscope, Syringe, TrendingUp, CalendarOff, ChevronLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ReportView = 'menu' | 'nurses' | 'techs' | 'leaves' | 'credits';

export default function ServiceReportsPage() {
  const { professionals } = useServiceProfessionals();
  const { requests, getTotalCreditsUsedByProfessional } = useLeaveRequests();
  const { allEntries } = useServiceSchedule('nurse');
  const { allEntries: techEntries } = useServiceSchedule('tech');

  const { getStatsForProfessional } = useServiceStats({
    allEntries,
    getTotalCreditsUsedByProfessional,
  });

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeView, setActiveView] = useState<ReportView>('menu');

  const handlePrint = () => window.print();

  const nurses = professionals.filter(p => p.category === 'nurse' && p.active);
  const techs = professionals.filter(p => p.category === 'tech' && p.active);

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const monthLeaveRequests = requests.filter(r =>
    r.leaveDates.some(date => {
      const d = new Date(date);
      return d >= monthStart && d <= monthEnd;
    })
  );

  const reportCards = [
    { id: 'nurses' as ReportView, title: 'Escala de Enfermeiros', description: 'Calendário mensal dos enfermeiros', icon: Stethoscope, count: nurses.length },
    { id: 'techs' as ReportView, title: 'Escala de Técnicos', description: 'Calendário mensal dos técnicos', icon: Syringe, count: techs.length },
    { id: 'leaves' as ReportView, title: 'Pedidos de Folga', description: 'Folgas registradas no mês', icon: CalendarOff, count: monthLeaveRequests.length },
    { id: 'credits' as ReportView, title: 'Extrato de Créditos', description: 'Saldo de créditos por profissional', icon: TrendingUp, count: nurses.length + techs.length },
  ];

  // ── Calendar Render ──
  const renderCalendar = (type: 'nurse' | 'tech') => {
    const profs = type === 'nurse' ? nurses : techs;
    const entries = type === 'nurse' ? allEntries : techEntries;
    const typeLabel = type === 'nurse' ? 'Enfermeiros' : 'Técnicos';

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Escala de {typeLabel} — <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: ptBR })}</span></h2>

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
                e.date === dateStr && profs.some(p => p.id === e.professionalId)
              );

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[80px] border border-border p-1",
                    isWeekendDay ? "bg-warning/10" : "bg-card"
                  )}
                >
                  <div className={cn(
                    "text-xs font-bold mb-1 px-1 py-0.5 rounded-sm inline-block",
                    isWeekendDay && "bg-warning/20 text-warning-foreground"
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
      </div>
    );
  };

  // ── Leave Report ──
  const renderLeaveReport = () => {
    const grouped = monthLeaveRequests.reduce((acc, req) => {
      if (!acc[req.professionalId]) acc[req.professionalId] = [];
      acc[req.professionalId].push(req);
      return acc;
    }, {} as Record<string, typeof requests>);

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pedidos de Folga — <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: ptBR })}</span></h2>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum pedido de folga registrado para este mês.</p>
        ) : (
          Object.entries(grouped).map(([profId, profRequests]) => {
            const prof = professionals.find(p => p.id === profId);
            if (!prof) return null;
            return (
              <Card key={profId}>
                <CardHeader className="bg-muted/50 py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {prof.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({prof.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Pedido</TableHead>
                        <TableHead>Datas da Folga</TableHead>
                        <TableHead className="text-center">Dias</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profRequests.map(req => (
                        <TableRow key={req.id}>
                          <TableCell className="text-sm">{format(new Date(req.requestDate), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {req.leaveDates.map(date => (
                                <span key={date} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                  {format(new Date(date), 'dd/MM')}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">{req.daysRequested}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{req.observations || '-'}</TableCell>
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

  // ── Credits Table ──
  const renderCreditsTable = (profs: typeof nurses, label: string) => (
    <Card>
      <CardHeader className="bg-muted/50 py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead className="text-center">Dias Trab.</TableHead>
              <TableHead className="text-center">FDS</TableHead>
              <TableHead className="text-center">Créditos +</TableHead>
              <TableHead className="text-center">Créditos −</TableHead>
              <TableHead className="text-center">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profs.map(prof => {
              const stats = getStatsForProfessional(prof.id, prof.name, prof.category);
              return (
                <TableRow key={prof.id}>
                  <TableCell className="font-medium">{prof.name}</TableCell>
                  <TableCell className="text-center">{stats.workedDays}</TableCell>
                  <TableCell className="text-center">
                    <span className="bg-warning/20 text-warning-foreground px-2 py-0.5 rounded text-sm">{stats.weekendDays}</span>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-accent">+{stats.creditsGenerated}</TableCell>
                  <TableCell className="text-center text-destructive">{stats.creditsUsed > 0 ? `-${stats.creditsUsed}` : '0'}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded font-bold",
                      stats.creditsBalance > 0 ? "bg-accent/15 text-accent"
                        : stats.creditsBalance < 0 ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {stats.creditsBalance}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderCreditsReport = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Extrato de Créditos — <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: ptBR })}</span></h2>
      {nurses.length > 0 && renderCreditsTable(nurses, 'Enfermeiros')}
      {techs.length > 0 && renderCreditsTable(techs, 'Técnicos')}
    </div>
  );

  const renderActiveReport = () => {
    switch (activeView) {
      case 'nurses': return renderCalendar('nurse');
      case 'techs': return renderCalendar('tech');
      case 'leaves': return renderLeaveReport();
      case 'credits': return renderCreditsReport();
      default: return null;
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Relatórios"
        description="Gere e imprima relatórios de escalas, folgas e créditos"
      />

      {/* Filtros */}
      <div className="form-section">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {activeView !== 'menu' && (
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          )}
        </div>
      </div>

      {activeView === 'menu' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reportCards.map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => setActiveView(card.id)}
                className="form-section cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-bold">{card.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('menu')}
            className="gap-1 no-print"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>

          <div className="form-section print-area">
            {renderActiveReport()}
          </div>
        </div>
      )}
    </div>
  );
}
