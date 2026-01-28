import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Users, Building2, Calendar, Briefcase, AlertTriangle, Clock } from 'lucide-react';
import { DAYS_OF_WEEK, PERIODS } from '@/types';

export default function Dashboard() {
  const { data, getWeeklyHoursUsed } = useAppData();
  
  const activeProfessionals = data.professionals.filter(p => p.active);
  const activeUnits = data.units.filter(u => u.active);

  // Stats by function
  const statsByFunction = data.functions.map(func => {
    const profs = activeProfessionals.filter(p => p.functionId === func.id);
    return {
      name: func.name,
      color: func.color,
      count: profs.length,
    };
  }).filter(s => s.count > 0);

  // Stats by unit
  const statsByUnit = activeUnits.map(unit => {
    const entries = data.schedule.filter(s => s.unitId === unit.id);
    const uniqueProfessionals = new Set(entries.map(e => e.professionalId));
    return {
      name: unit.name,
      count: uniqueProfessionals.size,
    };
  }).sort((a, b) => b.count - a.count).slice(0, 8);

  // Professionals with workload issues
  const workloadIssues = activeProfessionals.map(prof => {
    const used = getWeeklyHoursUsed(prof.id);
    const remaining = prof.weeklyHours - used;
    return {
      name: prof.name,
      used,
      total: prof.weeklyHours,
      remaining,
      percentage: Math.round((used / prof.weeklyHours) * 100),
    };
  }).filter(p => p.used > 0 || p.total > 0);

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Dashboard" 
        description="Visão geral do sistema de escalas"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeProfessionals.length}</p>
              <p className="text-sm text-muted-foreground">Profissionais</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeUnits.length}</p>
              <p className="text-sm text-muted-foreground">Unidades</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Calendar className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.schedule.length}</p>
              <p className="text-sm text-muted-foreground">Escalas</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.restrictions.length}</p>
              <p className="text-sm text-muted-foreground">Restrições</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By Function */}
        <div className="form-section">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Profissionais por Função
          </h3>
          {statsByFunction.length > 0 ? (
            <div className="space-y-3">
              {statsByFunction.map((stat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="text-sm">{stat.name}</span>
                  </div>
                  <span className="font-semibold">{stat.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado</p>
          )}
        </div>

        {/* By Unit */}
        <div className="form-section">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Profissionais por Unidade
          </h3>
          {statsByUnit.length > 0 ? (
            <div className="space-y-3">
              {statsByUnit.map((stat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm truncate flex-1">{stat.name}</span>
                  <span className="font-semibold ml-2">{stat.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada</p>
          )}
        </div>

        {/* Workload */}
        <div className="form-section lg:col-span-2">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Carga Horária Semanal
          </h3>
          {workloadIssues.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workloadIssues.slice(0, 9).map((prof, i) => (
                <div key={i} className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium truncate">{prof.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          prof.percentage > 100 ? 'bg-destructive' :
                          prof.percentage > 80 ? 'bg-warning' : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(prof.percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {prof.used}h / {prof.total}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma escala cadastrada</p>
          )}
        </div>
      </div>
    </div>
  );
}
