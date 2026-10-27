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
  Lock,
  ArrowLeftRight,
  Check,
  CheckCheck,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import PortalTermsDialog from '@/components/portal/PortalTermsDialog';
import PortalOnboardingTour from '@/components/portal/PortalOnboardingTour';
import { compressAvatarImage } from '@/lib/imageCompressor';
import logoSaude from '@/assets/logo-saude.png';
import logoSaudeEmblem from '@/assets/logo-saude-emblem.png';
import camocimBg from '@/assets/camocim-bg.jpg';
import portalBg from '@/assets/portal-bg.png';
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
    cancelled_at?: string | null;
    cancellation_reason?: string | null;
  }>;
  transfers: Array<{
    id: string;
    from_unit_name: string;
    to_unit_name: string;
    transferred_at: string;
  }>;
  credits: Array<{
    id: string;
    amount: number;
    origin: string;
    notes: string | null;
    created_at: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    is_global: boolean;
    priority: string;
    created_at: string;
    is_read: boolean;
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

// Armazenamento resiliente: localStorage + cookie de 1 ano (fallback)
const readSaved = (key: string): string | null => {
  try {
    const v = localStorage.getItem(key);
    if (v) return v;
  } catch {}
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + key + '=([^;]*)'));
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  return null;
};
const writeSaved = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch {}
  try {
    document.cookie = `${key}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`;
  } catch {}
};
const clearSaved = (key: string) => {
  try { localStorage.removeItem(key); } catch {}
  try { document.cookie = `${key}=; max-age=0; path=/; SameSite=Lax`; } catch {}
};

