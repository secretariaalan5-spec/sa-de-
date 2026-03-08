import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Shield,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAVE_TYPE_LABELS, LeaveType, LeaveRequest } from '@/types/serviceSchedule';
import { useProfessionalPortal } from '@/hooks/useProfessionalPortal';
import { toast } from 'sonner';

// ─── Types ───
interface ServiceProfessionalPortal {
  id: string; name: string; category: 'tech' | 'nurse'; monthlyHours: number; active: boolean;
}
interface ServiceScheduleEntry {
  id: string; professionalId: string; date: string; type: 'nurse' | 'tech'; isWeekend?: boolean;
}
interface PortalData {
  publishedAt: string; adminName?: string;
  service: { professionals: ServiceProfessionalPortal[]; nurseEntries: ServiceScheduleEntry[]; techEntries: ServiceScheduleEntry[]; leaveRequests?: LeaveRequest[]; };
}
type PortalTab = 'schedule' | 'credits' | 'leaves' | 'profile';

// ─── Credit Ring SVG ───
function CreditRing({ balance, total }: { balance: number; total: number }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.max(0, Math.min(1, balance / total)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="10" opacity="0.3" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={balance >= 0 ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="portal-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          "text-4xl font-black leading-none",
          balance > 0 ? "text-accent" : balance < 0 ? "text-destructive" : "text-muted-foreground"
        )}>{balance}</span>
        <span className="text-[10px] font-semibold text-muted-foreground mt-1">dias</span>
      </div>
    </div>
  );
}

// ─── Login Screen ───
function GoogleLoginScreen({ onLogin, loading, onInstall, showInstall }: { onLogin: () => void; loading: boolean; onInstall: () => void; showInstall: boolean; }) {
  return (
    <div className="portal-native min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-[22px] bg-primary flex items-center justify-center mx-auto shadow-xl shadow-primary/20 portal-press">
            <img src="/logo-saude-plus.png" alt="Saúde+" className="h-11 w-auto brightness-0 invert" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <Stethoscope className="h-9 w-9 text-primary-foreground absolute opacity-10" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Portal Saúde+</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Acesso do profissional</p>
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={onLogin} disabled={loading}
            className="portal-press w-full h-[52px] rounded-[14px] bg-foreground text-background font-semibold text-[15px] flex items-center justify-center gap-2.5 shadow-lg disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Chrome className="h-5 w-5" />}
            Continuar com Google
          </button>

          {showInstall && (
            <button onClick={onInstall}
              className="portal-press w-full h-[48px] rounded-[14px] border-2 border-border text-foreground font-semibold text-sm flex items-center justify-center gap-2">
              <Download className="h-4 w-4" /> Instalar App
            </button>
          )}
        </div>

        <p className="text-[10px] text-center text-muted-foreground/60">Acesso exclusivo para profissionais da Secretaria de Saúde</p>
      </div>
    </div>
  );
}

