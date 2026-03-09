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
  CalendarOff,
  Shield,
  Sparkles,
  Sun,
  Moon,
  Mail,
  CalendarDays,
  Award,
  Heart,
  Zap,
  Star,
  Activity,
  FileText,
  ArrowRight,
  CircleDot,
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
interface EmultScheduleEntry {
  id: string; professionalId: string; unitId: string; dayOfWeek: string; period: string;
}
interface EmultUnit {
  id: string; name: string; type?: string; active: boolean;
}
interface EmultProfessional {
  id: string; name: string; functionId: string; team: string; weeklyHours: number; active: boolean;
}
interface EmultFunction {
  id: string; name: string; color: string;
}
interface EmultData {
  professionals: EmultProfessional[];
  units: EmultUnit[];
  functions: EmultFunction[];
  schedule: EmultScheduleEntry[];
  teamId: string | null;
}
interface PortalData {
  publishedAt: string; adminName?: string;
  service: { professionals: ServiceProfessionalPortal[]; nurseEntries: ServiceScheduleEntry[]; techEntries: ServiceScheduleEntry[]; leaveRequests?: LeaveRequest[]; };
  emult?: EmultData;
}
type PortalTab = 'schedule' | 'credits' | 'leaves' | 'profile';

// ─── Greeting helper ───
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Bom dia', icon: Sun, emoji: '☀️' };
  if (h < 18) return { text: 'Boa tarde', icon: Sun, emoji: '🌤️' };
  return { text: 'Boa noite', icon: Moon, emoji: '🌙' };
}

// ─── Glassmorphism Card ───
function GlassCard({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(
      "rounded-3xl border border-border/30 bg-card/80 backdrop-blur-xl shadow-[0_2px_16px_-4px_hsl(var(--foreground)/0.06)]",
      className
    )} {...props}>
      {children}
    </div>
  );
}

