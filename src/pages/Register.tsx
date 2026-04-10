/**
 * Register — Google OAuth via invite link.
 * Stores invite token in localStorage so useAuth can assign the role after redirect.
 * Token comes from path params (/registro/:token) — never exposed in query string.
 * Now supports the pending approval flow.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, ShieldCheck, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import AuthBackground from '@/components/AuthBackground';
import logoSaude from '@/assets/logo-saude.png';
import { useAuthContext } from '@/contexts/AuthContext';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  rh: 'RH',
  category_chief: 'Chefe de Categoria',
  unit_manager: 'Gerente de Unidade',
  professional: 'Profissional',
};

export default function Register() {
  const { roleInfo, session, pendingStatus } = useAuthContext();
  const navigate = useNavigate();
  const { token: pathToken } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const token = pathToken || params.get('token');

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    // If the user already has an active session and lands here with a token,
    // they are trying to accept an invite. Process it directly.
    if (session && token) {
      setSubmitting(true);
      supabase.rpc('accept_invite_by_token', { p_token: token }).then(({ data, error }) => {
        // Always clean up token from localStorage
        localStorage.removeItem('pending_invite_token');

        if (error) {
          toast.error(error.message || 'Erro ao processar convite');
          setSubmitting(false);
          return;
        }

        // The RPC now returns status: 'pending' instead of creating the role directly
        if (data?.status === 'pending') {
          setRequestSent(true);
          setSubmitting(false);
          return;
        }

        if (data?.status === 'already_approved') {
          navigate('/', { replace: true });
          return;
        }

        if (data?.status === 'rejected') {
          toast.error('Sua solicitação foi recusada pelo administrador.');
          setSubmitting(false);
          return;
        }

        // Fallback: navigate to dashboard
        navigate('/', { replace: true });
        window.location.reload();
      });
      return;
    }

    // If the user already has a role assigned and no token is being processed, redirect
    if (roleInfo && !token) {
      navigate('/', { replace: true });
    }
  }, [session, roleInfo, navigate, token]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    // Clean token from URL if it came via query param
    if (params.get('token')) {
      window.history.replaceState({}, '', `/registro/${token}`);
    }

    supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle()
      .then(({ data }) => {
        setInvite(data);
        setLoading(false);
      });
  }, [token]);

  const handleGoogleRegister = async () => {
    if (!invite) return;
    setSubmitting(true);

    try {
      localStorage.setItem('pending_invite_token', invite.token);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/registro/${invite.token}`,
        },
      });
      if (error) throw error;
    } catch {
      toast.error('Erro ao conectar com Google. Tente novamente.');
      localStorage.removeItem('pending_invite_token');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthBackground>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </AuthBackground>
    );
  }

  // ========== PENDING APPROVAL SCREEN ==========
  if (requestSent || pendingStatus === 'pending') {
    return (
      <AuthBackground>
        <div className="max-w-[400px] w-full px-4 animate-fade-in">
          <div className="auth-card text-center space-y-5">
            <div className="auth-logo">
              <img src={logoSaude} alt="Saúde+" className="w-[60px] h-[60px] rounded-xl shadow-lg" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock size={24} className="text-amber-400 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold text-white">Aguardando Aprovação</h1>
            <p className="text-white/55 text-sm">
              Sua solicitação de acesso foi enviada com sucesso!
              O administrador precisa aprovar seu cadastro antes de você acessar o sistema.
            </p>
            <div className="bg-white/10 rounded-xl p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="text-xs text-white/60">Verificação de segurança</span>
              </div>
              <p className="text-[11px] text-white/40">
                Por segurança, todos os novos acessos passam por aprovação manual do administrador.
              </p>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <Button
              onClick={() => { navigate('/login'); }}
              variant="ghost"
              className="text-white/50 hover:text-white/80"
            >
              Voltar ao Login
            </Button>
          </div>
        </div>
      </AuthBackground>
    );
  }

  // ========== REJECTED SCREEN ==========
  if (pendingStatus === 'rejected') {
    return (
      <AuthBackground>
        <div className="max-w-[400px] w-full px-4 animate-fade-in">
          <div className="auth-card text-center space-y-5">
            <div className="auth-logo">
              <img src={logoSaude} alt="Saúde+" className="w-[60px] h-[60px] rounded-xl shadow-lg" />
            </div>
            <XCircle className="mx-auto h-10 w-10 text-red-400" />
            <h1 className="text-xl font-bold text-white">Acesso Recusado</h1>
            <p className="text-white/55 text-sm">
              Sua solicitação de acesso foi recusada pelo administrador.
              Entre em contato com o responsável pelo sistema.
            </p>
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <Button
              onClick={() => navigate('/login')}
              variant="ghost"
              className="text-white/50 hover:text-white/80"
            >
              Voltar ao Login
            </Button>
          </div>
        </div>
      </AuthBackground>
    );
  }

  // ========== INVITE NOT FOUND ==========
  if (!token || !invite) {
    return (
      <AuthBackground>
        <div className="max-w-[400px] w-full px-4 animate-fade-in">
          <div className="auth-card text-center space-y-5">
            <div className="auth-logo">
              <img src={logoSaude} alt="Saúde+" className="w-[60px] h-[60px] rounded-xl shadow-lg" />
            </div>
            <h1 className="text-xl font-bold text-white">Convite inválido ou expirado</h1>
            <p className="text-white/55 text-sm">
              Este link de convite é inválido ou já foi utilizado.
            </p>
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-white/70">Já tem acesso ao sistema?</p>
              <Button
                onClick={() => window.location.href = '/login'}
                className="auth-google-btn"
              >
                Fazer Login
              </Button>
            </div>
          </div>
        </div>
      </AuthBackground>
    );
  }

  // ========== INVITE VALID — REGISTER ==========
  return (
    <AuthBackground>
      <div className="max-w-[400px] w-full px-4 animate-fade-in">
        <div className="auth-card">
          <div className="text-center mb-8">
            <div className="auth-logo">
              <img src={logoSaude} alt="Saúde+" className="w-[72px] h-[72px] rounded-2xl shadow-lg" />
            </div>
            <h1 className="text-[26px] font-bold text-white mt-5 tracking-tight">
              Saúde+ Escalas
            </h1>
            <p className="text-white/60 text-sm mt-1.5">
              Convite para acesso ao sistema
            </p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

          <div className="space-y-5">
            <div className="bg-white/10 rounded-xl p-4 text-center space-y-2.5 border border-white/10">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-sm font-medium text-white/90">Convite válido</span>
              </div>
              <Badge className="bg-white/15 hover:bg-white/20 text-white border-white/20 text-sm px-3 py-1">
                {roleLabels[invite.role] || invite.role}
              </Badge>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
              <ShieldCheck size={12} />
              <span>Link seguro • Uso único • Aprovação obrigatória</span>
            </div>

            <p className="text-center text-sm text-white/55">
              Entre com sua conta Google para solicitar acesso
            </p>

            <Button
              onClick={handleGoogleRegister}
              disabled={submitting || !!session}
              size="lg"
              className="auth-google-btn"
            >
              {submitting || !!session ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {submitting ? 'Enviando solicitação...' : session ? 'Processando...' : 'Entrar com Google'}
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/40 italic">
              Após entrar, sua solicitação será enviada ao administrador para aprovação.
            </p>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}
