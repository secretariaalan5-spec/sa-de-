/**
 * Register — Google OAuth via invite link.
 * Stores invite token in localStorage so useAuth can assign the role after redirect.
 * Premium design with animated particle background.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import AuthBackground from '@/components/AuthBackground';
import logoSaude from '@/assets/logo-saude.png';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  rh: 'RH',
  category_chief: 'Chefe de Categoria',
  unit_manager: 'Gerente de Unidade',
  professional: 'Profissional',
};

export default function Register() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

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
          redirectTo: `${window.location.host === 'localhost:5173' ? 'http://localhost:5173' : window.location.origin}/?token=${invite.token}`,
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

  return (
    <AuthBackground>
      <div className="max-w-[400px] w-full px-4 animate-fade-in">
        {/* Glassmorphism card */}
        <div className="auth-card">
          {/* Header */}
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

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

          {/* Invite info */}
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

            <p className="text-center text-sm text-white/55">
              Entre com sua conta Google para criar seu acesso
            </p>

            <Button
              onClick={handleGoogleRegister}
              disabled={submitting}
              size="lg"
              className="auth-google-btn"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {submitting ? 'Conectando...' : 'Entrar com Google'}
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/40 italic">
              Acesso restrito a usuários com convite válido.
            </p>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}