// ─── Stat Pill ───
function StatPill({ icon: Icon, value, label, color = 'text-primary', iconBg = 'bg-primary/10' }: {
  icon: typeof Calendar; value: string | number; label: string; color?: string; iconBg?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/20 shadow-sm">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div>
        <p className={cn("text-lg font-black leading-none", color)}>{value}</p>
        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Credit Ring SVG ───
function CreditRing({ balance, total }: { balance: number; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.max(0, Math.min(1, balance / total)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" strokeLinecap="round" />
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
          "text-4xl font-black leading-none tracking-tight",
          balance > 0 ? "text-accent" : balance < 0 ? "text-destructive" : "text-muted-foreground"
        )}>{balance}</span>
        <span className="text-[11px] font-bold text-muted-foreground/60 mt-1 uppercase tracking-wider">dias</span>
      </div>
    </div>
  );
}

// ─── Primary Action Button ───
function ActionButton({ children, onClick, disabled, variant = 'primary', icon: Icon, className }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'outline' | 'danger';
  icon?: typeof Plus; className?: string;
}) {
  const base = "portal-press w-full h-[52px] rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2.5 transition-all disabled:opacity-30 relative overflow-hidden";
  const variants = {
    primary: "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 active:shadow-md",
    outline: "border-2 border-border text-foreground hover:bg-muted/50",
    danger: "border-2 border-destructive/20 text-destructive hover:bg-destructive/5",
  };

  return (
    <button onClick={onClick} disabled={disabled} className={cn(base, variants[variant], className)}>
      {variant === 'primary' && <div className="absolute inset-0 bg-gradient-to-r from-primary-foreground/8 to-transparent" />}
      {Icon && <Icon className="h-5 w-5 relative z-10" />}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

// ─── Login Screen ───
function GoogleLoginScreen({ onLogin, loading, onInstall, showInstall }: { onLogin: () => void; loading: boolean; onInstall: () => void; showInstall: boolean; }) {
  return (
    <div className="portal-native min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, hsl(var(--primary)/0.08) 0%, hsl(var(--background)) 35%, hsl(var(--accent)/0.05) 100%)' }}>
      {/* Decorative blobs */}
      <div className="absolute top-20 -left-20 w-60 h-60 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-32 -right-16 w-48 h-48 rounded-full bg-accent/5 blur-3xl" />

      <div className="w-full max-w-xs space-y-10 relative z-10">
        <div className="text-center space-y-5">
          <div className="w-20 h-20 rounded-[22px] bg-primary flex items-center justify-center mx-auto shadow-xl shadow-primary/25 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/15 to-transparent" />
            <img src="/logo-saude-plus.png" alt="Saúde+" className="h-11 w-auto brightness-0 invert relative z-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <Stethoscope className="h-9 w-9 text-primary-foreground absolute opacity-10" />
          </div>
          <div>
            <h1 className="text-[24px] font-black tracking-tight text-foreground leading-tight">
              Portal do<br />Profissional
            </h1>
            <p className="text-[13px] text-muted-foreground mt-2 font-medium">Saúde+ · Gestão de Escalas</p>
          </div>
        </div>

        <GlassCard className="p-6 space-y-4">
          <p className="text-center text-[13px] text-muted-foreground font-medium">
            Acesse com sua conta institucional
          </p>
          <ActionButton onClick={onLogin} disabled={loading} icon={loading ? Loader2 : Chrome}>
            Entrar com Google
          </ActionButton>
          {showInstall && (
            <ActionButton onClick={onInstall} variant="outline" icon={Download}>
              Instalar no celular
            </ActionButton>
          )}
        </GlassCard>

        <p className="text-[10px] text-center text-muted-foreground/40 leading-relaxed font-medium">
          Acesso exclusivo para profissionais<br />da Secretaria Municipal de Saúde
        </p>
      </div>
    </div>
  );
}

// ─── Registration Screen ───
function RegistrationScreen({ onRegister, teamId, userEmail, userName }: { onRegister: (t: string, c: string, n: string, fn?: string) => void; teamId: string | null; userEmail: string; userName: string; }) {
  const [fullName, setFullName] = useState(userName || '');
  const [category, setCategory] = useState('');
  const [functionName, setFunctionName] = useState('');

  const emultFunctions = [
    'Psicólogo(a)', 'Fisioterapeuta', 'Nutricionista', 'Assistente Social',
    'Educador(a) Físico', 'Fonoaudiólogo(a)', 'Terapeuta Ocupacional', 'Farmacêutico(a)',
  ];

  if (!teamId) {
    return (
      <div className="portal-native min-h-screen flex items-center justify-center bg-background px-6">
        <GlassCard className="p-8 text-center space-y-3 max-w-xs w-full">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto"><AlertCircle className="h-7 w-7 text-destructive" /></div>
          <h2 className="text-[17px] font-black">Link inválido</h2>
          <p className="text-[13px] text-muted-foreground">Solicite o link correto ao seu administrador.</p>
        </GlassCard>
      </div>
    );
  }

  const categories = [
    { value: 'nurse', label: 'Enfermeiro(a)', icon: Stethoscope, desc: 'Escala de enfermagem', gradient: 'from-primary/10 to-primary/5' },
    { value: 'tech', label: 'Técnico(a)', icon: Syringe, desc: 'Escala técnica', gradient: 'from-accent/10 to-accent/5' },
    { value: 'emult', label: 'eMult', icon: Users, desc: 'Equipe multiprofissional', gradient: 'from-warning/10 to-warning/5' },
  ];

  const isEmult = category === 'emult';
  const canSubmit = category && fullName.trim() && (!isEmult || functionName);

  return (
    <div className="portal-native min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs space-y-5">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mx-auto">
            <User className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-[20px] font-black">Criar sua conta</h2>
          <p className="text-[12px] text-muted-foreground font-medium">Complete o cadastro para acessar o portal</p>
        </div>

        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-muted/40 text-[11px] text-muted-foreground font-medium">
            <Mail className="w-3.5 h-3.5 shrink-0 text-primary/60" /> <span className="truncate">{userEmail}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome completo</Label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome"
              className="flex h-12 w-full rounded-2xl border-2 border-input bg-background px-4 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-all" />
          </div>

          <div className="space-y-2.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sua categoria</Label>
            <div className="grid gap-2.5">
              {categories.map(cat => (
                <button key={cat.value} onClick={() => { setCategory(cat.value); if (cat.value !== 'emult') setFunctionName(''); }}
                  className={cn(
                    "portal-press flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all text-left",
                    category === cat.value
                      ? "border-primary bg-gradient-to-r from-primary/8 to-transparent shadow-md shadow-primary/10"
                      : "border-border/40 hover:border-border hover:bg-muted/20"
                  )}>
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all",
                    category === cat.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : `bg-gradient-to-br ${cat.gradient} text-muted-foreground`
                  )}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-foreground">{cat.label}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{cat.desc}</p>
                  </div>
                  {category === cat.value && (
                    <CheckCircle2 className="w-5 h-5 text-primary ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de função/profissão para eMult */}
          {isEmult && (
            <div className="space-y-2.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sua profissão</Label>
              <div className="grid grid-cols-2 gap-2">
                {emultFunctions.map(fn => (
                  <button key={fn} onClick={() => setFunctionName(fn)}
                    className={cn(
                      "portal-press px-3 py-2.5 rounded-xl border-2 text-[12px] font-semibold transition-all text-left",
                      functionName === fn
                        ? "border-primary bg-primary/8 text-primary shadow-sm"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                    )}>
                    {fn}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ActionButton onClick={() => onRegister(teamId, category, fullName.trim(), isEmult ? functionName : undefined)} disabled={!canSubmit}>
            Solicitar Acesso
          </ActionButton>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Pending Screen ───
function PendingScreen({ onLogout, status }: { onLogout: () => void; status: string }) {
  return (
    <div className="portal-native min-h-screen flex items-center justify-center bg-background px-6">
      <GlassCard className="p-8 text-center space-y-5 max-w-xs w-full">
        {status === 'pending' ? (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-warning/15 to-warning/5 flex items-center justify-center mx-auto">
              <HourglassIcon className="h-8 w-8 text-warning animate-pulse" />
            </div>
            <div>
              <h2 className="text-[18px] font-black">Aguardando Aprovação</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-2">Sua solicitação foi enviada com sucesso.<br />Você será notificado após a análise.</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-destructive/15 to-destructive/5 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-[18px] font-black">Acesso Negado</h2>
              <p className="text-[13px] text-muted-foreground">Entre em contato com a coordenação.</p>
            </div>
          </>
        )}
        <button onClick={onLogout} className="portal-press text-[13px] text-muted-foreground font-semibold flex items-center gap-1.5 mx-auto hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </GlassCard>
    </div>
  );
}

// ─── Bottom Nav ───
function BottomNav({ active, onChange, leaveCount, isEmult }: { active: PortalTab; onChange: (t: PortalTab) => void; leaveCount: number; isEmult?: boolean }) {
  const allTabs: { id: PortalTab; icon: typeof Calendar; label: string }[] = [
    { id: 'schedule', icon: CalendarDays, label: 'Escala' },
    { id: 'credits', icon: Zap, label: 'Créditos' },
    { id: 'leaves', icon: FileText, label: 'Folgas' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  // eMult only sees Schedule + Profile
  const tabs = isEmult ? allTabs.filter(t => t.id === 'schedule' || t.id === 'profile') : allTabs;
  const cols = tabs.length;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/20 safe-area-bottom"
      style={{ background: 'hsl(var(--card) / 0.92)', backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)' }}>
      <div className={`grid max-w-lg mx-auto h-[60px]`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)}
              className={cn("portal-press flex flex-col items-center justify-center gap-[2px] relative transition-all", isActive ? "text-primary" : "text-muted-foreground/60")}>
              {isActive && <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-12 h-[3px] bg-primary rounded-full shadow-sm shadow-primary/30" />}
              <div className={cn("relative w-9 h-9 rounded-xl flex items-center justify-center transition-all", isActive && "bg-primary/10")}>
                <Icon className={cn("h-[20px] w-[20px] transition-all", isActive && "drop-shadow-sm")} strokeWidth={isActive ? 2.5 : 1.8} />
                {tab.id === 'leaves' && leaveCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center px-0.5 shadow-sm">{leaveCount}</span>
                )}
              </div>
              <span className={cn("text-[10px] transition-all", isActive ? "font-bold" : "font-medium")}>{tab.label}</span>
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
      if (data) setPortalData({
        publishedAt: data.published_at,
        adminName: data.admin_name || undefined,
        service: data.service_data as unknown as PortalData['service'],
        emult: data.emult_data as unknown as EmultData | undefined,
      });
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
  const isEmultUser = professionalUser.category === 'emult';
  const categoryLabel = isEmultUser ? (professionalUser as any).function_name || 'eMult' : professionalUser.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)';
  const CategoryIcon = professionalUser.category === 'nurse' ? Stethoscope : professionalUser.category === 'tech' ? Syringe : Users;
  const updatedLabel = portalData ? format(parseISO(portalData.publishedAt), "dd/MM 'às' HH:mm", { locale: ptBR }) : '';

  // eMult schedule data
  const emultData = portalData?.emult;
  const DAYS_LABELS: Record<string, string> = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta' };
  const PERIOD_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' };

  // Find eMult professional by name match
  const myEmultProfessional = useMemo(() => {
    if (!isEmultUser || !emultData?.professionals) return null;
    const name = professionalUser.full_name.toLowerCase().trim();
    return emultData.professionals.find(p =>
      p.name.toLowerCase().trim() === name
    ) || null;
  }, [isEmultUser, emultData, professionalUser]);

  const myEmultSchedule = useMemo(() => {
    if (!myEmultProfessional || !emultData?.schedule) return [];
    return emultData.schedule.filter(s => s.professionalId === myEmultProfessional.id);
  }, [myEmultProfessional, emultData]);

  const getEmultUnit = (unitId: string) => emultData?.units?.find(u => u.id === unitId);
  const getEmultFunction = (funcId: string) => emultData?.functions?.find(f => f.id === funcId);

  const statusBadge = (status: string) => {
    if (status === 'approved') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent shadow-sm">
        <CheckCircle2 className="w-3 h-3" />Aprovado
      </span>
    );
    if (status === 'rejected') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive shadow-sm">
        <XCircle className="w-3 h-3" />Rejeitado
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-warning/10 text-warning shadow-sm animate-pulse">
        <Clock className="w-3 h-3" />Pendente
      </span>
    );
  };

  return (
    <div className="portal-native min-h-screen bg-background flex flex-col">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-40 border-b border-border/15"
        style={{ background: 'hsl(var(--card) / 0.85)', backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)' }}>
        <div className="px-5 max-w-lg mx-auto h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <button onClick={() => setActiveTab('profile')} className="portal-press shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 ring-2 ring-primary/20 flex items-center justify-center shadow-sm">
                {professionalUser.avatar_url
                  ? <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[14px] font-black text-primary">{firstName[0]}</span>}
              </div>
            </button>
            <div className="min-w-0">
              <p className="text-[15px] font-black text-foreground leading-tight truncate">{greeting.text}, {firstName} {greeting.emoji}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/8 text-primary text-[9px] font-bold">
                  <CategoryIcon className="w-2.5 h-2.5" />{categoryLabel}
                </span>
              </div>
            </div>
          </div>
          <button onClick={() => { fetchPortalData(); refreshLeaveRequests(); }} disabled={loadingPortal}
            className="portal-press w-10 h-10 rounded-xl flex items-center justify-center bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all">
            <RefreshCw className={cn("h-[18px] w-[18px]", loadingPortal && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-[80px]">
        <div className="max-w-lg mx-auto px-5 py-5">
          {loadingPortal ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full rounded-3xl" />
              <div className="grid grid-cols-3 gap-3"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div>
              <Skeleton className="h-64 w-full rounded-3xl" />
            </div>
          ) : (
            <div key={activeTab} className="portal-page-enter">

              {/* ════════ SCHEDULE ════════ */}
              {activeTab === 'schedule' && (
                <div className="space-y-5">
                  {/* Hero stats card */}
                  <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(210 90% 40%) 100%)' }}>
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary-foreground/5 -translate-y-12 translate-x-12" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-primary-foreground/3 translate-y-8 -translate-x-4" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-primary-foreground/70" />
                        <p className="text-primary-foreground/70 text-[10px] font-bold uppercase tracking-[0.15em]">Resumo geral</p>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-primary-foreground text-[42px] font-black leading-none tracking-tight">{myStats.overall.workedDays}</p>
                          <p className="text-primary-foreground/60 text-[13px] font-semibold mt-1">dias escalados</p>
                        </div>
                        <div className="text-right space-y-2">
                          <div className="inline-flex items-center gap-1.5 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <Sun className="w-3.5 h-3.5 text-primary-foreground/80" />
                            <span className="text-primary-foreground text-[13px] font-bold">{myStats.overall.weekendDays}</span>
                            <span className="text-primary-foreground/60 text-[10px] font-semibold">FDS</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <Zap className="w-3.5 h-3.5 text-primary-foreground/80" />
                            <span className="text-primary-foreground text-[13px] font-bold">{myStats.overall.creditsBalance}</span>
                            <span className="text-primary-foreground/60 text-[10px] font-semibold">créd</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Month nav */}
                  <div className="flex items-center justify-between px-1">
                    <button onClick={prevMonth} className="portal-press w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-[16px] font-black capitalize text-foreground tracking-tight">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                    <button onClick={nextMonth} className="portal-press w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Calendar */}
                  <GlassCard className="overflow-hidden">
                    <div className="grid grid-cols-7 text-center border-b border-border/20">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={i} className="py-3 text-[10px] font-bold text-muted-foreground/40 uppercase">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 p-1.5 gap-0.5">
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
                            <div key={ds} className="aspect-square flex flex-col items-center justify-center relative p-0.5">
                              <span className={cn(
                                "text-[13px] font-semibold w-[36px] h-[36px] flex items-center justify-center rounded-xl transition-all",
                                isToday && "bg-primary text-primary-foreground font-black shadow-md shadow-primary/25 ring-2 ring-primary/20",
                                hasWork && !isToday && !hasLeave && !isWknd && "bg-accent/12 text-accent font-bold",
                                hasWork && !isToday && !hasLeave && isWknd && "bg-warning/12 text-warning font-bold",
                                hasLeave && !isToday && "bg-destructive/10 text-destructive",
                                !isToday && !hasWork && !hasLeave && isWknd && "text-muted-foreground/30",
                                !isToday && !hasWork && !hasLeave && !isWknd && "text-foreground/70",
                              )}>
                                {format(day, 'd')}
                              </span>
                              {hasWork && !isToday && (
                                <div className={cn(
                                  "absolute bottom-1 w-1 h-1 rounded-full",
                                  isWknd ? "bg-warning" : "bg-accent"
                                )} />
                              )}
                            </div>
                          );
                        });
                        return [...blanks, ...cells];
                      })()}
                    </div>
                  </GlassCard>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-5 text-[10px] font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5"><CircleDot className="w-3 h-3 text-accent" />Dia útil</span>
                    <span className="flex items-center gap-1.5"><CircleDot className="w-3 h-3 text-warning" />FDS</span>
                    <span className="flex items-center gap-1.5"><CircleDot className="w-3 h-3 text-destructive" />Folga</span>
                  </div>

                  {/* Month stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: myStats.month.workedDays, label: 'Escalas', icon: CalendarDays, color: 'text-primary', iconBg: 'bg-primary/10' },
                      { value: myStats.month.weekendDays, label: 'FDS', icon: Sun, color: 'text-warning', iconBg: 'bg-warning/10' },
                      { value: myStats.month.creditsBalance, label: 'Créditos', icon: Zap, color: myStats.month.creditsBalance >= 0 ? 'text-accent' : 'text-destructive', iconBg: myStats.month.creditsBalance >= 0 ? 'bg-accent/10' : 'bg-destructive/10' },
                    ].map((s, i) => (
                      <GlassCard key={i} className="p-3.5 flex flex-col items-center gap-1.5">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.iconBg)}>
                          <s.icon className={cn("w-4 h-4", s.color)} />
                        </div>
                        <p className={cn("text-xl font-black leading-none", s.color)}>{s.value}</p>
                        <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wider">{s.label}</p>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════ CREDITS ════════ */}
              {activeTab === 'credits' && (
                <div className="space-y-5">
                  <GlassCard className="p-7 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                      <Zap className="w-3 h-3" /> Saldo de Créditos
                    </div>
                    <CreditRing balance={myStats.overall.creditsBalance} total={Math.max(myStats.overall.creditsGenerated, 1)} />
                    <p className="text-[13px] text-muted-foreground font-medium mt-3">dias disponíveis para folga</p>
                  </GlassCard>

                  <div className="grid grid-cols-2 gap-3">
                    <GlassCard className="p-5 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center mx-auto mb-2.5">
                        <TrendingUp className="w-6 h-6 text-accent" />
                      </div>
                      <p className="text-3xl font-black text-accent">{myStats.overall.creditsGenerated}</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase mt-1 tracking-wider">Gerados</p>
                    </GlassCard>
                    <GlassCard className="p-5 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-destructive/15 to-destructive/5 flex items-center justify-center mx-auto mb-2.5">
                        <TrendingDown className="w-6 h-6 text-destructive" />
                      </div>
                      <p className="text-3xl font-black text-destructive">{myStats.overall.creditsUsed}</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase mt-1 tracking-wider">Utilizados</p>
                    </GlassCard>
                  </div>

                  <GlassCard className="overflow-hidden">
                    <div className="px-5 py-3.5 bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] capitalize flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </div>
                    {[
                      { label: 'Créditos gerados', value: `+${myStats.month.creditsGenerated}`, color: 'text-accent', icon: TrendingUp },
                      { label: 'Créditos utilizados', value: `-${myStats.month.creditsUsed}`, color: 'text-destructive', icon: TrendingDown },
                      { label: 'Saldo do mês', value: `${myStats.month.creditsBalance}`, color: myStats.month.creditsBalance >= 0 ? 'text-accent' : 'text-destructive', icon: Star, bold: true },
                    ].map((row, i) => (
                      <div key={i} className="px-5 py-3.5 flex items-center justify-between border-t border-border/20">
                        <div className="flex items-center gap-2.5">
                          <row.icon className={cn("w-4 h-4", row.color, "opacity-60")} />
                          <span className={cn("text-[13px]", row.bold ? "font-bold text-foreground" : "text-muted-foreground font-medium")}>{row.label}</span>
                        </div>
                        <span className={cn("text-[14px] font-black", row.color)}>{row.value}</span>
                      </div>
                    ))}
                  </GlassCard>

                  <div className="flex items-start gap-3 px-2 py-3 rounded-2xl bg-primary/5 border border-primary/10">
                    <Sparkles className="w-5 h-5 text-primary/40 shrink-0 mt-px" />
                    <p className="text-[12px] text-muted-foreground leading-relaxed">Cada final de semana trabalhado gera <strong className="text-foreground">2 créditos</strong> automaticamente.</p>
                  </div>
                </div>
              )}

              {/* ════════ LEAVES ════════ */}
              {activeTab === 'leaves' && (
                <div className="space-y-4">
                  <ActionButton onClick={() => setLeaveDialogOpen(true)} icon={Plus}>
                    Nova Solicitação
                  </ActionButton>

                  <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                    <DialogContent className="rounded-3xl max-w-[380px] mx-auto p-6">
                      <DialogHeader><DialogTitle className="text-[18px] font-black">Nova Solicitação</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/10">
                          <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-[11px] text-foreground/70 leading-relaxed font-medium">Solicite com mínimo <strong>10 dias de antecedência</strong>. Imprevistos serão analisados pela coordenação.</p>
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo de afastamento</Label>
                          <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm(p => ({ ...p, leaveType: v as LeaveType }))}>
                            <SelectTrigger className="h-12 rounded-2xl text-[13px] font-medium border-2"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                            <SelectContent>{Object.entries(LEAVE_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                          </Select>
                          {leaveForm.leaveType === 'folga_credito' && (
                            <p className="text-[11px] text-accent mt-1.5 font-bold flex items-center gap-1">
                              <Zap className="w-3 h-3" />Saldo disponível: {myStats.overall.creditsBalance} dias
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Início</Label>
                            <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm(p => ({ ...p, startDate: e.target.value }))}
                              className="flex h-12 w-full rounded-2xl border-2 border-input bg-background px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fim</Label>
                            <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm(p => ({ ...p, endDate: e.target.value }))}
                              className="flex h-12 w-full rounded-2xl border-2 border-input bg-background px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
                          </div>
                        </div>
                        {daysRequested > 0 && (
                          <div className="text-center">
                            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 text-primary text-[14px] font-black shadow-sm">
                              <CalendarDays className="w-4 h-4" />
                              {daysRequested} {daysRequested === 1 ? 'dia' : 'dias'}
                            </span>
                          </div>
                        )}
                        <div>
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Observações (opcional)</Label>
                          <Textarea value={leaveForm.observations} onChange={(e) => setLeaveForm(p => ({ ...p, observations: e.target.value }))} placeholder="Motivo ou detalhes..." className="rounded-2xl resize-none text-[13px] border-2 font-medium" rows={2} />
                        </div>
                        {isShortNotice && leaveForm.startDate && (
                          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-warning/8 border border-warning/15">
                            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-[11px] text-foreground/70 font-medium"><strong>Prazo inferior ao recomendado.</strong> Sujeito à análise da coordenação.</p>
                          </div>
                        )}
                        <ActionButton onClick={handleSubmitLeave} disabled={!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || daysRequested < 1} icon={ArrowRight}>
                          {isShortNotice ? 'Enviar Mesmo Assim' : 'Enviar Solicitação'}
                        </ActionButton>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* List */}
                  {leaveRequests.length === 0 ? (
                    <GlassCard className="py-14 px-6 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 flex items-center justify-center mx-auto mb-4">
                        <CalendarOff className="w-7 h-7 text-muted-foreground/30" />
                      </div>
                      <p className="text-[15px] font-bold text-muted-foreground">Sem solicitações</p>
                      <p className="text-[12px] text-muted-foreground/50 mt-1.5 font-medium">Toque em "Nova Solicitação" para pedir folga</p>
                    </GlassCard>
                  ) : (
                    <div className="space-y-3">
                      {leaveRequests.map(req => (
                        <GlassCard key={req.id} className="p-4.5 hover:shadow-md transition-shadow">
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-[14px] text-foreground truncate">{LEAVE_TYPE_LABELS[req.leave_type as LeaveType] || req.leave_type}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium bg-muted/40 px-2.5 py-1 rounded-full">
                                    <CalendarDays className="w-3 h-3 shrink-0" />
                                    {format(new Date(req.start_date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                                    {req.end_date !== req.start_date && <> → {format(new Date(req.end_date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}</>}
                                  </div>
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/8 text-primary text-[11px] font-bold">
                                    {req.days_requested}d
                                  </span>
                                </div>
                              </div>
                              {statusBadge(req.status)}
                            </div>
                            {req.observations && (
                              <p className="text-[11px] text-muted-foreground/60 italic mt-3 pt-3 border-t border-border/15 font-medium">"{req.observations}"</p>
                            )}
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════════ PROFILE ════════ */}
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  {/* Hero card */}
                  <GlassCard className="overflow-hidden">
                    <div className="h-24 relative" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(210 90% 40%) 100%)' }}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,hsl(var(--primary-foreground)/0.1),transparent_60%)]" />
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent" />
                    </div>
                    <div className="px-5 pb-6 -mt-12 relative z-10 flex flex-col items-center">
                      <div className="relative mb-3">
                        <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-card ring-4 ring-card flex items-center justify-center shadow-xl">
                          {professionalUser.avatar_url
                            ? <img src={professionalUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <span className="text-3xl font-black text-primary">{firstName[0]}</span>}
                        </div>
                        <button onClick={handleAvatarUpload} disabled={avatarUploading}
                          className="portal-press absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-3 ring-card transition-transform hover:scale-110">
                          {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <h2 className="text-[18px] font-black text-foreground mt-1">{myProfessional?.name || professionalUser.full_name}</h2>
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-[11px] font-bold">
                        <CategoryIcon className="w-3.5 h-3.5" /> {categoryLabel}
                      </div>
                    </div>
                  </GlassCard>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: myStats.overall.workedDays, label: 'Dias', color: 'text-primary', icon: CalendarDays, iconBg: 'bg-primary/10' },
                      { value: myStats.overall.weekendDays, label: 'FDS', color: 'text-warning', icon: Sun, iconBg: 'bg-warning/10' },
                      { value: myStats.overall.creditsBalance, label: 'Créditos', color: myStats.overall.creditsBalance >= 0 ? 'text-accent' : 'text-destructive', icon: Zap, iconBg: myStats.overall.creditsBalance >= 0 ? 'bg-accent/10' : 'bg-destructive/10' },
                    ].map((s, i) => (
                      <GlassCard key={i} className="p-3.5 text-center">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5", s.iconBg)}>
                          <s.icon className={cn("w-4 h-4", s.color)} />
                        </div>
                        <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
                        <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-wider">{s.label}</p>
                      </GlassCard>
                    ))}
                  </div>

                  {/* Info rows */}
                  <GlassCard className="divide-y divide-border/20">
                    {[
                      { icon: Mail, label: 'E-mail', value: professionalUser.email, iconColor: 'text-primary', iconBg: 'bg-primary/10' },
                      { icon: Shield, label: 'Status', value: 'Aprovado', cls: 'text-accent font-bold', iconColor: 'text-accent', iconBg: 'bg-accent/10' },
                      { icon: Clock, label: 'Atualizado', value: updatedLabel || 'Sem dados', iconColor: 'text-muted-foreground', iconBg: 'bg-muted/60' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3.5 px-5 py-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", row.iconBg)}>
                          <row.icon className={cn("w-4.5 h-4.5", row.iconColor)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">{row.label}</p>
                          <p className={cn("text-[13px] text-foreground truncate font-medium", row.cls)}>{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </GlassCard>

                  {/* Actions */}
                  <div className="space-y-3">
                    {deferredPrompt && (
                      <ActionButton onClick={handleInstall} variant="outline" icon={Download}>
                        Instalar Aplicativo
                      </ActionButton>
                    )}
                    <ActionButton onClick={logout} variant="danger" icon={LogOut}>
                      Sair da Conta
                    </ActionButton>
                  </div>

                  <p className="text-center text-[9px] text-muted-foreground/25 uppercase tracking-[0.2em] font-bold pt-3 pb-1">
                    © 2025 Secretaria Municipal de Saúde
                  </p>
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
