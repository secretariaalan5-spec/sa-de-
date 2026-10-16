import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Sun, Moon, MapPin, Tag } from 'lucide-react';

interface QuickScheduleDialogProps {
  employee: {
    id: string;
    name: string;
    category_id: string | null;
    unit_id: string | null;
  } | null;
  categoryName?: string;
  unitName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function QuickScheduleDialog({
  employee,
  open,
  onOpenChange,
  onSuccess,
}: QuickScheduleDialogProps) {
  const { roleInfo } = useAuthContext();
  const [shiftType, setShiftType] = useState<'full' | 'half'>('full');
  const [isCustomCredit, setIsCustomCredit] = useState(false);
  const [customCredit, setCustomCredit] = useState<number | null>(null);
  const [observations, setObservations] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dados carregados do profissional
  const [balance, setBalance] = useState<number>(0);
  const [schedulesThisMonth, setSchedulesThisMonth] = useState<number>(0);
  const [existingScheduleDates, setExistingScheduleDates] = useState<string[]>([]);
  const [leaveDates, setLeaveDates] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [unitName, setUnitName] = useState<string>('');

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Carrega dados específicos quando o modal abre
  useEffect(() => {
    if (!open || !employee || !roleInfo?.team_id) return;

    setSelectedDates([]);
    setObservations('');
    setShiftType('full');
    setIsCustomCredit(false);
    setCustomCredit(null);
    const now = new Date();
    setCurrentDate(now);

    const teamId = roleInfo.team_id;

    Promise.all([
      // Feriados da equipe
      supabase.from('holidays').select('id, date, name').eq('team_id', teamId).order('date'),
      // Categoria do profissional
      employee.category_id
        ? supabase.from('categories').select('id, name, color').eq('id', employee.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // Unidade do profissional
      employee.unit_id
        ? supabase.from('units').select('id, name').eq('id', employee.unit_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // Saldo de créditos do profissional
      supabase.from('leave_credits').select('amount').eq('employee_id', employee.id),
      // Todas as escalas do profissional
      supabase.from('schedules').select('id, date').eq('employee_id', employee.id),
      // Folgas aprovadas ou pendentes do profissional
      supabase.from('leave_requests').select('leave_dates').eq('employee_id', employee.id).in('status', ['pending', 'approved']),
    ]).then(([hRes, catRes, unitRes, credRes, schedRes, leaveRes]) => {
      setHolidays(hRes.data ?? []);
      setCategory(catRes.data ?? null);
      setUnitName(unitRes.data?.name ?? '');

      // Saldo total
      const totalBalance = (credRes.data ?? []).reduce((acc: number, c: any) => acc + (Number(c.amount) || 0), 0);
      setBalance(totalBalance);

      // Escalas existentes
      const schedDates = (schedRes.data ?? []).map((s: any) => s.date);
      setExistingScheduleDates(schedDates);

      // Escalas neste mês
      const thisMonthCount = (schedRes.data ?? []).filter((s: any) => {
        const d = new Date(s.date + 'T12:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      setSchedulesThisMonth(thisMonthCount);

      // Folgas
      const lDates: string[] = [];
      (leaveRes.data ?? []).forEach((r: any) => {
        if (Array.isArray(r.leave_dates)) {
          lDates.push(...r.leave_dates);
        }
      });
      setLeaveDates(lDates);
    });
  }, [open, employee, roleInfo?.team_id]);

  const holidayDatesSet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach(h => map.set(h.date, h.name));
    return map;
  }, [holidays]);

  const isHoliday = (dateStr: string) => holidayDatesSet.has(dateStr);
  const getHolidayName = (dateStr: string) => holidayMap.get(dateStr) ?? null;

  const isWeekend = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const calcCredit = (dateStr: string, shift: 'full' | 'half'): number => {
    if (isCustomCredit && customCredit !== null && customCredit > 0) {
      return customCredit;
    }
    const base = (isWeekend(dateStr) || isHoliday(dateStr)) ? 2 : 1;
    return shift === 'half' ? base / 2 : base;
  };

  const totalCreditsPreview = useMemo(() => {
    return selectedDates.reduce((sum, d) => sum + calcCredit(d, shiftType), 0);
  }, [selectedDates, shiftType, isCustomCredit, customCredit, holidayDatesSet]);

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const formatCredit = (val: number) =>
    val % 1 === 0 ? val.toString() : val.toFixed(1).replace('.', ',');

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const catColor = category?.color ?? '#6366f1';
  const catName = category?.name ?? '';
  const initials = employee?.name
    ? employee.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'PR';

  const handleCreate = async () => {
    if (!employee || selectedDates.length === 0) {
      toast.error('Selecione os dias da escala.');
      return;
    }

    if (!roleInfo?.team_id) {
      toast.error('Permissões ainda não carregadas. Recarregue a página.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const inserts = selectedDates.map(date => {
        const perDateCredit = isCustomCredit && customCredit !== null && customCredit > 0
          ? customCredit
          : calcCredit(date, shiftType);

        return {
          employee_id: employee.id,
          date,
          type: 'extra',
          shift_type: shiftType,
          credit_amount: perDateCredit,
          observations: observations.trim() || null,
          team_id: roleInfo.team_id,
          created_by: user?.id ?? null,
        };
      });

      const { error } = await supabase.from('schedules').insert(inserts);
      if (error) {
        toast.error(error.message || 'Erro ao criar escala.');
        return;
      }

      toast.success(
        `${selectedDates.length} escala(s) criada(s)! +${formatCredit(totalCreditsPreview)} crédito(s) total.`
      );
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Escala</DialogTitle>
          <DialogDescription>Selecione o turno e clique nos dias no calendário.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Employee profile card — exatamente idêntico ao de Schedules.tsx */}
          {employee && (
            <div
              className="flex items-start gap-3 rounded-xl p-3 transition-colors"
              style={{ backgroundColor: `${catColor}15` }}
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm bg-background/60 border"
                style={{ borderColor: catColor, color: catColor }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{employee.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {catName && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border bg-background/50"
                      style={{ borderColor: catColor, color: catColor }}
                    >
                      <Tag size={10} /> {catName}
                    </span>
                  )}
                  {unitName && (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-background/50 text-muted-foreground px-2 py-0.5 rounded-full border border-border font-medium">
                      <MapPin size={10} /> {unitName}
                    </span>
                  )}
                </div>
              </div>
              {/* Stats */}
              <div className="flex gap-3 shrink-0 text-center">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'text-base font-bold leading-none',
                      balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
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
          )}

          {/* Shift Type Selector — exatamente idêntico ao de Schedules.tsx */}
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

          {/* Credit rules / Custom Credit Selector — exatamente idêntico ao de Schedules.tsx */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Valor da folga (créditos)</Label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCustomCredit}
                  onChange={(e) => {
                    setIsCustomCredit(e.target.checked);
                    if (!e.target.checked) setCustomCredit(null);
                    else if (customCredit === null) setCustomCredit(1);
                  }}
                  className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Definir manualmente</span>
              </label>
            </div>

            {!isCustomCredit ? (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <span className="font-semibold text-foreground whitespace-nowrap">📋 Regra automática:</span>
                <span>Semana <b className="text-primary">+1</b>/<b className="text-primary">+0,5</b></span>
                <span>Fds/Feriado <b className="text-primary">+2</b>/<b className="text-primary">+1</b></span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-muted/30 border border-border rounded-lg">
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={customCredit ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Math.max(0.5, parseFloat(e.target.value));
                    setCustomCredit(val);
                  }}
                  placeholder="Qtd folgas"
                  className="h-8 text-xs font-semibold w-24 bg-card"
                />
                <div className="flex gap-1 flex-1 overflow-x-auto">
                  {[0.5, 1, 1.5, 2, 3].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCustomCredit(val)}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded border transition-colors',
                        customCredit === val
                          ? 'bg-primary text-primary-foreground border-primary font-bold'
                          : 'bg-card hover:bg-muted text-foreground border-border'
                      )}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Observations — exatamente idêntico ao de Schedules.tsx */}
          <div className="space-y-1">
            <Label>Observações / Local de Trabalho (Opcional)</Label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: ESF Centro, Campanha de vacinação..."
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              maxLength={200}
            />
          </div>

          {/* Mini calendar — exatamente idêntico ao de Schedules.tsx */}
          <div>
            <Label className="mb-2 block">
              Selecione os dias ({selectedDates.length} selecionado{selectedDates.length !== 1 ? 's' : ''})
            </Label>
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
                const hasLeave = leaveDates.includes(dateStr);
                const hasSchedule = existingScheduleDates.includes(dateStr);
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
                        ? 'bg-primary text-primary-foreground shadow-sm font-bold'
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

            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-destructive/15 inline-block" /> Folga / Escalado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-primary inline-block" /> Selecionado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/50 inline-block" /> Fds / Feriado (×2)
              </span>
            </div>
          </div>

          {/* Badges dos dias selecionados */}
          {selectedDates.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
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

              {/* Total credits preview — exatamente idêntico ao de Schedules.tsx */}
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <span className="text-sm font-medium">Total de créditos</span>
                <span className="text-lg font-bold text-primary font-mono">+{formatCredit(totalCreditsPreview)}</span>
              </div>
            </>
          )}

          {/* Botão de Criação */}
          <Button
            onClick={handleCreate}
            className="w-full"
            disabled={isSubmitting || selectedDates.length === 0}
          >
            {isSubmitting
              ? 'Criando escala...'
              : `Criar ${selectedDates.length} Escala${selectedDates.length !== 1 ? 's' : ''} (+${formatCredit(totalCreditsPreview)} créditos)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
