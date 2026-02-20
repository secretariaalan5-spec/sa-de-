import { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Stethoscope,
  Syringe,
  AlertCircle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAVE_TYPE_LABELS } from '@/types/serviceSchedule';
import { type InviteAccessLevel } from '@/hooks/usePortalInvites';

type AccessLevel = 'emult' | 'nurse' | 'tech';

interface PortalCodes {
  emult: string;
  nurse: string;
  tech: string;
}

const DEFAULT_PORTAL_CODES: PortalCodes = {
  emult: 'EMULT2025',
  nurse: 'ENFERMEIRO2025',
  tech: 'TECNICO2025',
};

// ─────────────────────────────────────────
// Tipos portal
// ─────────────────────────────────────────
interface ServiceProfessionalPortal {
  id: string;
  name: string;
  category: 'tech' | 'nurse';
  monthlyHours: number;
  active: boolean;
}
interface ServiceScheduleEntry {
  id: string;
  professionalId: string;
  date: string;
  type: 'nurse' | 'tech';
  isWeekend: boolean;
}
interface Professional {
  id: string;
  name: string;
  functionId: string;
  weeklyHours: number;
}
interface Unit {
  id: string;
  name: string;
  address?: string;
}
interface ProfessionalFunction {
  id: string;
  name: string;
  color: string;
}
interface ScheduleEntry {
  id: string;
  professionalId: string;
  unitId: string;
  dayOfWeek: string;
  period: string;
}
interface PortalData {
  publishedAt: string;
  emult: {
    professionals: Professional[];
    units: Unit[];
    functions: ProfessionalFunction[];
    schedule: ScheduleEntry[];
  };
  service: {
    professionals: ServiceProfessionalPortal[];
    nurseEntries: ServiceScheduleEntry[];
    techEntries: ServiceScheduleEntry[];
  };
}

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const PERIODS = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'integral', label: 'Integral' },
];

