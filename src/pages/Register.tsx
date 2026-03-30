import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Stethoscope } from 'lucide-react';

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setSubmitting(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: window.location.origin,
        },
      });
      if (authErr) throw authErr;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Erro ao criar usuário');

      // 2. Wait for profile trigger
      await new Promise(r => setTimeout(r, 1500));

      // 3. Create user_role
      await supabase.from('user_roles').insert({
        user_id: userId,
        role: invite.role,
        team_id: invite.team_id,
        category_id: invite.category_id,
        unit_id: invite.unit_id,
      });

      // 4. Update profile team_id
      await supabase
        .from('profiles')
        .update({ team_id: invite.team_id, display_name: name } as any)
        .eq('user_id', userId);

      // 5. Mark invite as used
      await supabase
        .from('invites')
        .update({ used: true, used_by: userId } as any)
        .eq('id', invite.id);

      toast.success('Cadastro realizado! Faça login para acessar.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Erro no cadastro');
    } finally {
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="page-card text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Convite inválido</h1>
          <p className="text-muted-foreground text-sm">
            Este link de convite é inválido ou já foi utilizado.
          </p>
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    rh: 'RH',
    category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full">
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="bg-primary p-8 text-center">
            <div className="bg-primary-foreground/20 p-3 rounded-xl backdrop-blur-sm inline-flex mb-4">
              <Stethoscope className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-primary-foreground mb-1">Criar Conta</h1>
            <p className="text-primary-foreground/80 text-sm">
              Nível: {roleLabels[invite.role] || invite.role}
            </p>
          </div>

          <form onSubmit={handleRegister} className="p-8 space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {submitting ? 'Criando...' : 'Criar Conta'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
