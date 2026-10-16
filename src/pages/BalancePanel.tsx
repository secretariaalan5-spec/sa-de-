/**
 * Painel de Relatórios & Saldo de Folgas
 * Visualização e controle de dias escalados, folgas concedidas e saldo de créditos com filtros por período, unidade e categoria.
 */
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText,
  Search,
  CalendarDays,
  CalendarOff,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Printer,
  MapPin,
  Tag,
  Eye,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmployeeDetailDialog from '@/components/EmployeeDetailDialog';

interface Employee {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
}

interface Schedule {
  id: string;
  employee_id: string;
  date: string;
  type: string;
  shift_type: string;
  credit_amount: number;
  observations: string | null;
}

interface LeaveReq {
  id: string;
  employee_id: string;
  leave_dates: string[];
  days_requested: number;
  observations: string | null;
  status: string;
  created_at: string;
}

interface Credit {
  employee_id: string;
  amount: number;
  origin: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Unit {
  id: string;
  name: string;
}

export default function BalancePanel() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const load = async () => {
    if (!roleInfo?.team_id) return;
    const teamId = roleInfo.team_id;

    let employeesQuery = supabase
      .from('employees')
      .select('id, name, category_id, unit_id')
      .eq('active', true)
      .eq('team_id', teamId)
      .order('name');

    // Segregação estrita por nível
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) {
      employeesQuery = employeesQuery.eq('unit_id', roleInfo.unit_id);
    }

    const [empRes, catRes, unitRes, credRes, schedRes, leaveRes] = await Promise.all([
      employeesQuery,
      supabase.from('categories').select('id, name, color').eq('active', true).eq('team_id', teamId),
      supabase.from('units').select('id, name').eq('active', true).eq('team_id', teamId),
      supabase.from('leave_credits').select('employee_id, amount, origin').eq('team_id', teamId),
      supabase.from('schedules').select('id, employee_id, date, type, shift_type, credit_amount, observations').eq('team_id', teamId),
      supabase.from('leave_requests').select('id, employee_id, leave_dates, days_requested, observations, status, created_at').eq('team_id', teamId).eq('status', 'approved'),
    ]);

    setEmployees(empRes.data ?? []);
    setCategories(catRes.data ?? []);
    setUnits(unitRes.data ?? []);
    setCredits(credRes.data ?? []);
    setSchedules(schedRes.data ?? []);
    setLeaves(leaveRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [roleInfo?.team_id]);

  useDataSubscription(['employees', 'leave_credits', 'categories', 'units', 'schedules', 'leave_requests'], load);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const unitMap = useMemo(() => new Map(units.map(u => [u.id, u.name])), [units]);

  const getCat = (id: string | null) => (id ? catMap.get(id) : null);
  const getUnitName = (id: string | null) => (id ? (unitMap.get(id) ?? '—') : '—');

