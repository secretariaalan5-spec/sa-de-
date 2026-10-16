import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarPlus, Sun, Moon, Star, CalendarDays } from 'lucide-react';

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

export default function QuickScheduleDialog({
  employee,
  categoryName,
  unitName,
  open,
  onOpenChange,
  onSuccess,
}: QuickScheduleDialogProps) {
  const { roleInfo } = useAuthContext();
  const [type, setType] = useState<'extra' | 'normal'>('extra');
  const [shiftType, setShiftType] = useState<'full' | 'half'>('full');
  const [observations, setObservations] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [existingScheduleDates, setExistingScheduleDates] = useState<string[]>([]);
  const [leaveDates, setLeaveDates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Reset states when employee changes or dialog opens
  useEffect(() => {
    if (open && employee) {
      setSelectedDates([]);
      setObservations('');
      setType('extra');
      setShiftType('full');
      setCurrentDate(new Date());

      const teamId = roleInfo?.team_id;
      if (!teamId) return;

      // Buscar feriados, escalas existentes e folgas desse profissional
      Promise.all([
        supabase.from('holidays').select('id, date, name').eq('team_id', teamId).order('date'),
        supabase.from('schedules').select('date').eq('employee_id', employee.id),
        supabase.from('leave_requests').select('leave_dates').eq('employee_id', employee.id).in('status', ['pending', 'approved']),
      ]).then(([hRes, sRes, lRes]) => {
        setHolidays(hRes.data ?? []);
        setExistingScheduleDates((sRes.data ?? []).map((s: any) => s.date));
        
        const leaves: string[] = [];
        (lRes.data ?? []).forEach((r: any) => {
          if (Array.isArray(r.leave_dates)) {
            leaves.push(...r.leave_dates);
          }
        });
        setLeaveDates(leaves);
      });
    }
  }, [open, employee, roleInfo?.team_id]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach(h => map.set(h.date, h.name));
    return map;
  }, [holidays]);

  const isHoliday = (dateStr: string) => holidayMap.has(dateStr);
  const getHolidayName = (dateStr: string) => holidayMap.get(dateStr) ?? null;

  const isWeekend = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const calcCredit = (dateStr: string, shift: 'full' | 'half'): number => {
    const base = (isWeekend(dateStr) || isHoliday(dateStr)) ? 2 : 1;
    return shift === 'half' ? base / 2 : base;
  };

  const totalCredits = useMemo(() => {
    return selectedDates.reduce((sum, d) => sum + calcCredit(d, shiftType), 0);
  }, [selectedDates, shiftType, holidayMap]);

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

  const handleCreateSchedule = async () => {
    if (!employee || selectedDates.length === 0) {
      toast.error('Selecione pelo menos uma data para a escala.');
      return;
    }

    if (!roleInfo?.team_id) {
      toast.error('Permissões não carregadas. Tente novamente.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const inserts = selectedDates.map(date => ({
        employee_id: employee.id,
        date,
        type,
        shift_type: shiftType,
        credit_amount: calcCredit(date, shiftType),
        observations: observations.trim() || null,
        team_id: roleInfo.team_id,
        created_by: user?.id ?? null,
      }));

      const { error } = await supabase.from('schedules').insert(inserts);
      if (error) {
        toast.error(error.message || 'Erro ao criar escala.');
        return;
      }

      toast.success(
        `${selectedDates.length} escala(s) criada(s) para ${employee.name}! (+${formatCredit(totalCredits)} créditos)`
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarPlus size={18} className="text-primary" />
            Nova Escala — {employee?.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {categoryName && <span className="font-medium text-foreground">{categoryName}</span>}
            {categoryName && unitName && <span> • </span>}
            {unitName && <span>{unitName}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Tipo de Escala e Turno */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Escala</Label>
              <Select value={type} onValueChange={(v: 'extra' | 'normal') => setType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="extra">
                    <span className="flex items-center gap-1.5">
                      <Star size={13} className="text-amber-500 fill-amber-500" /> Plantão Extra
                    </span>
                  </SelectItem>
                  <SelectItem value="normal">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={13} /> Escala Normal
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Turno</Label>
              <Select value={shiftType} onValueChange={(v: 'full' | 'half') => setShiftType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">
                    <span className="flex items-center gap-1.5">
                      <Sun size={13} className="text-amber-500" /> Integral (1.0x / 2.0x)
                    </span>
                  </SelectItem>
                  <SelectItem value="half">
                    <span className="flex items-center gap-1.5">
                      <Moon size={13} className="text-blue-500" /> Meio período (0.5x)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações / Local */}
          <div className="space-y-1">
            <Label className="text-xs">Observações / Local de Trabalho (Opcional)</Label>
            <input
              type="text"
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Ex: ESF Centro, Cobertura, Campanha..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              maxLength={150}
            />
          </div>

          {/* Mini Calendário */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">
                Selecione os dias ({selectedDates.length} selecionado{selectedDates.length !== 1 ? 's' : ''})
              </Label>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-semibold capitalize min-w-[100px] text-center">
                  {monthLabel}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-0.5">
                  {d}
                </div>
              ))}
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
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
                      hasLeave
                        ? 'Folga aprovada/pendente neste dia'
                        : hasSchedule
                        ? 'Já escalado neste dia'
                        : holidayName
                        ? `🎉 ${holidayName} (+${formatCredit(credit)})`
                        : wkend
                        ? `Final de semana (+${formatCredit(credit)})`
                        : `Dia da semana (+${formatCredit(credit)})`
                    }
                    className={cn(
                      'h-8 rounded-md text-xs font-medium transition-all relative',
                      blocked
                        ? 'bg-destructive/15 text-destructive/50 cursor-not-allowed line-through'
                        : selected
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                        : wkend || holiday
                        ? 'bg-amber-100/60 text-amber-800 hover:bg-amber-200/80 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-destructive/20 inline-block" /> Ocupado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-primary inline-block" /> Selecionado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-100 dark:bg-amber-900/40 inline-block" /> Fds / Feriado (×2)
              </span>
            </div>
          </div>

          {/* Badges dos dias selecionados */}
          {selectedDates.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1">
              {selectedDates.sort().map(d => {
                const credit = calcCredit(d, shiftType);
                const wkend = isWeekend(d);
                const holiday = isHoliday(d);
                return (
                  <Badge
                    key={d}
                    variant="secondary"
                    className={cn(
                      'text-[11px] cursor-pointer gap-1',
                      (wkend || holiday) && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    )}
                    onClick={() => toggleDate(d)}
                  >
                    {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    <span className="font-mono text-[10px] opacity-75">+{formatCredit(credit)}</span>
                    ✕
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Total de créditos */}
          <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-3.5 py-2.5">
            <span className="text-xs font-medium">Créditos gerados</span>
            <span className="text-base font-bold text-primary font-mono">
              +{formatCredit(totalCredits)}
            </span>
          </div>

          {/* Botão de Enviar */}
          <Button
            onClick={handleCreateSchedule}
            className="w-full"
            disabled={isSubmitting || selectedDates.length === 0}
          >
            {isSubmitting
              ? 'Criando escala...'
              : `Criar ${selectedDates.length} Escala${selectedDates.length !== 1 ? 's' : ''} (+${formatCredit(totalCredits)} créditos)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