export default function ProfessionalPortal() {
  const wasReturningRef = useRef<boolean>(
    !!readSaved('saude_portal_token') || !!readSaved('saude_portal_saved_code')
  );
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return readSaved('saude_portal_token');
  });
  const [autoLoginTick, setAutoLoginTick] = useState(0);
  const retriedRef = useRef(false);

  // Pede ao navegador armazenamento persistente (evita limpeza automática)
  useEffect(() => {
    try { navigator.storage?.persist?.(); } catch {}
  }, []);

  // Estado de Login com Código (busca salvo no aparelho ou captura automático se vier de QR Code)
  const [inputCode, setInputCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('codigo');
      if (urlCode) {
        const clean = urlCode.replace(/\D/g, '').slice(0, 3);
        if (clean) {
          writeSaved('saude_portal_saved_code', clean);
          try { window.history.replaceState({}, '', window.location.pathname); } catch {}
          return clean;
        }
      }
      return readSaved('saude_portal_saved_code') || '';
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

  // Estados de Navegação Estilo App Mobile (3 Abas Essenciais: Escalas, Folgas, Extrato)
  const [activeTab, setActiveTab] = useState<'schedules' | 'leaves' | 'extrato'>('schedules');
  const [extratoFilter, setExtratoFilter] = useState<'all' | 'shifts' | 'leaves' | 'credits' | 'transfers'>('all');
  const [leaveFilter, setLeaveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');
  const [notifOpen, setNotifOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Tour guiado: só no primeiro acesso de verdade (logo após aceitar os termos, registrado no servidor).
  // Não depende do armazenamento do aparelho, então não reaparece em iPhone/Safari ao reabrir.
  const [tourPending, setTourPending] = useState(false);
  useEffect(() => {
    if (tourPending && data && !dataLoading && !termsOpen) {
      const timer = setTimeout(() => {
        writeSaved('saude_portal_tour_completed', 'true');
        setTourPending(false);
        setTourOpen(true);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [tourPending, data, dataLoading, termsOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Configurar título, meta tags do iOS e manifest dedicado para que 'Adicionar à Tela de Início' no iPhone abra direto em /portal com o nome 'Saúde+ Portal'
  useEffect(() => {
    document.title = 'Saúde+ Portal';
    
    // Altera ou cria apple-mobile-web-app-title
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitle);
    }
    const origAppleTitle = appleTitle.getAttribute('content');
    appleTitle.setAttribute('content', 'Saúde+ Portal');

    // Troca manifest para manifest-portal.json (start_url: /portal)
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const origManifest = manifestLink?.getAttribute('href');
    if (manifestLink) {
      manifestLink.setAttribute('href', '/manifest-portal.json');
    }

    return () => {
      document.title = 'Saúde+ - Gestão de Escalas';
      if (appleTitle && origAppleTitle) appleTitle.setAttribute('content', origAppleTitle);
      if (manifestLink && origManifest) manifestLink.setAttribute('href', origManifest);
    };
  }, []);

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

  // Busca os dados do painel com o token de sessão (com suporte a reload silencioso em segundo plano)
  const loadDashboard = useCallback(async (token: string, silent = false) => {
    if (!silent) setDataLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('portal_get_dashboard_data', {
        p_token: token,
      });

      if (error) throw error;
      if (!res || !res.ok) {
        // Sessão expirada ou inválida
        clearSaved('saude_portal_token');
        setSessionToken(null);
        setData(null);
        const saved = readSaved('saude_portal_saved_code');
        if (saved && saved.length === 3 && !retriedRef.current) {
          // Re-login silencioso com o código salvo
          retriedRef.current = true;
          setInputCode(saved);
          setAutoLoginTick((t) => t + 1);
          return;
        }
        toast.error('Sessão expirada. Digite seu código de acesso novamente.');
        return;
      }

      retriedRef.current = false;
      setData(res);
      if (res.profile?.needs_terms) {
        setTermsOpen(true);
      }
    } catch (err: any) {
      const saved = readSaved('saude_portal_saved_code');
      if (!silent && saved && saved.length === 3 && !retriedRef.current) {
        retriedRef.current = true;
        clearSaved('saude_portal_token');
        setSessionToken(null);
        setData(null);
        setInputCode(saved);
        setAutoLoginTick((t) => t + 1);
        return;
      }
      if (!silent) toast.error('Erro ao carregar seus dados: ' + (err.message || ''));
    } finally {
      if (!silent) setDataLoading(false);
    }
  }, []);

  // Efeito inicial para restaurar sessão existente
  useEffect(() => {
    if (sessionToken) {
      loadDashboard(sessionToken);
    }
  }, [sessionToken, loadDashboard]);

  // Realtime: escuta atualizações para manter escalas, folgas e notificações sempre sincronizadas
  useEffect(() => {
    if (!data?.profile?.id) return;
    const empId = data.profile.id;

    const channel = supabase
      .channel(`portal-employee-${empId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests', filter: `employee_id=eq.${empId}` },
        () => {
          if (sessionToken) loadDashboard(sessionToken, true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `employee_id=eq.${empId}` },
        () => {
          if (sessionToken) loadDashboard(sessionToken, true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_credits', filter: `employee_id=eq.${empId}` },
        () => {
          if (sessionToken) loadDashboard(sessionToken, true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          if (sessionToken) loadDashboard(sessionToken, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.profile?.id, sessionToken, loadDashboard]);

  // Logout do portal
  const handleLogout = async () => {
    if (!window.confirm('Deseja realmente sair do portal?')) return;
    if (sessionToken) {
      try {
        await supabase.rpc('portal_logout', { p_token: sessionToken });
      } catch (e) {
        console.error('Erro no logout:', e);
      }
    }
    clearSaved('saude_portal_token');
    clearSaved('saude_portal_saved_code');
    setInputCode('');
    setSessionToken(null);
    setData(null);
    toast.success('Você saiu com segurança.');
  };

  // Notificações: marcar uma como lida
  const handleMarkNotifRead = async (notifId: string) => {
    if (!sessionToken) return;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === notifId ? { ...n, is_read: true } : n
        ),
      };
    });
    await supabase.rpc('portal_mark_notification_read', {
      p_token: sessionToken,
      p_notification_id: notifId,
    });
  };

  // Notificações: marcar todas como lidas
  const handleMarkAllNotifsRead = async () => {
    if (!sessionToken) return;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
      };
    });
    await supabase.rpc('portal_mark_all_notifications_read', {
      p_token: sessionToken,
    });
    toast.success('Todas as notificações marcadas como lidas.');
  };

  // Manipulador de Login por Código de 3 Dígitos
  const performLogin = useCallback(async (codeToUse: string) => {
    const clean = codeToUse.replace(/\D/g, '').slice(0, 3);
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
          // Remove código salvo se for inválido para não entrar em loop
          clearSaved('saude_portal_saved_code');
        }
        return;
      }

      // Salva o código e o token da sessão para acessos futuros
      writeSaved('saude_portal_saved_code', clean);
      writeSaved('saude_portal_token', res.token);
      retriedRef.current = false;

      setSessionToken(res.token);
      await loadDashboard(res.token);
      toast.success(`Bem-vindo(a), ${res.employee?.name?.split(' ')[0]}!`);
    } catch (err: any) {
      toast.error('Erro ao conectar ao portal: ' + (err.message || ''));
    } finally {
      setLoginLoading(false);
    }
  }, [loadDashboard]);

  // Login automático quando vier do QR Code (?codigo=XXX) ou quando tiver código de 3 dígitos salvo
  // Roda apenas na montagem e quando autoLoginTick muda (não dispara enquanto o usuário digita)
  useEffect(() => {
    if (!sessionToken && inputCode.length === 3) {
      performLogin(inputCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoginTick]);

  // Manipulador de envio do formulário de login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(inputCode);
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
      setTourPending(true);
      toast.success('Termos de uso aceitos com sucesso!');
      await loadDashboard(sessionToken);
    } catch (err: any) {
      toast.error('Erro ao registrar aceite: ' + (err.message || ''));
    } finally {
      setTermsLoading(false);
    }
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
    const pinDigits = [0, 1, 2];

    return (
      <div className="relative min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 text-white font-sans antialiased overflow-hidden select-none">
        {/* Foto de Fundo Oficial com Tratamento Suave e Blur */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105 filter blur-[3px]"
          style={{ backgroundImage: `url(${camocimBg})` }}
        />
        {/* Camada de Gradiente Azul Institucional */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b3b82]/95 via-[#08295e]/92 to-[#041533]/98 backdrop-blur-[2px]" />
        
        {/* Brilhos / Glows Sutis de Fundo */}
        <div className="absolute -bottom-24 -left-20 w-[600px] h-[600px] rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 -right-20 w-[400px] h-[400px] rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

        {/* Conteúdo: Topo com Logo e Região Inferior com o Card de Código */}
        <div className="relative z-10 w-full max-w-sm mx-auto flex-1 flex flex-col justify-between pt-8 sm:pt-14 pb-4">
          {/* Região Superior: Logo Oficial Transparente e Tipografia Institucional */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="relative flex items-center justify-center mb-1">
              <div className="absolute w-24 h-24 rounded-full bg-sky-400/20 blur-2xl pointer-events-none" />
              <img
                src={logoSaudeEmblem}
                alt="Saúde+"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative z-10"
              />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md font-sans">
                SAÚDE<span className="text-sky-400">+</span>
              </h1>
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-sky-200/90">
                PORTAL DO SERVIDOR
              </p>
              {/* Linha divisora ciano estilizada */}
              <div className="w-12 h-0.5 bg-sky-400/90 rounded-full mx-auto mt-2" />
            </div>
          </div>

          {/* Região Inferior: Card com Digitação do Código de Acesso */}
          <div className="w-full mt-auto pt-6 space-y-4">
            <div
              onClick={() => pinInputRef.current?.focus()}
              className="w-full bg-[#0a2754]/85 backdrop-blur-xl border border-sky-400/25 rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-5 cursor-text"
            >
              {/* Header do Card com Ícone de Cadeado Redondo */}
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-center text-sky-300 shadow-inner shrink-0">
                  <Lock size={18} />
                </div>
                <span className="text-base font-bold text-white tracking-wide">
                  Digite seu código de acesso
                </span>
              </div>

              {/* Formulário com Slots Visuais de PIN de 3 Dígitos */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  {/* Input invisível sobreposto para capturar teclado nativo mobile / desktop */}
                  <input
                    ref={pinInputRef}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={3}
                    value={formattedInput}
                    onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    autoFocus
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                    aria-label="Código de acesso de 3 dígitos"
                  />

                  {/* 3 Slots Quadrados com Vidro e Dots Idênticos à Imagem de Referência */}
                  <div className="grid grid-cols-3 gap-3 relative z-10 pointer-events-none">
                    {pinDigits.map((idx) => {
                      const digit = formattedInput[idx];
                      const isFilled = digit !== undefined;
                      const isCurrent = formattedInput.length === idx;

                      return (
                        <div
                          key={idx}
                          className={`h-16 rounded-2xl flex items-center justify-center transition-all duration-200 border ${
                            isCurrent
                              ? 'bg-[#153e78]/90 border-2 border-sky-400 ring-2 ring-sky-400/30 shadow-[0_0_20px_rgba(56,189,248,0.35)]'
                              : isFilled
                              ? 'bg-[#123668]/85 border-sky-400/40'
                              : 'bg-[#0d2852]/80 border-sky-500/20'
                          }`}
                        >
                          {isFilled ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm animate-in zoom-in-75 duration-150" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-400/40" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Botão de Entrar Estilo Azul Real com Seta */}
                <Button
                  type="submit"
                  disabled={loginLoading || formattedInput.length !== 3}
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#175ec9] to-[#1d6ee6] hover:from-[#1b68dc] hover:to-[#2277f5] text-white shadow-lg shadow-blue-700/35 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </Button>
              </form>

              {/* Aviso de Segurança e Privacidade no Card */}
              <div className="flex items-center justify-center gap-2 pt-0.5 text-center text-xs text-sky-200/80">
                <ShieldCheck size={16} className="text-sky-300 shrink-0" />
                <span className="text-[12px] font-medium leading-tight">
                  Seu acesso é seguro e pessoal.
                </span>
              </div>
            </div>


          </div>
        </div>

        {/* Rodapé da Página */}
        <div className="relative z-10 text-center text-[11px] text-sky-200/60 pb-2 font-medium tracking-wide">
          Secretaria de Saúde
        </div>
      </div>
    );
  }

  // Se tem token salvo mas os dados ainda estão carregando da API
  if (dataLoading || !data) {
    return (
      <div className="min-h-screen bg-[#0b295e] flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-sky-400 mb-3" />
        <p className="text-sm font-semibold text-sky-200">Carregando seus dados com segurança...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PAINEL DO PROFISSIONAL (Autenticado)
  // ─────────────────────────────────────────────────────────────────────────────
  const profile = data.profile;
  const summary = data.summary || { shifts: 0, manual: 0, used: 0, balance: 0 };
  const schedules = data.schedules || [];
  const leaves = data.leaves || [];
  const transfers = data.transfers || [];
  const credits = data?.credits || [];
  const notifications = data?.notifications || [];

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const pastLeaves = leaves.filter((l) => l.status !== 'pending');
  const cancelledLeaves = leaves.filter((l) => l.status === 'cancelled');

  // ── Construção do Extrato Cronológico Unificado ──────────────────────────────
  interface ExtratoItem {
    id: string;
    timestamp: number;
    dateStr: string;
    type: 'shift_extra' | 'shift_normal' | 'leave_pending' | 'leave_approved' | 'leave_rejected' | 'leave_cancelled' | 'credit_manual' | 'transfer';
    category: 'shifts' | 'leaves' | 'credits' | 'transfers';
    title: string;
    categoryLabel: string;
    description: string;
    detail?: string | null;
    badgeLabel: string;
    badgeVariant: 'shift' | 'leave_approved' | 'leave_pending' | 'leave_rejected' | 'leave_cancelled' | 'credit_add' | 'credit_sub' | 'transfer';
    amountBadge?: {
      text: string;
      positive: boolean;
    };
  }

  const extratoTimeline: ExtratoItem[] = [];

  // 1. Escalas (normais e extras)
  schedules.forEach((s) => {
    const isExtra = s.type === 'extra';
    const timestamp = new Date(s.date + 'T12:00:00').getTime();
    extratoTimeline.push({
      id: `sched-${s.id}`,
      timestamp,
      dateStr: s.date,
      type: isExtra ? 'shift_extra' : 'shift_normal',
      category: 'shifts',
      title: isExtra ? 'Plantão Extra Realizado' : 'Plantão na Escala',
      categoryLabel: 'Escala',
      description: `${s.unit_name} • ${s.shift_type === 'half' ? 'Meio Turno' : 'Turno Integral'}`,
      detail: s.observations || null,
      badgeLabel: isExtra ? 'Extra' : 'Normal',
      badgeVariant: isExtra ? 'credit_add' : 'shift',
      amountBadge: isExtra
        ? { text: `+${fmtCredit(s.credit_amount ?? 1)} dia`, positive: true }
        : undefined,
    });
  });

  // 2. Pedidos de folga (aprovados, pendentes, indeferidos e cancelados)
  leaves.forEach((l) => {
    const isCancelled = l.status === 'cancelled';
    const isApproved = l.status === 'approved';
    const isPending = l.status === 'pending';
    const isRejected = l.status === 'rejected';

    const dateRef = isCancelled
      ? (l.cancelled_at || l.decided_at || l.created_at)
      : (l.decided_at || l.created_at);
    const timestamp = new Date(dateRef).getTime();

    let title = 'Solicitação de Folga';
    let badgeLabel = 'Em Análise';
    let badgeVariant: ExtratoItem['badgeVariant'] = 'leave_pending';
    let amountBadge: { text: string; positive: boolean } | undefined;

    if (isCancelled) {
      title = 'Folga Cancelada';
      badgeLabel = 'Cancelada';
      badgeVariant = 'leave_cancelled';
      amountBadge = { text: `+${l.days_requested} dia(s) estornados`, positive: true };
    } else if (isApproved) {
      title = 'Folga Aprovada';
      badgeLabel = 'Aprovada';
      badgeVariant = 'leave_approved';
      amountBadge = { text: `-${l.days_requested} dia(s) usufruídos`, positive: false };
    } else if (isRejected) {
      title = 'Folga Indeferida';
      badgeLabel = 'Indeferida';
      badgeVariant = 'leave_rejected';
    } else {
      title = 'Pedido de Folga';
      badgeLabel = 'Em Análise';
      badgeVariant = 'leave_pending';
    }

    const datesFormatted = (l.leave_dates || []).map(fmtDate).join(', ');
    const detail = isCancelled && l.cancellation_reason
      ? `Motivo do cancelamento: ${l.cancellation_reason}`
      : l.observations || null;

    extratoTimeline.push({
      id: `leave-${l.id}`,
      timestamp,
      dateStr: dateRef,
      type: isCancelled ? 'leave_cancelled' : isApproved ? 'leave_approved' : isRejected ? 'leave_rejected' : 'leave_pending',
      category: 'leaves',
      title,
      categoryLabel: 'Folga',
      description: `${l.days_requested} dia(s) (${datesFormatted})`,
      detail,
      badgeLabel,
      badgeVariant,
      amountBadge,
    });
  });

  // 3. Créditos e Ajustes Manuais
  credits.forEach((c) => {
    const isShift = c.origin === 'extra_shift';
    const isLeave = c.origin === 'leave_used';
    if (isShift || isLeave) return; // evita duplicar plantões de escala e folgas já listados

    const timestamp = new Date(c.created_at).getTime();
    const isAdd = Number(c.amount) > 0;

    extratoTimeline.push({
      id: `credit-${c.id}`,
      timestamp,
      dateStr: c.created_at,
      type: 'credit_manual',
      category: 'credits',
      title: isAdd ? 'Ajuste Manual Adicionado' : 'Ajuste Manual Retirado',
      categoryLabel: 'Ajuste',
      description: c.notes?.trim() || (isAdd ? 'Crédito inserido pela gestão' : 'Estorno autorizado'),
      detail: null,
      badgeLabel: isAdd ? 'Crédito' : 'Débito',
      badgeVariant: isAdd ? 'credit_add' : 'credit_sub',
      amountBadge: {
        text: isAdd ? `+${fmtCredit(c.amount)} dia(s)` : `${fmtCredit(c.amount)} dia(s)`,
        positive: isAdd,
      },
    });
  });

  // 4. Transferências de Lotação
  transfers.forEach((t) => {
    const timestamp = new Date(t.transferred_at).getTime();
    extratoTimeline.push({
      id: `transfer-${t.id}`,
      timestamp,
      dateStr: t.transferred_at,
      type: 'transfer',
      category: 'transfers',
      title: 'Transferência de Unidade',
      categoryLabel: 'Transferência',
      description: `${t.from_unit_name} → ${t.to_unit_name}`,
      detail: null,
      badgeLabel: 'Movimentação',
      badgeVariant: 'transfer',
    });
  });

  // Ordenação decrescente: o mais recente primeiro!
  extratoTimeline.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="min-h-screen bg-[#dcebf7] flex justify-center items-start sm:py-6 sm:px-4 font-sans antialiased text-slate-900 selection:bg-primary/20">
      {/* Moldura de Aplicativo Mobile (sempre com fundo limpo mesmo em dark mode do Android) */}
      <div className="w-full max-w-md min-h-screen sm:min-h-0 sm:max-h-[94vh] bg-[#f0f6fc] sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200/80 flex flex-col overflow-hidden relative">
        {/* Imagem de Fundo Oficial do Portal (Ondas Fluidas & Pulso Médico) */}
        <div
          className="absolute inset-0 bg-cover bg-top bg-no-repeat pointer-events-none z-0"
          style={{ backgroundImage: `url(${portalBg})` }}
        />
        {/* Suave camada de luz para contraste e harmonia com os cartões */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/40 pointer-events-none z-0" />

        {/* Modal de Aceite de Termos (LGPD) */}
        <PortalTermsDialog
          open={termsOpen}
          employeeName={profile?.name || ''}
          onAccept={handleAcceptTerms}
          loading={termsLoading}
        />

        {/* Tour Guiado Interativo de Instruções */}
        <PortalOnboardingTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
        />

        {/* Input de arquivo invisível para a foto */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAvatarSelect}
          accept="image/*"
          className="hidden"
        />

        {/* Header Superior PWA Estilo Aplicativo Nativo */}
        <header className="px-5 pt-6 pb-2 shrink-0 relative z-20 flex items-start justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none font-sans drop-shadow-xs">
              Saúde+
            </h1>
            <p className="text-[10px] sm:text-[11px] font-bold text-sky-200/90 tracking-widest uppercase mt-1">
              PORTAL DO SERVIDOR
            </p>
            <div className="flex items-center gap-1 text-[11px] font-medium text-sky-200/80 mt-1 uppercase tracking-tight">
              <MapPin size={11} className="text-sky-300 shrink-0" />
              <span className="truncate">{profile?.unit_name || 'UNIDADE DE SAÚDE'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 shrink-0">
            {isInstallable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleInstallPWA}
                className="h-8 gap-1 text-[11px] font-bold text-white/90 hover:text-white hover:bg-white/10 rounded-full px-2.5"
              >
                <Download size={13} />
                <span className="hidden xs:inline">Instalar</span>
              </Button>
            )}

            {/* Popover de Notificações Exclusivas do Profissional */}
            <div id="tour-notifications" className="shrink-0 flex items-center">
              <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                <PopoverTrigger asChild>
                  <button
                    title="Suas Notificações"
                    className="relative p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Bell size={20} />
                    {unreadNotifsCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0f2444]" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                align="end"
                className="w-80 sm:w-88 p-0 rounded-2xl shadow-xl border border-slate-200 bg-white"
              >
                <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Bell size={14} className="text-primary" />
                    <span>Suas Notificações</span>
                    {unreadNotifsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 font-extrabold text-[10px]">
                        {unreadNotifsCount} nova(s)
                      </span>
                    )}
                  </div>
                  {unreadNotifsCount > 0 && (
                    <button
                      onClick={handleMarkAllNotifsRead}
                      className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <CheckCheck size={12} />
                      <span>Marcar lidas</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Nenhuma notificação direcionada a você no momento.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => !n.is_read && handleMarkNotifRead(n.id)}
                        className={`p-3 rounded-xl transition-colors cursor-pointer space-y-1 ${
                          n.is_read
                            ? 'opacity-70 hover:bg-slate-50'
                            : 'bg-primary/5 hover:bg-primary/10 border-l-2 border-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {fmtDate(n.created_at)}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 leading-snug">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

            {/* Avatar Header com foto e anel branco */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer"
              title="Clique para alterar foto"
            >
              <Avatar className="w-8 h-8 rounded-full border-2 border-white/80 shadow-xs hover:ring-2 hover:ring-white transition-all">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.name} />
                <AvatarFallback className="bg-sky-200 text-sky-950 font-bold text-xs">
                  {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'PS'}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Botão de Sair */}
            <button
              onClick={handleLogout}
              title="Sair do Portal"
              className="p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        {/* Conteúdo Principal com Scroll Interno (App-Like) */}
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-2 space-y-3.5 no-scrollbar relative z-10">
          {/* Card do Perfil do Servidor */}
          <div id="tour-profile-card" className="rounded-[24px] bg-[#0c1f38] text-white p-4 shadow-lg border border-sky-400/20 relative overflow-hidden flex items-center gap-3.5">
            <div className="relative shrink-0">
              <Avatar className="!w-16 !h-16 !min-w-[64px] !min-h-[64px] !max-w-[64px] !max-h-[64px] rounded-full border-2 border-white/40 bg-blue-100 shadow-md">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.name} className="object-cover w-full h-full rounded-full" />
                <AvatarFallback className="bg-[#e2edff] text-[#1a365d] font-black text-xl rounded-full">
                  {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'PS'}
                </AvatarFallback>
              </Avatar>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Alterar foto"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#3b82f6] text-white flex items-center justify-center shadow-md hover:bg-blue-600 transition-all active:scale-95 border-2 border-[#0c1f38]"
              >
                {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black tracking-wide uppercase truncate leading-tight text-white">
                  {profile?.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#064e3b]/90 text-[#34d399] border border-[#059669]/60">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-300 uppercase tracking-wider truncate font-medium">
                {profile?.category_name || 'Servidor(a)'}
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-400 font-normal">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span className="truncate uppercase">{profile?.unit_name || 'Unidade de Saúde'}</span>
              </div>
            </div>
          </div>

          {/* Card Saldo Disponível de Folgas */}
          <div id="tour-balance-card" className="rounded-[24px] bg-white p-4 shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-[14px]">
                <CalendarDays size={18} className="text-slate-800" />
                <span>Saldo disponível de folgas</span>
              </div>
              <span className="px-3.5 py-1 rounded-full text-xs font-black bg-[#15803d] text-white shadow-xs tracking-tight">
                {summary.balance > 0 ? `+${fmtCredit(summary.balance)} dias` : `${fmtCredit(summary.balance)} dias`}
              </span>
            </div>

            {/* As 2 Caixas Principais: Total Acumulado vs Folgas Tiradas */}
            <div className="grid grid-cols-2 gap-2.5 text-center pt-0.5">
              {/* Box 1: Total Acumulado (Azul Suave) */}
              <div className="p-3 rounded-2xl bg-[#dff0fc] flex flex-col justify-center items-center">
                <div className="text-xl font-black text-[#0284c7] font-sans leading-none">
                  +{fmtCredit(Number(summary.shifts || 0) + (summary.manual > 0 ? Number(summary.manual) : 0))}
                </div>
                <div className="text-[10.5px] font-bold text-[#0284c7] uppercase tracking-wider mt-1.5 leading-tight">
                  Total Acumulado
                </div>
              </div>

              {/* Box 2: Folgas Utilizadas (Rosa/Vermelho Pastel) */}
              <div className="p-3 rounded-2xl bg-[#fee2e2] flex flex-col justify-center items-center">
                <div className="text-xl font-black text-[#be123c] font-sans leading-none">
                  -{fmtCredit(summary.used)}
                </div>
                <div className="text-[10.5px] font-bold text-[#be123c] uppercase tracking-wider mt-1.5 leading-tight">
                  Folgas Utilizadas
                </div>
              </div>
            </div>
          </div>

          {/* 3 Abas Mobile Simplificadas: Escalas, Folgas, Extrato */}
          <div id="tour-tabs-bar" className="w-full">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-13 rounded-[22px] bg-[#dce7f2]/85 backdrop-blur-md p-1 border border-white/60 shadow-xs">
              <TabsTrigger
                value="schedules"
                className="text-xs font-semibold rounded-[18px] data-[state=active]:bg-white data-[state=active]:text-[#0284c7] data-[state=active]:shadow-sm transition-all text-slate-600 flex items-center justify-center gap-1.5 py-1.5 h-full"
              >
                <CalendarDays size={16} />
                <span className="text-xs font-bold leading-none">Escalas</span>
              </TabsTrigger>

              <TabsTrigger
                value="leaves"
                className="text-xs font-semibold rounded-[18px] data-[state=active]:bg-white data-[state=active]:text-[#0284c7] data-[state=active]:shadow-sm transition-all text-slate-600 flex items-center justify-center gap-1.5 py-1.5 h-full relative"
              >
                <CalendarOff size={16} />
                <span className="text-xs font-bold leading-none">Folgas</span>
                {pendingLeaves.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-2 right-2 ring-2 ring-white" />
                )}
              </TabsTrigger>

              <TabsTrigger
                value="extrato"
                className="text-xs font-semibold rounded-[18px] data-[state=active]:bg-white data-[state=active]:text-[#0284c7] data-[state=active]:shadow-sm transition-all text-slate-600 flex items-center justify-center gap-1.5 py-1.5 h-full"
              >
                <History size={16} />
                <span className="text-xs font-bold leading-none">Extrato</span>
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: EXTRATO COMPLETO EM ORDEM CRONOLÓGICA */}
            <TabsContent value="extrato" className="mt-3.5 space-y-3">
              {/* Filtros Rápidos do Extrato */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setExtratoFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    extratoFilter === 'all'
                      ? 'bg-[#102446] text-white shadow-xs'
                      : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200/60'
                  }`}
                >
                  Tudo ({extratoTimeline.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExtratoFilter('shifts')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    extratoFilter === 'shifts'
                      ? 'bg-[#0284c7] text-white shadow-xs'
                      : 'bg-[#dff0fc] text-[#0284c7] hover:bg-[#d0eafc]'
                  }`}
                >
                  Plantões ({extratoTimeline.filter((i) => i.category === 'shifts').length})
                </button>
                <button
                  type="button"
                  onClick={() => setExtratoFilter('leaves')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    extratoFilter === 'leaves'
                      ? 'bg-[#b45309] text-white shadow-xs'
                      : 'bg-[#fef4d4] text-[#b45309] hover:bg-[#fdebb8]'
                  }`}
                >
                  Folgas ({extratoTimeline.filter((i) => i.category === 'leaves').length})
                </button>
                <button
                  type="button"
                  onClick={() => setExtratoFilter('credits')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    extratoFilter === 'credits'
                      ? 'bg-[#15803d] text-white shadow-xs'
                      : 'bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0]'
                  }`}
                >
                  Ajustes ({extratoTimeline.filter((i) => i.category === 'credits').length})
                </button>
                <button
                  type="button"
                  onClick={() => setExtratoFilter('transfers')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    extratoFilter === 'transfers'
                      ? 'bg-[#6b21a8] text-white shadow-xs'
                      : 'bg-[#ede9fe] text-[#6b21a8] hover:bg-[#ddd6fe]'
                  }`}
                >
                  Transf. ({extratoTimeline.filter((i) => i.category === 'transfers').length})
                </button>
              </div>

              {/* Linha do Tempo / Feed do Extrato */}
              {(() => {
                const filtered = extratoTimeline.filter((item) => {
                  if (extratoFilter === 'shifts') return item.category === 'shifts';
                  if (extratoFilter === 'leaves') return item.category === 'leaves';
                  if (extratoFilter === 'credits') return item.category === 'credits';
                  if (extratoFilter === 'transfers') return item.category === 'transfers';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-muted-foreground bg-white rounded-[24px] border border-slate-100 shadow-sm">
                      <History size={28} className="mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs font-semibold text-slate-700">
                        Nenhum evento registrado
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Não encontramos registros para este filtro no momento.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {filtered.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-[24px] border border-slate-100 bg-white shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-[13px] font-extrabold text-slate-900">
                            <span>{fmtDate(item.dateStr)}</span>
                            <span className="text-xs font-normal text-slate-400">
                              ({weekday(item.dateStr)})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.badgeVariant === 'leave_rejected' ? (
                              <span className="bg-[#b91c1c] text-white font-bold text-[11px] rounded-full px-3 py-0.5 shadow-2xs">
                                {item.badgeLabel}
                              </span>
                            ) : item.badgeVariant === 'leave_approved' ? (
                              <span className="bg-[#15803d] text-white font-bold text-[11px] rounded-full px-3 py-0.5 shadow-2xs">
                                {item.badgeLabel}
                              </span>
                            ) : item.badgeVariant === 'leave_pending' ? (
                              <span className="bg-[#d97706] text-white font-bold text-[11px] rounded-full px-3 py-0.5 shadow-2xs">
                                {item.badgeLabel}
                              </span>
                            ) : item.badgeVariant === 'leave_cancelled' ? (
                              <span className="bg-slate-600 text-white font-bold text-[11px] rounded-full px-3 py-0.5 shadow-2xs">
                                {item.badgeLabel}
                              </span>
                            ) : item.badgeVariant === 'credit_add' ? (
                              <span className="bg-[#dcfce7] text-[#15803d] border border-[#86efac] font-bold text-[10.5px] rounded-full px-2.5 py-0.5">
                                {item.badgeLabel}
                              </span>
                            ) : (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 ${
                                  item.badgeVariant === 'credit_sub'
                                    ? 'bg-rose-500/10 text-rose-700 border-rose-300'
                                    : item.badgeVariant === 'transfer'
                                    ? 'bg-indigo-500/10 text-indigo-700 border-indigo-300'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {item.badgeLabel}
                              </Badge>
                            )}

                            {item.amountBadge && (
                              <span
                                className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                                  item.amountBadge.positive
                                    ? 'bg-[#dcfce7] text-[#15803d]'
                                    : 'bg-[#fee2e2] text-[#be123c]'
                                }`}
                              >
                                {item.amountBadge.text}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <h4 className="text-[13.5px] font-extrabold text-slate-900 leading-snug">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">
                            {item.description}
                          </p>
                        </div>

                        {item.detail && (
                          <div className="text-xs bg-[#f1f5f9] p-2.5 rounded-xl border border-slate-200/60 text-slate-700 leading-relaxed font-normal">
                            {item.detail}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>

            {/* ABA 2: ESCALAS E PLANTÕES */}
            <TabsContent value="schedules" className="mt-3.5 space-y-2.5">
              {schedules.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-white rounded-[24px] border border-slate-100 shadow-sm">
                  <CalendarDays size={28} className="mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Nenhuma escala registrada no sistema.</p>
                </div>
              ) : (
                schedules.map((s) => {
                  const isExtra = s.type === 'extra';
                  return (
                    <div
                      key={s.id}
                      className="p-4 rounded-[24px] border border-slate-100 bg-white shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-extrabold text-[13px] text-slate-900">
                          <span>{fmtDate(s.date)}</span>
                          <span className="text-xs text-slate-400 font-normal">({weekday(s.date)})</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {s.shift_type === 'half' ? 'Meio Turno' : 'Integral'}
                          </span>
                          <span
                            className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                              isExtra
                                ? 'bg-[#dcfce7] text-[#15803d]'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isExtra ? `Extra (+${fmtCredit(s.credit_amount ?? 1)})` : 'Normal'}
                          </span>
                        </div>
                      </div>

                      {s.observations && (
                        <div className="text-xs bg-[#f1f5f9] p-2.5 rounded-xl border border-slate-200/60 text-slate-700 leading-relaxed font-normal">
                          <strong className="text-slate-900 font-bold">Atividade: </strong>
                          <span>{s.observations}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ABA 2: PEDIDOS DE FOLGA (Com todas as situações: Em Análise, Aprovadas, Indeferidas e Canceladas) */}
            <TabsContent value="leaves" className="mt-3.5 space-y-3">
              {/* Filtros Rápidos de Situação da Folga */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setLeaveFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    leaveFilter === 'all'
                      ? 'bg-[#102446] text-white shadow-xs'
                      : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200/60'
                  }`}
                >
                  Todas ({leaves.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveFilter('pending')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    leaveFilter === 'pending'
                      ? 'bg-[#d97706] text-white shadow-xs'
                      : 'bg-[#fef4d4] text-[#b45309] hover:bg-[#fdebb8]'
                  }`}
                >
                  ⏳ Em Análise ({pendingLeaves.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveFilter('approved')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    leaveFilter === 'approved'
                      ? 'bg-[#15803d] text-white shadow-xs'
                      : 'bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0]'
                  }`}
                >
                  ✓ Aprovadas ({leaves.filter((l) => l.status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveFilter('cancelled')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    leaveFilter === 'cancelled'
                      ? 'bg-[#475569] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ↩ Canceladas ({cancelledLeaves.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveFilter('rejected')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    leaveFilter === 'rejected'
                      ? 'bg-[#b91c1c] text-white shadow-xs'
                      : 'bg-[#fee2e2] text-[#be123c] hover:bg-[#fecaca]'
                  }`}
                >
                  ✕ Indeferidas ({leaves.filter((l) => l.status === 'rejected').length})
                </button>
              </div>

              {/* Listagem de Folgas */}
              {(() => {
                const activeLeavesFiltered = leaves.filter((l) => {
                  if (leaveFilter === 'pending') return l.status === 'pending';
                  if (leaveFilter === 'approved') return l.status === 'approved';
                  if (leaveFilter === 'rejected') return l.status === 'rejected';
                  if (leaveFilter === 'cancelled') return l.status === 'cancelled';
                  return true;
                });

                if (activeLeavesFiltered.length === 0) {
                  return (
                    <div className="p-8 text-center text-muted-foreground bg-white rounded-[24px] border border-slate-100 shadow-sm">
                      <CalendarOff size={28} className="mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs font-semibold text-slate-700">Nenhum pedido de folga neste filtro.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {activeLeavesFiltered.map((l) => {
                      const isPending = l.status === 'pending';
                      const isApproved = l.status === 'approved';
                      const isCancelled = l.status === 'cancelled';

                      return (
                        <div
                          key={l.id}
                          className="p-4 rounded-[24px] border border-slate-100 bg-white shadow-sm space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-[13.5px] text-slate-900">
                              {l.days_requested} dia(s) {isCancelled ? 'cancelado(s)' : 'solicitado(s)'}
                            </span>
                            <span
                              className={`text-[10.5px] font-bold px-3 py-0.5 rounded-full ${
                                isPending
                                  ? 'bg-[#d97706] text-white'
                                  : isApproved
                                  ? 'bg-[#15803d] text-white'
                                  : isCancelled
                                  ? 'bg-[#475569] text-white'
                                  : 'bg-[#b91c1c] text-white'
                              }`}
                            >
                              {isPending ? 'Em Análise' : isApproved ? 'Aprovada' : isCancelled ? 'Cancelada' : 'Indeferida'}
                            </span>
                          </div>

                          {isCancelled && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
                              <CheckCircle2 size={13} className="shrink-0" />
                              <span>Créditos estornados: <strong>+{l.days_requested} dia(s)</strong> no seu saldo</span>
                            </div>
                          )}

                          <div className="text-xs text-slate-500 font-medium">
                            <strong className="text-slate-800">Datas da folga: </strong>
                            <span>
                              {(l.leave_dates || []).map((d) => fmtDate(d)).join(', ')}
                            </span>
                          </div>

                          {isCancelled && l.cancellation_reason && (
                            <div className="text-xs bg-rose-50/70 p-2.5 rounded-xl border border-rose-200/60 text-rose-900 space-y-0.5">
                              <span className="font-bold text-[10.5px] uppercase tracking-wider block text-rose-700">
                                Motivo do cancelamento:
                              </span>
                              <p className="text-xs leading-relaxed font-normal">{l.cancellation_reason}</p>
                            </div>
                          )}

                          {l.observations && (
                            <div className="text-xs bg-[#f1f5f9] p-2.5 rounded-xl border border-slate-200/60 text-slate-700 leading-relaxed font-normal space-y-0.5">
                              <span className="font-bold text-[10.5px] text-slate-400 block uppercase tracking-wider">
                                {isCancelled ? 'Motivo original solicitado:' : 'Motivo / Justificativa declarada:'}
                              </span>
                              <span>
                                {l.observations?.trim() || 'Motivo não especificado no pedido.'}
                              </span>
                            </div>
                          )}

                          <div className="text-[10.5px] text-slate-400 pt-0.5 flex items-center justify-between">
                            <span>Solicitado em {fmtDate(l.created_at)}</span>
                            {isCancelled && l.cancelled_at ? (
                              <span>Cancelado em {fmtDate(l.cancelled_at)}</span>
                            ) : l.decided_at ? (
                              <span>Decisão em {fmtDate(l.decided_at)}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>
        </main>
      </div>
    </div>
  );
}
