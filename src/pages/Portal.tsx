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
  Camera,
  CreditCard,
  CalendarOff,
  Settings,
  ChevronDown,
  Shield,
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

type PortalTab = 'schedule' | 'credits' | 'leaves' | 'profile';

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
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/8 to-transparent" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8 space-y-3">
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-[1.5rem] bg-primary flex items-center justify-center shadow-xl shadow-primary/25 mx-auto">
              <img
                src="/logo-saude-plus.png"
                alt="Saúde+"
                className="h-12 w-auto brightness-0 invert"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <Stethoscope className="h-10 w-10 text-primary-foreground absolute inset-0 m-auto opacity-15" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Portal <span className="text-primary">Saúde+</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Acesso do profissional de saúde</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-xl border border-border/50 overflow-hidden">
          <div className="p-8 space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-foreground">Bem-vindo(a)</h2>
              <p className="text-xs text-muted-foreground">
                Acesse suas escalas, créditos e solicite folgas
              </p>
            </div>

            <Button
              onClick={onLogin}
              disabled={loading}
              className="w-full h-14 text-base font-bold rounded-2xl gap-3 shadow-lg shadow-primary/15"
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
                className="w-full h-12 rounded-2xl font-semibold gap-2"
              >
                <Download className="h-4 w-4" />
                Instalar App
              </Button>
            )}
          </div>

          <div className="bg-muted/30 px-8 py-4 border-t border-border/30">
            <p className="text-[10px] text-center text-muted-foreground">
              Acesso exclusivo para profissionais da Secretaria de Saúde
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Registration Screen
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full rounded-3xl border shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-bold">Link inválido</h2>
            <p className="text-sm text-muted-foreground">
              Use o link fornecido pelo seu administrador para acessar o portal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <Card className="rounded-3xl border shadow-xl">
          <CardContent className="p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <User className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold">Solicitar Acesso</h2>
              <p className="text-xs text-muted-foreground">
                Complete seu cadastro para acessar o portal
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
              <p>Logado como <span className="font-medium text-foreground">{userEmail}</span></p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Nome completo</Label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome Sobrenome"
                className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Categoria profissional</Label>
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

            <p className="text-[10px] text-center text-muted-foreground">
              O administrador precisará aprovar seu acesso.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Pending Approval Screen
