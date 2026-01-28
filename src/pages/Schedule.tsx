import { useState } from 'react';
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

export default function Schedule() {
  const { 
    data, 
    addScheduleEntry, 
    deleteScheduleEntry, 
    validateScheduleEntry,
    getWeeklyHoursUsed
  } = useAppData();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [form, setForm] = useState({
    unitId: '',
    dayOfWeek: '' as DayOfWeek | '',
    period: '' as Period | '',
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const activeProfessionals = data.professionals.filter(p => p.active);
  const activeUnits = data.units.filter(u => u.active);

  const openNew = () => {
    setForm({ unitId: '', dayOfWeek: '', period: '' });
    setValidationErrors([]);
    setDialogOpen(true);
  };

  const handleValidate = () => {
    if (!selectedProfessional || !form.unitId || !form.dayOfWeek || !form.period) {
      setValidationErrors(['Preencha todos os campos']);
      return false;
    }

    const errors = validateScheduleEntry({
      professionalId: selectedProfessional,
      unitId: form.unitId,
      dayOfWeek: form.dayOfWeek,
      period: form.period,
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = () => {
    if (!handleValidate()) {
      return;
    }

    // Check if already exists
    const exists = data.schedule.find(s =>
      s.professionalId === selectedProfessional &&
      s.dayOfWeek === form.dayOfWeek &&
      s.period === form.period
    );

    if (exists) {
      toast.error('Já existe escala para este profissional neste dia/período');
      return;
    }

    addScheduleEntry({
      professionalId: selectedProfessional,
      unitId: form.unitId,
      dayOfWeek: form.dayOfWeek as DayOfWeek,
      period: form.period as Period,
    });
    toast.success('Escala adicionada');
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteScheduleEntry(id);
    toast.success('Escala removida');
  };

  const getProfessional = (id: string) => data.professionals.find(p => p.id === id);
  const getUnit = (id: string) => data.units.find(u => u.id === id);
  const getFunction = (id: string) => data.functions.find(f => f.id === id);
  const getPeriodLabel = (key: Period) => PERIODS.find(p => p.key === key)?.label || key;

  // Get schedule for selected professional
  const professionalSchedule = selectedProfessional 
    ? data.schedule.filter(s => s.professionalId === selectedProfessional)
    : [];

  const currentProf = getProfessional(selectedProfessional);
  const usedHours = currentProf ? getWeeklyHoursUsed(selectedProfessional) : 0;

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Escala Base" 
        description="Edite a escala semanal dos profissionais"
      />

      <div className="form-section mb-6">
        <Label>Selecione o Profissional</Label>
        <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
          <SelectTrigger className="bg-background max-w-md">
            <SelectValue placeholder="Escolha um profissional" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {activeProfessionals.map((p) => {
              const func = getFunction(p.functionId);
              return (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: func?.color || '#888' }}
                    />
                    {p.name} - {func?.name}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {!selectedProfessional ? (
        <EmptyState
          icon={Calendar}
          title="Selecione um profissional"
          description="Escolha um profissional para visualizar e editar sua escala"
        />
      ) : (
        <div className="space-y-6">
          {/* Workload indicator */}
          {currentProf && (
            <div className="form-section p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Carga horária semanal</p>
                  <p className="text-lg font-semibold">
                    {usedHours}h / {currentProf.weeklyHours}h
                  </p>
                </div>
                <div className="w-32 h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      usedHours > currentProf.weeklyHours ? 'bg-destructive' :
                      usedHours > currentProf.weeklyHours * 0.8 ? 'bg-warning' : 'bg-success'
                    }`}
                    style={{ width: `${Math.min((usedHours / currentProf.weeklyHours) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Schedule table */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Escala Semanal</h3>
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {professionalSchedule.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma escala cadastrada para este profissional
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th className="text-left">Dia</th>
                      <th className="text-left">Período</th>
                      <th className="text-left">Unidade</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS_OF_WEEK.map(day => {
                      const dayEntries = professionalSchedule.filter(s => s.dayOfWeek === day.key);
                      if (dayEntries.length === 0) return null;
                      return dayEntries.map((entry, idx) => (
                        <tr key={entry.id}>
                          {idx === 0 && (
                            <td rowSpan={dayEntries.length} className="font-medium border-r">
                              {day.label}
                            </td>
                          )}
                          <td>{getPeriodLabel(entry.period)}</td>
                          <td>{getUnit(entry.unitId)?.name || '-'}</td>
                          <td className="text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                    <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
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
                    <SelectItem key={p.key} value={p.key}>{p.label} ({p.hours}h)</SelectItem>
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
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
