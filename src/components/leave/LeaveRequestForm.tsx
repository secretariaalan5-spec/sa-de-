import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
}

interface Props {
  employees: Employee[];
  getBalance: (empId: string) => number;
  onSubmit: (empId: string, dates: string[], obs: string, isShortNotice: boolean) => Promise<void>;
  onCancel: () => void;
}

export default function LeaveRequestForm({ employees, getBalance, onSubmit, onCancel }: Props) {
  const [empId, setEmpId] = useState('');
  const [obs, setObs] = useState('');
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerm, setAcceptedTerm] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Generate dates array from range
  const selectedDates = useMemo(() => {
    if (!rangeStart) return [];
    if (!rangeEnd) return [rangeStart];
    const start = new Date(rangeStart + 'T12:00:00');
    const end = new Date(rangeEnd + 'T12:00:00');
    const dates: string[] = [];
    const current = new Date(Math.min(start.getTime(), end.getTime()));
    const last = new Date(Math.max(start.getTime(), end.getTime()));
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [rangeStart, rangeEnd]);

  const minAdvanceDate = new Date();
  minAdvanceDate.setDate(minAdvanceDate.getDate() + 7);
  const minAdvanceDateStr = minAdvanceDate.toISOString().split('T')[0];

  const getLocalTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getLocalTodayStr();
  const isPast = (day: number) => getDateStr(day) <= todayStr;
  const isUnderMinAdvance = (day: number) => getDateStr(day) < minAdvanceDateStr;

  const handleDayClick = (day: number) => {
    if (isPast(day)) return;
    const dateStr = getDateStr(day);
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateStr);
      setRangeEnd(null);
    } else {
      setRangeEnd(dateStr);
    }
  };

  const isInRange = (day: number) => {
    const dateStr = getDateStr(day);
    return selectedDates.includes(dateStr);
  };

  const isRangeStart = (day: number) => getDateStr(day) === rangeStart;
  const isRangeEnd = (day: number) => getDateStr(day) === (rangeEnd ?? rangeStart);

  // Check if any selected date is within the 7-day advance window
  const hasShortNoticeDates = useMemo(() => {
    return selectedDates.some(d => d < minAdvanceDateStr);
  }, [selectedDates, minAdvanceDateStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || selectedDates.length === 0) return;
    
    if (hasShortNoticeDates) {
      if (obs.trim().length < 5) return; // Need justification
      if (!acceptedTerm) return; // Need acceptance
    }
    
    setSubmitting(true);
    try {
      await onSubmit(empId, selectedDates, obs, hasShortNoticeDates);
    } finally {
      setSubmitting(false);
    }
  };

  const balance = empId ? getBalance(empId) : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Employee selector */}
      <div className="space-y-1.5">
        <Label>Funcionário</Label>
        <Select value={empId} onValueChange={(v) => { setEmpId(v); setRangeStart(null); setRangeEnd(null); }}>
          <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
          <SelectContent>
            {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
          </SelectContent>
        </Select>
        {empId && (
          <p className="text-xs text-muted-foreground">
            Saldo atual: <span className={cn('font-bold', balance > 0 ? 'text-primary' : 'text-destructive')}>{balance} crédito(s)</span>
          </p>
        )}
      </div>

      {/* Calendar date range picker */}
      <div className="space-y-2">
        <Label>Período da folga</Label>
        <p className="text-xs text-muted-foreground">
          {!rangeStart ? 'Clique na data de início' : !rangeEnd ? 'Agora clique na data final' : `${selectedDates.length} dia(s) selecionado(s)`}
        </p>

        <div className="bg-muted/30 rounded-xl p-3 border border-border">
          <div className="flex items-center justify-between mb-3">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-semibold capitalize">{monthLabel}</span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
              <ChevronRight size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />;
              const inRange = isInRange(day);
              const start = isRangeStart(day);
              const end = isRangeEnd(day);
              const pastDay = isPast(day);
              const shortNotice = !pastDay && isUnderMinAdvance(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={pastDay}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'h-9 rounded-md text-sm font-medium transition-all relative',
                    pastDay && 'opacity-30 cursor-not-allowed text-muted-foreground',
                    !pastDay && shortNotice && !inRange && 'text-amber-600 bg-amber-50 hover:bg-amber-100',
                    !pastDay && inRange && !start && !end && 'bg-primary/15 text-primary',
                    !pastDay && start && 'bg-primary text-primary-foreground rounded-r-none shadow-sm',
                    !pastDay && end && 'bg-primary text-primary-foreground rounded-l-none shadow-sm',
                    !pastDay && start && end && 'rounded-md',
                    !pastDay && !inRange && !shortNotice && 'hover:bg-muted text-foreground',
                    !pastDay && isToday(day) && !inRange && 'ring-1 ring-primary',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDates.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {new Date(selectedDates[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                {selectedDates.length > 1 && (
                  <> → {new Date(selectedDates[selectedDates.length - 1] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</>
                )}
              </Badge>
              <Badge variant="secondary" className="text-xs">{selectedDates.length} dia(s)</Badge>
              <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] text-destructive" onClick={() => { setRangeStart(null); setRangeEnd(null); }}>
                Limpar
              </Button>
            </div>
            {hasShortNoticeDates && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">Antecedência inferior a 7 dias</p>
                  <p className="text-[11px] mt-0.5 opacity-80">Este pedido ficará sujeito à análise da coordenação por não cumprir o prazo mínimo exigido pela Secretaria.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Observations / Justification */}
      <div className="space-y-1.5">
        <Label className={cn(hasShortNoticeDates && 'text-amber-700 font-bold')}>
          {hasShortNoticeDates ? 'Justificativa da Exceção (Obrigatório)' : 'Observações (opcional)'}
        </Label>
        <Input 
          value={obs} 
          onChange={e => setObs(e.target.value)} 
          placeholder={hasShortNoticeDates ? "Motivo da folga em curto prazo..." : "Motivo da folga..."} 
          required={hasShortNoticeDates}
          minLength={hasShortNoticeDates ? 5 : undefined}
          className={cn(hasShortNoticeDates && !obs.trim() && 'border-amber-400 focus-visible:ring-amber-400')}
        />
        {hasShortNoticeDates && (
          <p className="text-[10px] text-amber-700 font-medium pt-1">
            Por ter menos de 7 dias, é necessário justificar o pedido para a coordenação.
          </p>
        )}
      </div>

      {/* Short Notice Exception Checkbox */}
      {hasShortNoticeDates && (
        <div className="flex items-start space-x-2 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
          <Checkbox 
            id="terms" 
            checked={acceptedTerm} 
            onCheckedChange={(checked) => setAcceptedTerm(checked as boolean)}
            className="mt-0.5"
          />
          <Label 
            htmlFor="terms" 
            className="text-sm font-medium leading-tight text-amber-900 cursor-pointer"
          >
            Estou ciente de que o prazo regulamentar da Secretaria é de 7 dias de antecedência. Solicito esta folga em caráter de exceção devido a imprevisto.
          </Label>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button 
          type="submit" 
          className={cn("flex-1", hasShortNoticeDates && 'bg-amber-600 hover:bg-amber-700')} 
          disabled={!empId || selectedDates.length === 0 || submitting || (hasShortNoticeDates && (!acceptedTerm || obs.trim().length < 5))}
        >
          {submitting ? 'Enviando...' : `Solicitar ${selectedDates.length} dia(s)`}
        </Button>
      </div>
    </form>
  );
}
