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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Sun,
  Moon,
  Mail,
  CalendarDays,
  Award,
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

// ─── Greeting helper ───
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Bom dia', icon: Sun, emoji: '☀️' };
  if (h < 18) return { text: 'Boa tarde', icon: Sun, emoji: '🌤️' };
  return { text: 'Boa noite', icon: Moon, emoji: '🌙' };
}

// ─── Credit Ring SVG ───
function CreditRing({ balance, total }: { balance: number; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.max(0, Math.min(1, balance / total)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="65" cy="65" r={radius} fill="none"
          stroke={balance >= 0 ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="portal-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          "text-3xl font-black leading-none",
          balance > 0 ? "text-accent" : balance < 0 ? "text-destructive" : "text-muted-foreground"
        )}>{balance}</span>
        <span className="text-[10px] font-medium text-muted-foreground mt-0.5">dias</span>
      </div>
    </div>
  );
}

// ─── Login Screen ───
function GoogleLoginScreen({ onLogin, loading, onInstall, showInstall }: { onLogin: () => void; loading: boolean; onInstall: () => void; showInstall: boolean; }) {
  return (
    <div className="portal-native min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, hsl(var(--primary)/0.06) 0%, hsl(var(--background)) 40%, hsl(var(--accent)/0.04) 100%)' }}>
      <div className="w-full max-w-xs space-y-10 relative z-10">
        {/* Logo + title */}
        <div className="text-center space-y-4">
          <div className="w-[72px] h-[72px] rounded-[20px] bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/10 to-transparent" />
            <img src="/logo-saude-plus.png" alt="Saúde+" className="h-10 w-auto brightness-0 invert relative z-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <Stethoscope className="h-8 w-8 text-primary-foreground absolute opacity-10" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-foreground leading-tight">
              Portal do Profissional
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">Saúde+ · Gestão de Escalas</p>
          </div>
        </div>

        {/* Login card */}
        <div className="portal-card-inset p-6 space-y-4">
          <p className="text-center text-[13px] text-muted-foreground">
            Acesse com sua conta institucional
          </p>

          <button onClick={onLogin} disabled={loading}
            className="portal-press w-full h-[50px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] flex items-center justify-center gap-2.5 shadow-md shadow-primary/15 disabled:opacity-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-foreground/5 to-transparent" />
            {loading ? <Loader2 className="h-5 w-5 animate-spin relative z-10" /> : <Chrome className="h-5 w-5 relative z-10" />}
            <span className="relative z-10">Entrar com Google</span>
          </button>

          {showInstall && (
            <button onClick={onInstall}
              className="portal-press w-full h-[44px] rounded-xl border border-border text-foreground font-medium text-[13px] flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
              <Download className="h-4 w-4" /> Instalar no celular
            </button>
          )}
        </div>

        <p className="text-[10px] text-center text-muted-foreground/50 leading-relaxed">
          Acesso exclusivo para profissionais<br />da Secretaria Municipal de Saúde
        </p>
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
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto"><AlertCircle className="h-6 w-6 text-destructive" /></div>
          <h2 className="text-[16px] font-bold">Link inválido</h2>
          <p className="text-[13px] text-muted-foreground">Solicite o link correto ao seu administrador.</p>
        </div>
      </div>
    );
  }

  const categories = [
    { value: 'nurse', label: 'Enfermeiro(a)', icon: Stethoscope, desc: 'Escala de enfermagem' },
    { value: 'tech', label: 'Técnico(a)', icon: Syringe, desc: 'Escala técnica' },
    { value: 'emult', label: 'eMult', icon: Users, desc: 'Equipe multiprofissional' },
  ];

  return (
    <div className="portal-native min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"><User className="h-6 w-6 text-primary" /></div>
          <h2 className="text-[18px] font-bold">Criar sua conta</h2>
          <p className="text-[12px] text-muted-foreground">Complete o cadastro para acessar o portal</p>
        </div>

        <div className="portal-card-inset p-5 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
            <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{userEmail}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">Nome completo</Label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground">Sua categoria</Label>
            <div className="grid gap-2">
              {categories.map(cat => (
                <button key={cat.value} onClick={() => setCategory(cat.value)}
                  className={cn(
                    "portal-press flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    category === cat.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-border"
                  )}>
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", category === cat.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <cat.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{cat.label}</p>
                    <p className="text-[10px] text-muted-foreground">{cat.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => onRegister(teamId, category, fullName.trim())} disabled={!category || !fullName.trim()}
            className="portal-press w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] disabled:opacity-30 shadow-sm shadow-primary/10">
            Solicitar Acesso
          </button>
        </div>
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
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <HourglassIcon className="h-7 w-7 text-warning animate-pulse" />
            </div>
            <h2 className="text-[16px] font-bold">Aguardando Aprovação</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">Sua solicitação foi enviada.<br />Você será notificado após a análise.</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-[16px] font-bold">Acesso Negado</h2>
            <p className="text-[13px] text-muted-foreground">Entre em contato com a coordenação.</p>
          </>
        )}
        <button onClick={onLogout} className="portal-press text-[13px] text-muted-foreground font-medium flex items-center gap-1.5 mx-auto mt-2 hover:text-foreground transition-colors">
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
    { id: 'credits', icon: Award, label: 'Créditos' },
    { id: 'leaves', icon: CalendarOff, label: 'Folgas' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/30 safe-area-bottom"
      style={{ background: 'hsl(var(--card) / 0.88)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}>
      <div className="grid grid-cols-4 max-w-lg mx-auto h-[56px]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)}
              className={cn("portal-press flex flex-col items-center justify-center gap-[3px] relative transition-colors", isActive ? "text-primary" : "text-muted-foreground/70")}>
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2.5px] bg-primary rounded-full" />}
              <div className="relative">
                <Icon className={cn("h-[21px] w-[21px]", isActive && "drop-shadow-sm")} strokeWidth={isActive ? 2.5 : 1.8} />
                {tab.id === 'leaves' && leaveCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center px-0.5">{leaveCount}</span>
                )}
              </div>
              <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════
// MAIN PORTAL
// ═══════════════════════════════════════════
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

  useEffect(() => { const u = new URLSearchParams(window.location.search); const h = new URLSearchParams(window.location.hash.slice(1)); const t = u.get('team') || h.get('team'); if (t) localStorage.setItem('portal_team_id', t); }, []);

  useEffect(() => {
    if (!professionalUser || !teamIdFromUrl) return;
    if (!professionalUser.team_id || professionalUser.team_id !== teamIdFromUrl) {
      (async () => { try { await supabase.rpc('register_professional_via_portal' as any, { _team_id: teamIdFromUrl, _category: professionalUser.category, _full_name: professionalUser.full_name, _email: professionalUser.email } as any); await refreshProfile(); } catch (err) { console.error(err); } })();
    }
  }, [professionalUser, teamIdFromUrl, refreshProfile]);

  useEffect(() => { const h = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); }; window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h); }, []);
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
  useEffect(() => { contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [activeTab]);

  const myProfessional = useMemo(() => { if (!portalData || !professionalUser?.professional_id) return null; return portalData.service.professionals.find(p => p.id === professionalUser.professional_id) || null; }, [portalData, professionalUser]);
  const myEntries = useMemo(() => { if (!professionalUser?.professional_id || !portalData) return []; return [...(portalData.service.nurseEntries || []), ...(portalData.service.techEntries || [])].filter(e => e.professionalId === professionalUser.professional_id); }, [portalData, professionalUser]);
  const myLeaveRequestsFromAdmin = useMemo(() => { if (!professionalUser?.professional_id || !portalData?.service?.leaveRequests) return []; return (portalData.service.leaveRequests as LeaveRequest[]).filter(r => r.professionalId === professionalUser.professional_id); }, [portalData, professionalUser]);

  const myStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const pastEntries = myEntries.filter(e => new Date(e.date) <= today);
    const overallWorkedDays = new Set(pastEntries.map(e => e.date)).size;
    const overallWeekendDays = new Set(pastEntries.filter(e => e.isWeekend).map(e => e.date)).size;
    const cg = overallWeekendDays * 2;
    const cu = myLeaveRequestsFromAdmin.filter(r => r.leaveType === 'folga_credito' && r.status === 'approved').reduce((s, r) => s + r.daysRequested, 0);
    const ms = startOfMonth(currentMonth); const me = endOfMonth(currentMonth);
    const monthEntries = myEntries.filter(e => { const d = new Date(e.date); return d >= ms && d <= me && d <= today; });
    const mwd = new Set(monthEntries.map(e => e.date)).size;
    const mwed = new Set(monthEntries.filter(e => e.isWeekend).map(e => e.date)).size;
    const mcg = mwed * 2;
    const mcu = myLeaveRequestsFromAdmin.filter(r => r.leaveType === 'folga_credito' && r.status === 'approved').reduce((s, r) => { if (!r.leaveDates?.length) return s; const f = new Date(r.leaveDates[0] + 'T00:00:00'); const l = new Date(r.leaveDates[r.leaveDates.length - 1] + 'T00:00:00'); if (l < ms || f > me) return s; return s + r.daysRequested; }, 0);
    return {
      overall: { workedDays: overallWorkedDays, weekendDays: overallWeekendDays, creditsGenerated: cg, creditsUsed: cu, creditsBalance: cg - cu },
      month: { workedDays: mwd, weekendDays: mwed, creditsGenerated: mcg, creditsUsed: mcu, creditsBalance: mcg - mcu },
    };
  }, [myEntries, myLeaveRequestsFromAdmin, currentMonth]);

  const daysRequested = useMemo(() => { if (!leaveForm.startDate || !leaveForm.endDate) return 0; const s = new Date(leaveForm.startDate + 'T00:00:00'); const e = new Date(leaveForm.endDate + 'T00:00:00'); return e < s ? 0 : differenceInCalendarDays(e, s) + 1; }, [leaveForm.startDate, leaveForm.endDate]);
  const isShortNotice = useMemo(() => { if (!leaveForm.startDate) return false; const s = new Date(leaveForm.startDate + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0); return differenceInCalendarDays(s, t) < 10; }, [leaveForm.startDate]);

  const handleSubmitLeave = async () => {
    if (!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1) { toast.error('Preencha todos os campos.'); return; }
    if (leaveForm.leaveType === 'folga_credito' && daysRequested > myStats.overall.creditsBalance) { toast.error(`Saldo insuficiente: ${myStats.overall.creditsBalance} dias`); return; }
    const ok = await submitLeaveRequest({ leave_type: leaveForm.leaveType, start_date: leaveForm.startDate, end_date: leaveForm.endDate, days_requested: daysRequested, observations: leaveForm.observations || undefined });
    if (ok) { setLeaveForm({ leaveType: '', startDate: '', endDate: '', observations: '' }); setLeaveDialogOpen(false); }
  };

  const handleAvatarUpload = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file || !session?.user) return;
      if (file.size > 2 * 1024 * 1024) { toast.error('Máximo 2 MB'); return; }
      setAvatarUploading(true);
      try {
        const ext = file.name.split('.').pop() || 'jpg'; const fp = `${session.user.id}/avatar.${ext}`;
        const { error: ue } = await supabase.storage.from('avatars').upload(fp, file, { upsert: true }); if (ue) throw ue;
        const url = `https://qxpqzbswtdfatdrtqhrw.supabase.co/storage/v1/object/public/avatars/${fp}?t=${Date.now()}`;
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

  const prevMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));
  const greeting = getGreeting();
  const firstName = myProfessional?.name?.split(' ')[0] || professionalUser.full_name.split(' ')[0];
  const categoryLabel = professionalUser.category === 'nurse' ? 'Enfermeiro(a)' : professionalUser.category === 'tech' ? 'Técnico(a)' : 'eMult';
  const CategoryIcon = professionalUser.category === 'nurse' ? Stethoscope : professionalUser.category === 'tech' ? Syringe : Users;
  const updatedLabel = portalData ? format(parseISO(portalData.publishedAt), "dd/MM 'às' HH:mm", { locale: ptBR }) : '';

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent"><CheckCircle2 className="w-3 h-3" />Aprovado</span>;
    if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive"><XCircle className="w-3 h-3" />Rejeitado</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning"><Clock className="w-3 h-3" />Pendente</span>;
  };

  return (
    <div className="portal-native min-h-screen bg-background flex flex-col">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-40 border-b border-border/20"
        style={{ background: 'hsl(var(--card) / 0.82)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}>
        <div className="px-5 max-w-lg mx-auto h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setActiveTab('profile')} className="portal-press shrink-0">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-muted ring-2 ring-primary/15 flex items-center justify-center">
                {professionalUser.avatar_url
                  ? <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[13px] font-bold text-primary">{firstName[0]}</span>}
              </div>
            </button>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-foreground leading-tight truncate">{greeting.text}, {firstName} {greeting.emoji}</p>
              <div className="flex items-center gap-1.5 mt-px">
                <CategoryIcon className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground">{categoryLabel}</span>
                {updatedLabel && <>
                  <span className="text-muted-foreground/30 text-[10px]">·</span>
                  <span className="text-[10px] text-muted-foreground/60">{updatedLabel}</span>
                </>}
              </div>
            </div>
          </div>
          <button onClick={() => { fetchPortalData(); refreshLeaveRequests(); }} disabled={loadingPortal}
            className="portal-press w-9 h-9 rounded-full flex items-center justify-center bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn("h-4 w-4", loadingPortal && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-[76px]">
        <div className="max-w-lg mx-auto px-5 py-5">
          {loadingPortal ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-3/4 rounded-xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
              <div className="grid grid-cols-3 gap-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
            </div>
          ) : (
            <div key={activeTab} className="portal-page-enter">

              {/* ════════ SCHEDULE ════════ */}
              {activeTab === 'schedule' && (
                <div className="space-y-5">
                  {/* Quick stats hero */}
                  <div className="rounded-2xl p-4 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)' }}>
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary-foreground/5 -translate-y-8 translate-x-8" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div>
                        <p className="text-primary-foreground/70 text-[10px] font-bold uppercase tracking-wider">Resumo geral</p>
                        <p className="text-primary-foreground text-2xl font-black mt-0.5">{myStats.overall.workedDays} <span className="text-[14px] font-semibold opacity-80">dias escalados</span></p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-primary-foreground/80 text-[11px]"><span className="font-bold">{myStats.overall.weekendDays}</span> FDS</p>
                        <p className="text-primary-foreground text-[14px] font-black">{myStats.overall.creditsBalance} <span className="text-[10px] font-semibold opacity-70">créd</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Month nav */}
                  <div className="flex items-center justify-between">
                    <button onClick={prevMonth} className="portal-press w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-[15px] font-extrabold capitalize text-foreground">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                    <button onClick={nextMonth} className="portal-press w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Calendar */}
                  <div className="portal-card-inset overflow-hidden">
                    <div className="grid grid-cols-7 text-center border-b border-border/30">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={i} className="py-2.5 text-[10px] font-bold text-muted-foreground/50">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {(() => {
                        const ms = startOfMonth(currentMonth); const me = endOfMonth(currentMonth);
                        const days = eachDayOfInterval({ start: ms, end: me });
                        const blanks = Array.from({ length: getDay(ms) }, (_, i) => <div key={`b${i}`} className="aspect-square" />);
                        const cells = days.map(day => {
                          const ds = format(day, 'yyyy-MM-dd');
                          const hasWork = myEntries.some(e => e.date === ds);
                          const isWknd = getDay(day) === 0 || getDay(day) === 6;
                          const isToday = format(new Date(), 'yyyy-MM-dd') === ds;
                          const hasLeave = myLeaveRequestsFromAdmin.some(r => r.status === 'approved' && r.leaveDates?.includes(ds));
                          return (
                            <div key={ds} className="aspect-square flex flex-col items-center justify-center relative">
                              <span className={cn(
                                "text-[13px] font-semibold w-[34px] h-[34px] flex items-center justify-center rounded-xl transition-all",
                                isToday && "bg-primary text-primary-foreground font-bold shadow-sm",
                                hasWork && !isToday && !hasLeave && !isWknd && "bg-accent/10 text-accent font-bold",
                                hasWork && !isToday && !hasLeave && isWknd && "bg-warning/10 text-warning font-bold",
                                hasLeave && !isToday && "bg-destructive/8 text-destructive",
                                !isToday && !hasWork && !hasLeave && isWknd && "text-muted-foreground/40",
                                !isToday && !hasWork && !hasLeave && !isWknd && "text-foreground/80",
                              )}>
                                {format(day, 'd')}
                              </span>
                            </div>
                          );
                        });
                        return [...blanks, ...cells];
                      })()}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 text-[10px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-accent/10 text-accent text-[9px] font-bold flex items-center justify-center">5</span>Dia útil</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-warning/10 text-warning text-[9px] font-bold flex items-center justify-center">S</span>FDS</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-destructive/8 text-destructive text-[9px] font-bold flex items-center justify-center">F</span>Folga</span>
                  </div>

                  {/* Month stats */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { value: myStats.month.workedDays, label: 'Escalas', icon: CalendarDays, color: 'text-primary' },
                      { value: myStats.month.weekendDays, label: 'FDS', icon: Sun, color: 'text-warning' },
                      { value: myStats.month.creditsBalance, label: 'Créditos', icon: Award, color: myStats.month.creditsBalance >= 0 ? 'text-accent' : 'text-destructive' },
                    ].map((s, i) => (
                      <div key={i} className="portal-card-inset p-3 flex flex-col items-center gap-1">
                        <s.icon className={cn("w-4 h-4", s.color)} />
                        <p className={cn("text-xl font-black leading-none", s.color)}>{s.value}</p>
                        <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════ CREDITS ════════ */}
              {activeTab === 'credits' && (
                <div className="space-y-5">
                  <div className="portal-card-inset p-6 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Saldo de Créditos</p>
                    <CreditRing balance={myStats.overall.creditsBalance} total={Math.max(myStats.overall.creditsGenerated, 1)} />
                    <p className="text-[13px] text-muted-foreground mt-2">dias disponíveis para folga</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="portal-card-inset p-4 text-center">
                      <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-2"><TrendingUp className="w-5 h-5 text-accent" /></div>
                      <p className="text-2xl font-black text-accent">{myStats.overall.creditsGenerated}</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase mt-0.5">Gerados</p>
                    </div>
                    <div className="portal-card-inset p-4 text-center">
                      <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-2"><TrendingDown className="w-5 h-5 text-destructive" /></div>
                      <p className="text-2xl font-black text-destructive">{myStats.overall.creditsUsed}</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase mt-0.5">Utilizados</p>
                    </div>
                  </div>

                  <div className="portal-card-inset overflow-hidden">
                    <div className="px-4 py-3 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-wide capitalize">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </div>
                    {[
                      { label: 'Créditos gerados', value: `+${myStats.month.creditsGenerated}`, color: 'text-accent' },
                      { label: 'Créditos utilizados', value: `-${myStats.month.creditsUsed}`, color: 'text-destructive' },
                      { label: 'Saldo do mês', value: `${myStats.month.creditsBalance}`, color: myStats.month.creditsBalance >= 0 ? 'text-accent' : 'text-destructive', bold: true },
                    ].map((row, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between border-t border-border/30">
                        <span className={cn("text-[13px]", row.bold ? "font-bold text-foreground" : "text-muted-foreground")}>{row.label}</span>
                        <span className={cn("text-[13px] font-bold", row.color)}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2.5 px-1">
                    <Sparkles className="w-4 h-4 text-primary/30 shrink-0 mt-px" />
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Cada final de semana trabalhado gera <strong className="text-foreground/80">2 créditos</strong> automaticamente.</p>
                  </div>
                </div>
              )}

              {/* ════════ LEAVES ════════ */}
              {activeTab === 'leaves' && (
                <div className="space-y-4">
                  {/* CTA */}
                  <button onClick={() => setLeaveDialogOpen(true)}
                    className="portal-press w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2.5 shadow-md shadow-primary/15 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-foreground/5 to-transparent" />
                    <Plus className="h-5 w-5 relative z-10" /> <span className="relative z-10">Nova Solicitação</span>
                  </button>

                  <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                    <DialogContent className="rounded-3xl max-w-[360px] mx-auto p-5">
                      <DialogHeader><DialogTitle className="text-[16px] font-extrabold">Nova Solicitação</DialogTitle></DialogHeader>
                      <div className="space-y-3.5 pt-1">
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-[11px] text-foreground/70 leading-relaxed">Solicite com mínimo <strong>10 dias de antecedência</strong>. Imprevistos serão analisados pela coordenação.</p>
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Tipo de afastamento</Label>
                          <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm(p => ({ ...p, leaveType: v as LeaveType }))}>
                            <SelectTrigger className="h-11 rounded-xl text-[13px]"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                            <SelectContent>{Object.entries(LEAVE_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                          </Select>
                          {leaveForm.leaveType === 'folga_credito' && <p className="text-[10px] text-accent mt-1 font-semibold flex items-center gap-1"><Award className="w-3 h-3" />Saldo: {myStats.overall.creditsBalance} dias</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div><Label className="text-[10px] font-bold text-muted-foreground uppercase">Início</Label><input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-[13px]" /></div>
                          <div><Label className="text-[10px] font-bold text-muted-foreground uppercase">Fim</Label><input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm(p => ({ ...p, endDate: e.target.value }))} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-[13px]" /></div>
                        </div>
                        {daysRequested > 0 && <div className="text-center"><span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[13px] font-bold">{daysRequested} {daysRequested === 1 ? 'dia' : 'dias'}</span></div>}
                        <div><Label className="text-[10px] font-bold text-muted-foreground uppercase">Observações (opcional)</Label><Textarea value={leaveForm.observations} onChange={(e) => setLeaveForm(p => ({ ...p, observations: e.target.value }))} placeholder="Motivo ou detalhes..." className="rounded-xl resize-none text-[13px]" rows={2} /></div>
                        {isShortNotice && leaveForm.startDate && (
                          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/8 border border-warning/15">
                            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-[11px] text-foreground/70"><strong>Prazo inferior ao recomendado.</strong> Sujeito à análise da coordenação.</p>
                          </div>
                        )}
                        <button onClick={handleSubmitLeave} disabled={!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1}
                          className="portal-press w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] disabled:opacity-30 shadow-sm">
                          {isShortNotice ? 'Enviar Mesmo Assim' : 'Enviar Solicitação'}
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* List */}
                  {leaveRequests.length === 0 ? (
                    <div className="portal-card-inset py-12 px-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><CalendarOff className="w-6 h-6 text-muted-foreground/30" /></div>
                      <p className="text-[14px] font-semibold text-muted-foreground">Sem solicitações</p>
                      <p className="text-[12px] text-muted-foreground/60 mt-1">Toque em "Nova Solicitação" para pedir folga</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {leaveRequests.map(req => (
                        <div key={req.id} className="portal-card-inset p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[13px] text-foreground truncate">{LEAVE_TYPE_LABELS[req.leave_type as LeaveType] || req.leave_type}</p>
                              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                                <CalendarDays className="w-3 h-3 shrink-0" />
                                {format(new Date(req.start_date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                                {req.end_date !== req.start_date && <> → {format(new Date(req.end_date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}</>}
                                <span className="font-bold text-primary ml-0.5">{req.days_requested}d</span>
                              </p>
                            </div>
                            {statusBadge(req.status)}
                          </div>
                          {req.observations && <p className="text-[11px] text-muted-foreground/60 italic mt-2.5 pt-2.5 border-t border-border/20">"{req.observations}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════════ PROFILE ════════ */}
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  {/* Hero card */}
                  <div className="portal-card-inset overflow-hidden">
                    {/* Gradient banner */}
                    <div className="h-20 relative" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.7) 100%)' }}>
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
                    </div>
                    <div className="px-5 pb-5 -mt-10 relative z-10 flex flex-col items-center">
                      <div className="relative mb-2">
                        <div className="w-[80px] h-[80px] rounded-full overflow-hidden bg-card ring-4 ring-card flex items-center justify-center shadow-lg">
                          {professionalUser.avatar_url
                            ? <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <span className="text-2xl font-black text-primary">{firstName[0]}</span>}
                        </div>
                        <button onClick={handleAvatarUpload} disabled={avatarUploading}
                          className="portal-press absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md ring-2 ring-card">
                          {avatarUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                        </button>
                      </div>
                      <h2 className="text-[16px] font-extrabold text-foreground mt-1">{myProfessional?.name || professionalUser.full_name}</h2>
                      <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-bold">
                        <CategoryIcon className="w-3 h-3" /> {categoryLabel}
                      </div>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="portal-card-inset p-3 text-center">
                      <p className="text-xl font-black text-primary">{myStats.overall.workedDays}</p>
                      <p className="text-[8px] font-bold text-muted-foreground/50 uppercase">Dias</p>
                    </div>
                    <div className="portal-card-inset p-3 text-center">
                      <p className="text-xl font-black text-warning">{myStats.overall.weekendDays}</p>
                      <p className="text-[8px] font-bold text-muted-foreground/50 uppercase">FDS</p>
                    </div>
                    <div className="portal-card-inset p-3 text-center">
                      <p className={cn("text-xl font-black", myStats.overall.creditsBalance >= 0 ? "text-accent" : "text-destructive")}>{myStats.overall.creditsBalance}</p>
                      <p className="text-[8px] font-bold text-muted-foreground/50 uppercase">Créditos</p>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="portal-card-inset divide-y divide-border/30">
                    {[
                      { icon: Mail, label: 'E-mail', value: professionalUser.email },
                      { icon: Shield, label: 'Status', value: 'Aprovado', cls: 'text-accent font-semibold' },
                      { icon: Clock, label: 'Atualizado', value: updatedLabel || 'Sem dados' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3.5 px-4 py-3.5">
                        <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <row.icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{row.label}</p>
                          <p className={cn("text-[13px] text-foreground truncate", row.cls)}>{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2.5">
                    {deferredPrompt && (
                      <button onClick={handleInstall} className="portal-press w-full h-12 rounded-2xl border border-border text-foreground font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
                        <Download className="h-4 w-4" /> Instalar Aplicativo
                      </button>
                    )}
                    <button onClick={logout}
                      className="portal-press w-full h-12 rounded-2xl border border-destructive/15 text-destructive font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors">
                      <LogOut className="h-4 w-4" /> Sair da Conta
                    </button>
                  </div>

                  <p className="text-center text-[9px] text-muted-foreground/30 uppercase tracking-[0.15em] font-bold pt-2 pb-1">© 2025 Secretaria Municipal de Saúde</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} leaveCount={leaveRequests.filter(r => r.status === 'pending').length} />
    </div>
  );
}
