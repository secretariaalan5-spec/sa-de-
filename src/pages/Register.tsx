/**
 * Register — Google OAuth via invite link.
 * Stores invite token in localStorage so useAuth can assign the role after redirect.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Stethoscope, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
      // Store invite token so useAuth can process it after redirect
      localStorage.setItem('pending_invite_token', invite.token);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
        <div className="max-w-sm w-full bg-card rounded-2xl shadow-xl border border-border p-8 text-center space-y-4">
          <h1 className="text-xl font-bold mb-2">Convite inválido ou expirado</h1>
          <p className="text-muted-foreground text-sm">
            Este link de convite é inválido ou já foi utilizado.
          </p>
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-sm font-medium">Já tem acesso ao sistema?</p>
            <Button onClick={() => window.location.href = '/login'} className="w-full gap-2">
              Fazer Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="max-w-sm w-full animate-fade-in">
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="bg-primary p-10 text-center">
            <div className="bg-primary-foreground/20 p-4 rounded-2xl backdrop-blur-sm inline-flex mb-4">
              <Stethoscope className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-primary-foreground mb-1">Saúde+ Escalas</h1>
            <p className="text-primary-foreground/80 text-sm">Convite para acesso ao sistema</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                <span className="text-sm font-medium">Convite válido</span>
              </div>
              <Badge variant="secondary" className="text-sm">
                {roleLabels[invite.role] || invite.role}
              </Badge>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Entre com sua conta Google para criar seu acesso
            </p>

            <Button
              onClick={handleGoogleRegister}
              disabled={submitting}
              size="lg"
              className="w-full h-12 font-semibold text-[15px] gap-3 shadow-lg shadow-primary/20"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {submitting ? 'Conectando...' : 'Entrar com Google'}
            </Button>

            <div className="pt-3 text-center border-t border-border">
              <p className="text-[11px] text-muted-foreground italic">
                Acesso restrito a usuários com convite válido.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
