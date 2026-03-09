/**
 * Dashboard — Visão geral do sistema de escalas.
 *
 * Exibe cards de estatísticas, distribuição por função/unidade e carga horária.
 * Todos os cards usam a classe padronizada .stat-card e .page-card do design system.
 */

import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Users, Building2, Calendar, Briefcase, AlertTriangle, Clock } from 'lucide-react';

export default function Dashboard() {
  const { data, getWeeklyHoursUsed } = useAppData();
  
  const activeProfessionals = data.professionals.filter(p => p.active);
  const activeUnits = data.units.filter(u => u.active);

  /** Estatísticas por função */
  const statsByFunction = data.functions.map(func => ({
    name: func.name,
    color: func.color,
    count: activeProfessionals.filter(p => p.functionId === func.id).length,
  })).filter(s => s.count > 0);

  /** Estatísticas por unidade (top 8) */
  const statsByUnit = activeUnits.map(unit => ({
    name: unit.name,
    count: new Set(data.schedule.filter(s => s.unitId === unit.id).map(e => e.professionalId)).size,
  })).sort((a, b) => b.count - a.count).slice(0, 8);

  /** Carga horária dos profissionais */
  const workloadIssues = activeProfessionals.map(prof => {
    const used = getWeeklyHoursUsed(prof.id);
    return {
      name: prof.name,
      used,
      total: prof.weeklyHours,
      remaining: prof.weeklyHours - used,
      percentage: Math.round((used / prof.weeklyHours) * 100),
    };
  }).filter(p => p.used > 0 || p.total > 0);

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Dashboard" 
        description="Visão geral do sistema de escalas"
      />

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Profissionais */}
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

        {/* Unidades */}
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

        {/* Escalas */}
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

        {/* Restrições */}
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

      {/* ── Detalhamento ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Por Função */}
        <div className="page-card">
          <h2 className="mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Profissionais por Função
          </h2>
          {statsByFunction.length > 0 ? (
            <div className="space-y-3">
              {statsByFunction.map((stat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
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

        {/* Por Unidade */}
        <div className="page-card">
          <h2 className="mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Profissionais por Unidade
          </h2>
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

        {/* Carga Horária */}
        <div className="page-card lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Carga Horária Semanal
          </h2>
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
