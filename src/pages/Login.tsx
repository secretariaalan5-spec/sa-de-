/**
 * Login — Google OAuth (principal) + e-mail/senha (opcional).
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Chrome, Stethoscope, Mail, Lock } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

export default function Login() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error('Erro ao entrar com Google: ' + (error.message || 'Tente novamente.'));
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });
      if (error) throw error;
      localStorage.setItem('password_set', 'true');
    } catch (error: any) {
      toast.error('Erro no login: ' + (error.message || 'Verifique seus dados.'));
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full animate-fade-in">
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-primary p-8 text-center">
            <div className="bg-primary-foreground/20 p-3 rounded-xl backdrop-blur-sm inline-flex mb-4">
              <Stethoscope className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-primary-foreground mb-1">Saúde+ Escalas</h1>
            <p className="text-primary-foreground/80 text-sm">Sistema de Gestão de Escalas</p>
          </div>

          {/* Login */}
          <div className="p-8 space-y-5">
            <p className="text-center text-sm text-muted-foreground">
              Acesse com sua conta Google ou e-mail
            </p>

            <Button
              onClick={handleGoogleLogin}
              disabled={googleLoading || emailLoading}
              className="w-full h-12 font-semibold text-[15px] gap-2.5 shadow-lg shadow-primary/20"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Chrome className="w-5 h-5" />
              )}
              {googleLoading ? 'Conectando...' : 'Entrar com Google'}
            </Button>

            {!showEmailLogin ? (
              <button
                type="button"
                onClick={() => setShowEmailLogin(true)}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Entrar com e-mail e senha
              </button>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Sua senha"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={emailLoading || googleLoading}
                    className="w-full h-10 font-medium gap-2"
                  >
                    {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {emailLoading ? 'Entrando...' : 'Entrar com E-mail'}
                  </Button>
                </form>
              </>
            )}

            <div className="pt-2 text-center border-t border-border italic">
              <p className="text-[10px] text-muted-foreground">
                Acesso restrito a usuários autorizados.
              </p>
            </div>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="mt-8 text-center flex flex-col items-center">
          <img src="/logo-saude-plus.png" alt="Saúde+" className="h-8 mb-2 opacity-50 grayscale" />
          <p className="text-muted-foreground text-xs">© 2025 Saúde+ Gestão de Escalas</p>
        </div>
      </div>
    </div>
  );
}