// ─────────────────────────────────────────
// helper: valida código de convite no banco
// ─────────────────────────────────────────
async function validateInviteInDB(
  adminId: string,
  code: string
): Promise<InviteAccessLevel | null> {
  try {
    const { data, error } = await supabase
      .from('portal_invites' as any)
      .select('*')
      .eq('admin_id', adminId)
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;

    const invite = data as any;
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) return null;

    // Incrementa usos (fire-and-forget)
    supabase
      .from('portal_invites' as any)
      .update({ uses_count: (invite.uses_count || 0) + 1 })
      .eq('id', invite.id)
      .then(() => { });

    return invite.access_level as InviteAccessLevel;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// Tela de Login
// ─────────────────────────────────────────
function LoginScreen({
  onAccess,
  portalCodes,
  adminId,
}: {
  onAccess: (level: AccessLevel) => void,
  portalCodes: PortalCodes | null,
  adminId: string | null,
}) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    setChecking(true);
    setError('');

    // 1. Verifica códigos fixos (emult/nurse/tech)
    if (portalCodes) {
      if (trimmed === (portalCodes.emult || DEFAULT_PORTAL_CODES.emult)) {
        setChecking(false); return onAccess('emult');
      } else if (trimmed === (portalCodes.nurse || DEFAULT_PORTAL_CODES.nurse)) {
        setChecking(false); return onAccess('nurse');
      } else if (trimmed === (portalCodes.tech || DEFAULT_PORTAL_CODES.tech)) {
        setChecking(false); return onAccess('tech');
      }
    }

    // 2. Verifica na tabela de convites (portal_invites)
    if (adminId) {
      const inviteLevel = await validateInviteInDB(adminId, trimmed);
      if (inviteLevel) {
        setChecking(false); return onAccess(inviteLevel);
      }
    }

    setChecking(false);
    setError('Código inválido ou ainda não publicado. Verifique com o administrador.');
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl mx-auto mb-4">
            <img
              src="/logo-saude-plus.png"
              alt="Saúde+"
              className="h-12 w-auto"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Portal de Escalas</h1>
          <p className="text-muted-foreground mt-1 text-sm">Acesso restrito — somente visualização</p>
        </div>

        <Card
          className="border-0 shadow-2xl bg-card/90 backdrop-blur-sm"
          style={{ animation: shaking ? 'shake 0.4s ease-in-out' : undefined }}
        >
          <CardContent className="pt-8 pb-8 px-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg leading-tight">Digite seu código</h2>
                <p className="text-xs text-muted-foreground">Fornecido pelo administrador</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access-code">Código de acesso</Label>
                <div className="relative">
                  <Input
                    id="access-code"
                    type={showCode ? 'text' : 'password'}
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(''); }}
                    placeholder="Ex: EMT-A1B2C3"
                    className={cn('pr-10 text-center text-lg tracking-widest font-medium h-12', error && 'border-destructive')}
                    autoFocus
                    autoComplete="off"
                    disabled={checking}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
              <Button type="submit" disabled={checking} className="w-full h-12 text-base font-semibold gap-2">
                {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {checking ? 'Verificando...' : 'Acessar'}
              </Button>
            </form>
            {adminId && !portalCodes && (
              <div className="mt-4 text-center">
                <p className="text-[10px] text-muted-foreground animate-pulse">Carregando configurações do portal...</p>
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground mt-6">
              Não tem o código? Entre em contato com a secretaria.
            </p>
          </CardContent>
        </Card>
      </div>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-8px)}
          80%{transform:translateX(8px)}
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export default function Portal() {
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [portalCodes, setPortalCodes] = useState<PortalCodes | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loadingPortal, setLoadingPortal] = useState(false);

  // ── Pegar adminId e code da URL ──
  const searchParams = new URLSearchParams(window.location.search);
  const adminId = searchParams.get('admin');
  const urlCode = searchParams.get('code');

  // ── Tentar acesso automático se houver código na URL ──
  useEffect(() => {
    if (!urlCode || accessLevel) return;

    const tryAutoAccess = async () => {
      const trimmed = urlCode.trim().toUpperCase();

      // 1. Verifica códigos fixos
      if (portalCodes) {
        if (trimmed === portalCodes.emult) { setAccessLevel('emult'); return; }
        if (trimmed === portalCodes.nurse) { setAccessLevel('nurse'); return; }
        if (trimmed === portalCodes.tech) { setAccessLevel('tech'); return; }
      }

      // 2. Verifica convites na tabela portal_invites
      if (adminId) {
        const inviteLevel = await validateInviteInDB(adminId, trimmed);
        if (inviteLevel) { setAccessLevel(inviteLevel); return; }
      }
    };

    tryAutoAccess();
  }, [urlCode, portalCodes, accessLevel, adminId]);

  // ── Buscar códigos e dados ──
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!adminId) return;
      setLoadingPortal(true);
      try {
        const { data, error } = await supabase
          .from('portal_schedules')
          .select('*')
          .eq('user_id', adminId)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // Carrega os códigos da publicação (ou usa os padrões se for uma publicação antiga)
          const codes = (data as any).portal_codes as PortalCodes;
          setPortalCodes(codes || DEFAULT_PORTAL_CODES);

          // Armazena os dados da publicação
          setPortalData({
            publishedAt: data.published_at,
            emult: data.emult_data as unknown as PortalData['emult'],
            service: data.service_data as unknown as PortalData['service'],
          });
        }
      } catch (err) {
        console.error('Erro ao carregar dados iniciais do portal:', err);
      } finally {
        setLoadingPortal(false);
      }
    };

    fetchInitialData();
  }, [adminId]);

  // ── Hooks de dados locais (usados apenas como fallback ou interface) ──
  const { professionals: localProfessionals } = useServiceProfessionals();
  const { requests: localRequests, getTotalCreditsUsedByProfessional } = useLeaveRequests();
  const { allEntries: localNurseEntries } = useServiceSchedule('nurse');
  const { allEntries: localTechEntries } = useServiceSchedule('tech');

  // ── Dados efetivos (Supabase ou Local) ──
  const professionals = portalData?.service?.professionals || localProfessionals;
  const nurseEntries = portalData?.service?.nurseEntries || localNurseEntries;
  const techEntries = portalData?.service?.techEntries || localTechEntries;
  const requests = (portalData?.service as any)?.leaveRequests || localRequests;

  const { getStatsForProfessional } = useServiceStats({
    allEntries: [...nurseEntries, ...techEntries],
    getTotalCreditsUsedByProfessional: (id) => {
      return (requests as any[])
        .filter((r: any) => r.professionalId === id && r.status === 'approved')
        .reduce((acc: number, r: any) => acc + (r.daysRequested || 0), 0);
    },
  } as any);

  const fetchPortalData = async () => {
    // Agora os dados já são carregados no efeito inicial, mas mantemos para compatibilidade
    if (!adminId) return;
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase
        .from('portal_schedules')
        .select('*')
        .eq('user_id', adminId)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        if ((data as any).portal_codes) setPortalCodes((data as any).portal_codes as PortalCodes);
        setPortalData({
          publishedAt: data.published_at,
          emult: data.emult_data as unknown as PortalData['emult'],
          service: data.service_data as unknown as PortalData['service'],
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar dados do portal:', err);
    } finally {
      setLoadingPortal(false);
    }
  };

  useEffect(() => {
    if (accessLevel) fetchPortalData();
  }, [accessLevel]);

  const goToPreviousMonth = () =>
    setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  const handleLogout = () => {
    setAccessLevel(null);
    setPortalData(null);
  };

  // ── Dados filtrados por categoria ──
  const categoryFilter = accessLevel === 'nurse' ? 'nurse' : accessLevel === 'tech' ? 'tech' : null;
  const filteredProfessionals = categoryFilter
    ? professionals.filter(p => p.category === categoryFilter && p.active)
    : professionals.filter(p => p.active);

  const filteredRequests = categoryFilter
    ? requests.filter(r => r.category === categoryFilter)
    : requests;

  // ── Labels ──
  const groupLabel: Record<AccessLevel, string> = {
    emult: 'eMult',
    nurse: 'Enfermeiros',
    tech: 'Técnicos',
  };

  // ── Tela de Login ──
  if (!accessLevel) {
    return <LoginScreen onAccess={setAccessLevel} portalCodes={portalCodes} adminId={adminId} />;
  }

  // ── Carregando ──
  if (loadingPortal && accessLevel === 'emult') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl px-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ─────────────────────────
  // Renderizadores de seção
  // ─────────────────────────

  /** Calendário de serviço (enfermeiros ou técnicos) */
  const renderServiceCalendar = (type: 'nurse' | 'tech') => {
    const entries = type === 'nurse' ? nurseEntries : techEntries;
    const profs = professionals.filter(p => p.category === type && p.active);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const getEntriesForDate = (dateStr: string) =>
      entries.filter(e => e.date === dateStr);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="hover:bg-background">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-lg font-semibold capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="hover:bg-background">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="grid grid-cols-7 gap-px bg-muted min-w-[700px]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-sm font-semibold p-3 bg-muted/80 text-muted-foreground">{day}</div>
            ))}
            {Array.from({ length: getDay(monthStart) }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2 bg-background min-h-[90px]" />
            ))}
            {daysInMonth.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEntries = getEntriesForDate(dateStr);
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;
              return (
                <div key={dateStr} className={cn('min-h-[90px] p-2 bg-background', isWeekend && 'bg-amber-50/50 dark:bg-amber-950/20')}>
                  <div className={cn('text-sm font-semibold mb-1 w-7 h-7 flex items-center justify-center rounded-full', isWeekend ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700' : '')}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEntries.map(entry => {
                      const prof = profs.find(p => p.id === entry.professionalId);
                      return (
                        <div
                          key={entry.id}
                          className={cn('text-xs px-2 py-0.5 rounded-md truncate font-medium', type === 'nurse' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700')}
                          title={prof?.name}
                        >
                          {prof?.name?.split(' ')[0] || '?'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /** Escala eMult por unidade */
  const renderEmultSchedule = () => {
    if (!portalData) return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhuma escala publicada pelo administrador ainda.</p>
        <Button variant="outline" size="sm" onClick={fetchPortalData} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" />Atualizar
        </Button>
      </div>
    );

    const { professionals: emultProfs, units, functions, schedule } = portalData.emult;

    if (units.length === 0) return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma unidade cadastrada na escala eMult.</p>
      </div>
    );

    return (
      <div className="space-y-6">
        {units.map(unit => (
          <Card key={unit.id} className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {unit.name}
              </CardTitle>
              {unit.address && <p className="text-sm text-muted-foreground">{unit.address}</p>}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 font-semibold text-muted-foreground">Período</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day} className="text-center p-4 font-semibold text-muted-foreground">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map(period => (
                      <tr key={period.key} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-4 font-medium">{period.label}</td>
                        {DAYS_OF_WEEK.map(day => {
                          const entry = schedule.find(s => s.unitId === unit.id && s.dayOfWeek === day && s.period === period.key);
                          const professional = entry ? emultProfs.find(p => p.id === entry.professionalId) : null;
                          const func = professional ? functions.find(f => f.id === professional.functionId) : null;
                          return (
                            <td key={day} className="text-center p-3">
                              {professional ? (
                                <div
                                  className="inline-flex px-3 py-1.5 rounded-full text-white text-xs font-medium shadow-sm"
                                  style={{ backgroundColor: func?.color || '#6b7280' }}
                                  title={`${professional.name} - ${func?.name || ''}`}
                                >
                                  {professional.name.split(' ')[0]}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  /** Horas no banco / créditos */
  const renderCredits = () => {
    if (filteredProfessionals.length === 0) return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p>Nenhum profissional encontrado.</p>
      </div>
    );

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProfessionals.map(prof => {
          const stats = getStatsForProfessional(prof.id, prof.name, prof.category);
          return (
            <div key={prof.id} className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-4">
              <div className="flex items-center gap-2">
                {prof.category === 'nurse'
                  ? <Stethoscope className="w-5 h-5 text-emerald-600" />
                  : <Syringe className="w-5 h-5 text-blue-600" />}
                <span className="font-semibold truncate">{prof.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                    <Calendar className="w-3 h-3" />Dias Trabalhados
                  </div>
                  <div className="text-xl font-bold">{stats.workedDays}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
                  <div className="text-amber-600 text-xs mb-1">Fins de Semana</div>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.weekendDays}</div>
                </div>
                <div className="bg-primary/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-primary text-xs mb-1">
                    <TrendingUp className="w-3 h-3" />Créditos Gerados
                  </div>
                  <div className="text-xl font-bold text-primary">{stats.creditsGenerated}</div>
                </div>
                <div className="bg-destructive/5 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-destructive text-xs mb-1">
                    <TrendingDown className="w-3 h-3" />Créditos Usados
                  </div>
                  <div className="text-xl font-bold text-destructive">{stats.creditsUsed}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Saldo Disponível</span>
                <span className={cn('text-2xl font-bold',
                  stats.creditsBalance > 0 ? 'text-green-600 dark:text-green-400'
                    : stats.creditsBalance < 0 ? 'text-destructive'
                      : 'text-muted-foreground'
                )}>
                  {stats.creditsBalance} dias
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /** Pedidos de folga */
  const renderLeaveRequests = () => {
    if (filteredRequests.length === 0) return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p>Nenhum pedido de folga registrado.</p>
      </div>
    );

    const absenceLabel = (type?: string) => {
      switch (type) {
        case 'ferias': return { label: 'Férias', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
        case 'licenca': return { label: 'Licença', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
        case 'atestado': return { label: 'Atestado', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
        default: return { label: 'Folga', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
      }
    };

    return (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold text-muted-foreground">Profissional</th>
                <th className="text-center p-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-center p-3 font-semibold text-muted-foreground">Ausência</th>
                <th className="text-center p-3 font-semibold text-muted-foreground">Data Pedido</th>
                <th className="text-center p-3 font-semibold text-muted-foreground">Dias</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Período</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Obs</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests
                .sort((a, b) => b.requestDate.localeCompare(a.requestDate))
                .map(req => {
                  const prof = professionals.find(p => p.id === req.professionalId);
                  const abs = absenceLabel(req.absenceType);
                  return (
                    <tr key={req.id} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium">{prof?.name || 'Desconhecido'}</td>
                      <td className="p-3 text-center">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                          {LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', abs.cls)}>{abs.label}</span>
                      </td>
                      <td className="p-3 text-center">
                        {format(new Date(req.requestDate + 'T00:00:00'), 'dd/MM/yyyy')}
                      </td>
                      <td className="p-3 text-center font-semibold">{req.daysRequested}</td>
                      <td className="p-3 text-sm">
                        {req.leaveDates.length > 0 && (
                          <>
                            {format(new Date(req.leaveDates[0] + 'T00:00:00'), 'dd/MM')}
                            {req.leaveDates.length > 1 && (
                              <> a {format(new Date(req.leaveDates[req.leaveDates.length - 1] + 'T00:00:00'), 'dd/MM')}</>
                            )}
                          </>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{req.observations || '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─────────────────────────
  // Abas disponíveis por grupo
  // ─────────────────────────
  const tabs = {
    emult: [
      { key: 'escala', label: 'Escala eMult', icon: <Calendar className="h-4 w-4" /> },
    ],
    nurse: [
      { key: 'escala', label: 'Escala', icon: <Calendar className="h-4 w-4" /> },
      { key: 'horas', label: 'Horas no Banco', icon: <Clock className="h-4 w-4" /> },
      { key: 'folgas', label: 'Folgas', icon: <FileText className="h-4 w-4" /> },
    ],
    tech: [
      { key: 'escala', label: 'Escala', icon: <Calendar className="h-4 w-4" /> },
      { key: 'horas', label: 'Horas no Banco', icon: <Clock className="h-4 w-4" /> },
      { key: 'folgas', label: 'Folgas', icon: <FileText className="h-4 w-4" /> },
    ],
  };

  const currentTabs = tabs[accessLevel];
  const updatedLabel = portalData
    ? `Atualizado em ${format(parseISO(portalData.publishedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
    : 'Dados locais';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <img
                  src="/logo-saude-plus.png"
                  alt="Saúde+"
                  className="h-8 w-auto"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Portal de Escalas —{' '}
                  <span className={cn(
                    'text-sm font-medium px-2 py-0.5 rounded-full',
                    accessLevel === 'nurse' ? 'bg-emerald-100 text-emerald-700' :
                      accessLevel === 'tech' ? 'bg-blue-100 text-blue-700' :
                        'bg-primary/10 text-primary'
                  )}>
                    {groupLabel[accessLevel]}
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground">{updatedLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchPortalData}
                className="text-muted-foreground hover:text-foreground"
                title="Atualizar"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="escala" className="space-y-6">
          <TabsList className={cn(
            'grid h-14 p-1 bg-muted/50 backdrop-blur-sm max-w-xl mx-auto',
            currentTabs.length === 1 ? 'grid-cols-1' :
              currentTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
          )}>
            {currentTabs.map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
              >
                {tab.icon}
                <span className="hidden sm:inline font-medium">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Aba: Escala ── */}
          <TabsContent value="escala">
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center',
                    accessLevel === 'nurse' ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                      accessLevel === 'tech' ? 'bg-blue-100 dark:bg-blue-900/40' :
                        'bg-primary/10'
                  )}>
                    {accessLevel === 'nurse' ? <Stethoscope className="h-5 w-5 text-emerald-600" /> :
                      accessLevel === 'tech' ? <Syringe className="h-5 w-5 text-blue-600" /> :
                        <Calendar className="h-5 w-5 text-primary" />}
                  </div>
                  {accessLevel === 'nurse' ? 'Escala de Enfermeiros' :
                    accessLevel === 'tech' ? 'Escala de Técnicos' :
                      'Escala eMult — Por Unidade'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {accessLevel === 'emult' && renderEmultSchedule()}
                {accessLevel === 'nurse' && renderServiceCalendar('nurse')}
                {accessLevel === 'tech' && renderServiceCalendar('tech')}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Aba: Horas no Banco ── */}
          {(accessLevel === 'nurse' || accessLevel === 'tech') && (
            <TabsContent value="horas">
              <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    Horas no Banco de Créditos —{' '}
                    {accessLevel === 'nurse' ? 'Enfermeiros' : 'Técnicos'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">{renderCredits()}</CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ── Aba: Pedidos de Folga ── */}
          {(accessLevel === 'nurse' || accessLevel === 'tech') && (
            <TabsContent value="folgas">
              <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    Pedidos de Folga —{' '}
                    {accessLevel === 'nurse' ? 'Enfermeiros' : 'Técnicos'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">{renderLeaveRequests()}</CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <footer className="border-t bg-card/50 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Portal de visualização de escalas —{' '}
            <span className="font-medium">Somente leitura</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
