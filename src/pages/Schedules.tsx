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
import { Plus, CalendarDays, Trash2, ChevronLeft, ChevronRight, List, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Schedule {
  id: string;
  employee_id: string;
  date: string;
  type: string;
  unit_id: string | null;
  created_at: string;
}

interface Employee { id: string; name: string; category_id: string | null; }

export default function Schedules() {
  const { roleInfo, isAdmin, isChief, isRH, isManager } = useAuthContext();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvedLeaveDates, setApprovedLeaveDates] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [type, setType] = useState('extra');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const canCreate = isAdmin || isChief;

  const load = async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    let schedulesQuery = supabase.from('schedules').select('*').eq('team_id', teamId).order('date', { ascending: false }).limit(500);
    let employeesQuery = supabase.from('employees').select('id, name, category_id').eq('active', true).eq('team_id', teamId).order('name');
    let lrQuery = supabase.from('leave_requests').select('employee_id, leave_dates').eq('team_id', teamId).eq('status', 'approved').limit(200);
    let pendingLrQuery = supabase.from('leave_requests').select('employee_id, leave_dates').eq('team_id', teamId).eq('status', 'pending').limit(200);

    // Filtro Explícito: Chefe de Categoria só pode escalar seus próprios funcionários
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }

    const [s, e, lr, pendingLr] = await Promise.all([schedulesQuery, employeesQuery, lrQuery, pendingLrQuery]);
    setSchedules(s.data ?? []);
    setEmployees(e.data ?? []);

    // Build a map of employee_id -> approved + pending leave dates
    const leaveMap: Record<string, string[]> = {};
    [...(lr.data ?? []), ...(pendingLr.data ?? [])].forEach((r: any) => {
      if (!leaveMap[r.employee_id]) leaveMap[r.employee_id] = [];
      leaveMap[r.employee_id].push(...(r.leave_dates ?? []));
    });
    setApprovedLeaveDates(leaveMap);
  };

  useEffect(() => { load(); }, [roleInfo?.team_id]);
  useDataSubscription(['schedules', 'employees', 'leave_requests'], load);

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
      team_id: roleInfo.team_id,
      created_by: user?.id ?? null,
    }));

    const { error } = await supabase.from('schedules').insert(inserts);
    if (error) {
      toast.error(error.message || 'Erro ao criar escala(s).');
      return;
    }

    toast.success(`${selectedDates.length} escala(s) extra criada(s)! +2 créditos por escala.`);
    setOpen(false);
    setEmpId('');
    setSelectedDates([]);
    setType('extra');
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover escala.'); return; }
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
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {weekDays.map(d => (
              <div key={d} className="bg-primary text-primary-foreground text-center py-2 text-xs font-semibold">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="bg-card min-h-[80px]" />;
              const daySchedules = schedulesForDay(day);
              return (
                <div key={day} className={cn('bg-card min-h-[80px] p-1.5 relative transition-colors', isToday(day) && 'ring-2 ring-primary ring-inset')}>
                  <span className={cn('text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full', isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground')}>{day}</span>
                  <div className="mt-0.5 space-y-0.5 overflow-y-auto max-h-[60px]">
                    {daySchedules.slice(0, 3).map(s => (
                      <div key={s.id} className={cn('text-[10px] px-1.5 py-0.5 rounded truncate', s.type === 'extra' ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary')} title={`${getEmpName(s.employee_id)} (${s.type})`}>
                        {getEmpName(s.employee_id)}
                      </div>
                    ))}
                    {daySchedules.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{daySchedules.length - 3} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        monthSchedules.length === 0 ? (
          <div className="empty-state">
            <CalendarDays className="mx-auto mb-3 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">Nenhuma escala neste mês</p>
          </div>
        ) : (
          <div className="page-card overflow-x-auto">
            <table className="schedule-table">
              <thead><tr><th className="text-left">Funcionário</th><th className="text-left">Data</th><th className="text-left">Tipo</th>{canCreate && <th className="text-right">Ações</th>}</tr></thead>
              <tbody>
                {monthSchedules.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium">{getEmpName(s.employee_id)}</td>
                    <td>{new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td><Badge variant="default">Extra (+2)</Badge></td>
                    {canCreate && (
                      <td className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 size={16} className="text-destructive" /></Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Create Schedule Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Escala</DialogTitle>
            <DialogDescription>Selecione o funcionário, tipo e clique nos dias do calendário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Funcionário</Label>
              <Select value={empId} onValueChange={(v) => { setEmpId(v); setSelectedDates([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              Tipo: <span className="font-medium text-foreground">Extra (+2 créditos por escala)</span>
            </p>

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
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => !blocked && toggleDate(dateStr)}
                      disabled={blocked}
                      title={hasLeave ? 'Folga aprovada neste dia' : hasSchedule ? 'Já escalado neste dia' : ''}
                      className={cn(
                        'h-8 rounded-md text-sm font-medium transition-all',
                        blocked
                          ? 'bg-destructive/15 text-destructive/50 cursor-not-allowed line-through'
                          : selected
                          ? 'bg-primary text-primary-foreground shadow-sm'
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
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/15 inline-block" /> Folga / Já escalado</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary inline-block" /> Selecionado</span>
                </div>
              )}
            </div>

            {selectedDates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedDates.sort().map(d => (
                  <Badge key={d} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleDate(d)}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ✕
                  </Badge>
                ))}
              </div>
            )}

            <Button onClick={handleAdd} className="w-full" disabled={!empId || selectedDates.length === 0}>
              Criar {selectedDates.length} Escala{selectedDates.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