// ─── Registration Screen ───
function RegistrationScreen({ onRegister, teamId, userEmail, userName }: { onRegister: (t: string, c: string, n: string) => void; teamId: string | null; userEmail: string; userName: string; }) {
  const [fullName, setFullName] = useState(userName || '');
  const [category, setCategory] = useState('');

  if (!teamId) {
    return (
      <div className="portal-native min-h-screen flex items-center justify-center bg-background px-6">
        <div className="portal-card-inset p-8 text-center space-y-3 max-w-xs w-full">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
          <h2 className="text-lg font-bold">Link inválido</h2>
          <p className="text-sm text-muted-foreground">Use o link fornecido pelo administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-native min-h-screen flex items-center justify-center bg-background px-6">
      <div className="portal-card-inset p-6 space-y-5 max-w-xs w-full">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"><User className="h-6 w-6 text-primary" /></div>
          <h2 className="text-lg font-bold mt-2">Solicitar Acesso</h2>
        </div>
        <div className="bg-muted/50 rounded-xl px-3 py-2 text-xs text-muted-foreground">{userEmail}</div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Nome completo</Label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome Sobrenome"
            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nurse"><span className="flex items-center gap-2"><Stethoscope className="w-4 h-4" />Enfermeiro(a)</span></SelectItem>
              <SelectItem value="tech"><span className="flex items-center gap-2"><Syringe className="w-4 h-4" />Técnico(a)</span></SelectItem>
              <SelectItem value="emult"><span className="flex items-center gap-2"><Users className="w-4 h-4" />eMult</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button onClick={() => onRegister(teamId, category, fullName.trim())} disabled={!category || !fullName.trim()}
          className="portal-press w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-40">
          Enviar Solicitação
        </button>
      </div>
    </div>
  );
}

// ─── Pending Screen ───
function PendingScreen({ onLogout, status }: { onLogout: () => void; status: string }) {
  return (
    <div className="portal-native min-h-screen flex items-center justify-center bg-background px-6">
      <div className="portal-card-inset p-8 text-center space-y-4 max-w-xs w-full">
        {status === 'pending' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-warning/15 flex items-center justify-center mx-auto">
              <HourglassIcon className="h-7 w-7 text-warning animate-pulse" />
            </div>
            <h2 className="text-lg font-bold">Aguardando Aprovação</h2>
            <p className="text-sm text-muted-foreground">Sua solicitação será analisada pelo administrador.</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-bold">Acesso Negado</h2>
            <p className="text-sm text-muted-foreground">Entre em contato com a coordenação.</p>
          </>
        )}
        <button onClick={onLogout} className="portal-press text-sm text-muted-foreground font-medium flex items-center gap-1.5 mx-auto">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───
function BottomNav({ active, onChange, leaveCount }: { active: PortalTab; onChange: (t: PortalTab) => void; leaveCount: number }) {
  const tabs: { id: PortalTab; icon: typeof Calendar; label: string }[] = [
    { id: 'schedule', icon: Calendar, label: 'Escala' },
    { id: 'credits', icon: CreditCard, label: 'Créditos' },
    { id: 'leaves', icon: CalendarOff, label: 'Folgas' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 portal-glass border-t border-border/40 safe-area-bottom">
      <div className="grid grid-cols-4 max-w-lg mx-auto h-[54px]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)}
              className={cn("portal-press flex flex-col items-center justify-center gap-[2px] relative", isActive ? "text-primary" : "text-muted-foreground")}>
              <div className="relative">
                <Icon className={cn("h-[22px] w-[22px] transition-all duration-200", isActive && "scale-105")} strokeWidth={isActive ? 2.5 : 2} />
                {tab.id === 'leaves' && leaveCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">{leaveCount}</span>
                )}
              </div>
              <span className={cn("text-[10px] leading-none", isActive ? "font-bold" : "font-medium")}>{tab.label}</span>
              {isActive && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-[3px] bg-primary rounded-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Main ───
export default function Portal() {
  const {
    session, professionalUser, leaveRequests, loading,
    loginWithGoogle, logout, registerProfessional, submitLeaveRequest,
    refreshLeaveRequests, refreshProfile,
  } = useProfessionalPortal();

  interface BeforeInstallPromptEvent extends Event {
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
  const [leaveForm, setLeaveForm] = useState({ leaveType: '' as LeaveType | '', startDate: '', endDate: '', observations: '' });
  const contentRef = useRef<HTMLDivElement>(null);

  const getTeamId = (): string | null => {
    const u = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.slice(1));
    return u.get('team') || h.get('team') || localStorage.getItem('portal_team_id');
  };
  const teamIdFromUrl = getTeamId();

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.slice(1));
    const t = u.get('team') || h.get('team');
    if (t) localStorage.setItem('portal_team_id', t);
  }, []);

  useEffect(() => {
    if (!professionalUser || !teamIdFromUrl) return;
    if (!professionalUser.team_id || professionalUser.team_id !== teamIdFromUrl) {
      (async () => {
        try {
          await supabase.rpc('register_professional_via_portal' as any, { _team_id: teamIdFromUrl, _category: professionalUser.category, _full_name: professionalUser.full_name, _email: professionalUser.email } as any);
          await refreshProfile();
        } catch (err) { console.error(err); }
      })();
    }
  }, [professionalUser, teamIdFromUrl, refreshProfile]);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const handleInstall = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') setDeferredPrompt(null); };

  const effectiveTeamId = professionalUser?.team_id || teamIdFromUrl;

  const fetchPortalData = useCallback(async () => {
    if (!effectiveTeamId) return;
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.from('portal_schedules' as any).select('*').eq('emult_data->>teamId', effectiveTeamId).order('published_at', { ascending: false }).limit(1).maybeSingle() as any;
      if (error) throw error;
      if (data) setPortalData({ publishedAt: data.published_at, adminName: data.admin_name || undefined, service: data.service_data as unknown as PortalData['service'] });
    } catch (err) { console.error(err); } finally { setLoadingPortal(false); }
  }, [effectiveTeamId]);

  useEffect(() => { if (professionalUser?.status === 'approved') fetchPortalData(); }, [professionalUser, fetchPortalData]);

  // Scroll to top on tab change
  useEffect(() => { contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [activeTab]);

  const myProfessional = useMemo(() => {
    if (!portalData || !professionalUser?.professional_id) return null;
    return portalData.service.professionals.find(p => p.id === professionalUser.professional_id) || null;
  }, [portalData, professionalUser]);

  const myEntries = useMemo(() => {
    if (!professionalUser?.professional_id || !portalData) return [];
    return [...(portalData.service.nurseEntries || []), ...(portalData.service.techEntries || [])].filter(e => e.professionalId === professionalUser.professional_id);
  }, [portalData, professionalUser]);

  const myLeaveRequestsFromAdmin = useMemo(() => {
    if (!professionalUser?.professional_id || !portalData?.service?.leaveRequests) return [];
    return (portalData.service.leaveRequests as LeaveRequest[]).filter(r => r.professionalId === professionalUser.professional_id);
  }, [portalData, professionalUser]);

  const myStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const pastEntries = myEntries.filter(e => new Date(e.date) <= today);
    const overallWorkedDays = new Set(pastEntries.map(e => e.date)).size;
    const overallWeekendDays = new Set(pastEntries.filter(e => e.isWeekend).map(e => e.date)).size;
    const overallCreditsGenerated = overallWeekendDays * 2;
    const overallCreditsUsed = myLeaveRequestsFromAdmin.filter(r => r.leaveType === 'folga_credito' && r.status === 'approved').reduce((s, r) => s + r.daysRequested, 0);

    const ms = startOfMonth(currentMonth); const me = endOfMonth(currentMonth);
    const monthEntries = myEntries.filter(e => { const d = new Date(e.date); return d >= ms && d <= me && d <= today; });
    const monthWorkedDays = new Set(monthEntries.map(e => e.date)).size;
    const monthWeekendDays = new Set(monthEntries.filter(e => e.isWeekend).map(e => e.date)).size;
    const monthCreditsGenerated = monthWeekendDays * 2;
    const monthCreditsUsed = myLeaveRequestsFromAdmin.filter(r => r.leaveType === 'folga_credito' && r.status === 'approved').reduce((s, r) => {
      if (!r.leaveDates?.length) return s;
      const f = new Date(r.leaveDates[0] + 'T00:00:00'); const l = new Date(r.leaveDates[r.leaveDates.length - 1] + 'T00:00:00');
      if (l < ms || f > me) return s; return s + r.daysRequested;
    }, 0);

    return {
      overall: { workedDays: overallWorkedDays, weekendDays: overallWeekendDays, creditsGenerated: overallCreditsGenerated, creditsUsed: overallCreditsUsed, creditsBalance: overallCreditsGenerated - overallCreditsUsed },
      month: { workedDays: monthWorkedDays, weekendDays: monthWeekendDays, creditsGenerated: monthCreditsGenerated, creditsUsed: monthCreditsUsed, creditsBalance: monthCreditsGenerated - monthCreditsUsed },
    };
  }, [myEntries, myLeaveRequestsFromAdmin, currentMonth]);

  const daysRequested = useMemo(() => {
    if (!leaveForm.startDate || !leaveForm.endDate) return 0;
    const s = new Date(leaveForm.startDate + 'T00:00:00'); const e = new Date(leaveForm.endDate + 'T00:00:00');
    return e < s ? 0 : differenceInCalendarDays(e, s) + 1;
  }, [leaveForm.startDate, leaveForm.endDate]);

  const isShortNotice = useMemo(() => {
    if (!leaveForm.startDate) return false;
    const s = new Date(leaveForm.startDate + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
    return differenceInCalendarDays(s, t) < 10;
  }, [leaveForm.startDate]);

  const handleSubmitLeave = async () => {
    if (!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1) { toast.error('Preencha todos os campos.'); return; }
    if (leaveForm.leaveType === 'folga_credito' && daysRequested > myStats.overall.creditsBalance) { toast.error(`Saldo insuficiente: ${myStats.overall.creditsBalance} dias`); return; }
    const ok = await submitLeaveRequest({ leave_type: leaveForm.leaveType, start_date: leaveForm.startDate, end_date: leaveForm.endDate, days_requested: daysRequested, observations: leaveForm.observations || undefined });
    if (ok) { setLeaveForm({ leaveType: '', startDate: '', endDate: '', observations: '' }); setLeaveDialogOpen(false); }
  };

  const handleAvatarUpload = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !session?.user) return;
      if (file.size > 2 * 1024 * 1024) { toast.error('Máximo 2 MB'); return; }
      setAvatarUploading(true);
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `${session.user.id}/avatar.${ext}`;
        const { error: ue } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
        if (ue) throw ue;
        const url = `https://qxpqzbswtdfatdrtqhrw.supabase.co/storage/v1/object/public/avatars/${filePath}?t=${Date.now()}`;
        await (supabase.from('professional_users' as any).update({ avatar_url: url } as any).eq('user_id', session.user.id) as any);
        await refreshProfile(); toast.success('Foto atualizada!');
      } catch (err: any) { toast.error('Erro: ' + (err.message || '')); } finally { setAvatarUploading(false); }
    };
    input.click();
  };

  // ─── Guards ───
  if (loading) return <div className="portal-native min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!session) return <GoogleLoginScreen onLogin={loginWithGoogle} loading={false} onInstall={handleInstall} showInstall={!!deferredPrompt} />;
  if (!professionalUser) return <RegistrationScreen onRegister={registerProfessional} teamId={teamIdFromUrl} userEmail={session.user.email || ''} userName={session.user.user_metadata?.full_name || ''} />;
  if (professionalUser.status !== 'approved') return <PendingScreen onLogout={logout} status={professionalUser.status} />;

  // ─── Helpers ───
  const prevMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));
  const firstName = myProfessional?.name?.split(' ')[0] || professionalUser.full_name.split(' ')[0];
  const categoryLabel = professionalUser.category === 'nurse' ? 'Enfermeiro(a)' : professionalUser.category === 'tech' ? 'Técnico(a)' : 'eMult';
  const CategoryIcon = professionalUser.category === 'nurse' ? Stethoscope : professionalUser.category === 'tech' ? Syringe : Users;

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent"><CheckCircle2 className="w-3 h-3" />Aprovado</span>;
    if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive"><XCircle className="w-3 h-3" />Rejeitado</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning"><Clock className="w-3 h-3" />Pendente</span>;
  };

  // ─── RENDER ───
  return (
    <div className="portal-native min-h-screen bg-background flex flex-col">
      {/* ── iOS-style header ── */}
      <header className="portal-glass sticky top-0 z-40 border-b border-border/30">
        <div className="px-4 max-w-lg mx-auto">
          {/* Top row: avatar + name + refresh */}
          <div className="h-[52px] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 ring-[1.5px] ring-primary/20">
                {professionalUser.avatar_url
                  ? <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <User className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-foreground leading-tight truncate">Olá, {firstName} 👋</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">{categoryLabel}</p>
              </div>
            </div>
            <button
              onClick={() => { fetchPortalData(); refreshLeaveRequests(); }}
              disabled={loadingPortal}
              className="portal-press w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground">
              <RefreshCw className={cn("h-4 w-4", loadingPortal && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content area ── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-4">
          {loadingPortal ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-2xl" />
              <Skeleton className="h-60 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="portal-page-enter">
              {/* ════════ SCHEDULE ════════ */}
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  {/* Month nav */}
                  <div className="flex items-center justify-between">
                    <button onClick={prevMonth} className="portal-press w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/50">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-[15px] font-extrabold capitalize text-foreground tracking-tight">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                    <button onClick={nextMonth} className="portal-press w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/50">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Calendar grid */}
                  <div className="portal-card-inset overflow-hidden">
                    <div className="grid grid-cols-7 text-center">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={i} className="py-2 text-[10px] font-bold text-muted-foreground/60">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-border/20">
                      {(() => {
                        const ms = startOfMonth(currentMonth);
                        const me = endOfMonth(currentMonth);
                        const days = eachDayOfInterval({ start: ms, end: me });
                        const blanks = Array.from({ length: getDay(ms) }, (_, i) => <div key={`b${i}`} className="aspect-square bg-background" />);

                        const cells = days.map(day => {
                          const ds = format(day, 'yyyy-MM-dd');
                          const hasWork = myEntries.some(e => e.date === ds);
                          const isWknd = getDay(day) === 0 || getDay(day) === 6;
                          const isToday = format(new Date(), 'yyyy-MM-dd') === ds;
                          const hasLeave = myLeaveRequestsFromAdmin.some(r => r.status === 'approved' && r.leaveDates?.includes(ds));

                          return (
                            <div key={ds} className={cn("aspect-square flex flex-col items-center justify-center bg-background relative")}>
                              <span className={cn(
                                "text-[13px] font-semibold w-8 h-8 flex items-center justify-center rounded-full transition-all",
                                isToday && "bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/30",
                                hasLeave && !isToday && "bg-destructive/10 text-destructive",
                                !isToday && !hasLeave && isWknd && "text-muted-foreground/50",
                                !isToday && !hasLeave && !isWknd && "text-foreground",
                              )}>
                                {format(day, 'd')}
                              </span>
                              {hasWork && !hasLeave && (
                                <div className={cn(
                                  "absolute bottom-[3px] w-[5px] h-[5px] rounded-full",
                                  isWknd ? "bg-warning" : "bg-accent"
                                )} />
                              )}
                              {hasLeave && (
                                <div className="absolute bottom-[3px] w-[5px] h-[5px] rounded-full bg-destructive" />
                              )}
                            </div>
                          );
                        });
                        return [...blanks, ...cells];
                      })()}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 text-[9px] font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1"><div className="w-[6px] h-[6px] rounded-full bg-accent" />Dia útil</span>
                    <span className="flex items-center gap-1"><div className="w-[6px] h-[6px] rounded-full bg-warning" />FDS</span>
                    <span className="flex items-center gap-1"><div className="w-[6px] h-[6px] rounded-full bg-destructive" />Afastamento</span>
                  </div>

                  {/* Month summary cards */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: myStats.month.workedDays, label: 'Escalas', color: 'text-primary' },
                      { value: myStats.month.weekendDays, label: 'FDS', color: 'text-warning' },
                      { value: myStats.month.creditsBalance, label: 'Créditos', color: myStats.month.creditsBalance >= 0 ? 'text-accent' : 'text-destructive' },
                    ].map((s, i) => (
                      <div key={i} className="portal-card-inset p-3 text-center">
                        <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Overall bar */}
                  <div className="portal-card-inset p-3 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-muted-foreground">Geral</span>
                    <div className="flex gap-4">
                      <span>{myStats.overall.workedDays} <span className="text-muted-foreground">dias</span></span>
                      <span>{myStats.overall.weekendDays} <span className="text-muted-foreground">fds</span></span>
                      <span className={cn("font-bold", myStats.overall.creditsBalance >= 0 ? "text-accent" : "text-destructive")}>
                        {myStats.overall.creditsBalance} <span className="font-normal text-muted-foreground">créd</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════ CREDITS ════════ */}
              {activeTab === 'credits' && (
                <div className="space-y-5">
                  <div className="portal-card-inset p-6">
                    <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Saldo de Créditos</p>
                    <CreditRing balance={myStats.overall.creditsBalance} total={Math.max(myStats.overall.creditsGenerated, 1)} />
                    <p className="text-center text-sm text-muted-foreground mt-3">dias disponíveis para folga</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="portal-card-inset p-4 text-center space-y-1">
                      <TrendingUp className="w-5 h-5 text-accent mx-auto" />
                      <p className="text-2xl font-black text-accent">{myStats.overall.creditsGenerated}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Gerados</p>
                    </div>
                    <div className="portal-card-inset p-4 text-center space-y-1">
                      <TrendingDown className="w-5 h-5 text-destructive mx-auto" />
                      <p className="text-2xl font-black text-destructive">{myStats.overall.creditsUsed}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Utilizados</p>
                    </div>
                  </div>

                  <div className="portal-card-inset divide-y divide-border/40">
                    <div className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </div>
                    {[
                      { label: 'Créditos gerados', value: `+${myStats.month.creditsGenerated}`, color: 'text-accent' },
                      { label: 'Créditos utilizados', value: `-${myStats.month.creditsUsed}`, color: 'text-destructive' },
                      { label: 'Saldo do mês', value: `${myStats.month.creditsBalance}`, color: myStats.month.creditsBalance >= 0 ? 'text-accent' : 'text-destructive', bold: true },
                    ].map((row, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <span className={cn("text-[13px]", row.bold ? "font-bold text-foreground" : "text-muted-foreground")}>{row.label}</span>
                        <span className={cn("text-[13px] font-bold", row.color)}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 px-1">
                    <Sparkles className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground/70">Cada FDS trabalhado gera <strong>2 créditos</strong> automaticamente.</p>
                  </div>
                </div>
              )}

              {/* ════════ LEAVES ════════ */}
              {activeTab === 'leaves' && (
                <div className="space-y-4">
                  <button onClick={() => setLeaveDialogOpen(true)}
                    className="portal-press w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-sm shadow-primary/15">
                    <Plus className="h-4 w-4" /> Nova Solicitação
                  </button>

                  <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                    <DialogContent className="rounded-3xl max-w-[340px] mx-auto p-5">
                      <DialogHeader>
                        <DialogTitle className="text-[16px] font-extrabold">Nova Solicitação</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3.5 pt-1">
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                          <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <p className="text-[10px] text-foreground/70 leading-relaxed">
                            Solicite com mínimo <strong>10 dias</strong> de antecedência. Imprevistos serão analisados pela coordenação.
                          </p>
                        </div>

                        <div>
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Tipo</Label>
                          <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm(p => ({ ...p, leaveType: v as LeaveType }))}>
                            <SelectTrigger className="h-10 rounded-xl text-[13px]"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>{Object.entries(LEAVE_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                          </Select>
                          {leaveForm.leaveType === 'folga_credito' && <p className="text-[10px] text-accent mt-1 font-semibold">Saldo: {myStats.overall.creditsBalance} dias</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Início</Label>
                            <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm(p => ({ ...p, startDate: e.target.value }))}
                              className="flex h-10 w-full rounded-xl border border-input bg-background px-2.5 text-[13px]" />
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Fim</Label>
                            <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm(p => ({ ...p, endDate: e.target.value }))}
                              className="flex h-10 w-full rounded-xl border border-input bg-background px-2.5 text-[13px]" />
                          </div>
                        </div>

                        {daysRequested > 0 && <p className="text-center text-[13px] font-bold text-primary">{daysRequested} {daysRequested === 1 ? 'dia' : 'dias'}</p>}

                        <div>
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Observações</Label>
                          <Textarea value={leaveForm.observations} onChange={(e) => setLeaveForm(p => ({ ...p, observations: e.target.value }))}
                            placeholder="Opcional..." className="rounded-xl resize-none text-[13px]" rows={2} />
                        </div>

                        {isShortNotice && leaveForm.startDate && (
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/20">
                            <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                            <p className="text-[10px] text-foreground/70"><strong>Prazo inferior ao recomendado.</strong> Sujeito à análise da coordenação.</p>
                          </div>
                        )}

                        <button onClick={handleSubmitLeave}
                          disabled={!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1}
                          className="portal-press w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-[13px] disabled:opacity-40">
                          {isShortNotice ? 'Enviar Mesmo Assim' : 'Enviar'}
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {leaveRequests.length === 0 ? (
                    <div className="portal-card-inset p-10 text-center">
                      <CalendarOff className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                      <p className="text-[13px] font-semibold text-muted-foreground">Nenhuma solicitação</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Toque no botão acima para pedir folga</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {leaveRequests.map(req => (
                        <div key={req.id} className="portal-card-inset p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-[13px] text-foreground truncate">{LEAVE_TYPE_LABELS[req.leave_type as LeaveType] || req.leave_type}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {format(new Date(req.start_date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                                {req.end_date !== req.start_date && <> → {format(new Date(req.end_date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}</>}
                                <span className="ml-1 font-bold text-primary">{req.days_requested}d</span>
                              </p>
                            </div>
                            {statusBadge(req.status)}
                          </div>
                          {req.observations && <p className="text-[10px] text-muted-foreground/60 italic mt-2 pt-2 border-t border-border/30">"{req.observations}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════════ PROFILE ════════ */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  {/* Avatar card */}
                  <div className="portal-card-inset p-6 flex flex-col items-center">
                    <div className="relative mb-3">
                      <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-muted ring-[3px] ring-primary/15 flex items-center justify-center">
                        {professionalUser.avatar_url
                          ? <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <User className="w-8 h-8 text-muted-foreground" />}
                      </div>
                      <button onClick={handleAvatarUpload} disabled={avatarUploading}
                        className="portal-press absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25">
                        {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <h2 className="text-lg font-extrabold text-foreground">{myProfessional?.name || professionalUser.full_name}</h2>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-[11px] font-bold">
                      <CategoryIcon className="w-3 h-3" /> {categoryLabel}
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="portal-card-inset divide-y divide-border/40">
                    {[
                      { icon: User, label: 'E-mail', value: professionalUser.email },
                      { icon: Shield, label: 'Status', value: 'Aprovado', valueClass: 'text-accent font-semibold' },
                      { icon: CreditCard, label: 'Créditos', value: `${myStats.overall.creditsBalance} dias`, valueClass: myStats.overall.creditsBalance >= 0 ? 'text-accent font-semibold' : 'text-destructive font-semibold' },
                      { icon: Calendar, label: 'Dias escalados', value: `${myStats.overall.workedDays} dias` },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-[10px] bg-muted flex items-center justify-center shrink-0">
                          <row.icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{row.label}</p>
                          <p className={cn("text-[13px] text-foreground truncate", row.valueClass)}>{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    {deferredPrompt && (
                      <button onClick={handleInstall}
                        className="portal-press w-full h-11 rounded-2xl border-2 border-border text-foreground font-semibold text-[13px] flex items-center justify-center gap-2">
                        <Download className="h-4 w-4" /> Instalar App
                      </button>
                    )}
                    <button onClick={logout}
                      className="portal-press w-full h-11 rounded-2xl border-2 border-destructive/20 text-destructive font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-destructive/5">
                      <LogOut className="h-4 w-4" /> Sair da Conta
                    </button>
                  </div>

                  <p className="text-center text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-bold pt-4 pb-2">
                    © 2025 Secretaria Municipal de Saúde
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <BottomNav active={activeTab} onChange={setActiveTab} leaveCount={leaveRequests.filter(r => r.status === 'pending').length} />
    </div>
  );
}
