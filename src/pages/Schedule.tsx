import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, Trash2, AlertCircle } from 'lucide-react';
import { DAYS_OF_WEEK, PERIODS, DayOfWeek, Period } from '@/types';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ScheduleEntry } from '@/types';

export default function Schedule() {
  const {
    data,
    addScheduleEntry,
    deleteScheduleEntry,
    validateScheduleEntry,
    getWeeklyHoursUsed,
  } = useAppData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    professionalId: string;
    dayOfWeek: DayOfWeek | '';
    unitId: string;
    period: Period | '';
  }>({ professionalId: '', dayOfWeek: '', unitId: '', period: '' });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [filterFunctionId, setFilterFunctionId] = useState<string>('');

  const activeProfessionals = data.professionals.filter((p) => p.active);
  const activeUnits = data.units.filter((u) => u.active);

  const professionalsByFunction = useMemo(() => {
    const grouped: Record<string, typeof activeProfessionals> = {};
    const filtered =
      filterFunctionId && filterFunctionId !== 'all'
        ? activeProfessionals.filter((p) => p.functionId === filterFunctionId)
        : activeProfessionals;
    filtered.forEach((prof) => {
      const fid = prof.functionId;
      if (!grouped[fid]) grouped[fid] = [];
      grouped[fid].push(prof);
    });
    return grouped;
  }, [activeProfessionals, filterFunctionId]);

  const openNew = (professionalId?: string, dayOfWeek?: DayOfWeek) => {
    // Smart Unit Selection
    let defaultUnit = '';
    if (activeUnits.length === 1) {
      defaultUnit = activeUnits[0].id;
    } else {
      const lastUnit = localStorage.getItem('lastUsedUnitId');
      if (lastUnit && activeUnits.some(u => u.id === lastUnit)) {
        defaultUnit = lastUnit;
      }
    }

    setForm({
      professionalId: professionalId ?? '',
      dayOfWeek: dayOfWeek ?? '',
      unitId: defaultUnit,
      period: '',
    });
    setValidationErrors([]);
    setDialogOpen(true);
  };

  const openFromCell = (e: React.MouseEvent, professionalId: string, dayOfWeek: DayOfWeek) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    openNew(professionalId, dayOfWeek);
  };

  const handleValidate = () => {
    if (!form.professionalId || !form.unitId || !form.dayOfWeek || !form.period) {
      setValidationErrors(['Preencha todos os campos']);
      return false;
    }
    const errors = validateScheduleEntry({
      professionalId: form.professionalId,
      unitId: form.unitId,
      dayOfWeek: form.dayOfWeek,
      period: form.period,
    });
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = () => {
    if (!handleValidate()) return;
    const exists = data.schedule.some(
      (s) =>
        s.professionalId === form.professionalId &&
        s.dayOfWeek === form.dayOfWeek &&
        s.period === form.period
    );
    if (exists) {
      toast.error('Já existe escala para este profissional neste dia/período');
      return;
    }
    addScheduleEntry({
      professionalId: form.professionalId,
      unitId: form.unitId,
      dayOfWeek: form.dayOfWeek as DayOfWeek,
      period: form.period as Period,
    });

    // Persist last used unit
    localStorage.setItem('lastUsedUnitId', form.unitId);

    toast.success('Escala adicionada');
    setDialogOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteScheduleEntry(id);
    toast.success('Escala removida');
  };

  const getProfessional = (id: string) => data.professionals.find((p) => p.id === id);
  const getUnit = (id: string) => data.units.find((u) => u.id === id);
  const getFunction = (id: string) => data.functions.find((f) => f.id === id);

  const getEntriesForCell = (professionalId: string, day: DayOfWeek): ScheduleEntry[] =>
    data.schedule.filter(
      (s) => s.professionalId === professionalId && s.dayOfWeek === day
    );

  const formatEntry = (entry: ScheduleEntry) => {
    const unit = getUnit(entry.unitId)?.name ?? '';
    const suffix =
      entry.period === 'manha' ? ' - MANHÃ' : entry.period === 'tarde' ? ' - TARDE' : '';
    const prof = getProfessional(entry.professionalId);
    const func = getFunction(prof?.functionId || '');
    return {
      text: `${unit}${suffix}`,
      id: entry.id,
      color: func?.color
    };
  };

  const hasActiveProfs = activeProfessionals.length > 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Escala Base"
        description="Edite a escala semanal na estrutura da tabela. Uma pessoa pode ficar vários dias no mesmo lugar ou repartido em vários."
      />

      <div className="form-section mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label>Filtrar por função</Label>
          <Select
            value={filterFunctionId || 'all'}
            onValueChange={(v) => setFilterFunctionId(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas as funções</SelectItem>
              {data.functions.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openNew()}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar escala
        </Button>
      </div>

      {!hasActiveProfs ? (
        <EmptyState
          icon={Calendar}
          title="Nenhum profissional ativo"
          description="Cadastre profissionais em Profissionais para montar a escala"
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(professionalsByFunction).map(([funcId, profs]) => {
            const func = getFunction(funcId);
            return (
              <div key={funcId} className="form-section overflow-x-auto">
                <h3
                  className="font-bold text-lg mb-4 pb-2 border-b-2"
                  style={{ borderColor: func?.color ?? '#888' }}
                >
                  PROFISSIONAL {func?.name?.toUpperCase() ?? 'Indefinido'}
                </h3>
                <table className="schedule-table schedule-grid">
                  <thead>
                    <tr>
                      <th className="text-left w-48">PROFISSIONAL<br />{func?.name?.toUpperCase()}</th>
                      <th className="text-center w-20">CARGA</th>
                      {DAYS_OF_WEEK.map((day) => (
                        <th key={day.key} className="text-center min-w-[140px]">
                          {day.label.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profs.map((prof) => {
                      const used = getWeeklyHoursUsed(prof.id);
                      const limit = prof.weeklyHours;
                      return (
                        <tr key={prof.id}>
                          <td className="font-semibold align-top">{prof.name.toUpperCase()}</td>
                          <td className="text-center align-top text-xs">
                            <span
                              className={
                                used > limit
                                  ? 'text-destructive font-medium'
                                  : used > limit * 0.8
                                    ? 'text-warning'
                                    : 'text-muted-foreground'
                              }
                            >
                              {used}h/{limit}h
                            </span>
                          </td>
                          {DAYS_OF_WEEK.map((day) => {
                            const entries = getEntriesForCell(prof.id, day.key);
                            return (
                              <td
                                key={day.key}
                                className="align-top p-2 schedule-cell cursor-pointer hover:bg-slate-50 transition-colors border-l border-dashed border-slate-200"
                                onClick={(e) => openFromCell(e, prof.id, day.key)}
                              >
                                <div className="flex flex-col gap-1 min-h-[2.5rem]">
                                  {entries.map((entry) => {
                                    const { text, id, color } = formatEntry(entry);
                                    const cardColor = color || '#000';
                                    return (
                                      <div
                                        key={id}
                                        className="group relative flex items-center justify-between gap-1 rounded-r-md px-2 py-1.5 text-xs shadow-sm hover:shadow-md transition-all bg-white"
                                        style={{
                                          borderLeft: `4px solid ${cardColor}`,
                                          backgroundColor: `${cardColor}15` // 15 = very light opacity
                                        }}
                                      >
                                        <span className="truncate font-semibold text-slate-700">{text}</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 absolute right-0 top-0.5"
                                          onClick={(e) => handleDelete(e, id)}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-dashed border-slate-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openNew(prof.id, day.key);
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    <span className="sr-only">Adicionar</span>
                                  </Button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {Object.keys(professionalsByFunction).length === 0 && (
            <div className="form-section text-center py-12 text-muted-foreground">
              Nenhum profissional para a função selecionada
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Adicionar Escala</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {validationErrors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Profissional *</Label>
              <Select
                value={form.professionalId}
                onValueChange={(v) => setForm({ ...form, professionalId: v })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {activeProfessionals.map((p) => {
                    const f = getFunction(p.functionId);
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: f?.color ?? '#888' }}
                          />
                          {p.name} – {f?.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Dia da Semana *</Label>
              <Select
                value={form.dayOfWeek}
                onValueChange={(v) => setForm({ ...form, dayOfWeek: v as DayOfWeek })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Período *</Label>
              <Select
                value={form.period}
                onValueChange={(v) => setForm({ ...form, period: v as Period })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {PERIODS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label} ({p.hours}h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Unidade *</Label>
              <Select
                value={form.unitId}
                onValueChange={(v) => setForm({ ...form, unitId: v })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {activeUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
