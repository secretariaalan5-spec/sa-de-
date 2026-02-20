import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { DAYS_OF_WEEK } from '@/types';
import { Building2, Users } from 'lucide-react';

type ViewMode = 'unit' | 'professional';

/** Retorna o sufixo de período para exibição na escala. */
const getPeriodSuffix = (period: string, format: 'long' | 'short') => {
  if (period === 'manha') return format === 'long' ? ' - MANHÃ' : ' (M)';
  if (period === 'tarde') return format === 'long' ? ' - TARDE' : ' (T)';
  return '';
};

export default function Visualization() {
  const { data } = useAppData();
  const [viewMode, setViewMode] = useState<ViewMode>('professional');

  // ── Lookups por ID ──
  const getProfessional = (id: string) => data.professionals.find(p => p.id === id);
  const getUnit         = (id: string) => data.units.find(u => u.id === id);
  const getFunction     = (id: string) => data.functions.find(f => f.id === id);

  const activeProfessionals = data.professionals.filter(p => p.active);
  const activeUnits         = data.units.filter(u => u.active);

  // ── Agrupa profissionais por função para a view "Por Profissional" ──
  const professionalsByFunction = useMemo(() => {
    const grouped: Record<string, typeof activeProfessionals> = {};
    activeProfessionals.forEach(prof => {
      const funcId = prof.functionId;
      if (!grouped[funcId]) grouped[funcId] = [];
      grouped[funcId].push(prof);
    });
    return grouped;
  }, [activeProfessionals]);

  /** Texto de escala de um profissional em um dia específico. */
  const getScheduleText = (professionalId: string, day: string) => {
    const entries = data.schedule.filter(
      s => s.professionalId === professionalId && s.dayOfWeek === day
    );
    if (entries.length === 0) return '-';

    return entries.map(entry => {
      const unit = getUnit(entry.unitId);
      return `${unit?.name || ''}${getPeriodSuffix(entry.period, 'long')}`;
    }).join('\n');
  };

  /** Texto de escala de uma unidade em um dia específico. */
  const getUnitSchedule = (unitId: string, day: string) => {
    const entries = data.schedule.filter(
      s => s.unitId === unitId && s.dayOfWeek === day
    );
    if (entries.length === 0) return '-';

    return entries.map(entry => {
      const prof = getProfessional(entry.professionalId);
      return `${prof?.name || ''}${getPeriodSuffix(entry.period, 'short')}`;
    }).join('\n');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Visualização"
        description="Visualize a escala por profissional ou por unidade"
      />

      {/* ── Alternador de modo de visualização ── */}
      <div className="flex gap-2 mb-6">
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

      {/* ── View: Por Profissional ── */}
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
                      <th className="text-left w-48">
                        PROFISSIONAL<br />{func?.name?.toUpperCase()}
                      </th>
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
        /* ── View: Por Unidade ── */
        <div className="space-y-8">
          {activeUnits.map(unit => {
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
