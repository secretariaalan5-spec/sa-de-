import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  CalendarDays,
  CalendarOff,
  Wallet,
  Camera,
  LogOut,
  RefreshCw,
  Building2,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Info,
  Smartphone,
  Download,
  HelpCircle,
  QrCode,
  BookOpen,
  SlidersHorizontal,
  History,
  PlusCircle,
  MinusCircle,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Bell,
  MapPin,
  Home,
  FileText,
} from 'lucide-react';
import PortalTermsDialog from '@/components/portal/PortalTermsDialog';
import { compressAvatarImage } from '@/lib/imageCompressor';
import logoSaude from '@/assets/logo-saude.png';
import { toast } from 'sonner';

interface DashboardData {
  profile: {
    id: string;
    name: string;
    avatar_url: string | null;
    category_name: string;
    unit_name: string;
    terms_accepted_at: string | null;
    needs_terms: boolean;
  };
  summary: {
    shifts: number;
    manual: number;
    used: number;
    balance: number;
  };
  schedules: Array<{
    id: string;
    date: string;
    type: string;
    shift_type: string | null;
    unit_name: string;
    observations: string | null;
    credit_amount: number | null;
  }>;
  leaves: Array<{
    id: string;
    status: string;
    days_requested: number;
    leave_dates: string[];
    observations: string | null;
    created_at: string;
    decided_at: string | null;
  }>;
  credits: Array<{
    id: string;
    amount: number;
    origin: string;
    notes: string | null;
    created_at: string;
  }>;
}

const fmtCredit = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ','));

const fmtDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
};

const fmtDateExtenso = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const weekday = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  } catch {
    return '';
  }
};

