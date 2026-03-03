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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
// Registration Screen
// ─────────────────────────────────────────
function RegistrationScreen({
  onRegister,
  adminId,
  userEmail,
  userName,
  presetRole,
}: {
  onRegister: (teamId: string, category: string, fullName: string) => void;
  adminId: string | null;
  userEmail: string;
  userName: string;
  presetRole: string | null;
}) {
  const [fullName, setFullName] = useState(userName || '');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);

  const roleFromUrl = presetRole && ['nurse', 'tech'].includes(presetRole) ? presetRole : null;

  useEffect(() => {
    const fetchAdminTeam = async () => {
      if (!adminId) {
        setLoadingTeam(false);
        return;
      }
      try {
        const { data } = await (supabase
          .from('profiles' as any)
          .select('team_id')
          .eq('user_id', adminId)
          .maybeSingle() as any);

        // Se encontrar team_id, usa ele.
        setTeamId(data?.team_id || null);
      } catch (err) {
        console.error('Erro ao buscar equipe:', err);
        setTeamId(null);
      } finally {
        setLoadingTeam(false);
      }
    };
    fetchAdminTeam();
  }, [adminId]);

  if (loadingTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminId || (!loadingTeam && !teamId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a] p-4">
        <Card className="max-w-md w-full rounded-[2rem] border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-bold">Link inválido</h2>
            <p className="text-sm text-muted-foreground">
              Para acessar o portal, use o link fornecido pelo seu administrador (com o parâmetro <code>?admin=ID</code> na URL).
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

          {/* Categoria (preset ou select) */}
          {roleFromUrl ? (
            <div className="space-y-2">
              <Label>Sua categoria profissional</Label>
              <div className={`flex items-center gap-3 h-12 px-4 rounded-xl border-2 font-bold ${roleFromUrl === 'nurse'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300'
                : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
                }`}>
                {roleFromUrl === 'nurse'
                  ? <Stethoscope className="w-5 h-5" />
                  : <Syringe className="w-5 h-5" />}
                {roleFromUrl === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a) de Enfermagem'}
              </div>
              <p className="text-xs text-muted-foreground">
                Categoria definida pelo link de convite.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Sua categoria profissional</Label>
              <Select value={fullName.length > 0 ? (fullName.includes('nurse') ? 'nurse' : 'tech') : ''} onValueChange={() => { }}>
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
                </SelectContent>
              </Select>
              <p className="text-xs text-destructive">Link inválido: categoria não definida. Use o link fornecido pelo administrador.</p>
            </div>
          )}

          <Button
            onClick={() => onRegister(teamId!, roleFromUrl || '', fullName.trim())}
            disabled={!roleFromUrl || !fullName.trim()}
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

  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '' as LeaveType | '',
    startDate: '',
    endDate: '',
    observations: '',
  });

  // ── Extração Robusta de Parâmetros ──
  // Procuramos na URL (search), no fragmento (#) do Supabase ou no histórico (localStorage)
  const getParam = (key: string, storageKey: string) => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1)); // Trata redirects do Supabase
    return urlParams.get(key) || hashParams.get(key) || localStorage.getItem(storageKey);
  };

  const adminId = getParam('admin', 'portal_admin_id');
  const roleFromUrl = getParam('role', 'portal_role_hint');

  // Salva no localStorage assim que detectado na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));

    const currentAdmin = urlParams.get('admin') || hashParams.get('admin');
    const currentRole = urlParams.get('role') || hashParams.get('role');

    if (currentAdmin) localStorage.setItem('portal_admin_id', currentAdmin);
    if (currentRole) localStorage.setItem('portal_role_hint', currentRole);
  }, [window.location.search, window.location.hash]);

  // PWA install
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  // Fetch portal data
  const fetchPortalData = useCallback(async () => {
    const effectiveAdminId = adminId || professionalUser?.team_id;
    if (!effectiveAdminId) return;

    setLoadingPortal(true);
    try {
      // Try fetching by admin user_id first, then by team relationship
      let query = supabase
        .from('portal_schedules')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(1);

      if (adminId) {
        query = query.eq('user_id', adminId);
      }

      const { data, error } = await query.maybeSingle();
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
  }, [adminId, professionalUser]);

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

  // Stats
  const myStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const workedDays = myEntries.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    }).length;

    const weekendDays = myEntries.filter(e => {
      const d = new Date(e.date);
      if (d < monthStart || d > monthEnd) return false;
      const day = getDay(d);
      return day === 0 || day === 6;
    }).length;

    const creditsGenerated = weekendDays * 2;

    const creditsUsedAdmin = myLeaveRequestsFromAdmin
      .filter(r => r.leaveType === 'folga_credito' && r.status === 'approved')
      .reduce((sum, r) => sum + r.daysRequested, 0);

    const creditsUsedPortal = leaveRequests
      .filter(r => r.leave_type === 'folga_credito' && r.status === 'approved')
      .reduce((sum, r) => sum + r.days_requested, 0);

    const creditsUsed = creditsUsedAdmin + creditsUsedPortal;

    return { workedDays, weekendDays, creditsGenerated, creditsUsed, creditsBalance: creditsGenerated - creditsUsed };
  }, [myEntries, myLeaveRequestsFromAdmin, leaveRequests, currentMonth]);

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
        adminId={adminId}
        userEmail={session.user.email || ''}
        userName={session.user.user_metadata?.full_name || ''}
        presetRole={roleFromUrl}
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
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {professionalUser.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}
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
          <Tabs defaultValue="escala" className="space-y-6 md:space-y-10">
            {/* Desktop Tabs */}
            <div className="hidden md:block">
              <TabsList className="grid grid-cols-3 h-16 p-1.5 bg-slate-100/50 dark:bg-slate-800/50 max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
                <TabsTrigger value="escala" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-md rounded-xl font-bold h-full">
                  <Calendar className="h-4 w-4" /> Minha Escala
                </TabsTrigger>
                <TabsTrigger value="creditos" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-md rounded-xl font-bold h-full">
                  <Clock className="h-4 w-4" /> Meus Créditos
                </TabsTrigger>
                <TabsTrigger value="folgas" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-md rounded-xl font-bold h-full">
                  <FileText className="h-4 w-4" /> Minhas Folgas
                </TabsTrigger>
              </TabsList>
            </div>

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

            {/* Tab: Minha Escala */}
            <TabsContent value="escala" className="mt-0 focus-visible:outline-none">
              <div className="space-y-6">
                <div className="px-2">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Minha Escala</h2>
                  <p className="text-sm text-slate-500 font-medium">Seus dias de trabalho programados</p>
                </div>

                {/* Month navigation */}
                <div className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-800/80 shadow-inner">
                  <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="h-10 w-10 rounded-xl">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h3 className="text-lg font-black capitalize text-slate-700 dark:text-slate-200">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-10 w-10 rounded-xl">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                {/* Calendar */}
                <div className="overflow-x-auto rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                  <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 min-w-[700px]">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-[10px] font-black p-3 bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase tracking-[0.2em]">{day}</div>
                    ))}
                    {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
                      <div key={`empty-${i}`} className="p-2 bg-white dark:bg-slate-900 min-h-[80px]" />
                    ))}
                    {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const hasEntry = myEntries.some(e => e.date === dateStr);
                      const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                      const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                      return (
                        <div key={dateStr} className={cn(
                          'min-h-[80px] p-3 transition-colors relative',
                          isWeekend ? 'bg-slate-50/50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'
                        )}>
                          <div className={cn(
                            'text-sm font-black mb-2 w-8 h-8 flex items-center justify-center rounded-xl',
                            isToday ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                              isWeekend ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                          )}>
                            {format(day, 'd')}
                          </div>
                          {hasEntry && (
                            <div className={cn(
                              'text-[9px] px-2 py-1 rounded-lg font-bold uppercase text-center border',
                              professionalUser.category === 'nurse'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                            )}>
                              {isWeekend ? '⭐ FDS' : 'Escalado'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Créditos */}
            <TabsContent value="creditos" className="mt-0 focus-visible:outline-none">
              <div className="space-y-6">
                <div className="px-2">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Meus Créditos</h2>
                  <p className="text-sm text-slate-500 font-medium">Saldo de banco de horas e créditos de folga</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="rounded-[1.5rem] border-0 shadow-md">
                    <CardContent className="p-5 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Dias Trabalhados</p>
                      <p className="text-3xl font-black text-slate-700 dark:text-slate-200">{myStats.workedDays}</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-[1.5rem] border-0 shadow-md bg-amber-50 dark:bg-amber-900/10">
                    <CardContent className="p-5 text-center">
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tight mb-2">Fins de Semana</p>
                      <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{myStats.weekendDays}</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-[1.5rem] border-0 shadow-md">
                    <CardContent className="p-5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-tight mb-2">
                        <TrendingUp className="w-3 h-3" /> Gerados
                      </div>
                      <p className="text-3xl font-black text-emerald-600">{myStats.creditsGenerated}</p>
                    </CardContent>
                  </Card>
                  <Card className={cn(
                    "rounded-[1.5rem] border-0 shadow-md",
                    myStats.creditsBalance > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10' :
                      myStats.creditsBalance < 0 ? 'bg-rose-50 dark:bg-rose-900/10' : ''
                  )}>
                    <CardContent className="p-5 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Saldo Livre</p>
                      <p className={cn(
                        "text-3xl font-black",
                        myStats.creditsBalance > 0 ? 'text-emerald-600' :
                          myStats.creditsBalance < 0 ? 'text-rose-600' : 'text-slate-500'
                      )}>
                        {myStats.creditsBalance}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">(Usado: {myStats.creditsUsed})</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Folgas */}
            <TabsContent value="folgas" className="mt-0 focus-visible:outline-none">
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Minhas Folgas</h2>
                    <p className="text-sm text-slate-500 font-medium">Solicite e acompanhe seus pedidos de afastamento</p>
                  </div>
                  <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-xl font-bold gap-2">
                        <Plus className="w-4 h-4" /> Solicitar Folga
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Solicitar Folga</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Tipo de Afastamento</Label>
                          <Select
                            value={leaveForm.leaveType}
                            onValueChange={(v) => setLeaveForm(prev => ({ ...prev, leaveType: v as LeaveType }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                            <SelectContent>
                              {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {leaveForm.leaveType === 'folga_credito' && (
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-primary" />
                              <span className="text-sm">
                                Saldo disponível: <strong className="text-primary">{myStats.creditsBalance} dias</strong>
                              </span>
                            </div>
                          </div>
                        )}

                        <div>
                          <Label>Data Inicial</Label>
                          <Input
                            type="date"
                            value={leaveForm.startDate}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Data Final</Label>
                          <Input
                            type="date"
                            value={leaveForm.endDate}
                            min={leaveForm.startDate || undefined}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))}
                          />
                        </div>

                        {daysRequested > 0 && (
                          <div className="p-3 bg-muted rounded-lg text-sm">
                            Quantidade: <strong>{daysRequested} {daysRequested === 1 ? 'dia' : 'dias'}</strong>
                          </div>
                        )}

                        <div>
                          <Label>Observações</Label>
                          <Textarea
                            value={leaveForm.observations}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, observations: e.target.value }))}
                            placeholder="Motivo, justificativa..."
                          />
                        </div>

                        <Button
                          onClick={handleSubmitLeave}
                          className="w-full"
                          disabled={daysRequested < 1 || (leaveForm.leaveType === 'folga_credito' && daysRequested > myStats.creditsBalance)}
                        >
                          Enviar Pedido
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Leave requests list */}
                {leaveRequests.length === 0 && myLeaveRequestsFromAdmin.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-medium">Nenhum pedido de folga registrado.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Portal leave requests */}
                    {leaveRequests.map(req => (
                      <Card key={req.id} className="rounded-[1.5rem] border-0 shadow-md">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs">
                              {LEAVE_TYPE_LABELS[req.leave_type as LeaveType] || req.leave_type}
                            </Badge>
                            {statusBadge(req.status)}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-muted/50 rounded-lg p-2">
                              <div className="text-xs text-muted-foreground">Período</div>
                              <div className="font-medium">
                                {format(new Date(req.start_date + 'T00:00:00'), 'dd/MM')}
                                {req.end_date !== req.start_date && (
                                  <> a {format(new Date(req.end_date + 'T00:00:00'), 'dd/MM')}</>
                                )}
                              </div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2">
                              <div className="text-xs text-muted-foreground">Duração</div>
                              <div className="font-bold text-primary">{req.days_requested} {req.days_requested === 1 ? 'dia' : 'dias'}</div>
                            </div>
                          </div>
                          {req.observations && (
                            <p className="text-xs text-muted-foreground italic">"{req.observations}"</p>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            Enviado em {format(new Date(req.created_at), 'dd/MM/yyyy HH:mm')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Admin-registered leave requests */}
                    {myLeaveRequestsFromAdmin.map(req => (
                      <Card key={req.id} className="rounded-[1.5rem] border-0 shadow-md bg-muted/30">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs">
                              {LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                              Registrado pelo Admin
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-muted/50 rounded-lg p-2">
                              <div className="text-xs text-muted-foreground">Período</div>
                              <div className="font-medium">
                                {req.leaveDates[0] && format(new Date(req.leaveDates[0] + 'T00:00:00'), 'dd/MM')}
                                {req.leaveDates.length > 1 && (
                                  <> a {format(new Date(req.leaveDates[req.leaveDates.length - 1] + 'T00:00:00'), 'dd/MM')}</>
                                )}
                              </div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2">
                              <div className="text-xs text-muted-foreground">Duração</div>
                              <div className="font-bold text-primary">{req.daysRequested} {req.daysRequested === 1 ? 'dia' : 'dias'}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 no-print">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-2">
                <TabsList className="bg-transparent h-16 w-full grid grid-cols-3 gap-1">
                  {[
                    { key: 'escala', label: 'Escala', icon: <Calendar className="h-4 w-4" /> },
                    { key: 'creditos', label: 'Créditos', icon: <Clock className="h-4 w-4" /> },
                    { key: 'folgas', label: 'Folgas', icon: <FileText className="h-4 w-4" /> },
                  ].map(tab => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className="flex flex-col items-center justify-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-[1.5rem] transition-all duration-300 py-2 border-0"
                    >
                      {tab.icon}
                      <span className="text-[10px] font-bold uppercase tracking-tight">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
          </Tabs>
        )}
      </main>
    </div>
  );
}
