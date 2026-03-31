/**
 * Login — Google OAuth only.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import logoSaude from '@/assets/logo-saude.png';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch {
      toast.error('Erro ao entrar com Google. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="max-w-sm w-full animate-fade-in">
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="bg-primary p-10 text-center">
            <img src={logoSaude} alt="Saúde+" className="w-20 h-20 mx-auto mb-4 rounded-2xl" />
            <h1 className="text-2xl font-bold text-primary-foreground mb-1">Saúde+ Escalas</h1>
            <p className="text-primary-foreground/80 text-sm">Sistema de Gestão de Escalas</p>
          </div>

          <div className="p-8 space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              Acesse com sua conta Google institucional
            </p>

            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              size="lg"
              className="w-full h-12 font-semibold text-[15px] gap-3 shadow-lg shadow-primary/20"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? 'Conectando...' : 'Entrar com Google'}
            </Button>

            <div className="pt-3 text-center border-t border-border">
              <p className="text-[11px] text-muted-foreground italic">
                Acesso restrito a usuários autorizados.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-xs">© 2025 Saúde+ Gestão de Escalas</p>
        </div>
      </div>
    </div>
  );
}