export default function ProfessionalPortal() {
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return localStorage.getItem('saude_portal_token');
  });

  // Estado de Login com Código (captura automático se vier de QR Code)
  const [inputCode, setInputCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('codigo') || '';
    }
    return '';
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Estados de Navegação e Filtros Estilo App Nativo
  const [activeTab, setActiveTab] = useState<'schedules' | 'leaves' | 'credits' | 'help'>('schedules');
  const [creditFilter, setCreditFilter] = useState<'all' | 'shifts' | 'manual' | 'used'>('all');
  const [leaveFilter, setLeaveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capturar evento de instalação PWA (Add to Home Screen)
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      toast.success('Aplicativo instalado com sucesso!');
    }
    setDeferredPrompt(null);
  };

  // Busca os dados do painel com o token de sessão
  const loadDashboard = useCallback(async (token: string) => {
    setDataLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('portal_get_dashboard_data', {
        p_token: token,
      });

      if (error) throw error;
      if (!res || !res.ok) {
        // Sessão expirada ou inválida
        localStorage.removeItem('saude_portal_token');
        setSessionToken(null);
        setData(null);
        toast.error('Sessão expirada. Digite seu código de acesso novamente.');
        return;
      }

      setData(res);
      if (res.profile?.needs_terms) {
        setTermsOpen(true);
      }
    } catch (err: any) {
      toast.error('Erro ao carregar seus dados: ' + (err.message || ''));
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Efeito inicial para restaurar sessão existente
  useEffect(() => {
    if (sessionToken) {
      loadDashboard(sessionToken);
    }
  }, [sessionToken, loadDashboard]);

  // Realtime: escuta atualizações para manter escalas e folgas sempre sincronizadas
  useEffect(() => {
    if (!data?.profile?.id) return;
    const empId = data.profile.id;

    const channel = supabase
      .channel(`portal-employee-${empId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests', filter: `employee_id=eq.${empId}` },
        () => {
          if (sessionToken) loadDashboard(sessionToken);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `employee_id=eq.${empId}` },
        () => {
          if (sessionToken) loadDashboard(sessionToken);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_credits', filter: `employee_id=eq.${empId}` },
        () => {
          if (sessionToken) loadDashboard(sessionToken);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.profile?.id, sessionToken, loadDashboard]);

  // Manipulador de Login por Código de 3 Dígitos
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.replace(/\D/g, '').slice(0, 3);
    if (clean.length !== 3) {
      toast.error('Digite o código de 3 dígitos completo.');
      return;
    }

    setLoginLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('portal_login', {
        p_code: clean,
        p_user_agent: navigator.userAgent,
      });

      if (error) throw error;
      if (!res.ok) {
        if (res.reason === 'rate_limited') {
          toast.error('Muitas tentativas incorretas. Aguarde alguns minutos antes de tentar novamente.');
        } else {
          toast.error('Código de acesso inválido. Verifique com a coordenação ou RH.');
        }
        return;
      }

      localStorage.setItem('saude_portal_token', res.token);
      setSessionToken(res.token);
      await loadDashboard(res.token);
      toast.success(`Bem-vindo(a), ${res.employee?.name?.split(' ')[0]}!`);
    } catch (err: any) {
      toast.error('Erro ao conectar ao portal: ' + (err.message || ''));
    } finally {
      setLoginLoading(false);
    }
  };

  // Aceite dos Termos de Uso (LGPD)
  const handleAcceptTerms = async (photoConsent: boolean) => {
    if (!sessionToken) return;
    setTermsLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('portal_accept_terms', {
        p_token: sessionToken,
        p_photo_consent: photoConsent,
        p_user_agent: navigator.userAgent,
      });

      if (error) throw error;
      if (!res.ok) throw new Error('Não foi possível registrar o aceite');

      setTermsOpen(false);
      toast.success('Termos de uso aceitos com sucesso!');
      await loadDashboard(sessionToken);
    } catch (err: any) {
      toast.error('Erro ao registrar aceite: ' + (err.message || ''));
    } finally {
      setTermsLoading(false);
    }
  };

  // Logout do Portal
  const handleLogout = async () => {
    if (sessionToken) {
      try {
        await supabase.rpc('portal_logout', { p_token: sessionToken });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('saude_portal_token');
    setSessionToken(null);
    setData(null);
    setInputCode('');
    toast.info('Sessão encerrada com sucesso.');
  };

  // Upload e Compressão de Foto de Perfil
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionToken || !data?.profile?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida (JPEG, PNG ou WebP).');
      return;
    }

    setUploadingAvatar(true);
    const toastId = toast.loading('Comprimindo e enviando sua foto...');

    try {
      // Comprime no celular para ~300x300px WebP de alta qualidade e leveza extrema
      const compressedBlob = await compressAvatarImage(file, 300, 0.85);

      const filePath = `portal/${data.profile.id}-${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedBlob, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = publicData.publicUrl;

      // Atualiza no banco através da RPC segura
      const { data: updateRes, error: updateError } = await supabase.rpc('portal_update_avatar', {
        p_token: sessionToken,
        p_avatar_url: avatarUrl,
      });

      if (updateError || !updateRes.ok) throw (updateError || new Error('Erro ao salvar URL da foto'));

      // Atualiza o estado local imediatamente
      setData((prev) => (prev ? { ...prev, profile: { ...prev.profile, avatar_url: avatarUrl } } : null));

      toast.success('Foto de perfil atualizada e sincronizada com o sistema!', { id: toastId });
    } catch (err: any) {
      toast.error('Erro ao enviar foto: ' + (err.message || ''), { id: toastId });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TELA DE LOGIN POR CÓDIGO (se não estiver autenticado)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!sessionToken || (!data && !dataLoading)) {
    const formattedInput = inputCode.replace(/\D/g, '').slice(0, 3);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-between p-4 sm:p-6 text-white font-sans antialiased selection:bg-primary selection:text-white">
        <div className="w-full max-w-sm mx-auto my-auto py-8">
          {/* Card Principal de Login */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            {/* Logo e Cabeçalho */}
            <div className="space-y-3">
              <div className="inline-flex p-2.5 rounded-2xl bg-white/10 border border-white/20 shadow-inner">
                <img src={logoSaude} alt="Saúde+ Oficial" className="w-16 h-16 object-contain rounded-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Portal do Profissional</h1>
                <p className="text-xs text-slate-300 mt-1">
                  Consulte suas escalas, plantões e saldo de folgas em tempo real
                </p>
              </div>
            </div>

            {/* Formulário de Código */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Código de Acesso (3 dígitos)</span>
                  <span className="text-[11px] text-primary-foreground/70 font-mono">ex: 042</span>
                </label>

                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={3}
                    placeholder="000"
                    value={formattedInput}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="w-full text-center tracking-[0.5em] font-mono text-4xl font-black h-16 rounded-2xl bg-black/40 border border-white/20 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loginLoading || formattedInput.length !== 3}
                className="w-full h-12 rounded-2xl font-bold text-sm bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Validando Acesso...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>

            {/* Orientação */}
            <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 space-y-1">
              <p>Não possui seu código? Solicite à chefia imediata ou ao RH da sua unidade.</p>
              <div className="inline-flex items-center gap-1 text-slate-400 font-medium">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Acesso seguro em modo de leitura</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé institucional */}
        <div className="text-center text-[10.5px] text-slate-400 pb-2">
          Saúde+ Gestão Integrada • Secretaria Municipal de Saúde
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PAINEL DO PROFISSIONAL (Autenticado)
  // ─────────────────────────────────────────────────────────────────────────────
  const profile = data?.profile;
  const summary = data?.summary || { shifts: 0, manual: 0, used: 0, balance: 0 };
  const schedules = data?.schedules || [];
  const leaves = data?.leaves || [];
  const credits = data?.credits || [];

  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const pastLeaves = leaves.filter((l) => l.status !== 'pending');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-foreground pb-8">
      {/* Modal de Aceite de Termos (LGPD) */}
      <PortalTermsDialog
        open={termsOpen}
        employeeName={profile?.name || ''}
        onAccept={handleAcceptTerms}
        loading={termsLoading}
      />

      {/* Input de arquivo invisível para a foto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Header Superior PWA Estilo Governo / Aplicativo */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-2xs px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center p-1.5 shadow-xs shrink-0">
              <img src={logoSaude} alt="Brasão / Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                Portal do Servidor
              </h1>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                {profile?.unit_name || 'SECRETARIA DE SAÚDE'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInstallable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleInstallPWA}
                className="h-8 gap-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30 rounded-lg px-2"
              >
                <Download size={13} />
                <span>Instalar</span>
              </Button>
            )}

            <button
              onClick={() => sessionToken && loadDashboard(sessionToken)}
              disabled={dataLoading}
              title="Atualizar dados"
              className="relative p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <Bell size={18} />
              {pendingLeaves.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>

            {/* Avatar no topo */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer relative"
              title="Clique para alterar foto"
            >
              <Avatar className="w-9 h-9 rounded-full border border-slate-200 shadow-2xs">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.name} />
                <AvatarFallback className="bg-blue-100 text-blue-900 font-bold text-xs">
                  {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'PS'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Card do Perfil do Servidor (Azul Profundo Governo com Avatar Redondo e Ícone de Câmera) */}
        <div className="rounded-2xl bg-gradient-to-r from-[#173059] via-[#1b3d75] to-[#143261] text-white p-4 shadow-md relative overflow-hidden flex items-center gap-3.5">
          <div className="relative shrink-0">
            <Avatar className="w-16 h-16 rounded-full border-2 border-white/30 bg-blue-100 shadow-inner">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.name} />
              <AvatarFallback className="bg-[#e2edff] text-[#1a365d] font-black text-xl rounded-full">
                {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'PS'}
              </AvatarFallback>
            </Avatar>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Alterar foto"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#3b82f6] text-white flex items-center justify-center shadow-md hover:bg-blue-600 transition-all active:scale-95 border-2 border-white"
            >
              {uploadingAvatar ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold tracking-tight uppercase truncate leading-tight text-white">
                {profile?.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40">
                Ativo
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider truncate">
              {profile?.category_name || 'Servidor(a)'}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium">
              <MapPin size={12} className="text-slate-300 shrink-0" />
              <span className="truncate uppercase">{profile?.unit_name || 'Lotação'}</span>
            </div>
          </div>
        </div>

        {/* Card Saldo Disponível de Folgas com as 3 Caixas Coloridas Suaves da Imagem */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <CalendarDays size={16} className="text-slate-500" />
              <span>Saldo disponível de folgas</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#2e7d32] text-white">
              {summary.balance > 0 ? `+${fmtCredit(summary.balance)} dias` : `${fmtCredit(summary.balance)} dias`}
            </span>
          </div>

          {/* As 3 Caixas com cantos arredondados e tons pastéis idênticos à imagem */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            {/* Box 1: Plantões (Azul Claro) */}
            <div className="p-3 rounded-2xl bg-[#dff1fd] border border-[#bce2fb] dark:bg-blue-950/40 dark:border-blue-900/60 flex flex-col justify-center">
              <div className="text-lg font-black text-[#0284c7] font-mono leading-none">
                +{fmtCredit(summary.shifts)}
              </div>
              <div className="text-[10px] font-bold text-[#0369a1] uppercase tracking-wider mt-1.5">
                Plantões
              </div>
            </div>

            {/* Box 2: Ajustes (Bege/Amarelo Claro) */}
            <div className="p-3 rounded-2xl bg-[#fef5d8] border border-[#fbe5a7] dark:bg-amber-950/40 dark:border-amber-900/60 flex flex-col justify-center">
              <div className="text-lg font-black text-[#b45309] font-mono leading-none">
                {summary.manual > 0 ? `+${fmtCredit(summary.manual)}` : fmtCredit(summary.manual)}
              </div>
              <div className="text-[10px] font-bold text-[#92400e] uppercase tracking-wider mt-1.5">
                Ajustes
              </div>
            </div>

            {/* Box 3: Usufruídas (Rosa/Vermelho Claro) */}
            <div className="p-3 rounded-2xl bg-[#fee4e4] border border-[#fccfcf] dark:bg-rose-950/40 dark:border-rose-900/60 flex flex-col justify-center">
              <div className="text-lg font-black text-[#e11d48] font-mono leading-none">
                -{fmtCredit(summary.used)}
              </div>
              <div className="text-[10px] font-bold text-[#be123c] uppercase tracking-wider mt-1.5">
                Usufruídas
              </div>
            </div>
          </div>
        </div>

        {/* Abas Superiores Idênticas à Referência */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-12 rounded-2xl bg-[#eef3f8] dark:bg-slate-800 p-1 border border-slate-200/60 dark:border-slate-700/60">
            <TabsTrigger
              value="schedules"
              className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#0284c7] data-[state=active]:shadow-xs transition-all text-slate-500 flex flex-col py-1 h-full"
            >
              <CalendarDays size={16} />
              <span className="text-[11px] leading-none">Escalas</span>
            </TabsTrigger>

            <TabsTrigger
              value="leaves"
              className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#0284c7] data-[state=active]:shadow-xs transition-all text-slate-500 flex flex-col py-1 h-full relative"
            >
              <FileText size={16} />
              <span className="text-[11px] leading-none">Folgas</span>
              {pendingLeaves.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-2" />
              )}
            </TabsTrigger>

            <TabsTrigger
              value="credits"
              className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#0284c7] data-[state=active]:shadow-xs transition-all text-slate-500 flex flex-col py-1 h-full"
            >
              <Sparkles size={16} />
              <span className="text-[11px] leading-none">Extrato</span>
            </TabsTrigger>

            <TabsTrigger
              value="help"
              className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#0284c7] data-[state=active]:shadow-xs transition-all text-slate-500 flex flex-col py-1 h-full"
            >
              <HelpCircle size={16} />
              <span className="text-[11px] leading-none">Ajuda</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: ESCALAS E PLANTÕES EXTRAS */}
          <TabsContent value="schedules" className="mt-3 space-y-2">
            {schedules.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground bg-white dark:bg-slate-900 rounded-2xl border border-border">
                <CalendarDays size={28} className="mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs font-medium">Nenhuma escala registrada no sistema.</p>
              </div>
            ) : (
              schedules.map((s) => {
                const isExtra = s.type === 'extra';
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl border border-border bg-white dark:bg-slate-900 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                        <span>{fmtDate(s.date)}</span>
                        <span className="text-xs text-muted-foreground font-normal">({weekday(s.date)})</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {s.shift_type === 'half' ? 'Meio Turno' : 'Integral'}
                        </Badge>
                        <Badge
                          className={
                            isExtra
                              ? 'bg-primary text-white text-[10px] font-bold'
                              : 'bg-muted text-muted-foreground text-[10px]'
                          }
                        >
                          {isExtra ? `Extra (+${fmtCredit(s.credit_amount ?? 1)})` : 'Normal'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 size={13} className="text-primary shrink-0" />
                      <span className="truncate">{s.unit_name}</span>
                    </div>

                    {s.observations && (
                      <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-border/60 text-foreground">
                        <strong className="text-foreground">Atividade: </strong>
                        <span>{s.observations}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* ABA 2: FOLGAS PENDENTES E HISTÓRICO */}
          <TabsContent value="leaves" className="mt-3 space-y-3">
            {/* Filtros Rápidos de Situação da Folga */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setLeaveFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  leaveFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
              >
                Todas ({leaves.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveFilter('pending')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  leaveFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                ⏳ Em Análise ({pendingLeaves.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveFilter('approved')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  leaveFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                ✓ Aprovadas ({leaves.filter((l) => l.status === 'approved').length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveFilter('rejected')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  leaveFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
                }`}
              >
                ✕ Indeferidas ({leaves.filter((l) => l.status === 'rejected').length})
              </button>
            </div>

            {/* Listagem de Folgas */}
            {(() => {
              const filteredLeaves = leaves.filter((l) => {
                if (leaveFilter === 'pending') return l.status === 'pending';
                if (leaveFilter === 'approved') return l.status === 'approved';
                if (leaveFilter === 'rejected') return l.status === 'rejected';
                return true;
              });

              if (filteredLeaves.length === 0) {
                return (
                  <div className="p-8 text-center text-muted-foreground bg-white dark:bg-slate-900 rounded-2xl border border-border">
                    <CalendarOff size={28} className="mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs font-medium">Nenhum pedido de folga neste filtro.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {filteredLeaves.map((l) => {
                    const isPending = l.status === 'pending';
                    const isApproved = l.status === 'approved';

                    return (
                      <div
                        key={l.id}
                        className={`p-3.5 rounded-2xl border ${
                          isPending
                            ? 'border-amber-400 bg-amber-500/5 dark:bg-amber-950/20 shadow-xs'
                            : 'border-border bg-white dark:bg-slate-900 shadow-2xs'
                        } space-y-2`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {l.days_requested} dia(s) solicitado(s)
                          </span>
                          <Badge
                            className={
                              isPending
                                ? 'bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1'
                                : isApproved
                                ? 'bg-emerald-600 text-white text-[10px] font-bold'
                                : 'bg-rose-600 text-white text-[10px] font-bold'
                            }
                          >
                            {isPending && <Clock size={11} />}
                            {isPending ? 'Em Análise' : isApproved ? 'Aprovada' : 'Indeferida'}
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <strong>Datas da folga: </strong>
                          <span className="text-foreground font-medium">
                            {(l.leave_dates || []).map((d) => fmtDate(d)).join(', ')}
                          </span>
                        </div>

                        {/* Motivo declarado fiel ao histórico individual */}
                        <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-border/60 text-foreground space-y-0.5">
                          <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">
                            Motivo / Justificativa declarada:
                          </span>
                          <span className="text-foreground leading-relaxed">
                            {l.observations?.trim() || 'Motivo não especificado no pedido.'}
                          </span>
                        </div>

                        <div className="text-[10.5px] text-muted-foreground pt-0.5 flex items-center justify-between">
                          <span>Solicitado em {fmtDate(l.created_at)}</span>
                          {l.decided_at && <span>Decisão em {fmtDate(l.decided_at)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          {/* ABA 3: EXTRATO COMPLETO DE CRÉDITOS E AJUSTES MANUAIS (DESIGN IDÊNTICO À IMAGEM) */}
          <TabsContent value="credits" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                Histórico / Extrato
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCreditFilter('all')}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                    creditFilter === 'all' ? 'bg-slate-800 text-white dark:bg-white dark:text-black' : 'text-slate-500'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setCreditFilter('manual')}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                    creditFilter === 'manual' ? 'bg-amber-500 text-white' : 'text-slate-500'
                  }`}
                >
                  Ajustes
                </button>
              </div>
            </div>

            {/* Lista com Cards Brancos Idênticos à Imagem */}
            {(() => {
              const filteredCredits = credits.filter((c) => {
                const isShift = c.origin === 'extra_shift';
                const isLeave = c.origin === 'leave_used';
                const isManual = !isShift && !isLeave;
                if (creditFilter === 'shifts') return isShift;
                if (creditFilter === 'manual') return isManual;
                if (creditFilter === 'used') return isLeave;
                return true;
              });

              if (filteredCredits.length === 0) {
                return (
                  <div className="p-8 text-center text-muted-foreground bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80">
                    <Sparkles size={28} className="mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs font-medium">Nenhum lançamento registrado.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  {filteredCredits.map((c) => {
                    const isShift = c.origin === 'extra_shift';
                    const isLeave = c.origin === 'leave_used';
                    const isManualAdd = !isShift && !isLeave && Number(c.amount) > 0;
                    const isManualRemove = !isShift && !isLeave && Number(c.amount) < 0;
                    const isAdd = Number(c.amount) > 0;

                    let title = 'Plantão Extra na Escala';
                    let subtitle = 'Crédito de escala extra';

                    if (isShift) {
                      title = 'Plantão Extra na Escala';
                      subtitle = c.notes?.trim() || 'Crédito de escala extra';
                    } else if (isManualAdd) {
                      title = 'Ajuste Manual Adicionado';
                      subtitle = c.notes?.trim() || 'Crédito inserido pela gestão';
                    } else if (isManualRemove) {
                      title = 'Ajuste Manual Retirado';
                      subtitle = c.notes?.trim() || 'Estorno autorizado';
                    } else if (isLeave) {
                      title = 'Folga Usufruída';
                      subtitle = c.notes?.trim() || 'Desconto referente a folga gozada';
                    }

                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between gap-3 transition-colors hover:border-slate-300"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="text-xs text-slate-900 dark:text-slate-100 font-normal truncate">
                            <strong className="font-extrabold text-slate-900 dark:text-white mr-1.5">
                              {title}
                            </strong>
                            <span className="text-slate-500 font-normal">
                              {fmtDateExtenso(c.created_at)}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-400 dark:text-slate-400 truncate">
                            {subtitle}
                          </p>
                        </div>

                        <div
                          className={`font-mono text-base font-extrabold shrink-0 px-2 py-0.5 rounded-lg ${
                            isAdd
                              ? 'text-[#059669] dark:text-[#10b981]'
                              : 'text-[#e11d48] dark:text-[#f43f5e]'
                          }`}
                        >
                          {isAdd ? `+${fmtCredit(c.amount)}` : fmtCredit(c.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          {/* ABA 4: COMO FUNCIONA O PORTAL (GUIA COMPLETO) */}
          <TabsContent value="help" className="mt-3 space-y-3">
            <div className="p-4 rounded-2xl border border-border bg-white dark:bg-slate-900 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <BookOpen size={18} className="text-primary" />
                <h3 className="font-bold text-sm text-foreground">Como Funciona o Portal do Servidor</h3>
              </div>

              {/* Seção 1: Escalas */}
              <div className="space-y-1 text-xs">
                <strong className="text-foreground flex items-center gap-1.5 font-bold">
                  <CalendarDays size={14} className="text-primary" />
                  1. Escalas de Trabalho e Plantões Extras
                </strong>
                <p className="text-muted-foreground leading-relaxed pl-5">
                  Aqui você visualiza seus plantões programados, horários (diurno/noturno/24h) e unidade de atendimento. Plantões marcados como <strong className="text-amber-600 dark:text-amber-400">"Plantão Extra"</strong> geram créditos automáticos para você usufruir de folgas no futuro.
                </p>
              </div>

              {/* Seção 2: Folgas */}
              <div className="space-y-1 text-xs">
                <strong className="text-foreground flex items-center gap-1.5 font-bold">
                  <CalendarOff size={14} className="text-amber-600" />
                  2. Solicitações de Folga (Pendentes e Aprovadas)
                </strong>
                <p className="text-muted-foreground leading-relaxed pl-5">
                  Na aba de folgas, acompanhe o andamento dos seus pedidos. Os pedidos com badge amarelo <strong className="text-amber-600">"Em Análise"</strong> aguardam parecer da coordenação. Quando aprovados, o sistema debita automaticamente os dias do seu saldo de créditos.
                </p>
              </div>

              {/* Seção 3: Saldo e Créditos */}
              <div className="space-y-1 text-xs">
                <strong className="text-foreground flex items-center gap-1.5 font-bold">
                  <Wallet size={14} className="text-emerald-600" />
                  3. Saldo e Extrato de Créditos
                </strong>
                <p className="text-muted-foreground leading-relaxed pl-5">
                  Seu saldo compensatório é calculado em tempo real: <br />
                  <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">
                    Saldo = (Plantões Extras) + (Ajustes Autorizados) - (Folgas Gozadas)
                  </code>
                </p>
              </div>

              {/* Seção 4: Foto de Perfil */}
              <div className="space-y-1 text-xs">
                <strong className="text-foreground flex items-center gap-1.5 font-bold">
                  <Camera size={14} className="text-primary" />
                  4. Foto de Perfil Sincronizada
                </strong>
                <p className="text-muted-foreground leading-relaxed pl-5">
                  Ao clicar no ícone de câmera na sua foto, você pode enviar uma foto pessoal. Ela é comprimida instantaneamente no seu celular para carregar rápido e fica sincronizada tanto no seu portal quanto no painel dos gestores.
                </p>
              </div>

              {/* Seção 5: QR Code e Instalação */}
              <div className="space-y-1 text-xs">
                <strong className="text-foreground flex items-center gap-1.5 font-bold">
                  <QrCode size={14} className="text-indigo-600" />
                  5. Acesso Rápido por QR Code & App PWA
                </strong>
                <p className="text-muted-foreground leading-relaxed pl-5">
                  Você pode salvar o portal na tela inicial do seu celular usando o botão <strong>"Instalar App"</strong> no topo, ou ler o QR Code fornecido pelo RH para entrar diretamente sem precisar digitar o código.
                </p>
              </div>

              {/* Caixa Jurídica LGPD */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-[11px] text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  Proteção de Dados (LGPD):
                </span>
                <p>
                  Suas informações são pessoais e intransferíveis. O portal opera em modo de leitura e auditoria contínua, garantindo conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
