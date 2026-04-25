import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, CalendarDays, Trash2, ChevronLeft, ChevronRight, List, LayoutGrid, Sun, Moon, TrendingUp, Star, User, MapPin, Tag, Wallet, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Schedule {
  id: string;
  employee_id: string;
  date: string;
  type: string;
  shift_type: string;
  credit_amount: number;
  unit_id: string | null;
  created_at: string;
}

interface Employee { id: string; name: string; category_id: string | null; unit_id: string | null; active?: boolean; }
interface Unit { id: string; name: string; }
interface Category { id: string; name: string; }
interface Credit { employee_id: string; amount: number; }
interface Holiday { id: string; date: string; name: string; }

export default function Schedules() {
  const { roleInfo, isAdmin, isChief, isRH, isManager } = useAuthContext();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [approvedLeaveDates, setApprovedLeaveDates] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [empId, setEmpId] = useState('');
  const [type, setType] = useState('extra');
  const [shiftType, setShiftType] = useState<'full' | 'half'>('full');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterEmpId, setFilterEmpId] = useState('all');

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const canCreate = isAdmin || isChief;

  const load = async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    const schedulesQuery = supabase.from('schedules').select('*').eq('team_id', teamId).order('date', { ascending: false }).limit(500);
    let employeesQuery = supabase.from('employees').select('id, name, category_id, unit_id, active').eq('team_id', teamId).order('name');
    const unitsQuery = supabase.from('units').select('id, name').eq('team_id', teamId);
    const categoriesQuery = supabase.from('categories').select('id, name').eq('team_id', teamId);
    const creditsQuery = supabase.from('leave_credits').select('employee_id, amount').eq('team_id', teamId);
    const lrQuery = supabase.from('leave_requests').select('employee_id, leave_dates').eq('team_id', teamId).eq('status', 'approved').limit(200);
    const pendingLrQuery = supabase.from('leave_requests').select('employee_id, leave_dates').eq('team_id', teamId).eq('status', 'pending').limit(200);
    const holidaysQuery = supabase.from('holidays').select('id, date, name').eq('team_id', teamId).order('date');

    // Filtro Explícito: Chefe de Categoria só pode escalar seus próprios funcionários
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }

    const [s, e, u, cat, cred, lr, pendingLr, h] = await Promise.all([
      schedulesQuery,
      employeesQuery,
      unitsQuery,
      categoriesQuery,
      creditsQuery,
      lrQuery,
      pendingLrQuery,
      holidaysQuery
    ]);
    setSchedules(s.data ?? []);
    setEmployees(e.data ?? []);
    setUnits(u.data ?? []);
    setCategories(cat.data ?? []);
    setCredits(cred.data ?? []);
    setHolidays(h.data ?? []);

    // Build a map of employee_id -> approved + pending leave dates
    const leaveMap: Record<string, string[]> = {};
    [...(lr.data ?? []), ...(pendingLr.data ?? [])].forEach((r: any) => {
      if (!leaveMap[r.employee_id]) leaveMap[r.employee_id] = [];
      leaveMap[r.employee_id].push(...(r.leave_dates ?? []));
    });
    setApprovedLeaveDates(leaveMap);
  };

  useEffect(() => { load(); }, [roleInfo?.team_id]);
  useDataSubscription(['schedules', 'employees', 'leave_requests', 'holidays', 'units', 'categories', 'leave_credits'], load);

  const unitMap = useMemo(() => {
    const map = new Map<string, string>();
    units.forEach(u => map.set(u.id, u.name));
    return map;
  }, [units]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const getUnitName = (unitId: string | null) => unitId ? (unitMap.get(unitId) ?? '') : '';
  const getCategoryName = (catId: string | null) => catId ? (categoryMap.get(catId) ?? '') : '';

  const getCategoryTheme = (catName: string) => {
    if (!catName) return { bg: 'bg-primary/5', border: 'border-primary/20', text: 'text-primary', hexBg: '#f3f4f6', hexText: '#000000' };
    const themes = [
      { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-400', hexBg: '#0e6931', hexText: '#ffffff' }, // Verde escuro
      { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-700 dark:text-purple-400', hexBg: '#c3addb', hexText: '#000000' }, // Roxo claro
      { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-700 dark:text-teal-400', hexBg: '#95cdca', hexText: '#000000' }, // Teal
      { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-700 dark:text-green-400', hexBg: '#b5d0ac', hexText: '#000000' }, // Verde claro
      { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-700 dark:text-rose-400', hexBg: '#e6a5b6', hexText: '#000000' }, // Rosa
      { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-700 dark:text-amber-400', hexBg: '#f2d48f', hexText: '#000000' }, // Amarelo
      { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-700 dark:text-blue-400', hexBg: '#9cbadd', hexText: '#000000' }, // Azul claro
    ];
    let hash = 0;
    for (let i = 0; i < catName.length; i++) {
      hash = catName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return themes[Math.abs(hash) % themes.length];
  };

  const getEmpBalance = (employeeId: string) =>
    credits.filter(c => c.employee_id === employeeId).reduce((s, c) => s + c.amount, 0);

  const getEmpSchedulesThisMonth = (employeeId: string) =>
    schedules.filter(s => {
      const d = new Date(s.date + 'T12:00:00');
      return s.employee_id === employeeId && d.getMonth() === month && d.getFullYear() === year;
    }).length;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const holidayDatesSet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  const isHoliday = (dateStr: string) => holidayDatesSet.has(dateStr);
  const isWeekend = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
  };

  /** Calculate credit amount for a given date and shift type */
  const calcCredit = (dateStr: string, shift: 'full' | 'half'): number => {
    const base = (isWeekend(dateStr) || isHoliday(dateStr)) ? 2 : 1;
    return shift === 'half' ? base / 2 : base;
  };

  /** Total credits for all selected dates with current shift type */
  const totalCreditsPreview = useMemo(() => {
    return selectedDates.reduce((sum, d) => sum + calcCredit(d, shiftType), 0);
  }, [selectedDates, shiftType, holidayDatesSet]);

  const schedulesForDay = (day: number) => {
    const dateStr = getDateStr(day);
    return schedules.filter(s => s.date === dateStr);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const isLeaveDay = (empId: string, dateStr: string) => {
    return approvedLeaveDates[empId]?.includes(dateStr) ?? false;
  };

  const isAlreadyScheduled = (empId: string, dateStr: string) => {
    return schedules.some(s => s.employee_id === empId && s.date === dateStr);
  };

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleAdd = async () => {
    if (!empId || selectedDates.length === 0) {
      toast.error('Selecione funcionário e datas.');
      return;
    }

    if (!roleInfo?.team_id) {
      toast.error('Permissões ainda não carregadas. Recarregue a página e tente novamente.');
      return;
    }

    const conflictLeave = selectedDates.filter(d => isLeaveDay(empId, d));
    if (conflictLeave.length > 0) {
      const formatted = conflictLeave.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      toast.error(`Conflito: o profissional tem folga aprovada em ${formatted}`);
      return;
    }

    const conflictSchedule = selectedDates.filter(d => isAlreadyScheduled(empId, d));
    if (conflictSchedule.length > 0) {
      const formatted = conflictSchedule.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      toast.error(`Conflito: já existe escala em ${formatted}`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const inserts = selectedDates.map(date => ({
      employee_id: empId,
      date,
      type,
      shift_type: shiftType,
      team_id: roleInfo.team_id,
      created_by: user?.id ?? null,
    }));

    const { error } = await supabase.from('schedules').insert(inserts);
    if (error) {
      toast.error(error.message || 'Erro ao criar escala(s).');
      return;
    }

    const creditText = totalCreditsPreview % 1 === 0 ? totalCreditsPreview.toString() : totalCreditsPreview.toFixed(1);
    toast.success(`${selectedDates.length} escala(s) criada(s)! +${creditText} crédito(s) total.`);
    setOpen(false);
    setEmpId('');
    setSelectedDates([]);
    setType('extra');
    setShiftType('full');
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) { toast.error(error.message || 'Erro ao remover escala.'); return; }
    toast.success('Escala removida. Créditos devolvidos automaticamente.');
    load();
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? '—';
  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const roleDescription = isRH
    ? 'Visualização de todas as escalas'
    : isManager
    ? 'Escalas da sua unidade (somente visualização)'
    : isChief
    ? 'Escalas da sua categoria'
    : 'Todas as escalas';

  // Set of active employee IDs for filtering displayed schedules
  const activeEmployeeIds = useMemo(
    () => new Set(employees.filter(e => e.active !== false).map(e => e.id)),
    [employees]
  );

  const monthSchedules = useMemo(() => schedules.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d.getMonth() === month && d.getFullYear() === year && activeEmployeeIds.has(s.employee_id);
  }).sort((a, b) => a.date.localeCompare(b.date)), [schedules, month, year, activeEmployeeIds]);

  // E1: KPI metrics for the current month
  const kpiMetrics = useMemo(() => {
    const specialDays = monthSchedules.filter(s => {
      const d = new Date(s.date + 'T12:00:00');
      return d.getDay() === 0 || d.getDay() === 6 || holidayDatesSet.has(s.date);
    }).length;
    const totalCredits = monthSchedules.reduce((sum, s) => sum + (Number(s.credit_amount) || 0), 0);
    return { total: monthSchedules.length, specialDays, totalCredits };
  }, [monthSchedules, holidayDatesSet]);

  // E4: Filtered list schedules by employee
  const filteredListSchedules = useMemo(() =>
    filterEmpId === 'all' ? monthSchedules : monthSchedules.filter(s => s.employee_id === filterEmpId),
    [monthSchedules, filterEmpId]
  );

  // Check if a day has a leave for the selected employee (dialog mini calendar)
  const isDayLeaveForSelected = (day: number) => {
    if (!empId) return false;
    return isLeaveDay(empId, getDateStr(day));
  };

  const isDayScheduledForSelected = (day: number) => {
    if (!empId) return false;
    return isAlreadyScheduled(empId, getDateStr(day));
  };

  const formatCredit = (amount: number) => {
    if (amount % 1 === 0) return amount.toString();
    return amount.toFixed(1).replace('.', ',');
  };

  const getHolidayName = (dateStr: string) => holidays.find(h => h.date === dateStr)?.name;

  /** Badge label for credit in list view */
  const creditBadgeLabel = (s: Schedule) => {
    const amt = Number(s.credit_amount) || 0;
    const shiftLabel = s.shift_type === 'half' ? '½T' : '';
    return `Extra +${formatCredit(amt)}${shiftLabel ? ` ${shiftLabel}` : ''}`;
  };

  const memoizedCalendar = useMemo(() => (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
      {weekDays.map(d => (
        <div key={d} className="bg-primary text-primary-foreground text-center py-2 text-[10px] sm:text-xs font-semibold">{d}</div>
      ))}
      {calendarDays.map((day, i) => {
        if (day === null) return <div key={`e-${i}`} className="bg-card min-h-[60px] sm:min-h-[80px]" />;
        // Only show schedules from active employees in the calendar
        const daySchedules = schedulesForDay(day).filter(s => activeEmployeeIds.has(s.employee_id));
        const dateStr = getDateStr(day);
        const holidayName = getHolidayName(dateStr);
        const wkend = isWeekend(dateStr);
        return (
          <div key={day} className={cn(
            'bg-card min-h-[60px] sm:min-h-[80px] p-1 sm:p-1.5 relative transition-colors',
            isToday(day) && 'ring-1 sm:ring-2 ring-primary ring-inset',
            (wkend || holidayName) && 'bg-amber-50/50 dark:bg-amber-950/20'
          )}>
            <div className="flex items-center gap-1">
              <span className={cn('text-[10px] sm:text-xs font-medium inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full', isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground')}>{day}</span>
              {holidayName && <span className="text-[8px] text-amber-600 dark:text-amber-400 truncate" title={holidayName}>🎉</span>}
            </div>
            <div className="mt-0.5 space-y-0.5 overflow-hidden">
              {daySchedules.slice(0, 2).map(s => (
                <div key={s.id} className={cn(
                  'text-[8px] sm:text-[10px] px-1 py-0.5 rounded truncate',
                  s.type === 'extra' ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary'
                )} title={`${getEmpName(s.employee_id)}`}>
                  {getEmpName(s.employee_id).split(' ')[0]}
                </div>
              ))}
              {daySchedules.length > 2 && <p className="text-[8px] sm:text-[10px] text-muted-foreground text-center">+{daySchedules.length - 2}</p>}
            </div>
          </div>
        );
      })}
    </div>
  ), [calendarDays, month, year, schedules, holidays]);

  const memoizedList = useMemo(() => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
          <tr>
            <th className="px-5 py-4 font-semibold">Funcionário</th>
            <th className="px-5 py-4 font-semibold">Data</th>
            <th className="px-5 py-4 font-semibold">Turno</th>
            <th className="px-5 py-4 font-semibold">Créditos</th>
            {canCreate && <th className="px-5 py-4 font-semibold text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {monthSchedules.map(s => {
            const amt = Number(s.credit_amount) || 0;
            const holidayName = getHolidayName(s.date);
            return (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                <td className="px-5 py-3.5 font-medium text-foreground">{getEmpName(s.employee_id)}</td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  <span>{new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  {holidayName && <span className="ml-1.5 text-[10px] text-amber-600">🎉 {holidayName}</span>}
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant="secondary" className={cn(
                    'shadow-none text-xs',
                    s.shift_type === 'half'
                      ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
                      : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
                  )}>
                    {s.shift_type === 'half' ? '½ Turno' : 'Integral'}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 shadow-none">
                    +{formatCredit(amt)}
                  </Badge>
                </td>
                {canCreate && (
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end opacity-100 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(s.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ), [monthSchedules, canCreate, holidays]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* E3: Header with inline month navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Escalas</h1>
            <p className="text-muted-foreground text-sm">{roleDescription}</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 rounded-xl border border-border px-2 py-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft size={15} /></Button>
            <span className="text-sm font-semibold capitalize px-1 min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight size={15} /></Button>
            <Button variant="ghost" size="sm" onClick={goToday} className="text-xs h-7 px-2 ml-1">Hoje</Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-muted rounded-lg p-0.5">
            <button onClick={() => setViewMode('calendar')} className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'calendar' && 'active')}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('list')} className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'list' && 'active')}>
              <List size={14} />
            </button>
          </div>
          {canCreate && (
            <Button onClick={() => { setEmpId(''); setSelectedDates([]); setOpen(true); }} className="gap-2">
              <Plus size={16} /> Nova Escala
            </Button>
          )}
        </div>
      </div>

      {/* E1: KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarDays size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{kpiMetrics.total}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Escala{kpiMetrics.total !== 1 ? 's' : ''} no mês</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Star size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{kpiMetrics.specialDays}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Fds / Feriado</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none text-emerald-600">+{formatCredit(kpiMetrics.totalCredits)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Créditos gerados</p>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="page-card p-2 sm:p-3 overflow-hidden">
          {memoizedCalendar}
        </div>
      ) : (
        monthSchedules.length === 0 ? (
          <div className="empty-state">
            <CalendarDays className="mx-auto mb-3 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">Nenhuma escala neste mês</p>
          </div>
        ) : (
          <>
            {/* E4: Employee filter for list mode */}
            <div className="flex items-center gap-3 bg-card rounded-xl border border-border p-3">
              <Select value={filterEmpId} onValueChange={setFilterEmpId}>
                <SelectTrigger className="w-[220px] h-9">
                  <SelectValue placeholder="Filtrar por funcionário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funcionários</SelectItem>
                  {employees.filter(e => e.active !== false && monthSchedules.some(s => s.employee_id === e.id)).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filterEmpId !== 'all' && (
                <span className="text-sm text-muted-foreground">
                  {filteredListSchedules.length} escala{filteredListSchedules.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Mobile List View (Cards) */}
            <div className="space-y-3 sm:hidden">
              {filteredListSchedules.map(s => (
                <div key={s.id} className="page-card p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{getEmpName(s.employee_id)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-[10px]">{s.shift_type === 'half' ? '½T' : 'Integral'}</Badge>
                      {canCreate && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                      +{formatCredit(Number(s.credit_amount))} créditos
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop List View (Table) — filtered */}
            <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Funcionário</th>
                      <th className="px-5 py-4 font-semibold">Data</th>
                      <th className="px-5 py-4 font-semibold">Turno</th>
                      <th className="px-5 py-4 font-semibold">Créditos</th>
                      {canCreate && <th className="px-5 py-4 font-semibold text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredListSchedules.map(s => {
                      const amt = Number(s.credit_amount) || 0;
                      const hName = getHolidayName(s.date);
                      return (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-5 py-3.5 font-medium text-foreground">{getEmpName(s.employee_id)}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">
                            <span>{new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            {hName && <span className="ml-1.5 text-[10px] text-amber-600">🎉 {hName}</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant="secondary" className={cn(
                              'shadow-none text-xs',
                              s.shift_type === 'half'
                                ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
                                : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
                            )}>
                              {s.shift_type === 'half' ? '½ Turno' : 'Integral'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 shadow-none">
                              +{formatCredit(amt)}
                            </Badge>
                          </td>
                          {canCreate && (
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(s.id)}>
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Escala</DialogTitle>
            <DialogDescription>Selecione o funcionário, turno e clique nos dias.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5 flex flex-col">
              <Label>Profissional</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between h-11 font-normal bg-card hover:bg-card px-3"
                  >
                    {empId ? (
                      <span className="truncate">{employees.find((e) => e.id === empId)?.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Pesquisar ou selecionar profissional...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[540px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Digite o nome do profissional..." />
                    <CommandList className="max-h-[350px]">
                      <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
                      <CommandGroup className="p-2 [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-1 sm:[&_[cmdk-group-items]]:grid-cols-2 [&_[cmdk-group-items]]:gap-2">
                        {employees.filter(e => e.active !== false).map((e) => {
                          const unit = getUnitName(e.unit_id);
                          const cat = getCategoryName(e.category_id);
                          const theme = getCategoryTheme(cat);
                          return (
                            <CommandItem
                              key={e.id}
                              value={`${e.name} ${cat} ${unit}`}
                              onSelect={() => {
                                setEmpId(e.id);
                                setSelectedDates([]);
                                setOpenCombobox(false);
                              }}
                              className="relative flex flex-col items-start p-3 rounded-xl cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] data-[selected=true]:ring-2 data-[selected=true]:ring-offset-1 data-[selected=true]:ring-primary/50 min-h-[95px] h-full"
                              style={{ backgroundColor: theme.hexBg, color: theme.hexText }}
                            >
                              {/* Check icon top-right if selected */}
                              {empId === e.id && (
                                <div className="absolute top-2 right-2 bg-white/30 rounded-full p-0.5">
                                  <Check className="h-3.5 w-3.5" style={{ color: theme.hexText }} />
                                </div>
                              )}
                              <div className="font-bold text-[13px] leading-snug text-left w-full break-words">
                                {e.name}
                              </div>
                              <div className="flex gap-1.5 mt-auto pt-3 flex-wrap">
                                {cat && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-bold whitespace-nowrap" style={{ color: theme.hexText }}>
                                    <Tag size={9} /> {cat}
                                  </span>
                                )}
                                {unit && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-bold whitespace-nowrap" style={{ color: theme.hexText }}>
                                    <MapPin size={9} /> {unit}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Employee profile card — shown after selection */}
            {empId && (() => {
              const emp = employees.find(e => e.id === empId);
              if (!emp) return null;
              const balance = getEmpBalance(empId);
              const schedulesThisMonth = getEmpSchedulesThisMonth(empId);
              const cat = getCategoryName(emp.category_id);
              const unit = getUnitName(emp.unit_id);
              const theme = getCategoryTheme(cat);
              const initials = emp.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
              return (
                <div className={cn("flex items-start gap-3 rounded-xl border p-3 transition-colors", theme.bg, theme.border)}>
                  {/* Avatar */}
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm bg-background/60 shadow-sm border", theme.border, theme.text)}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{emp.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cat && (
                        <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border bg-background/50", theme.border, theme.text)}>
                          <Tag size={10} /> {cat}
                        </span>
                      )}
                      {unit && (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-background/50 text-muted-foreground px-2 py-0.5 rounded-full border border-border font-medium">
                          <MapPin size={10} /> {unit}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex gap-3 shrink-0 text-center">
                    <div className="flex flex-col items-center">
                      <span className={cn('text-base font-bold leading-none', balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                        {balance % 1 === 0 ? balance : balance.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">saldo</span>
                    </div>
                    <div className="w-px bg-border" />
                    <div className="flex flex-col items-center">
                      <span className="text-base font-bold leading-none text-primary">{schedulesThisMonth}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">escalas/mês</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Shift Type Selector */}
            <div className="space-y-1">
              <Label>Turno</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShiftType('full')}
                  className={cn(
                    'flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium',
                    shiftType === 'full'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                  )}
                >
                  <Sun size={14} />
                  Integral
                </button>
                <button
                  type="button"
                  onClick={() => setShiftType('half')}
                  className={cn(
                    'flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium',
                    shiftType === 'half'
                      ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm dark:bg-orange-950/30 dark:border-orange-400 dark:text-orange-400'
                      : 'border-border bg-card text-muted-foreground hover:border-orange-300'
                  )}
                >
                  <Moon size={14} />
                  Meio Turno
                </button>
              </div>
            </div>

            {/* Credit rules - compact */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <span className="font-semibold text-foreground whitespace-nowrap">📋 Créditos:</span>
              <span>Semana <b className="text-primary">+1</b>/<b className="text-primary">+0,5</b></span>
              <span>Fds/Feriado <b className="text-primary">+2</b>/<b className="text-primary">+1</b></span>
            </div>

            {/* Mini calendar */}
            <div>
              <Label className="mb-2 block">Selecione os dias ({selectedDates.length} selecionado{selectedDates.length !== 1 ? 's' : ''})</Label>
              <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft size={14} /></Button>
                <span className="text-sm font-medium capitalize">{monthLabel}</span>
                <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight size={14} /></Button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const dateStr = getDateStr(day);
                  const selected = selectedDates.includes(dateStr);
                  const hasLeave = isDayLeaveForSelected(day);
                  const hasSchedule = isDayScheduledForSelected(day);
                  const blocked = hasLeave || hasSchedule;
                  const wkend = isWeekend(dateStr);
                  const holiday = isHoliday(dateStr);
                  const holidayName = getHolidayName(dateStr);
                  const credit = calcCredit(dateStr, shiftType);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => !blocked && toggleDate(dateStr)}
                      disabled={blocked}
                      title={
                        hasLeave ? 'Folga aprovada neste dia'
                        : hasSchedule ? 'Já escalado neste dia'
                        : holidayName ? `🎉 ${holidayName} (+${formatCredit(credit)})`
                        : wkend ? `Final de semana (+${formatCredit(credit)})`
                        : `Dia da semana (+${formatCredit(credit)})`
                      }
                      className={cn(
                        'h-8 rounded-md text-sm font-medium transition-all relative',
                        blocked
                          ? 'bg-destructive/15 text-destructive/50 cursor-not-allowed line-through'
                          : selected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : (wkend || holiday)
                          ? 'bg-amber-100/60 text-amber-800 hover:bg-amber-200/80 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                          : 'hover:bg-muted text-foreground',
                        isToday(day) && !selected && !blocked && 'ring-1 ring-primary'
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              {empId && (
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/15 inline-block" /> Folga / Escalado</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary inline-block" /> Selecionado</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/50 inline-block" /> Fds / Feriado (×2)</span>
                </div>
              )}
            </div>

            {selectedDates.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1">
                  {selectedDates.sort().map(d => {
                    const credit = calcCredit(d, shiftType);
                    const wkend = isWeekend(d);
                    const holiday = isHoliday(d);
                    return (
                      <Badge
                        key={d}
                        variant="secondary"
                        className={cn(
                          'text-xs cursor-pointer gap-1',
                          (wkend || holiday) && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        )}
                        onClick={() => toggleDate(d)}
                      >
                        {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        <span className="font-mono text-[10px] opacity-70">+{formatCredit(credit)}</span>
                        ✕
                      </Badge>
                    );
                  })}
                </div>

                {/* Total credits preview */}
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium">Total de créditos</span>
                  <span className="text-lg font-bold text-primary font-mono">+{formatCredit(totalCreditsPreview)}</span>
                </div>
              </>
            )}

            <Button onClick={handleAdd} className="w-full" disabled={!empId || selectedDates.length === 0}>
              Criar {selectedDates.length} Escala{selectedDates.length !== 1 ? 's' : ''} (+{formatCredit(totalCreditsPreview)} créditos)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
