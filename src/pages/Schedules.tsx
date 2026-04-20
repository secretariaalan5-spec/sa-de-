import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, CalendarDays, Trash2, ChevronLeft, ChevronRight, List, LayoutGrid, Sun, Moon } from 'lucide-react';
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

interface Employee { id: string; name: string; category_id: string | null; unit_id: string | null; }
interface Unit { id: string; name: string; }
interface Holiday { id: string; date: string; name: string; }

export default function Schedules() {
  const { roleInfo, isAdmin, isChief, isRH, isManager } = useAuthContext();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [approvedLeaveDates, setApprovedLeaveDates] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [type, setType] = useState('extra');
  const [shiftType, setShiftType] = useState<'full' | 'half'>('full');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const canCreate = isAdmin || isChief;

  const load = async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    const schedulesQuery = supabase.from('schedules').select('*').eq('team_id', teamId).order('date', { ascending: false }).limit(500);
    let employeesQuery = supabase.from('employees').select('id, name, category_id, unit_id').eq('active', true).eq('team_id', teamId).order('name');
    const unitsQuery = supabase.from('units').select('id, name').eq('team_id', teamId);
    const lrQuery = supabase.from('leave_requests').select('employee_id, leave_dates').eq('team_id', teamId).eq('status', 'approved').limit(200);
    const pendingLrQuery = supabase.from('leave_requests').select('employee_id, leave_dates').eq('team_id', teamId).eq('status', 'pending').limit(200);
    const holidaysQuery = supabase.from('holidays').select('id, date, name').eq('team_id', teamId).order('date');

    // Filtro Explícito: Chefe de Categoria só pode escalar seus próprios funcionários
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }

    const [s, e, u, lr, pendingLr, h] = await Promise.all([schedulesQuery, employeesQuery, unitsQuery, lrQuery, pendingLrQuery, holidaysQuery]);
    setSchedules(s.data ?? []);
    setEmployees(e.data ?? []);
    setUnits(u.data ?? []);
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
  useDataSubscription(['schedules', 'employees', 'leave_requests', 'holidays', 'units'], load);

  const unitMap = useMemo(() => {
    const map = new Map<string, string>();
    units.forEach(u => map.set(u.id, u.name));
    return map;
  }, [units]);

  const getUnitName = (unitId: string | null) => unitId ? (unitMap.get(unitId) ?? '') : '';

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

  const monthSchedules = schedules.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  }).sort((a, b) => a.date.localeCompare(b.date));

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

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Escalas</h1>
          <p className="text-muted-foreground text-sm">{roleDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button onClick={() => setViewMode('calendar')} className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'calendar' && 'active')}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('list')} className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'list' && 'active')}>
              <List size={14} />
            </button>
          </div>
          {canCreate && (
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus size={16} /> Nova Escala
            </Button>
          )}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft size={18} /></Button>
        <div className="flex items-center gap-3">
          <h2 className="font-semibold capitalize">{monthLabel}</h2>
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs h-7">Hoje</Button>
        </div>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight size={18} /></Button>
      </div>

      {viewMode === 'calendar' ? (
        <div className="page-card p-3">
          {useMemo(() => (
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {weekDays.map(d => (
              <div key={d} className="bg-primary text-primary-foreground text-center py-2 text-xs font-semibold">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="bg-card min-h-[80px]" />;
              const daySchedules = schedulesForDay(day);
              const dateStr = getDateStr(day);
              const holidayName = getHolidayName(dateStr);
              const wkend = isWeekend(dateStr);
              return (
                <div key={day} className={cn(
                  'bg-card min-h-[80px] p-1.5 relative transition-colors',
                  isToday(day) && 'ring-2 ring-primary ring-inset',
                  (wkend || holidayName) && 'bg-amber-50/50 dark:bg-amber-950/20'
                )}>
                  <div className="flex items-center gap-1">
                    <span className={cn('text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full', isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground')}>{day}</span>
                    {holidayName && <span className="text-[8px] text-amber-600 dark:text-amber-400 truncate" title={holidayName}>🎉</span>}
                  </div>
                  <div className="mt-0.5 space-y-0.5 overflow-y-auto max-h-[60px]">
                    {daySchedules.slice(0, 3).map(s => (
                      <div key={s.id} className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded truncate',
                        s.type === 'extra' ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary'
                      )} title={`${getEmpName(s.employee_id)} (${s.shift_type === 'half' ? '½ turno' : 'integral'}) +${formatCredit(Number(s.credit_amount))}`}>
                        {getEmpName(s.employee_id)} {s.shift_type === 'half' && '½'}
                      </div>
                    ))}
                    {daySchedules.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{daySchedules.length - 3} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>
          ), [calendarDays, month, year, schedules, holidays])}
        </div>
      ) : (
        monthSchedules.length === 0 ? (
          <div className="empty-state">
            <CalendarDays className="mx-auto mb-3 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">Nenhuma escala neste mês</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mt-2">
            {useMemo(() => (
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
            ), [monthSchedules, canCreate, holidays])}
          </div>
        )
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Escala</DialogTitle>
            <DialogDescription>Selecione o funcionário, turno e clique nos dias.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Funcionário</Label>
              <Select value={empId} onValueChange={(v) => { setEmpId(v); setSelectedDates([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => {
                    const unit = getUnitName(e.unit_id);
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        <span>{e.name}</span>
                        {unit && <span className="text-muted-foreground text-xs ml-2">• {unit}</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

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
