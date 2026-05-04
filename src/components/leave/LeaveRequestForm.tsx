import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { ChevronLeft, ChevronRight, AlertTriangle, Check, ChevronsUpDown, MapPin, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
}

interface Category { id: string; name: string; color: string; }
interface Unit { id: string; name: string; }

interface Props {
  employees: Employee[];
  categories: Category[];
  units: Unit[];
  getBalance: (empId: string) => number;
  onSubmit: (empId: string, dates: string[], obs: string, isShortNotice: boolean) => Promise<void>;
  onCancel: () => void;
}

export default function LeaveRequestForm({ employees, categories, units, getBalance, onSubmit, onCancel }: Props) {
  const [empId, setEmpId] = useState('');
  const [openCombobox, setOpenCombobox] = useState(false);
  const [obs, setObs] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
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
  
  const balance = empId ? getBalance(empId) : 0;

  const getUnitName = (unitId: string | null) => unitId ? (units.find(u => u.id === unitId)?.name ?? '') : '';
  const getCategoryName = (catId: string | null) => catId ? (categories.find(c => c.id === catId)?.name ?? '') : '';
  const getCategoryColor = (catId: string | null) => catId ? (categories.find(c => c.id === catId)?.color ?? '#6366f1') : '#6366f1';

  const handleDayClick = (day: number) => {
    if (isPast(day)) return;
    const dateStr = getDateStr(day);
    
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        if (prev.length >= balance) {
          // Bloquear clique na interface para respeitar o saldo
          return prev;
        }
        return [...prev, dateStr].sort();
      }
    });
  };

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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Employee selector */}
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
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Digite o nome do profissional..." />
              <CommandList 
                className="max-h-[350px] overflow-y-auto"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
                <CommandGroup className="p-2">
                  {employees.map((e) => {
                    const unit = getUnitName(e.unit_id);
                    const cat = getCategoryName(e.category_id);
                    const catColor = getCategoryColor(e.category_id);
                    const initials = e.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                    return (
                      <CommandItem
                        key={e.id}
                        value={`${e.name} ${cat} ${unit}`}
                        onSelect={() => {
                          setEmpId(e.id);
                          setSelectedDates([]);
                          setOpenCombobox(false);
                        }}
                        style={{
                          '--cat-color': catColor,
                          '--cat-bg': `${catColor}25`,
                        } as React.CSSProperties}
                        className={cn(
                          "mb-1.5 last:mb-0 relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-[var(--cat-bg)] data-[selected=true]:bg-[var(--cat-bg)] bg-transparent touch-pan-y"
                        )}
                      >
                        {/* Avatar */}
                        <div 
                          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-medium text-sm border-2 bg-background/50" 
                          style={{ borderColor: catColor, color: catColor }}
                        >
                          {initials}
                        </div>

                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="font-medium text-[14px] leading-snug text-foreground break-words pr-6">
                            {e.name}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-foreground/80 mt-1">
                            {cat && (
                              <span className="flex items-center gap-1.5 whitespace-nowrap">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                                <span className="font-medium" style={{ color: catColor }}>{cat}</span>
                              </span>
                            )}
                            {unit && (
                              <span className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
                                <MapPin size={12} /> {unit}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Check icon if selected */}
                        {empId === e.id && (
                          <div className="absolute right-4 rounded-full p-1" style={{ color: catColor }}>
                            <Check className="h-5 w-5" strokeWidth={2.5} />
                          </div>
                        )}
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
        const cat = getCategoryName(emp.category_id);
        const unit = getUnitName(emp.unit_id);
        const catColor = getCategoryColor(emp.category_id);
        const initials = emp.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        return (
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
              <p className="font-semibold text-sm truncate">{emp.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {cat && (
                  <span 
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border bg-background/50"
                    style={{ borderColor: catColor, color: catColor }}
                  >
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
            <div className="flex gap-3 shrink-0 text-center items-center h-10">
              <div className="flex flex-col items-center justify-center h-full">
                <span className={cn('text-base font-bold leading-none', balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {balance % 1 === 0 ? balance : balance.toFixed(1)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">saldo</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Calendar date range picker */}
      <div className="space-y-2">
        <Label>Período da folga</Label>
        <p className="text-xs text-muted-foreground">
          Clique nos dias desejados. Clique novamente para desmarcar.
          {selectedDates.length > 0 && <span className="block mt-1 font-medium">{selectedDates.length} dia(s) selecionado(s)</span>}
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

          <div className="calendar-grid grid grid-cols-7 gap-1">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />;
              const dateStr = getDateStr(day);
              const isSelected = selectedDates.includes(dateStr);
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
                    !pastDay && isSelected && 'bg-primary text-primary-foreground shadow-sm',
                    !pastDay && !isSelected && shortNotice && 'text-amber-600 bg-amber-50 hover:bg-amber-100',
                    !pastDay && !isSelected && !shortNotice && 'hover:bg-muted text-foreground',
                    !pastDay && isToday(day) && !isSelected && 'ring-1 ring-primary',
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
            <div className="flex flex-wrap gap-1.5 items-center">
              <Badge variant="outline" className="text-xs">
                {selectedDates.slice(0, 3).map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })).join(', ')}
                {selectedDates.length > 3 && ` + ${selectedDates.length - 3} dia(s)`}
              </Badge>
              <Badge variant="secondary" className="text-xs">{selectedDates.length} dia(s)</Badge>
              <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] text-destructive" onClick={() => setSelectedDates([])}>
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
