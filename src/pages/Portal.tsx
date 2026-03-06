import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Stethoscope,
  Syringe,
  AlertCircle,
  RefreshCw,
  LogOut,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  Download,
  Plus,
  Chrome,
  Loader2,
  User,
  CheckCircle2,
  XCircle,
  HourglassIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAVE_TYPE_LABELS, LeaveType, LeaveRequest } from '@/types/serviceSchedule';
import { useProfessionalPortal } from '@/hooks/useProfessionalPortal';
import { toast } from 'sonner';

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
  isWeekend?: boolean;
}
interface PortalData {
  publishedAt: string;
  adminName?: string;
  service: {
    professionals: ServiceProfessionalPortal[];
    nurseEntries: ServiceScheduleEntry[];
    techEntries: ServiceScheduleEntry[];
    leaveRequests?: LeaveRequest[];
  };
}

// ─────────────────────────────────────────
// Google Login Screen
// ─────────────────────────────────────────
function GoogleLoginScreen({
  onLogin,
  loading,
  onInstall,
  showInstall,
}: {
  onLogin: () => void;
  loading: boolean;
  onInstall: () => void;
  showInstall: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
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
              <User className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              Meu <span className="text-primary italic">Portal</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Portal do Profissional de Saúde</p>
          </div>
        </div>

        <Card className="border-0 shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
          <CardContent className="pt-10 pb-10 px-8">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bem-vindo(a)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Entre com sua conta Google para acessar suas escalas, créditos e solicitar folgas.
                </p>
              </div>

              <Button
                onClick={onLogin}
                disabled={loading}
                className="w-full h-16 text-lg font-bold rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg hover:shadow-primary/25 gap-3"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Chrome className="h-5 w-5" />
                )}
                Entrar com Google
              </Button>

              {showInstall && (
                <Button
                  variant="outline"
                  onClick={onInstall}
                  className="w-full h-14 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 text-primary font-bold gap-2 transition-all"
                >
                  <Download className="h-5 w-5" />
                  Instalar Aplicativo (PWA)
                </Button>
              )}

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs font-medium text-slate-400">
                  Acesso exclusivo para profissionais da Secretaria de Saúde.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-slate-400 mt-10 uppercase tracking-[0.2em] font-bold">
          &copy; 2025 Secretaria Municipal de Saúde
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Registration Screen - choose category
// ─────────────────────────────────────────
function RegistrationScreen({
  onRegister,
  teamId,
  userEmail,
  userName,
}: {
  onRegister: (teamId: string, category: string, fullName: string) => void;
  teamId: string | null;
  userEmail: string;
  userName: string;
}) {
  const [fullName, setFullName] = useState(userName || '');
  const [category, setCategory] = useState('');

  if (!teamId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a] p-4">
        <Card className="max-w-md w-full rounded-[2rem] border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-bold">Link inválido</h2>
            <p className="text-sm text-muted-foreground">
              Para acessar o portal, use o link fornecido pelo seu administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a] p-4">
      <Card className="max-w-md w-full rounded-[2rem] border-0 shadow-xl">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Solicitar Acesso</h2>
            <p className="text-sm text-muted-foreground">
              Complete seu cadastro para acessar o portal.
            </p>
          </div>

          <div className="space-y-1 bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Logado como</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="reg-name">Seu nome completo</Label>
            <input
              id="reg-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome Sobrenome"
              className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Sua categoria profissional</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder="Selecione sua categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nurse">
                  <span className="flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Enfermeiro(a)</span>
                </SelectItem>
                <SelectItem value="tech">
                  <span className="flex items-center gap-2"><Syringe className="w-4 h-4" /> Técnico(a)</span>
                </SelectItem>
                <SelectItem value="emult">
                  <span className="flex items-center gap-2"><Users className="w-4 h-4" /> eMult</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => onRegister(teamId, category, fullName.trim())}
            disabled={!category || !fullName.trim()}
            className="w-full h-12 rounded-xl font-bold"
          >
            Enviar Solicitação
          </Button>

          <p className="text-[11px] text-center text-muted-foreground">
            Após enviar, o administrador precisará aprovar seu acesso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// Pending Approval Screen
