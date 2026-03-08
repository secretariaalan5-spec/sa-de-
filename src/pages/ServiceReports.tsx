import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Printer, Users, Stethoscope, Syringe, TrendingUp, CalendarOff, ChevronLeft,
  BarChart3, Clock, Award, AlertTriangle,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ReportView = 'menu' | 'nurses' | 'techs' | 'leaves' | 'credits' | 'summary';

export default function ServiceReportsPage() {
  const { professionals } = useServiceProfessionals();
  const { requests, getTotalCreditsUsedByProfessional } = useLeaveRequests();
  const { allEntries } = useServiceSchedule('nurse');
  const { allEntries: techEntries } = useServiceSchedule('tech');

  const { getStatsForProfessional } = useServiceStats({
    allEntries,
    getTotalCreditsUsedByProfessional,
  });

  const { getStatsForProfessional: getTechStats } = useServiceStats({
    allEntries: techEntries,
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

  // ── Summary stats ──
  const summaryData = useMemo(() => {
    const nurseStats = nurses.map(p => getStatsForProfessional(p.id, p.name, p.category));
    const techStats = techs.map(p => getTechStats(p.id, p.name, p.category));
    const allStats = [...nurseStats, ...techStats];

    const totalWorkedDays = allStats.reduce((s, st) => s + st.workedDays, 0);
    const totalWeekendDays = allStats.reduce((s, st) => s + st.weekendDays, 0);
    const totalCreditsGenerated = allStats.reduce((s, st) => s + st.creditsGenerated, 0);
    const totalCreditsUsed = allStats.reduce((s, st) => s + st.creditsUsed, 0);
    const totalLeaves = monthLeaveRequests.length;
    const totalLeaveDays = monthLeaveRequests.reduce((s, r) => s + r.daysRequested, 0);

    const negativeBalance = allStats.filter(st => st.creditsBalance < 0);
    const topWorkers = [...allStats].sort((a, b) => b.workedDays - a.workedDays).slice(0, 5);

    // Leave types distribution
    const leaveByType: Record<string, number> = {};
    monthLeaveRequests.forEach(r => {
      leaveByType[r.leaveType] = (leaveByType[r.leaveType] || 0) + 1;
    });

    return {
      totalProfessionals: nurses.length + techs.length,
      totalWorkedDays,
      totalWeekendDays,
      totalCreditsGenerated,
      totalCreditsUsed,
      totalCreditsBalance: totalCreditsGenerated - totalCreditsUsed,
      totalLeaves,
      totalLeaveDays,
      negativeBalance,
      topWorkers,
      leaveByType,
      nurseStats,
      techStats,
    };
  }, [nurses, techs, getStatsForProfessional, getTechStats, monthLeaveRequests]);

  const leaveTypeLabels: Record<string, string> = {
    folga_credito: 'Folga por Crédito',
    falta: 'Falta',
    atestado: 'Atestado',
    ferias: 'Férias',
    licenca: 'Licença',
    outro: 'Outro',
  };

  const reportCards = [
    { id: 'summary' as ReportView, title: 'Resumo Geral', description: 'Visão consolidada do mês', icon: BarChart3, count: null, accent: 'from-primary/20 to-primary/5' },
    { id: 'nurses' as ReportView, title: 'Escala de Enfermeiros', description: 'Calendário mensal dos enfermeiros', icon: Stethoscope, count: nurses.length, accent: 'from-accent/20 to-accent/5' },
    { id: 'techs' as ReportView, title: 'Escala de Técnicos', description: 'Calendário mensal dos técnicos', icon: Syringe, count: techs.length, accent: 'from-warning/20 to-warning/5' },
    { id: 'leaves' as ReportView, title: 'Pedidos de Folga', description: 'Folgas registradas no mês', icon: CalendarOff, count: monthLeaveRequests.length, accent: 'from-destructive/15 to-destructive/5' },
    { id: 'credits' as ReportView, title: 'Extrato de Créditos', description: 'Saldo de créditos por profissional', icon: TrendingUp, count: nurses.length + techs.length, accent: 'from-accent/20 to-accent/5' },
  ];

  // ── Summary Report ──
  const renderSummaryReport = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        Resumo Geral — <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: ptBR })}</span>
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Profissionais Ativos', value: summaryData.totalProfessionals, icon: Users, color: 'text-primary' },
          { label: 'Total Dias Trabalhados', value: summaryData.totalWorkedDays, icon: Clock, color: 'text-accent' },
          { label: 'Dias de FDS', value: summaryData.totalWeekendDays, icon: Award, color: 'text-warning' },
          { label: 'Folgas no Mês', value: summaryData.totalLeaves, icon: CalendarOff, color: 'text-destructive' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={cn("w-4 h-4", kpi.color)} />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Credits overview */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/20">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Balanço de Créditos
          </h3>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Gerados</p>
            <p className="text-xl font-bold text-accent">+{summaryData.totalCreditsGenerated}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Utilizados</p>
            <p className="text-xl font-bold text-destructive">−{summaryData.totalCreditsUsed}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Saldo Total</p>
            <p className={cn("text-xl font-bold", summaryData.totalCreditsBalance >= 0 ? "text-accent" : "text-destructive")}>
              {summaryData.totalCreditsBalance}
            </p>
          </div>
        </div>
      </div>

      {/* Negative balance alerts */}
      {summaryData.negativeBalance.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">Profissionais com Saldo Negativo</h3>
          </div>
          <div className="space-y-2">
            {summaryData.negativeBalance.map(st => (
              <div key={st.professionalId} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{st.professionalName}</span>
                <span className="text-destructive font-bold">{st.creditsBalance} créditos</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top workers */}
      {summaryData.topWorkers.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-warning" />
              Top 5 — Mais Dias Trabalhados
            </h3>
          </div>
          <div className="divide-y divide-border">
            {summaryData.topWorkers.map((st, i) => (
              <div key={st.professionalId} className="flex items-center gap-3 px-5 py-3">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  i === 0 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{st.professionalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {st.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{st.workedDays} dias</p>
                  <p className="text-[11px] text-muted-foreground">{st.weekendDays} FDS</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave types distribution */}
      {Object.keys(summaryData.leaveByType).length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-destructive" />
              Distribuição de Folgas por Tipo
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(summaryData.leaveByType).map(([type, count]) => {
              const total = summaryData.totalLeaves;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{leaveTypeLabels[type] || type}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── Calendar Render ──
  const renderCalendar = (type: 'nurse' | 'tech') => {
    const profs = type === 'nurse' ? nurses : techs;
    const entries = type === 'nurse' ? allEntries : techEntries;
    const typeLabel = type === 'nurse' ? 'Enfermeiros' : 'Técnicos';

    // Summary stats for this category
    const statsGetter = type === 'nurse' ? getStatsForProfessional : getTechStats;
    const categoryStats = profs.map(p => statsGetter(p.id, p.name, p.category));
    const totalWorked = categoryStats.reduce((s, st) => s + st.workedDays, 0);
    const totalWeekend = categoryStats.reduce((s, st) => s + st.weekendDays, 0);

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Escala de {typeLabel} — <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: ptBR })}</span></h2>

        {/* Category KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Profissionais</p>
            <p className="text-xl font-bold text-foreground">{profs.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Escalados</p>
            <p className="text-xl font-bold text-foreground">{totalWorked}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Dias FDS</p>
            <p className="text-xl font-bold text-warning">{totalWeekend}</p>
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

        {/* Per-professional summary table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold">Resumo Individual</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead className="text-center">Dias Escalados</TableHead>
                <TableHead className="text-center">FDS</TableHead>
                <TableHead className="text-center">Créditos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryStats.map(st => (
                <TableRow key={st.professionalId}>
                  <TableCell className="font-medium">{st.professionalName}</TableCell>
                  <TableCell className="text-center">{st.workedDays}</TableCell>
                  <TableCell className="text-center">
                    <span className="bg-warning/20 text-warning-foreground px-2 py-0.5 rounded text-sm">{st.weekendDays}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded font-bold text-sm",
                      st.creditsBalance > 0 ? "bg-accent/15 text-accent"
                        : st.creditsBalance < 0 ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {st.creditsBalance}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

    const totalDays = monthLeaveRequests.reduce((s, r) => s + r.daysRequested, 0);

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pedidos de Folga — <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: ptBR })}</span></h2>

        {/* Leave KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Total de Pedidos</p>
            <p className="text-xl font-bold text-foreground">{monthLeaveRequests.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Total de Dias</p>
            <p className="text-xl font-bold text-foreground">{totalDays}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Profissionais</p>
            <p className="text-xl font-bold text-foreground">{Object.keys(grouped).length}</p>
          </div>
        </div>

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
                    <span className="ml-auto text-xs font-medium text-muted-foreground">
                      {profRequests.reduce((s, r) => s + r.daysRequested, 0)} dias
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Datas</TableHead>
                        <TableHead className="text-center">Dias</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profRequests.map(req => (
                        <TableRow key={req.id}>
                          <TableCell className="text-sm">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                              {leaveTypeLabels[req.leaveType] || req.leaveType}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {req.leaveDates.map(date => (
                                <span key={date} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
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
  const renderCreditsTable = (profs: typeof nurses, label: string, statsGetter: typeof getStatsForProfessional) => {
    const stats = profs.map(p => statsGetter(p.id, p.name, p.category));
    const totalGenerated = stats.reduce((s, st) => s + st.creditsGenerated, 0);
    const totalUsed = stats.reduce((s, st) => s + st.creditsUsed, 0);

    return (
      <Card>
        <CardHeader className="bg-muted/50 py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {label}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Saldo: <span className={cn("font-bold", (totalGenerated - totalUsed) >= 0 ? "text-accent" : "text-destructive")}>
                {totalGenerated - totalUsed}
              </span>
            </span>
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
              {stats.map(st => (
                <TableRow key={st.professionalId}>
                  <TableCell className="font-medium">{st.professionalName}</TableCell>
                  <TableCell className="text-center">{st.workedDays}</TableCell>
                  <TableCell className="text-center">
                    <span className="bg-warning/20 text-warning-foreground px-2 py-0.5 rounded text-sm">{st.weekendDays}</span>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-accent">+{st.creditsGenerated}</TableCell>
                  <TableCell className="text-center text-destructive">{st.creditsUsed > 0 ? `−${st.creditsUsed}` : '0'}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded font-bold",
                      st.creditsBalance > 0 ? "bg-accent/15 text-accent"
                        : st.creditsBalance < 0 ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {st.creditsBalance}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderCreditsReport = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Extrato de Créditos — <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: ptBR })}</span></h2>
      {nurses.length > 0 && renderCreditsTable(nurses, 'Enfermeiros', getStatsForProfessional)}
      {techs.length > 0 && renderCreditsTable(techs, 'Técnicos', getTechStats)}
    </div>
  );

  const renderActiveReport = () => {
    switch (activeView) {
      case 'summary': return renderSummaryReport();
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportCards.map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => setActiveView(card.id)}
                className="form-section cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden"
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity rounded-lg", card.accent)} />
                <div className="relative flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{card.title}</h3>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>
                  {card.count !== null && (
                    <div className="text-right shrink-0">
                      <span className="text-xl font-bold">{card.count}</span>
                    </div>
                  )}
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