// ─────────────────────────────────────────
function PendingScreen({ onLogout, status }: { onLogout: () => void; status: string }) {
  const isPending = status === 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-sm w-full rounded-3xl border shadow-xl">
        <CardContent className="p-8 text-center space-y-5">
          {isPending ? (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <HourglassIcon className="h-8 w-8 text-amber-500 animate-pulse" />
              </div>
              <h2 className="text-lg font-bold">Aguardando Aprovação</h2>
              <p className="text-sm text-muted-foreground">
                Sua solicitação foi enviada. Você receberá acesso após a aprovação do administrador.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-lg font-bold">Acesso Negado</h2>
              <p className="text-sm text-muted-foreground">
                Sua solicitação foi rejeitada. Entre em contato com a coordenação.
              </p>
            </>
          )}
          <Button variant="outline" onClick={onLogout} className="gap-2 rounded-xl">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// Bottom Navigation Bar
// ─────────────────────────────────────────
function PortalBottomNav({ activeTab, onTabChange }: { activeTab: PortalTab; onTabChange: (tab: PortalTab) => void }) {
  const tabs: { id: PortalTab; icon: typeof Calendar; label: string }[] = [
    { id: 'schedule', icon: Calendar, label: 'Escala' },
    { id: 'credits', icon: CreditCard, label: 'Créditos' },
    { id: 'leaves', icon: CalendarOff, label: 'Folgas' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch max-w-lg mx-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200 relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:scale-95"
              )}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full" />
              )}
              <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
              <span className={cn("text-[10px] font-semibold", isActive && "font-bold")}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area spacer for iPhones */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
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
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalTab>('schedule');
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const t = urlParams.get('team') || hashParams.get('team');
    if (t) localStorage.setItem('portal_team_id', t);
  }, []);

  useEffect(() => {
    const ensureTeamForProfessional = async () => {
      if (!professionalUser || !teamIdFromUrl) return;
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

  const effectiveTeamId = professionalUser?.team_id || teamIdFromUrl;

  const fetchPortalData = useCallback(async () => {
    if (!effectiveTeamId) return;
    setLoadingPortal(true);
    try {
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

  // Computed data
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

  const myStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastEntries = myEntries.filter(e => new Date(e.date) <= today);
    const overallWorkedDays = new Set(pastEntries.map(e => e.date)).size;
    const overallWeekendEntries = pastEntries.filter(e => e.isWeekend);
    const overallWeekendDates = new Set(overallWeekendEntries.map(e => e.date));
    const overallWeekendDays = overallWeekendDates.size;
    const overallCreditsGenerated = overallWeekendDays * 2;
    const overallCreditsUsed = myLeaveRequestsFromAdmin
      .filter(r => r.leaveType === 'folga_credito' && r.status === 'approved')
      .reduce((sum, r) => sum + r.daysRequested, 0);
    const overallCreditsBalance = overallCreditsGenerated - overallCreditsUsed;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthEntries = myEntries.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd && d <= today;
    });
    const monthWorkedDays = new Set(monthEntries.map(e => e.date)).size;
    const monthWeekendEntries = monthEntries.filter(e => e.isWeekend);
    const monthWeekendDates = new Set(monthWeekendEntries.map(e => e.date));
    const monthWeekendDays = monthWeekendDates.size;
    const monthCreditsGenerated = monthWeekendDays * 2;
    const monthCreditsUsed = myLeaveRequestsFromAdmin
      .filter(r => r.leaveType === 'folga_credito' && r.status === 'approved')
      .reduce((sum, r) => {
        if (!r.leaveDates?.length) return sum;
        const first = new Date(r.leaveDates[0] + 'T00:00:00');
        const last = new Date(r.leaveDates[r.leaveDates.length - 1] + 'T00:00:00');
        if (last < monthStart || first > monthEnd) return sum;
        return sum + r.daysRequested;
      }, 0);

    return {
      overall: {
        workedDays: overallWorkedDays,
        weekendDays: overallWeekendDays,
        creditsGenerated: overallCreditsGenerated,
        creditsUsed: overallCreditsUsed,
        creditsBalance: overallCreditsBalance,
      },
      month: {
        workedDays: monthWorkedDays,
        weekendDays: monthWeekendDays,
        creditsGenerated: monthCreditsGenerated,
        creditsUsed: monthCreditsUsed,
        creditsBalance: monthCreditsGenerated - monthCreditsUsed,
      },
    };
  }, [myEntries, myLeaveRequestsFromAdmin, currentMonth]);

  // Leave form helpers
  const daysRequested = useMemo(() => {
    if (!leaveForm.startDate || !leaveForm.endDate) return 0;
    const start = new Date(leaveForm.startDate + 'T00:00:00');
    const end = new Date(leaveForm.endDate + 'T00:00:00');
    if (end < start) return 0;
    return differenceInCalendarDays(end, start) + 1;
  }, [leaveForm.startDate, leaveForm.endDate]);

  const isShortNotice = useMemo(() => {
    if (!leaveForm.startDate) return false;
    const start = new Date(leaveForm.startDate + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return differenceInCalendarDays(start, today) < 10;
  }, [leaveForm.startDate]);

  const handleSubmitLeave = async () => {
    if (!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1) {
      toast.error('Preencha todos os campos.');
      return;
    }
    if (leaveForm.leaveType === 'folga_credito' && daysRequested > myStats.overall.creditsBalance) {
      toast.error(`Saldo insuficiente. Disponível: ${myStats.overall.creditsBalance} dias`);
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

  const handleAvatarUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !session?.user) return;
      if (file.size > 2 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 2 MB');
        return;
      }
      setAvatarUploading(true);
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `${session.user.id}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });
        if (uploadErr) throw uploadErr;
        const avatarUrl = `https://qxpqzbswtdfatdrtqhrw.supabase.co/storage/v1/object/public/avatars/${filePath}?t=${Date.now()}`;
        await (supabase.from('professional_users' as any).update({ avatar_url: avatarUrl } as any).eq('user_id', session.user.id) as any);
        await refreshProfile();
        toast.success('Foto atualizada!');
      } catch (err: any) {
        toast.error('Erro ao enviar foto: ' + (err.message || ''));
      } finally {
        setAvatarUploading(false);
      }
    };
    input.click();
  };

  // ─── Render States ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  if (professionalUser.status !== 'approved') {
    return <PendingScreen onLogout={logout} status={professionalUser.status} />;
  }

  // ─── Helper funcs ───
  const goToPreviousMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  const updatedLabel = portalData
    ? format(parseISO(portalData.publishedAt), "dd/MM 'às' HH:mm", { locale: ptBR })
    : 'Sem dados';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'rejected': return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]"><HourglassIcon className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  const categoryLabel = professionalUser.category === 'nurse' ? 'Enfermeiro(a)' : professionalUser.category === 'tech' ? 'Técnico(a)' : 'eMult';
  const firstName = myProfessional?.name?.split(' ')[0] || professionalUser.full_name.split(' ')[0];

  // ─── APPROVED MAIN PORTAL ───
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Compact Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 h-14 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 ring-2 ring-primary/20">
              {professionalUser.avatar_url ? (
                <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">Olá, {firstName}</p>
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                <Clock className="w-3 h-3" /> Atualizado {updatedLabel}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { fetchPortalData(); refreshLeaveRequests(); }}
            disabled={loadingPortal}
            className="rounded-full h-9 w-9"
          >
            <RefreshCw className={cn("h-4 w-4", loadingPortal && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        {loadingPortal ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* ═══ SCHEDULE TAB ═══ */}
            {activeTab === 'schedule' && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Month navigator */}
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="rounded-full h-9 w-9">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-base font-black capitalize text-foreground">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-full h-9 w-9">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                {/* Calendar */}
                <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-7 text-center bg-muted/40 border-b border-border/50">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                      <div key={i} className="py-2.5 text-[10px] font-bold text-muted-foreground uppercase">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {(() => {
                      const mStart = startOfMonth(currentMonth);
                      const mEnd = endOfMonth(currentMonth);
                      const days = eachDayOfInterval({ start: mStart, end: mEnd });
                      const startDow = getDay(mStart);
                      const blanks = Array.from({ length: startDow }, (_, i) => (
                        <div key={`b-${i}`} className="aspect-square" />
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
                              "aspect-square flex flex-col items-center justify-center relative transition-colors",
                              isToday && "bg-primary/8",
                            )}
                          >
                            <span className={cn(
                              "text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full",
                              isToday && "bg-primary text-primary-foreground font-bold",
                              !isToday && isWeekend && "text-muted-foreground",
                              !isToday && !isWeekend && "text-foreground"
                            )}>
                              {format(day, 'd')}
                            </span>
                            {hasWork && (
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full mt-0.5 absolute bottom-1",
                                isWeekend ? "bg-amber-400" : "bg-emerald-500"
                              )} />
                            )}
                          </div>
                        );
                      });

                      return [...blanks, ...dayCells];
                    })()}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" />Dia útil</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" />Fim de semana</span>
                  <span className="flex items-center gap-1.5"><div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[8px] font-bold">H</div>Hoje</span>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
                    <p className="text-2xl font-black text-primary">{myStats.month.workedDays}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mt-0.5">Dias no mês</p>
                  </div>
                  <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
                    <p className="text-2xl font-black text-amber-500">{myStats.month.weekendDays}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mt-0.5">Fins de semana</p>
                  </div>
                </div>

                {/* Overall summary */}
                <div className="bg-muted/30 rounded-2xl border border-border/50 p-4">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide mb-2">Resumo Geral</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-black text-foreground">{myStats.overall.workedDays}</p>
                      <p className="text-[9px] text-muted-foreground">Dias totais</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-amber-500">{myStats.overall.weekendDays}</p>
                      <p className="text-[9px] text-muted-foreground">FDS totais</p>
                    </div>
                    <div>
                      <p className={cn("text-lg font-black", myStats.overall.creditsBalance >= 0 ? "text-emerald-600" : "text-destructive")}>{myStats.overall.creditsBalance}</p>
                      <p className="text-[9px] text-muted-foreground">Saldo créditos</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ CREDITS TAB ═══ */}
            {activeTab === 'credits' && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Main balance */}
                <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-8 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Saldo de Créditos</p>
                  <p className={cn(
                    "text-6xl font-black leading-none",
                    myStats.overall.creditsBalance > 0 ? "text-emerald-600" : myStats.overall.creditsBalance < 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {myStats.overall.creditsBalance}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">dias disponíveis</p>
                </div>

                {/* Generated vs Used */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200/50 dark:border-emerald-700/30 p-5 text-center">
                    <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-3xl font-black text-emerald-600">{myStats.overall.creditsGenerated}</p>
                    <p className="text-[10px] font-bold text-emerald-600/70 uppercase mt-1">Gerados</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200/50 dark:border-red-700/30 p-5 text-center">
                    <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-2" />
                    <p className="text-3xl font-black text-red-600">{myStats.overall.creditsUsed}</p>
                    <p className="text-[10px] font-bold text-red-600/70 uppercase mt-1">Utilizados</p>
                  </div>
                </div>

                {/* Month stats */}
                <div className="bg-card rounded-2xl border border-border/50 p-5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide mb-3">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Créditos gerados</span>
                      <span className="text-sm font-bold text-emerald-600">+{myStats.month.creditsGenerated}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Créditos utilizados</span>
                      <span className="text-sm font-bold text-red-500">-{myStats.month.creditsUsed}</span>
                    </div>
                    <div className="border-t border-border/50 pt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Saldo do mês</span>
                      <span className={cn("text-sm font-black", myStats.month.creditsBalance >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {myStats.month.creditsBalance}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground">
                    Créditos são gerados automaticamente: <strong>2 dias</strong> por cada final de semana trabalhado.
                  </p>
                </div>
              </div>
            )}

            {/* ═══ LEAVES TAB ═══ */}
            {activeTab === 'leaves' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full h-12 rounded-2xl font-bold shadow-sm gap-2">
                      <Plus className="h-4 w-4" /> Solicitar Folga
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl max-w-sm mx-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-black">Nova Solicitação</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] text-foreground/70">
                          Solicite com no mínimo <span className="font-bold">10 dias de antecedência</span>. Imprevistos serão analisados pela coordenação.
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Tipo</Label>
                        <Select
                          value={leaveForm.leaveType}
                          onValueChange={(v) => setLeaveForm(prev => ({ ...prev, leaveType: v as LeaveType }))}
                        >
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {leaveForm.leaveType === 'folga_credito' && (
                          <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                            Saldo disponível: {myStats.overall.creditsBalance} dias
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Início</Label>
                          <input
                            type="date"
                            value={leaveForm.startDate}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))}
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Fim</Label>
                          <input
                            type="date"
                            value={leaveForm.endDate}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))}
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                          />
                        </div>
                      </div>

                      {daysRequested > 0 && (
                        <p className="text-center text-sm font-bold text-primary">
                          {daysRequested} {daysRequested === 1 ? 'dia' : 'dias'}
                        </p>
                      )}

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Observações (opcional)</Label>
                        <Textarea
                          value={leaveForm.observations}
                          onChange={(e) => setLeaveForm(prev => ({ ...prev, observations: e.target.value }))}
                          placeholder="Motivo ou detalhes..."
                          className="rounded-xl resize-none"
                          rows={2}
                        />
                      </div>

                      {isShortNotice && leaveForm.startDate && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            <span className="font-bold">Prazo inferior ao recomendado.</span> Sua solicitação passará por análise especial da coordenação.
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={handleSubmitLeave}
                        className="w-full h-11 rounded-xl font-bold"
                        disabled={!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1}
                      >
                        {isShortNotice ? 'Enviar Mesmo Assim' : 'Enviar Solicitação'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {leaveRequests.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border/50 p-10 text-center">
                    <CalendarOff className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-semibold text-sm text-muted-foreground">Nenhuma solicitação</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">Use o botão acima para pedir folgas</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {leaveRequests.map(req => (
                      <div key={req.id} className="bg-card rounded-2xl border border-border/50 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">
                              {LEAVE_TYPE_LABELS[req.leave_type as LeaveType] || req.leave_type}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {format(new Date(req.start_date + 'T00:00:00'), 'dd/MM/yyyy')}
                              {req.end_date !== req.start_date && (
                                <> → {format(new Date(req.end_date + 'T00:00:00'), 'dd/MM/yyyy')}</>
                              )}
                              <span className="ml-1.5 font-bold text-primary">{req.days_requested}d</span>
                            </p>
                          </div>
                          {statusBadge(req.status)}
                        </div>
                        {req.observations && (
                          <p className="text-[11px] text-muted-foreground/70 italic mt-2 border-t border-border/30 pt-2">"{req.observations}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ PROFILE TAB ═══ */}
            {activeTab === 'profile' && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Avatar + Name */}
                <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6 flex flex-col items-center text-center">
                  <div className="relative group mb-4">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-4 ring-primary/10">
                      {professionalUser.avatar_url ? (
                        <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      onClick={handleAvatarUpload}
                      disabled={avatarUploading}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    >
                      {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    </button>
                  </div>
                  <h2 className="text-xl font-black text-foreground">
                    {myProfessional?.name || professionalUser.full_name}
                  </h2>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {professionalUser.category === 'nurse' ? <Stethoscope className="w-3.5 h-3.5" /> : professionalUser.category === 'tech' ? <Syringe className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    {categoryLabel}
                  </div>
                </div>

                {/* Info items */}
                <div className="bg-card rounded-2xl border border-border/50 divide-y divide-border/50">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">E-mail</p>
                      <p className="text-sm text-foreground truncate">{professionalUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Status</p>
                      <p className="text-sm text-emerald-600 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Última atualização</p>
                      <p className="text-sm text-foreground">{updatedLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Saldo de Créditos</p>
                      <p className={cn("text-sm font-bold", myStats.overall.creditsBalance >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {myStats.overall.creditsBalance} dias
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2.5">
                  {deferredPrompt && (
                    <Button
                      variant="outline"
                      onClick={handleInstall}
                      className="w-full h-12 rounded-2xl font-semibold gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Instalar Aplicativo
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={logout}
                    className="w-full h-12 rounded-2xl font-semibold gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair da Conta
                  </Button>
                </div>

                <p className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-widest font-bold pt-4">
                  © 2025 Secretaria Municipal de Saúde
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <PortalBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
