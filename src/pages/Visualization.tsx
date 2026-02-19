import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { DAYS_OF_WEEK, PERIODS } from '@/types';
import { Building2, Users, CloudUpload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceStats } from '@/hooks/useServiceStats';

type ViewMode = 'unit' | 'professional';

export default function Visualization() {
  const { data } = useAppData();
  const [viewMode, setViewMode] = useState<ViewMode>('professional');
  const [isPublishing, setIsPublishing] = useState(false);

  // ── Dados de Serviço (Local) ──
  const { professionals: serviceProfs } = useServiceProfessionals();
  const { allEntries: nurseEntries } = useServiceSchedule('nurse');
  const { allEntries: techEntries } = useServiceSchedule('tech');
  const { requests } = useLeaveRequests();

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      // 1. Consolidar dados eMult
      const emultData = {
        professionals: data.professionals,
        units: data.units,
        functions: data.functions,
        schedule: data.schedule,
      };

      // 2. Consolidar dados de Serviço
      const serviceData = {
        professionals: serviceProfs,
        nurseEntries: nurseEntries,
        techEntries: techEntries,
        leaveRequests: requests,
      };

      // 3. Enviar para o Supabase
      const { error } = await supabase
        .from('portal_schedules')
        .insert([{
          emult_data: emultData as any,
          service_data: serviceData as any,
          published_at: new Date().toISOString()
        }]);

      if (error) throw error;
      toast.success('Escalas publicadas com sucesso! Todos os dados estão disponíveis no portal.');
    } catch (err) {
      console.error('Erro ao publicar:', err);
      toast.error('Erro ao publicar escalas. Verifique sua conexão.');
    } finally {
      setIsPublishing(false);
    }
  };

  const getProfessional = (id: string) => data.professionals.find(p => p.id === id);
  const getUnit = (id: string) => data.units.find(u => u.id === id);
  const getFunction = (id: string) => data.functions.find(f => f.id === id);

  const activeProfessionals = data.professionals.filter(p => p.active);
  const activeUnits = data.units.filter(u => u.active);

  // Group by function for professional view
  const professionalsByFunction = useMemo(() => {
    const grouped: Record<string, typeof activeProfessionals> = {};
    activeProfessionals.forEach(prof => {
      const funcId = prof.functionId;
      if (!grouped[funcId]) grouped[funcId] = [];
      grouped[funcId].push(prof);
    });
    return grouped;
  }, [activeProfessionals]);

  // Get schedule entries formatted for display
  const getScheduleText = (professionalId: string, day: string) => {
    const entries = data.schedule.filter(
      s => s.professionalId === professionalId && s.dayOfWeek === day
    );

    if (entries.length === 0) return '-';

    return entries.map(entry => {
      const unit = getUnit(entry.unitId);
      const period = PERIODS.find(p => p.key === entry.period);
      const periodSuffix = period?.key === 'manha' ? ' - MANHÃ' :
        period?.key === 'tarde' ? ' - TARDE' : '';
      return `${unit?.name || ''}${periodSuffix}`;
    }).join('\n');
  };

  // Get professionals working at unit on specific day
  const getUnitSchedule = (unitId: string, day: string) => {
    const entries = data.schedule.filter(
      s => s.unitId === unitId && s.dayOfWeek === day
    );

    if (entries.length === 0) return '-';

    return entries.map(entry => {
      const prof = getProfessional(entry.professionalId);
      const period = PERIODS.find(p => p.key === entry.period);
      const periodSuffix = period?.key === 'manha' ? ' (M)' :
        period?.key === 'tarde' ? ' (T)' : '';
      return `${prof?.name || ''}${periodSuffix}`;
    }).join('\n');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Visualização"
        description="Visualize a escala por profissional ou por unidade"
      />

      {/* View mode toggle and Publish button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('professional')}
            className={`view-toggle-btn flex items-center gap-2 ${viewMode === 'professional' ? 'active' : ''}`}
          >
            <Users className="w-4 h-4" />
            Por Profissional
          </button>
          <button
            onClick={() => setViewMode('unit')}
            className={`view-toggle-btn flex items-center gap-2 ${viewMode === 'unit' ? 'active' : ''}`}
          >
            <Building2 className="w-4 h-4" />
            Por Unidade
          </button>
        </div>

        <Button
          onClick={handlePublish}
          disabled={isPublishing}
          variant="default"
          className="bg-primary hover:bg-primary/90 text-white shadow-lg gap-2 w-full sm:w-auto"
        >
          {isPublishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          {isPublishing ? 'Publicando...' : 'Publicar no Portal'}
        </Button>
      </div>

      {viewMode === 'professional' ? (
        <div className="space-y-8">
          {Object.entries(professionalsByFunction).map(([funcId, profs]) => {
            const func = getFunction(funcId);
            if (profs.length === 0) return null;

            return (
              <div key={funcId} className="form-section overflow-x-auto">
                <h3
                  className="font-bold text-lg mb-4 pb-2 border-b-2"
                  style={{ borderColor: func?.color || '#888' }}
                >
                  PROFISSIONAL {func?.name?.toUpperCase()}
                </h3>
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th className="text-left w-48">PROFISSIONAL<br />{func?.name?.toUpperCase()}</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.key} className="text-center">{day.label.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profs.map(prof => (
                      <tr key={prof.id}>
                        <td className="font-semibold">{prof.name.toUpperCase()}</td>
                        {DAYS_OF_WEEK.map(day => (
                          <td key={day.key} className="text-center whitespace-pre-line text-xs">
                            {getScheduleText(prof.id, day.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {Object.keys(professionalsByFunction).length === 0 && (
            <div className="form-section text-center py-12 text-muted-foreground">
              Nenhum profissional cadastrado
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {activeUnits.map(unit => {
            // Check if unit has any schedules
            const hasSchedules = data.schedule.some(s => s.unitId === unit.id);
            if (!hasSchedules) return null;

            return (
              <div key={unit.id} className="form-section overflow-x-auto">
                <h3 className="font-bold text-lg mb-4 pb-2 border-b-2 border-primary">
                  {unit.name.toUpperCase()} {unit.type && `(${unit.type})`}
                </h3>
                <table className="schedule-table">
                  <thead>
                    <tr>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.key} className="text-center">{day.label.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {DAYS_OF_WEEK.map(day => (
                        <td key={day.key} className="text-center whitespace-pre-line text-xs align-top">
                          {getUnitSchedule(unit.id, day.key)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {!activeUnits.some(u => data.schedule.some(s => s.unitId === u.id)) && (
            <div className="form-section text-center py-12 text-muted-foreground">
              Nenhuma escala cadastrada
            </div>
          )}
        </div>
      )}
    </div>
  );
}
