import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Printer, Users, Stethoscope, Syringe, TrendingUp, CalendarOff,
  BarChart3, Clock, Award, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ReportTab = 'summary' | 'nurses' | 'techs' | 'leaves' | 'credits';

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
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');

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

  const leaveTypeLabels: Record<string, string> = {
    folga_credito: 'Folga por Crédito',
    falta: 'Falta',
    atestado: 'Atestado',
    ferias: 'Férias',
    licenca: 'Licença',
    outro: 'Outro',
  };

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

  const tabs: { id: ReportTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'summary', label: 'Resumo', icon: BarChart3 },
    { id: 'nurses', label: 'Enfermeiros', icon: Stethoscope, badge: nurses.length },
    { id: 'techs', label: 'Técnicos', icon: Syringe, badge: techs.length },
    { id: 'leaves', label: 'Folgas', icon: CalendarOff, badge: monthLeaveRequests.length },
    { id: 'credits', label: 'Créditos', icon: TrendingUp },
  ];

  // ── KPI Card ──
  const KpiCard = ({ icon: Icon, label, value, color = 'text-primary', sub }: {
    icon: React.ElementType; label: string; value: string | number; color?: string; sub?: string;
  }) => (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-muted")}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  // ── Summary Report ──
  const renderSummary = () => (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Profissionais Ativos" value={summaryData.totalProfessionals} />
        <KpiCard icon={Clock} label="Dias Trabalhados" value={summaryData.totalWorkedDays} color="text-accent" />
        <KpiCard icon={Award} label="Dias de FDS" value={summaryData.totalWeekendDays} color="text-warning" sub={`${summaryData.totalCreditsGenerated} créditos gerados`} />
        <KpiCard icon={CalendarOff} label="Folgas no Mês" value={summaryData.totalLeaves} color="text-destructive" sub={`${summaryData.totalLeaveDays} dias totais`} />
      </div>

      {/* Credits balance bar */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Balanço de Créditos</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          {[
            { label: 'Gerados', value: `+${summaryData.totalCreditsGenerated}`, cls: 'text-accent' },
            { label: 'Utilizados', value: `−${summaryData.totalCreditsUsed}`, cls: 'text-destructive' },
            { label: 'Saldo', value: String(summaryData.totalCreditsBalance), cls: summaryData.totalCreditsBalance >= 0 ? 'text-accent' : 'text-destructive' },
          ].map(c => (
            <div key={c.label} className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={cn("text-2xl font-bold", c.cls)}>{c.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top workers */}
        {summaryData.topWorkers.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Award className="w-4 h-4 text-warning" />
              <span className="text-sm font-semibold">Top 5 — Mais Dias Trabalhados</span>
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
                    <p className="text-xs text-muted-foreground">{st.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{st.workedDays} dias</p>
                    <p className="text-[11px] text-muted-foreground">{st.weekendDays} FDS</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Leave distribution + alerts */}
        <div className="space-y-4">
          {/* Negative balance alerts */}
          {summaryData.negativeBalance.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">Saldo Negativo</span>
              </div>
              <div className="space-y-2">
                {summaryData.negativeBalance.map(st => (
                  <div key={st.professionalId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{st.professionalName}</span>
                    <span className="text-destructive font-bold">{st.creditsBalance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leave types */}
          {Object.keys(summaryData.leaveByType).length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold">Folgas por Tipo</span>
              </div>
              <CardContent className="p-4 space-y-3">
                {Object.entries(summaryData.leaveByType).map(([type, count]) => {
                  const total = summaryData.totalLeaves;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-foreground font-medium">{leaveTypeLabels[type] || type}</span>
                        <span className="text-muted-foreground text-xs">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <span className="text-sm font-semibold">Acesso Rápido</span>
            </div>
            <div className="divide-y divide-border">
              {[
                { tab: 'nurses' as ReportTab, label: 'Ver escala de enfermeiros', icon: Stethoscope },
                { tab: 'techs' as ReportTab, label: 'Ver escala de técnicos', icon: Syringe },
                { tab: 'credits' as ReportTab, label: 'Ver extrato de créditos', icon: TrendingUp },
              ].map(link => (
                <button
                  key={link.tab}
                  onClick={() => setActiveTab(link.tab)}
                  className="flex items-center gap-3 px-5 py-3 w-full text-left hover:bg-muted/50 transition-colors group"
                >
                  <link.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors flex-1">{link.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  // ── Calendar Render ──
  const renderCalendar = (type: 'nurse' | 'tech') => {
    const profs = type === 'nurse' ? nurses : techs;
    const entries = type === 'nurse' ? allEntries : techEntries;
    const statsGetter = type === 'nurse' ? getStatsForProfessional : getTechStats;
    const categoryStats = profs.map(p => statsGetter(p.id, p.name, p.category));
    const totalWorked = categoryStats.reduce((s, st) => s + st.workedDays, 0);
    const totalWeekend = categoryStats.reduce((s, st) => s + st.weekendDays, 0);

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard icon={Users} label="Profissionais" value={profs.length} />
          <KpiCard icon={Clock} label="Total Escalados" value={totalWorked} color="text-accent" />
          <KpiCard icon={Award} label="Dias FDS" value={totalWeekend} color="text-warning" />
        </div>

        <Card className="overflow-hidden">
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
                        <div key={entry.id} className="text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded truncate" title={prof?.name}>
                          {prof?.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Per-professional table */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Resumo Individual</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead className="text-center">Dias</TableHead>
                <TableHead className="text-center">FDS</TableHead>
                <TableHead className="text-center">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryStats.map(st => (
                <TableRow key={st.professionalId}>
                  <TableCell className="font-medium">{st.professionalName}</TableCell>
                  <TableCell className="text-center">{st.workedDays}</TableCell>
                  <TableCell className="text-center">
                    <span className="bg-warning/20 text-warning-foreground px-2 py-0.5 rounded text-xs font-medium">{st.weekendDays}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded font-bold text-xs",
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
        </Card>
      </div>
    );
  };

  // ── Leave Report ──
  const renderLeaves = () => {
    const grouped = monthLeaveRequests.reduce((acc, req) => {
      if (!acc[req.professionalId]) acc[req.professionalId] = [];
      acc[req.professionalId].push(req);
      return acc;
    }, {} as Record<string, typeof requests>);

    const totalDays = monthLeaveRequests.reduce((s, r) => s + r.daysRequested, 0);

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard icon={CalendarOff} label="Total Pedidos" value={monthLeaveRequests.length} color="text-destructive" />
          <KpiCard icon={Clock} label="Total de Dias" value={totalDays} />
          <KpiCard icon={Users} label="Profissionais" value={Object.keys(grouped).length} />
        </div>

        {Object.keys(grouped).length === 0 ? (
          <Card className="p-8 text-center">
            <CalendarOff className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum pedido de folga registrado para este mês.</p>
          </Card>
        ) : (
          Object.entries(grouped).map(([profId, profRequests]) => {
            const prof = professionals.find(p => p.id === profId);
            if (!prof) return null;
            return (
              <Card key={profId} className="overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">{prof.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {prof.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {profRequests.reduce((s, r) => s + r.daysRequested, 0)} dias
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Datas</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">
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
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{req.observations || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  // ── Credits Table ──
  const renderCreditsSection = (profs: typeof nurses, label: string, icon: React.ElementType, statsGetter: typeof getStatsForProfessional) => {
    const stats = profs.map(p => statsGetter(p.id, p.name, p.category));
    const totalGenerated = stats.reduce((s, st) => s + st.creditsGenerated, 0);
    const totalUsed = stats.reduce((s, st) => s + st.creditsUsed, 0);
    const Icon = icon;

    return (
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {label}
          </span>
          <span className="text-xs text-muted-foreground">
            Saldo: <span className={cn("font-bold", (totalGenerated - totalUsed) >= 0 ? "text-accent" : "text-destructive")}>
              {totalGenerated - totalUsed}
            </span>
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead className="text-center">Dias</TableHead>
              <TableHead className="text-center">FDS</TableHead>
              <TableHead className="text-center">Créd. +</TableHead>
              <TableHead className="text-center">Créd. −</TableHead>
              <TableHead className="text-center">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map(st => (
              <TableRow key={st.professionalId}>
                <TableCell className="font-medium">{st.professionalName}</TableCell>
                <TableCell className="text-center">{st.workedDays}</TableCell>
                <TableCell className="text-center">
                  <span className="bg-warning/20 text-warning-foreground px-2 py-0.5 rounded text-xs font-medium">{st.weekendDays}</span>
                </TableCell>
                <TableCell className="text-center font-semibold text-accent">+{st.creditsGenerated}</TableCell>
                <TableCell className="text-center text-destructive">{st.creditsUsed > 0 ? `−${st.creditsUsed}` : '0'}</TableCell>
                <TableCell className="text-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded font-bold text-xs",
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
      </Card>
    );
  };

  const renderCredits = () => (
    <div className="space-y-5">
      {/* Total overview */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border">
          {[
            { label: 'Total Gerados', value: `+${summaryData.totalCreditsGenerated}`, cls: 'text-accent' },
            { label: 'Total Utilizados', value: `−${summaryData.totalCreditsUsed}`, cls: 'text-destructive' },
            { label: 'Saldo Geral', value: String(summaryData.totalCreditsBalance), cls: summaryData.totalCreditsBalance >= 0 ? 'text-accent' : 'text-destructive' },
          ].map(c => (
            <div key={c.label} className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={cn("text-2xl font-bold", c.cls)}>{c.value}</p>
            </div>
          ))}
        </div>
      </Card>
      {nurses.length > 0 && renderCreditsSection(nurses, 'Enfermeiros', Stethoscope, getStatsForProfessional)}
      {techs.length > 0 && renderCreditsSection(techs, 'Técnicos', Syringe, getTechStats)}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'summary': return renderSummary();
      case 'nurses': return renderCalendar('nurse');
      case 'techs': return renderCalendar('tech');
      case 'leaves': return renderLeaves();
      case 'credits': return renderCredits();
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Relatórios"
        description={`${format(monthStart, "MMMM 'de' yyyy", { locale: ptBR })} — Visão completa das escalas`}
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button onClick={handlePrint} size="sm" variant="outline" className="gap-1.5 no-print">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          </div>
        }
      />

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-print">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={cn(
                  "text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="print-area">
        {renderContent()}
      </div>
    </div>
  );
}
