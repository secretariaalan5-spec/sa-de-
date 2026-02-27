import { useState, useEffect, useCallback } from 'react';
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
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAVE_TYPE_LABELS, LeaveRequest } from '@/types/serviceSchedule';
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
  adminName?: string;
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
      .from('portal_invites')
      .select('*')
      .eq('admin_id', adminId)
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;

    const invite = data;
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) return null;

    // Incrementa usos (fire-and-forget)
    supabase
      .from('portal_invites')
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
  onInstall,
  showInstall,
  loading,
}: {
  onAccess: (level: AccessLevel) => void,
  portalCodes: PortalCodes | null,
  adminId: string | null,
  onInstall: () => void,
  showInstall: boolean,
  loading: boolean,
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
    const effectiveCodes = portalCodes || DEFAULT_PORTAL_CODES;
    if (trimmed === (effectiveCodes.emult || DEFAULT_PORTAL_CODES.emult)) {
      localStorage.setItem('portal_last_code', trimmed);
      setChecking(false); return onAccess('emult');
    } else if (trimmed === (effectiveCodes.nurse || DEFAULT_PORTAL_CODES.nurse)) {
      localStorage.setItem('portal_last_code', trimmed);
      setChecking(false); return onAccess('nurse');
    } else if (trimmed === (effectiveCodes.tech || DEFAULT_PORTAL_CODES.tech)) {
      localStorage.setItem('portal_last_code', trimmed);
      setChecking(false); return onAccess('tech');
    }

    // 2. Verifica na tabela de convites (portal_invites)
    if (adminId) {
      const inviteLevel = await validateInviteInDB(adminId, trimmed);
      if (inviteLevel) {
        localStorage.setItem('portal_last_code', trimmed);
        setChecking(false); return onAccess(inviteLevel);
      }
    }

    setChecking(false);
    setError('Código inválido ou ainda não publicado.');
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full animate-pulse" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 space-y-4">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl mx-auto transform hover:scale-105 transition-transform duration-300">
              <img
                src="/logo-saude-plus.png"
                alt="Saúde+"
                className="h-14 w-auto brightness-0 invert"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <Stethoscope className="h-12 w-12 text-white absolute inset-0 m-auto opacity-20" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700">
              <Lock className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              Secretaria <span className="text-primary italic">Ativa</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Portal de Transparência de Escalas</p>
          </div>
        </div>

        <Card
          className={cn(
            "border-0 shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden rounded-[2.5rem]",
            shaking && "animate-shake"
          )}
        >
          <CardContent className="pt-10 pb-10 px-8">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bem-vindo(a)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Insira seu código de acesso para visualizar as escalas</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="access-code" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Código de Acesso</Label>
                  <div className="relative group">
                    <Input
                      id="access-code"
                      type={showCode ? 'text' : 'password'}
                      value={code}
                      onChange={(e) => { setCode(e.target.value); setError(''); }}
                      placeholder="DIRECAO2025"
                      className={cn(
                        'pr-12 text-center text-xl tracking-[0.3em] font-bold h-16 bg-slate-50/50 dark:bg-slate-800/50 border-2 transition-all duration-300 rounded-2xl',
                        error ? 'border-destructive ring-destructive/20' : 'border-transparent focus:border-primary ring-offset-0 focus:ring-4 focus:ring-primary/10'
                      )}
                      autoFocus
                      autoComplete="off"
                      disabled={checking || loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors p-2"
                    >
                      {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-xs font-semibold bg-destructive/10 p-3 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={checking || loading}
                  className="w-full h-16 text-lg font-bold rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg hover:shadow-primary/25 gap-3"
                >
                  {checking || loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>{loading ? 'Carregando portal...' : 'Acessando...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Portal</span>
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>

              {showInstall && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={onInstall}
                    className="w-full h-14 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 text-primary font-bold gap-2 transition-all"
                  >
                    <Download className="h-5 w-5" />
                    Instalar Aplicativo (PWA)
                  </Button>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs font-medium text-slate-400">
                  Dúvidas sobre seu acesso?<br />
                  <span className="text-primary hover:underline cursor-pointer">Contate a Secretaria de Saúde</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-slate-400 mt-10 uppercase tracking-[0.2em] font-bold">
          &copy; 2025 Secretaria Municipal de Saúde
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [emultSearch, setEmultSearch] = useState('');

  // ── Listener para PWA Install ──
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // ── Pegar adminId e code da URL ou localStorage ──
  const searchParams = new URLSearchParams(window.location.search);
  const urlAdminId = searchParams.get('admin');
  const urlCode = searchParams.get('code');

  // Se não houver adminId na URL, tenta pegar do localStorage (para PWA instalado)
  const [adminId, setAdminId] = useState<string | null>(urlAdminId || localStorage.getItem('portal_admin_id'));

  // Atualiza adminId se vier na URL
  useEffect(() => {
    if (urlAdminId && urlAdminId !== adminId) {
      setAdminId(urlAdminId);
      localStorage.setItem('portal_admin_id', urlAdminId);
    }
  }, [urlAdminId, adminId]);

  // ── Tentar acesso automático se houver código na URL ou salvo ──
  useEffect(() => {
    const savedCode = localStorage.getItem('portal_last_code');
    const codeToTry = urlCode || savedCode;

    if (!codeToTry || accessLevel) return;

    const tryAutoAccess = async () => {
      const trimmed = codeToTry.trim().toUpperCase();
      if (!trimmed || trimmed === '...') return;

      // 1. Verifica códigos fixos
      const effectiveCodes = portalCodes || DEFAULT_PORTAL_CODES;
      let level: AccessLevel | null = null;
      if (trimmed === (effectiveCodes.emult || DEFAULT_PORTAL_CODES.emult)) level = 'emult';
      else if (trimmed === (effectiveCodes.nurse || DEFAULT_PORTAL_CODES.nurse)) level = 'nurse';
      else if (trimmed === (effectiveCodes.tech || DEFAULT_PORTAL_CODES.tech)) level = 'tech';

      if (level) {
        setAccessLevel(level);
        localStorage.setItem('portal_last_code', trimmed);
        return;
      }

      // 2. Verifica convites na tabela portal_invites
      if (adminId) {
        const inviteLevel = await validateInviteInDB(adminId, trimmed);
        if (inviteLevel) {
          setAccessLevel(inviteLevel);
          localStorage.setItem('portal_last_code', trimmed);
          return;
        }
      }

      // Se o código salvo não for mais válido, limpa
      if (!urlCode && savedCode) {
        localStorage.removeItem('portal_last_code');
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
          const codes = data.portal_codes as unknown as PortalCodes;
          setPortalCodes(codes || DEFAULT_PORTAL_CODES);

          // Armazena os dados da publicação
          setPortalData({
            publishedAt: data.published_at,
            adminName: data.admin_name || undefined,
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
  const requests = (portalData?.service as unknown as { leaveRequests: LeaveRequest[] })?.leaveRequests || localRequests;

  const { getStatsForProfessional } = useServiceStats({
    allEntries: [...nurseEntries, ...techEntries],
    getTotalCreditsUsedByProfessional: (id: string) => {
      return (requests as LeaveRequest[])
        .filter((r) => r.professionalId === id && r.status === 'approved' && r.leaveType === 'folga_credito')
        .reduce((acc: number, r) => acc + (r.daysRequested || 0), 0);
    },
  });

  const fetchPortalData = useCallback(async () => {
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
        if (data.portal_codes) setPortalCodes(data.portal_codes as unknown as PortalCodes);
        setPortalData({
          publishedAt: data.published_at,
          adminName: data.admin_name || undefined,
          emult: data.emult_data as unknown as PortalData['emult'],
          service: data.service_data as unknown as PortalData['service'],
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar dados do portal:', err);
    } finally {
      setLoadingPortal(false);
    }
  }, [adminId]);

  useEffect(() => {
    if (accessLevel) fetchPortalData();
  }, [accessLevel, fetchPortalData]);

  const goToPreviousMonth = () =>
    setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  const handleLogout = () => {
    setAccessLevel(null);
    setPortalData(null);
    localStorage.removeItem('portal_last_code');
    localStorage.removeItem('portal_admin_id');
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

  // ── Tela de Login (Garante que carregou os códigos antes se houver adminId) ──
  if (!accessLevel) {
    if (loadingPortal && !portalCodes) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
          <div className="space-y-4 w-full max-w-md px-4 text-center">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-slate-500 font-medium">Carregando portal...</p>
          </div>
        </div>
      );
    }

    return (
      <LoginScreen
        onAccess={setAccessLevel}
        portalCodes={portalCodes}
        adminId={adminId}
        onInstall={handleInstall}
        showInstall={!!deferredPrompt}
        loading={loadingPortal}
      />
    );
  }

  // ── Carregando dados após login ──
  if (loadingPortal && (accessLevel === 'emult' || !portalData)) {
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-800/80 shadow-inner">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousMonth}
              className="h-10 w-10 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h3 className="text-lg font-black capitalize min-w-[140px] text-center text-slate-700 dark:text-slate-200">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              className="h-10 w-10 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
            className="rounded-xl border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase tracking-widest h-9 px-4"
          >
            Hoje
          </Button>
        </div>

        <div className="relative group">
          <div className="overflow-x-auto rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl transition-all duration-500">
            <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 min-w-[800px]">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-[10px] font-black p-4 bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase tracking-[0.2em]">{day}</div>
              ))}
              {Array.from({ length: getDay(monthStart) }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2 bg-white dark:bg-slate-900 min-h-[120px]" />
              ))}
              {daysInMonth.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEntries = getEntriesForDate(dateStr);
                const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                return (
                  <div key={dateStr} className={cn(
                    'min-h-[120px] p-3 transition-colors relative group/day',
                    isWeekend ? 'bg-slate-50/50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'
                  )}>
                    <div className={cn(
                      'text-sm font-black mb-3 w-8 h-8 flex items-center justify-center rounded-xl transition-transform group-hover/day:scale-110',
                      isToday ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                        isWeekend ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1.5">
                      {dayEntries.map(entry => {
                        const prof = profs.find(p => p.id === entry.professionalId);
                        return (
                          <div
                            key={entry.id}
                            className={cn(
                              'text-[10px] px-2.5 py-1.5 rounded-lg truncate font-bold uppercase tracking-tighter border shadow-sm transition-all hover:scale-105 active:scale-95 cursor-default',
                              type === 'nurse'
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800'
                            )}
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
          {/* Scroll Indicator for Mobile */}
          <div className="md:hidden absolute -right-2 top-1/2 -translate-y-1/2 bg-primary/90 p-1.5 rounded-l-xl text-white shadow-lg animate-bounce pointer-events-none">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  };

  /** Escala eMult semanal por profissional */
  const renderEmultSchedule = () => {
    if (!portalData) return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-500 font-medium italic">Nenhuma escala publicada ainda.</p>
        <Button variant="outline" size="sm" onClick={fetchPortalData} className="mt-6 gap-2 rounded-xl">
          <RefreshCw className="h-4 w-4" />Atualizar
        </Button>
      </div>
    );

    const { professionals: emultProfs, units, functions, schedule } = portalData.emult;

    if (emultProfs.length === 0) return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
        <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-500 font-medium">Nenhum profissional cadastrado.</p>
      </div>
    );

    const filteredEmultProfs = emultSearch.trim()
      ? emultProfs.filter(p => p.name.toLowerCase().includes(emultSearch.toLowerCase()))
      : emultProfs;

    // Agrupar profissionais filtrados por função
    const profsByFunction = functions.map(func => ({
      ...func,
      profs: filteredEmultProfs.filter(p => p.functionId === func.id)
    })).filter(f => f.profs.length > 0);

    return (
      <div className="space-y-8">
        {/* Search Bar */}
        <div className="relative max-w-md mx-auto mb-10 no-print">
          <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            placeholder="Buscar profissional na eMult..."
            value={emultSearch}
            onChange={(e) => setEmultSearch(e.target.value)}
            className="pl-12 h-14 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg shadow-primary/5 text-lg font-medium transition-all"
          />
        </div>

        {profsByFunction.length === 0 ? (
          <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 font-medium whitespace-nowrap">Nenhum profissional encontrado com esse nome.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {profsByFunction.map(funcGroup => (
              <div key={funcGroup.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden transition-all duration-500 hover:shadow-xl">
                <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transform rotate-3"
                      style={{ backgroundColor: funcGroup.color }}
                    >
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Grupo de Atuação</span>
                      {funcGroup.name.toUpperCase()}
                    </div>
                  </h3>
                  <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5">Escala Semanal</span>
                  </div>
                </div>

                {/* Mobile: View por Card (Profissional) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {funcGroup.profs.map(prof => (
                    <div key={prof.id} className="p-5 space-y-4">
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{prof.name}</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {DAYS_OF_WEEK.map(day => {
                          const dayEntries = schedule.filter(s => s.professionalId === prof.id && s.dayOfWeek === day);
                          if (dayEntries.length === 0) return null;

                          return (
                            <div key={day} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-black text-slate-400 uppercase w-16">{day}</span>
                              <div className="flex-1 space-y-1">
                                {dayEntries.map(entry => {
                                  const unit = units.find(u => u.id === entry.unitId);
                                  const periodLabel = PERIODS.find(p => p.key === entry.period)?.label;
                                  return (
                                    <div key={entry.id} className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{unit?.name}</span>
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-400 uppercase">{periodLabel}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {DAYS_OF_WEEK.every(day => schedule.filter(s => s.professionalId === prof.id && s.dayOfWeek === day).length === 0) && (
                          <p className="text-xs italic text-slate-400 text-center py-2">Sem atividades programadas nesta semana.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Tradicional Table Layout */}
                <div className="hidden md:block overflow-x-auto selection:bg-primary/10">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm">
                        <th className="text-left p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px] border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-slate-50/95 dark:bg-slate-800/95 z-20 min-w-[200px] shadow-[2px_0_10px_rgba(0,0,0,0.02)]">Profissional</th>
                        {DAYS_OF_WEEK.map(day => (
                          <th key={day} className="text-center p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px] min-w-[160px] border-r border-slate-100 dark:border-slate-800 last:border-r-0">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {funcGroup.profs.map(prof => (
                        <tr key={prof.id} className="hover:bg-primary/[0.02] transition-colors group">
                          <td className="p-6 font-bold text-slate-700 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 group-hover:text-primary transition-colors shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                            {prof.name.toUpperCase()}
                          </td>
                          {DAYS_OF_WEEK.map(day => {
                            const dayEntries = schedule.filter(s => s.professionalId === prof.id && s.dayOfWeek === day);

                            return (
                              <td key={day} className="p-4 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0">
                                {dayEntries.length > 0 ? (
                                  <div className="space-y-2">
                                    {dayEntries.map(entry => {
                                      const unit = units.find(u => u.id === entry.unitId);
                                      const periodLabel = PERIODS.find(p => p.key === entry.period)?.label;
                                      return (
                                        <div key={entry.id} className="group/unit transform transition-all hover:scale-105">
                                          <span className="block font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-tight">
                                            {unit?.name || '?'}
                                          </span>
                                          {entry.period !== 'integral' && (
                                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1">
                                              {periodLabel}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700 font-bold opacity-50">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  /** Horas no banco / créditos */
  const renderCredits = () => {
    if (filteredProfessionals.length === 0) return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
        <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-500 font-medium">Nenhum profissional encontrado.</p>
      </div>
    );

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProfessionals.map(prof => {
          const stats = getStatsForProfessional(prof.id, prof.name, prof.category);
          const balanceColor = stats.creditsBalance > 0 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'
            : stats.creditsBalance < 0 ? 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'
              : 'text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800';

          return (
            <div key={prof.id} className="group bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden flex flex-col">
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                      prof.category === 'nurse' ? "bg-emerald-100/50 text-emerald-600" : "bg-blue-100/50 text-blue-600"
                    )}>
                      {prof.category === 'nurse' ? <Stethoscope className="w-6 h-6" /> : <Syringe className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{prof.name}</h3>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                        {prof.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Dias Trab.</p>
                    <p className="text-xl font-black text-slate-700 dark:text-slate-200">{stats.workedDays}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/20">
                    <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-tight mb-1">Fins de Sem.</p>
                    <p className="text-xl font-black text-amber-600 dark:text-amber-400">{stats.weekendDays}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-tight mb-1">
                    <TrendingUp className="w-3 h-3" /> Gerados
                  </div>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.creditsGenerated}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 uppercase tracking-tight mb-1">
                    <TrendingDown className="w-3 h-3" /> Usados
                  </div>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.creditsUsed}</p>
                </div>
              </div>

              <div className="mt-auto p-6 pt-2">
                <div className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all duration-300", balanceColor)}>
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80">Saldo Livre</span>
                  <span className="text-2xl font-black tracking-tighter">
                    {stats.creditsBalance} <span className="text-[10px] font-bold ml-1">DIAS</span>
                  </span>
                </div>
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
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
        <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-500 font-medium">Nenhum pedido de folga registrado.</p>
      </div>
    );

    const absenceLabel = (type?: string) => {
      switch (type) {
        case 'ferias': return { label: 'Férias', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' };
        case 'licenca':
        case 'licenca_medica': return { label: 'Licença', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' };
        case 'atestado': return { label: 'Atestado', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' };
        case 'folga_feriado': return { label: 'Feriado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' };
        case 'capacitacao': return { label: 'Capacitação', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20' };
        case 'folga_credito': return { label: 'Folga (Crédito)', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' };
        default: return { label: 'Afastamento', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20' };
      }
    };

    return (
      <div className="space-y-4">
        {/* Mobile: Card Layout */}
        <div className="grid grid-cols-1 md:hidden gap-4">
          {filteredRequests
            .sort((a, b) => b.requestDate.localeCompare(a.requestDate))
            .map(req => {
              const prof = professionals.find(p => p.id === req.professionalId);
              const abs = absenceLabel(req.leaveType);
              return (
                <div key={req.id} className="bg-white dark:bg-slate-900 p-5 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                  <div className={cn("absolute top-0 right-0 w-16 h-16 opacity-5 -mr-4 -mt-4 transform rotate-12 transition-transform group-hover:scale-110", abs.cls.split(' ')[0])}>
                    <FileText className="w-full h-full" />
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">{prof?.name || 'Desconhecido'}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Solicitado em {format(new Date(req.requestDate + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    </div>
                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border', abs.cls)}>
                      {abs.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {req.leaveDates.length > 0 && (
                          <>
                            {format(new Date(req.leaveDates[0] + 'T00:00:00'), 'dd/MM')}
                            {req.leaveDates.length > 1 && (
                              <> a {format(new Date(req.leaveDates[req.leaveDates.length - 1] + 'T00:00:00'), 'dd/MM')}</>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 shadow-sm">
                      <span className="text-sm font-black text-primary">{req.daysRequested}</span>
                      <span className="text-[10px] font-bold text-slate-400">DIAS</span>
                    </div>
                  </div>

                  {req.observations && (
                    <p className="mt-3 text-xs italic text-slate-400 line-clamp-2">
                      &ldquo;{req.observations}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
        </div>

        {/* Desktop: Table Layout */}
        <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 transition-colors">
                  <th className="text-left p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Profissional</th>
                  <th className="text-center p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Ausência</th>
                  <th className="text-center p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Data Pedido</th>
                  <th className="text-center p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Dias</th>
                  <th className="text-left p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Período</th>
                  <th className="text-left p-6 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Anotações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests
                  .sort((a, b) => b.requestDate.localeCompare(a.requestDate))
                  .map(req => {
                    const prof = professionals.find(p => p.id === req.professionalId);
                    const abs = absenceLabel(req.leaveType);
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                        <td className="p-6 font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">{prof?.name || 'Desconhecido'}</td>
                        <td className="p-6 text-center">
                          <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border', abs.cls)}>{abs.label}</span>
                        </td>
                        <td className="p-6 text-center text-slate-500 font-medium whitespace-nowrap">
                          {format(new Date(req.requestDate + 'T00:00:00'), 'dd/MM/yyyy')}
                        </td>
                        <td className="p-6 text-center">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/5 text-primary">
                            <span className="font-black text-base">{req.daysRequested}</span>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">dias</span>
                          </div>
                        </td>
                        <td className="p-6 text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                          {req.leaveDates.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-300" />
                              <span>
                                {format(new Date(req.leaveDates[0] + 'T00:00:00'), 'dd/MM')}
                                {req.leaveDates.length > 1 && (
                                  <> a {format(new Date(req.leaveDates[req.leaveDates.length - 1] + 'T00:00:00'), 'dd/MM')}</>
                                )}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-6 text-slate-400 italic text-xs max-w-xs truncate">{req.observations || '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] pb-24 md:pb-12 transition-colors duration-500">
      {/* PWA Floating Install Button (Main View) */}
      {deferredPrompt && (
        <Button
          onClick={handleInstall}
          className="fixed bottom-6 right-6 z-[100] h-14 px-6 rounded-2xl shadow-2xl bg-primary hover:bg-primary/90 text-white font-bold gap-2 animate-bounce hover:animate-none transition-all no-print"
        >
          <Download className="h-5 w-5" />
          <span className="hidden sm:inline">Instalar App</span>
        </Button>
      )}
      {/* Header Premium */}
      <header className="sticky top-0 z-40 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="container mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg shadow-black/5 shrink-0 transform hover:rotate-3 transition-transform overflow-hidden border border-slate-100 dark:border-slate-700">
              <img
                src="/logo-saude-plus.png"
                alt="Saúde+"
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">
                Portal <span className="text-primary italic">Ativa</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {groupLabel[accessLevel]}
                </div>
                {portalData?.adminName && (
                  <span className="text-[10px] md:text-[11px] text-slate-400 font-medium truncate hidden sm:inline">
                    por {portalData.adminName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="hidden lg:block text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Última Atualização</p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{updatedLabel}</p>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              className="rounded-xl md:rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-all h-10 w-10 md:h-12 md:w-12 shadow-sm"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-10">
        <Tabs defaultValue="escala" className="space-y-6 md:space-y-10">

          {/* Desktop Tabs / Mobile Hidden (Using Bottom Nav instead) */}
          <div className="hidden md:block">
            <TabsList className={cn(
              'grid h-16 p-1.5 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-sm max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner',
              currentTabs.length === 1 ? 'grid-cols-1' :
                currentTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
            )}>
              {currentTabs.map(tab => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="flex items-center justify-center gap-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-md rounded-xl transition-all duration-300 font-bold text-slate-500 data-[state=active]:text-primary h-full"
                >
                  <div className="flex items-center gap-2">
                    {tab.icon}
                    <span>{tab.label}</span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Mobile Info & Update */}
          <div className="md:hidden flex items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Atualizado em</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{updatedLabel}</span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-xl text-primary bg-primary/10 hover:bg-primary/20"
              onClick={fetchPortalData}
              disabled={loadingPortal}
            >
              <RefreshCw className={cn("h-4 w-4", loadingPortal && "animate-spin")} />
            </Button>
          </div>

          {/* ── Aba: Escala ── */}
          <TabsContent value="escala" className="mt-0 focus-visible:outline-none">
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {accessLevel === 'nurse' ? 'Escala de Enfermeiros' :
                      accessLevel === 'tech' ? 'Escala de Técnicos' :
                        'Escala eMult'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Visualização oficial das atividades programadas</p>
                </div>
                {accessLevel !== 'emult' && (
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <div className="px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Dados em Tempo Real
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-2 md:p-6 shadow-sm overflow-hidden min-h-[400px]">
                {accessLevel === 'emult' && renderEmultSchedule()}
                {accessLevel === 'nurse' && renderServiceCalendar('nurse')}
                {accessLevel === 'tech' && renderServiceCalendar('tech')}
              </div>
            </div>
          </TabsContent>

          {/* ── Aba: Horas no Banco ── */}
          {(accessLevel === 'nurse' || accessLevel === 'tech') && (
            <TabsContent value="horas" className="mt-0 focus-visible:outline-none">
              <div className="space-y-4 md:space-y-6">
                <div className="px-2">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Banco de Horas</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Controle de créditos e saldos dos profissionais</p>
                </div>
                <div className="pt-2">
                  {renderCredits()}
                </div>
              </div>
            </TabsContent>
          )}

          {/* ── Aba: Pedidos de Folga ── */}
          {(accessLevel === 'nurse' || accessLevel === 'tech') && (
            <TabsContent value="folgas" className="mt-0 focus-visible:outline-none">
              <div className="space-y-4 md:space-y-6">
                <div className="px-2">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Histórico de Ausências</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Registro de folgas, férias e licenças</p>
                </div>
                {renderLeaveRequests()}
              </div>
            </TabsContent>
          )}

          {/* Mobile Bottom Navigation Bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 no-print">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-2">
              <TabsList className="bg-transparent h-16 w-full grid grid-cols-3 gap-1">
                {currentTabs.map(tab => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="flex flex-col items-center justify-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-[1.5rem] transition-all duration-300 py-2 border-0"
                  >
                    <div className="p-0">
                      {tab.icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-tight">{tab.label.split(' ')[0]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
        </Tabs>
      </main>

      {/* Footer minimalista no desktop */}
      <footer className="hidden md:block border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 mt-12 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
            Secretaria Municipal de Saúde
          </p>
          <p className="text-[10px] text-slate-400">
            Este portal é uma ferramenta de transparência pública para visualização de escalas de trabalho.
          </p>
        </div>
      </footer>
    </div>
  );
}