// ─────────────────────────────────────────
function PendingScreen({ onLogout, status }: { onLogout: () => void; status: string }) {
  const isPending = status === 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a] p-4">
      <Card className="max-w-md w-full rounded-[2rem] border-0 shadow-xl">
        <CardContent className="p-8 text-center space-y-6">
          {isPending ? (
            <>
              <HourglassIcon className="h-16 w-16 mx-auto text-amber-500 animate-pulse" />
              <h2 className="text-xl font-bold">Aguardando Aprovação</h2>
              <p className="text-sm text-muted-foreground">
                Sua solicitação foi enviada ao administrador. Você receberá acesso assim que for aprovado(a).
              </p>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 mx-auto text-destructive" />
              <h2 className="text-xl font-bold">Acesso Negado</h2>
              <p className="text-sm text-muted-foreground">
                Sua solicitação foi rejeitada pelo administrador. Entre em contato com a Secretaria de Saúde.
              </p>
            </>
          )}
          <Button variant="outline" onClick={onLogout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// Main Portal Component
// ─────────────────────────────────────────
export default function Portal() {
  const {
    session,
    professionalUser,
    leaveRequests,
    loading,
    loginWithGoogle,
    logout,
    registerProfessional,
    submitLeaveRequest,
    refreshLeaveRequests,
    refreshProfile,
  } = useProfessionalPortal();

  interface BeforeInstallPromptEvent extends Event {
    readonly platforms?: string[];
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
  }

  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '' as LeaveType | '',
    startDate: '',
    endDate: '',
    observations: '',
  });

  // ── Get team ID from URL or localStorage ──
  const getTeamId = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    return urlParams.get('team') || hashParams.get('team') || localStorage.getItem('portal_team_id');
  };

  const teamIdFromUrl = getTeamId();

  // Save team to localStorage when detected
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const t = urlParams.get('team') || hashParams.get('team');
    if (t) localStorage.setItem('portal_team_id', t);
  }, []);

  // Garantir que usuários antigos sem team_id sejam vinculados ao time do link atual
  // Also re-link if professional is on wrong team
  useEffect(() => {
    const ensureTeamForProfessional = async () => {
      if (!professionalUser || !teamIdFromUrl) return;
      // If no team or team differs from URL, re-link via RPC
      if (!professionalUser.team_id || professionalUser.team_id !== teamIdFromUrl) {
        try {
          await supabase.rpc('register_professional_via_portal' as any, {
            _team_id: teamIdFromUrl,
            _category: professionalUser.category,
            _full_name: professionalUser.full_name,
            _email: professionalUser.email,
          } as any);
          await refreshProfile();
        } catch (err) {
          console.error('Erro ao atualizar equipe do profissional:', err);
        }
      }
    };

    ensureTeamForProfessional();
  }, [professionalUser, teamIdFromUrl, refreshProfile]);

  // PWA install
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  // Fetch portal data using team_id from professional_user or URL
  const effectiveTeamId = professionalUser?.team_id || teamIdFromUrl;

  const fetchPortalData = useCallback(async () => {
    if (!effectiveTeamId) return;

    setLoadingPortal(true);
    try {
      // Busca sempre a última publicação vinculada ao time atual,
      // usando o teamId salvo dentro de emult_data.
      const { data, error } = await supabase
        .from('portal_schedules' as any)
        .select('*')
        .eq('emult_data->>teamId', effectiveTeamId)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any;

      if (error) throw error;

      if (data) {
        setPortalData({
          publishedAt: data.published_at,
          adminName: data.admin_name || undefined,
          service: data.service_data as unknown as PortalData['service'],
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados do portal:', err);
    } finally {
      setLoadingPortal(false);
    }
  }, [effectiveTeamId]);

  useEffect(() => {
    if (professionalUser?.status === 'approved') fetchPortalData();
  }, [professionalUser, fetchPortalData]);

  // Computed data for the professional
  const myProfessional = useMemo(() => {
    if (!portalData || !professionalUser?.professional_id) return null;
    return portalData.service.professionals.find(p => p.id === professionalUser.professional_id) || null;
  }, [portalData, professionalUser]);

  const myEntries = useMemo(() => {
    if (!professionalUser?.professional_id || !portalData) return [];
    const allEntries = [
      ...(portalData.service.nurseEntries || []),
      ...(portalData.service.techEntries || []),
    ];
    return allEntries.filter(e => e.professionalId === professionalUser.professional_id);
  }, [portalData, professionalUser]);

  const myLeaveRequestsFromAdmin = useMemo(() => {
    if (!professionalUser?.professional_id || !portalData?.service?.leaveRequests) return [];
    return (portalData.service.leaveRequests as LeaveRequest[])
      .filter(r => r.professionalId === professionalUser.professional_id);
  }, [portalData, professionalUser]);

  // All team entries for team view
  const allTeamEntries = useMemo(() => {
    if (!portalData) return [];
    return [
      ...(portalData.service.nurseEntries || []),
      ...(portalData.service.techEntries || []),
    ];
  }, [portalData]);

  const allProfessionals = useMemo(() => portalData?.service?.professionals || [], [portalData]);

  // Stats - mesma regra do Controle Individual (base admin)
  const myStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Dias efetivamente trabalhados (passado + hoje), sem limitar por mês
    const pastEntries = myEntries.filter(e => new Date(e.date) <= today);
    const workedDays = new Set(pastEntries.map(e => e.date)).size;

    // Finais de semana trabalhados (baseado no dia da semana)
    const allWeekendEntries = pastEntries.filter(e => {
      const day = getDay(new Date(e.date));
      return day === 0 || day === 6;
    });
    const uniqueWeekendDates = new Set(allWeekendEntries.map(e => e.date));
    const weekendDays = uniqueWeekendDates.size;
    const creditsGenerated = weekendDays * 2;

    // Créditos usados: mesma base do admin → apenas folgas aprovadas que já
    // estão refletidas nas escalas (snapshot em service_data.leaveRequests).
    const creditsUsed = myLeaveRequestsFromAdmin
      .filter(r => r.leaveType === 'folga_credito' && r.status === 'approved')
      .reduce((sum, r) => sum + r.daysRequested, 0);
    const creditsBalance = creditsGenerated - creditsUsed;

    return { workedDays, weekendDays, creditsGenerated, creditsUsed, creditsBalance };
  }, [myEntries, myLeaveRequestsFromAdmin]);

  // Leave form
  const daysRequested = useMemo(() => {
    if (!leaveForm.startDate || !leaveForm.endDate) return 0;
    const start = new Date(leaveForm.startDate + 'T00:00:00');
    const end = new Date(leaveForm.endDate + 'T00:00:00');
    if (end < start) return 0;
    return differenceInCalendarDays(end, start) + 1;
  }, [leaveForm.startDate, leaveForm.endDate]);

  const handleSubmitLeave = async () => {
    if (!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1) {
      toast.error('Preencha todos os campos.');
      return;
    }
    if (leaveForm.leaveType === 'folga_credito' && daysRequested > myStats.creditsBalance) {
      toast.error(`Saldo insuficiente. Disponível: ${myStats.creditsBalance} dias`);
      return;
    }

    const success = await submitLeaveRequest({
      leave_type: leaveForm.leaveType,
      start_date: leaveForm.startDate,
      end_date: leaveForm.endDate,
      days_requested: daysRequested,
      observations: leaveForm.observations || undefined,
    });

    if (success) {
      setLeaveForm({ leaveType: '', startDate: '', endDate: '', observations: '' });
      setLeaveDialogOpen(false);
    }
  };

  // ─── Render States ───

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <GoogleLoginScreen
        onLogin={loginWithGoogle}
        loading={false}
        onInstall={handleInstall}
        showInstall={!!deferredPrompt}
      />
    );
  }

  // No professional record → registration
  if (!professionalUser) {
    return (
      <RegistrationScreen
        onRegister={registerProfessional}
        teamId={teamIdFromUrl}
        userEmail={session.user.email || ''}
        userName={session.user.user_metadata?.full_name || ''}
      />
    );
  }

  // Not approved
  if (professionalUser.status !== 'approved') {
    return <PendingScreen onLogout={logout} status={professionalUser.status} />;
  }

  // ─── Approved: Main Portal ───

  const goToPreviousMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  const updatedLabel = portalData
    ? `Atualizado em ${format(parseISO(portalData.publishedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
    : 'Sem dados publicados';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'rejected': return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><HourglassIcon className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  const categoryLabel = professionalUser.category === 'nurse' ? 'Enfermeiro(a)' : professionalUser.category === 'tech' ? 'Técnico(a)' : 'eMult';

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] pb-24 md:pb-12 transition-colors duration-500">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="container mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg shadow-black/5 shrink-0 overflow-hidden border border-slate-100 dark:border-slate-700">
              <img
                src="/logo-saude-plus.png"
                alt="Saúde+"
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">
                Olá, <span className="text-primary">{myProfessional?.name?.split(' ')[0] || professionalUser.full_name.split(' ')[0]}</span>
              </h1>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 truncate">{professionalUser.email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {categoryLabel}
                </div>
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
              onClick={logout}
              className="rounded-xl md:rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-all h-10 w-10 md:h-12 md:w-12 shadow-sm"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-10">
        {loadingPortal ? (
          <div className="space-y-4 w-full max-w-2xl mx-auto">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Mobile info bar */}
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
                onClick={() => { fetchPortalData(); refreshLeaveRequests(); }}
                disabled={loadingPortal}
              >
                <RefreshCw className={cn("h-4 w-4", loadingPortal && "animate-spin")} />
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)] md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
              {/* Calendário + estatísticas */}
              <div className="space-y-6 max-w-4xl mx-auto w-full">
                {/* Month Navigator */}
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="rounded-xl">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-lg md:text-xl font-black capitalize text-slate-800 dark:text-white">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-xl">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                {/* Calendar */}
                <Card className="border-0 shadow-lg rounded-[2rem] overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-7 text-center bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                        <div key={d} className="py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {(() => {
                        const monthStart = startOfMonth(currentMonth);
                        const monthEnd = endOfMonth(currentMonth);
                        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                        const startDayOfWeek = getDay(monthStart);
                        const blanks = Array.from({ length: startDayOfWeek }, (_, i) => (
                          <div key={`blank-${i}`} className="aspect-square" />
                        ));

                        const dayCells = days.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const hasWork = myEntries.some(e => e.date === dateStr);
                          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                          const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                          return (
                            <div
                              key={dateStr}
                              className={cn(
                                "aspect-square flex flex-col items-center justify-center border-b border-r border-slate-100 dark:border-slate-800 transition-colors relative",
                                isToday && "bg-primary/5",
                                hasWork && !isWeekend && "bg-emerald-50 dark:bg-emerald-900/20",
                                hasWork && isWeekend && "bg-amber-50 dark:bg-amber-900/20",
                              )}
                            >
                              <span className={cn(
                                "text-sm md:text-base font-bold",
                                isToday && "text-primary",
                                isWeekend && "text-slate-400",
                                !isToday && !isWeekend && "text-slate-700 dark:text-slate-200"
                              )}>
                                {format(day, 'd')}
                              </span>
                              {hasWork && (
                                <div className={cn(
                                  "w-2 h-2 rounded-full mt-0.5",
                                  isWeekend ? "bg-amber-400" : "bg-emerald-400"
                                )} />
                              )}
                            </div>
                          );
                        });

                        return [...blanks, ...dayCells];
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span>Dia útil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span>Final de semana</span>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-black text-primary">{myStats.workedDays}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Dias escalados</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-black text-amber-500">{myStats.weekendDays}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Fins de semana</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <p className="text-2xl font-black text-emerald-600">{myStats.creditsGenerated}</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Créditos gerados</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <p className="text-2xl font-black text-red-600">{myStats.creditsUsed}</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Créditos usados</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Créditos */}
              <div className="space-y-6 max-w-2xl mx-auto w-full">
                <Card className="border-0 shadow-lg rounded-[2rem] overflow-hidden">
                  <CardContent className="p-8 text-center space-y-6">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Saldo Atual de Créditos</p>
                      <p className={cn(
                        "text-6xl font-black",
                        myStats.creditsBalance > 0 ? "text-emerald-600" : myStats.creditsBalance < 0 ? "text-destructive" : "text-slate-400"
                      )}>
                        {myStats.creditsBalance}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">dias disponíveis para folga</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                        <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                        <p className="text-2xl font-black text-emerald-600">{myStats.creditsGenerated}</p>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase">Gerados</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20">
                        <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
                        <p className="text-2xl font-black text-red-600">{myStats.creditsUsed}</p>
                        <p className="text-[10px] font-bold text-red-500 uppercase">Utilizados</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400">
                      Créditos são gerados automaticamente: 2 dias por cada final de semana trabalhado.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Folgas */}
              <div className="space-y-6 max-w-2xl mx-auto w-full">
                <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full h-14 rounded-2xl font-bold shadow-lg shadow-primary/20 gap-2 text-base">
                      <Plus className="h-5 w-5" /> Solicitar Folga
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2rem]">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black">Nova Solicitação de Folga</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label className="text-xs font-bold uppercase text-slate-400">Tipo de Afastamento</Label>
                        <Select
                          value={leaveForm.leaveType}
                          onValueChange={(v) => setLeaveForm(prev => ({ ...prev, leaveType: v as LeaveType }))}
                        >
                          <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {leaveForm.leaveType === 'folga_credito' && (
                          <p className="text-xs text-emerald-600 mt-1 font-medium">
                            Saldo disponível: {myStats.creditsBalance} dias
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-bold uppercase text-slate-400">Data Início</Label>
                          <input
                            type="date"
                            value={leaveForm.startDate}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))}
                            className="flex h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase text-slate-400">Data Fim</Label>
                          <input
                            type="date"
                            value={leaveForm.endDate}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))}
                            className="flex h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                          />
                        </div>
                      </div>
                      {daysRequested > 0 && (
                        <p className="text-center text-sm font-bold text-primary">
                          {daysRequested} {daysRequested === 1 ? 'dia' : 'dias'} solicitado(s)
                        </p>
                      )}
                      <div>
                        <Label className="text-xs font-bold uppercase text-slate-400">Observações (opcional)</Label>
                        <Textarea
                          value={leaveForm.observations}
                          onChange={(e) => setLeaveForm(prev => ({ ...prev, observations: e.target.value }))}
                          placeholder="Motivo ou detalhes..."
                          className="rounded-xl resize-none"
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={handleSubmitLeave}
                        className="w-full h-12 rounded-xl font-bold"
                        disabled={!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1}
                      >
                        Enviar Solicitação
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {leaveRequests.length === 0 ? (
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="p-8 text-center text-slate-400">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Nenhuma solicitação enviada</p>
                      <p className="text-xs mt-1">Use o botão acima para solicitar folgas.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {leaveRequests.map(req => (
                      <Card key={req.id} className="border-0 shadow-md rounded-2xl overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-bold text-sm text-slate-800 dark:text-white">
                                {LEAVE_TYPE_LABELS[req.leave_type as LeaveType] || req.leave_type}
                              </p>
                              <p className="text-xs text-slate-500">
                                {format(new Date(req.start_date + 'T00:00:00'), 'dd/MM/yyyy')}
                                {req.end_date !== req.start_date && (
                                  <> a {format(new Date(req.end_date + 'T00:00:00'), 'dd/MM/yyyy')}</>
                                )}
                                <span className="ml-2 font-bold text-primary">{req.days_requested} {req.days_requested === 1 ? 'dia' : 'dias'}</span>
                              </p>
                            </div>
                            {statusBadge(req.status)}
                          </div>
                          {req.observations && (
                            <p className="text-xs text-slate-400 italic">"{req.observations}"</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