  const fmtCredit = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ','));

  // Processa dados consolidados por profissional
  const processedRows = useMemo(() => {
    return employees.map(emp => {
      // Saldo de créditos total
      const empCredits = credits.filter(c => c.employee_id === emp.id);
      const grossExtras = empCredits.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
      const adjustments = Math.abs(empCredits.filter(c => c.amount < 0 && c.origin !== 'leave_used').reduce((s, c) => s + c.amount, 0));
      const extras = grossExtras - adjustments;
      const used = Math.abs(empCredits.filter(c => c.amount < 0 && c.origin === 'leave_used').reduce((s, c) => s + c.amount, 0));
      const balance = extras - used;

      // Escalas no mês selecionado
      const empSchedulesMonth = schedules
        .filter(s => s.employee_id === emp.id && s.date.startsWith(monthPrefix))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Folgas tiradas no mês selecionado
      const empLeavesMonth: { date: string; observations: string | null }[] = [];
      leaves
        .filter(l => l.employee_id === emp.id)
        .forEach(l => {
          (l.leave_dates || []).forEach(d => {
            if (d.startsWith(monthPrefix)) {
              empLeavesMonth.push({
                date: d,
                observations: l.observations,
              });
            }
          });
        });
      empLeavesMonth.sort((a, b) => a.date.localeCompare(b.date));

      return {
        employee: emp,
        category: getCat(emp.category_id),
        unitName: getUnitName(emp.unit_id),
        balance,
        schedulesMonth: empSchedulesMonth,
        leavesMonth: empLeavesMonth,
      };
    });
  }, [employees, credits, schedules, leaves, monthPrefix, catMap, unitMap]);

  // Aplicação dos filtros
  const filtered = useMemo(() => {
    return processedRows.filter(row => {
      const nameMatch = row.employee.name.toLowerCase().includes(search.toLowerCase());
      const catMatch = filterCat === 'all' || row.employee.category_id === filterCat;
      const unitMatch = filterUnit === 'all' || row.employee.unit_id === filterUnit;
      return nameMatch && catMatch && unitMatch;
    });
  }, [processedRows, search, filterCat, filterUnit]);

  // Totais do mês para os cards de resumo
  const totalSchedulesInMonth = filtered.reduce((acc, r) => acc + r.schedulesMonth.length, 0);
  const totalLeavesInMonth = filtered.reduce((acc, r) => acc + r.leavesMonth.length, 0);
  const totalBalanceFiltered = filtered.reduce((acc, r) => acc + r.balance, 0);

  const showCategoryFilter = isAdmin || isRH;
  const showUnitFilter = isAdmin || isRH || isChief;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:p-0">
      {/* Header oficial */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={24} className="text-primary" />
            Relatórios de Escalas & Folgas
          </h1>
          <p className="text-muted-foreground text-sm">
            Acompanhamento mensal de dias trabalhados, folgas concedidas e saldo de créditos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="gap-2 bg-card border-border hover:bg-muted"
          >
            <Printer size={16} />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      {/* Cabeçalho impresso (visível apenas na impressão) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h2 className="text-xl font-bold">Secretaria Municipal de Saúde</h2>
        <h3 className="text-base font-semibold text-gray-700">Relatório Mensal de Escalas e Folgas</h3>
        <p className="text-xs text-gray-500 mt-1">
          Período de Referência: <strong className="capitalize">{monthLabel}</strong> | Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Summary Cards — estilo padrão idêntico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <CalendarDays size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{totalSchedulesInMonth}</p>
            <p className="text-xs text-muted-foreground">Escalas no Mês</p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <CalendarOff size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{totalLeavesInMonth}</p>
            <p className="text-xs text-muted-foreground">Folgas Concedidas no Mês</p>
          </div>
        </div>

        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <Wallet size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{fmtCredit(totalBalanceFiltered)}</p>
            <p className="text-xs text-muted-foreground">Saldo Total de Folgas</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros — estilo padrão idêntico a Employees.tsx */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border p-3 print:hidden">
        {/* Seletor de Mês */}
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1 border border-border">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs font-semibold capitalize min-w-[120px] text-center">
            {monthLabel}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={goToday}>
            Hoje
          </Button>
        </div>

        {/* Busca por Nome */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar profissional..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Filtro de Categoria */}
        {showCategoryFilter && (
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro de Unidade */}
        {showUnitFilter && (
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Unidades</SelectItem>
              {units.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground print:hidden">
        <span>{filtered.length} profissional(is) no relatório</span>
        <span className="capitalize">Referência: {monthLabel}</span>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando relatório...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state py-12">
          <FileText className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum profissional encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {/* Visualização Mobile: Cards */}
          <div className="space-y-4 sm:hidden print:hidden">
            {filtered.map(row => (
              <div key={row.employee.id} className="page-card p-4 space-y-3.5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-foreground">{row.employee.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {row.category && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                          style={{
                            backgroundColor: `${row.category.color}15`,
                            borderColor: `${row.category.color}40`,
                            color: row.category.color,
                          }}
                        >
                          {row.category.name}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin size={10} /> {row.unitName}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={row.balance > 0 ? 'default' : row.balance < 0 ? 'destructive' : 'secondary'}
                    className="font-mono font-bold"
                  >
                    Saldo: {row.balance > 0 ? `+${fmtCredit(row.balance)}` : fmtCredit(row.balance)}
                  </Badge>
                </div>

                {/* Dias Escalados */}
                <div className="bg-muted/30 p-2.5 rounded-lg space-y-1.5 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                      <CalendarDays size={13} /> Dias Escalados ({row.schedulesMonth.length})
                    </span>
                  </div>
                  {row.schedulesMonth.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Nenhuma escala neste mês</p>
                  ) : (
                    <div className="flex flex-col gap-1 pt-1">
                      {row.schedulesMonth.map(s => (
                        <div key={s.id} className="text-xs flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-[10px] bg-background">
                            {new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </Badge>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            ({s.shift_type === 'half' ? 'Meio Turno' : 'Integral'})
                          </span>
                          {s.observations && (
                            <span className="text-[11px] text-foreground/80 truncate">
                              • {s.observations}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dias de Folga */}
                <div className="bg-muted/30 p-2.5 rounded-lg space-y-1.5 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-amber-600">
                      <CalendarOff size={13} /> Folgas Tiradas ({row.leavesMonth.length})
                    </span>
                  </div>
                  {row.leavesMonth.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Nenhuma folga neste mês</p>
                  ) : (
                    <div className="flex flex-col gap-1 pt-1">
                      {row.leavesMonth.map((l, idx) => (
                        <div key={idx} className="text-xs flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-[10px] bg-background text-amber-600 border-amber-300">
                            {new Date(l.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </Badge>
                          {l.observations && (
                            <span className="text-[11px] text-foreground/80 truncate">
                              • {l.observations}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary"
                    onClick={() => setDetailEmp(row.employee)}
                  >
                    <Eye size={12} /> Ver Histórico Completo
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Visualização Desktop: Tabela de Relatório */}
          <div className="hidden sm:block print:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-4 font-semibold w-[220px]">Profissional</th>
                    <th className="px-5 py-4 font-semibold w-[140px]">Lotação</th>
                    <th className="px-5 py-4 font-semibold">Dias Escalados no Mês</th>
                    <th className="px-5 py-4 font-semibold">Folgas no Mês</th>
                    <th className="px-5 py-4 font-semibold text-center w-[110px]">Saldo Total</th>
                    <th className="px-4 py-4 font-semibold text-right w-[80px] print:hidden">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(row => (
                    <tr key={row.employee.id} className="hover:bg-muted/20 transition-colors">
                      {/* Profissional */}
                      <td className="px-5 py-3.5 align-top">
                        <p className="font-semibold text-foreground text-sm leading-snug">
                          {row.employee.name}
                        </p>
                        {row.category && (
                          <span
                            className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mt-1"
                            style={{
                              backgroundColor: `${row.category.color}15`,
                              borderColor: `${row.category.color}40`,
                              color: row.category.color,
                            }}
                          >
                            {row.category.name}
                          </span>
                        )}
                      </td>

                      {/* Lotação */}
                      <td className="px-5 py-3.5 align-top text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{row.unitName}</span>
                        </span>
                      </td>

                      {/* Dias Escalados */}
                      <td className="px-5 py-3.5 align-top">
                        {row.schedulesMonth.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary mb-1">
                              <CalendarDays size={12} /> {row.schedulesMonth.length} dia(s)
                            </span>
                            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                              {row.schedulesMonth.map(s => (
                                <div key={s.id} className="text-xs flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="font-mono text-[11px] bg-background px-1.5 py-0">
                                    {new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {s.shift_type === 'half' ? '½' : 'Int'}
                                  </span>
                                  {s.observations ? (
                                    <span className="text-[11px] text-foreground/80 font-normal truncate max-w-[280px]" title={s.observations}>
                                      • {s.observations}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/60">• Plantão</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Folgas no Mês */}
                      <td className="px-5 py-3.5 align-top">
                        {row.leavesMonth.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 mb-1">
                              <CalendarOff size={12} /> {row.leavesMonth.length} folga(s)
                            </span>
                            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                              {row.leavesMonth.map((l, idx) => (
                                <div key={idx} className="text-xs flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="font-mono text-[11px] bg-background text-amber-600 border-amber-300 px-1.5 py-0">
                                    {new Date(l.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </Badge>
                                  {l.observations && (
                                    <span className="text-[11px] text-foreground/80 font-normal truncate max-w-[250px]" title={l.observations}>
                                      • {l.observations}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Saldo Total */}
                      <td className="px-5 py-3.5 align-top text-center">
                        <Badge
                          variant={row.balance > 0 ? 'default' : row.balance < 0 ? 'destructive' : 'secondary'}
                          className="font-mono font-bold text-xs"
                        >
                          {row.balance > 0 ? `+${fmtCredit(row.balance)}` : fmtCredit(row.balance)}
                        </Badge>
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-3.5 align-top text-right print:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver Histórico Completo"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => setDetailEmp(row.employee)}
                        >
                          <Eye size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Detalhes do Profissional (reaproveitamento do componente padrão) */}
      <EmployeeDetailDialog
        employeeId={detailEmp?.id ?? null}
        employeeName={detailEmp?.name ?? ''}
        open={!!detailEmp}
        onOpenChange={o => {
          if (!o) setDetailEmp(null);
        }}
      />
    </div>
  );
}
