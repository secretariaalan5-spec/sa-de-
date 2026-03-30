/**
 * InvitePage — Accessed via unique invite link /convite/:token
 * Shows login/register form. After auth, auto-accept processes the invite.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Chrome, Stethoscope, Mail, Lock, UserPlus, CheckCircle2 } from 'lucide-react';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase
        .from('team_members' as any)
        .select('*')
        .eq('invite_token', token)
        .eq('status', 'pending')
        .maybeSingle() as any;
      setInvite(data);
      if (data?.member_email) setEmail(data.member_email);
      setLoading(false);
    };
    fetchInvite();
  }, [token]);

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && invite) {
        await processInvite(session.user.id, session.user.email || '');
      }
    };
    if (invite) checkSession();
  }, [invite]);

  const processInvite = async (userId: string, userEmail: string) => {
    try {
      // Accept invite
      await supabase
        .from('team_members' as any)
        .update({
          member_id: userId,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        } as any)
        .eq('id', invite.id) as any;

      // Update profile team_id
      if (invite.team_id) {
        await supabase
          .from('profiles')
          .update({ team_id: invite.team_id } as any)
          .eq('user_id', userId);
      }

      // Create user_role based on invite permissions
      const perms = invite.permissions || {};
      const roleData: any = {
        user_id: userId,
        role: invite.role || 'admin',
        team_id: invite.team_id,
        category_id: perms.pending_category_id || null,
        unit_id: perms.pending_unit_id || null,
      };

      // Check if user_role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from('user_roles')
          .update(roleData)
          .eq('id', existingRole.id);
      } else {
        await supabase
          .from('user_roles')
          .insert(roleData);
      }

      toast.success('Convite aceito! Bem-vindo à equipe.');
      navigate('/');
    } catch (err: any) {
      console.error('Erro ao processar convite:', err);
      toast.error('Erro ao aceitar convite.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Preencha todos os campos.'); return; }
    setAuthLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name || email },
          emailRedirectTo: window.location.href,
        },
      });
      if (error) throw error;
      if (authData.user && invite) {
        localStorage.setItem('password_set', 'true');
        // Wait for trigger to create profile
        await new Promise(r => setTimeout(r, 2000));
        await processInvite(authData.user.id, email);
      } else {
        toast.success('Verifique seu e-mail para confirmar o cadastro.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Preencha todos os campos.'); return; }
    setAuthLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      localStorage.setItem('password_set', 'true');
      if (authData.user && invite) {
        await processInvite(authData.user.id, email);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro no login.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      // Store token in localStorage so auto-accept can process it after redirect
      if (token) localStorage.setItem('pending_invite_token', token);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/convite/${token}` },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error('Erro ao entrar com Google.');
      setAuthLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      rh: 'RH',
      category_chief: 'Chefe de Categoria',
      unit_manager: 'Gerente de Unidade',
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="bg-destructive/10 p-4 rounded-2xl inline-flex mx-auto">
            <UserPlus className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Convite Inválido</h1>
          <p className="text-muted-foreground text-sm">
            Este link de convite não é válido ou já foi utilizado.
          </p>
          <Button onClick={() => navigate('/login')} variant="outline">Ir para Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full animate-fade-in">
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-primary p-6 text-center">
            <div className="bg-primary-foreground/20 p-3 rounded-xl backdrop-blur-sm inline-flex mb-3">
              <Stethoscope className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-primary-foreground mb-1">Saúde+ Escalas</h1>
            <p className="text-primary-foreground/80 text-sm">Convite para a equipe</p>
          </div>

          {/* Invite Info */}
          <div className="px-6 pt-4 pb-2">
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Você foi convidado como</p>
                <p className="font-bold text-sm">{getRoleLabel(invite.role)}</p>
              </div>
            </div>
          </div>

          {/* Auth Form */}
          <div className="p-6 space-y-4">
            <Button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full h-11 font-semibold gap-2 shadow-lg shadow-primary/20"
            >
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Chrome className="w-5 h-5" />}
              Entrar com Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-3">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome completo</Label>
                  <Input
                    placeholder="Seu nome"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-10"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>

              <Button type="submit" variant="secondary" disabled={authLoading} className="w-full h-10 font-medium gap-2">
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {mode === 'register' ? 'Criar Conta' : 'Entrar'}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              {mode === 'register' ? 'Já tenho conta — Fazer login' : 'Não tenho conta — Criar agora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
