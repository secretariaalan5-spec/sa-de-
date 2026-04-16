/**
 * AcceptInvite — Category Chief invite acceptance.
 * Token comes from path params (/convite/:token) — never exposed in query string.
 * Now supports the pending approval flow.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock } from 'lucide-react';
import AuthBackground from '@/components/AuthBackground';
import logoSaude from '@/assets/logo-saude.png';

interface CategoryInvite {
  id: string;
  token: string;
  category_ids: string[];
  label: string;
  is_active: boolean;
  uses_count: number;
  max_uses: number | null;
  expires_at: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function AcceptInvite() {
  const { refreshRole } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<CategoryInvite | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const navigate = useNavigate();

  const { token: pathToken } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const token = pathToken || params.get('token');

  useEffect(() => {
    // Clean token from URL if it came via query param (security)
    if (params.get('token') && token) {
      window.history.replaceState({}, '', `/convite/${token}`);
    }
    loadInvite();
  }, []);

  const loadInvite = async () => {
    try {
      if (!token) {
        setError('Token de convite não fornecido.');
        setLoading(false);
        return;
      }

      const [inviteRes, userRes] = await Promise.all([
        supabase.from('category_invites').select('*').eq('token', token).single(),
        supabase.auth.getUser(),
      ]);

      if (inviteRes.error || !inviteRes.data) {
        setError('Convite não encontrado ou inválido.');
        setLoading(false);
        return;
      }

      setInvite(inviteRes.data);

      if (inviteRes.data.category_ids.length > 0) {
        const { data: catsData } = await supabase
          .from('categories')
          .select('id, name')
          .in('id', inviteRes.data.category_ids);
        setCategories(catsData ?? []);
      }

      if (userRes.data?.user) {
        setUserEmail(userRes.data.user.email ?? null);
        setUserId(userRes.data.user.id);
      }

      setLoading(false);
    } catch {
      setError('Erro ao carregar convite.');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invite) return;
    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc('accept_category_invite', {
        p_token: invite.token,
      });

      if (error) {
        toast.error(error.message || 'Erro ao aceitar convite.');
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao aceitar convite.');
        return;
      }

      // Handle the new pending approval flow
      if (data?.status === 'pending') {
        toast.success('Solicitação enviada! Aguarde a aprovação do administrador.');
        setPendingApproval(true);
        return;
      }

      // Direct approval — refresh role in AuthContext so sidebar updates immediately
      toast.success(data.message || 'Convite aceito!');
      await refreshRole();
      navigate('/', { replace: true });
    } catch {
      toast.error('Erro ao processar convite.');
    } finally {
      setAccepting(false);
    }
  };

  const handleGoogleLogin = async () => {
    const redirectUrl = `${window.location.origin}/convite/${token}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
    if (error) {
      toast.error('Erro ao conectar com Google.');
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
  if (pendingApproval) {
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
              Sua solicitação de acesso como <strong className="text-white/80">Chefe de Categoria</strong> foi enviada com sucesso!
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

  if (error) {
    return (
      <AuthBackground>
        <div className="max-w-[400px] w-full px-4 animate-fade-in">
          <div className="auth-card text-center space-y-5">
            <div className="auth-logo">
              <img src={logoSaude} alt="Saúde+" className="w-[60px] h-[60px] rounded-xl shadow-lg" />
            </div>
            <XCircle className="mx-auto h-10 w-10 text-red-400" />
            <h1 className="text-xl font-bold text-white">Erro</h1>
            <p className="text-white/55 text-sm">{error}</p>
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-white/70">Já tem acesso ao sistema?</p>
              <Button onClick={() => navigate('/login')} className="auth-google-btn">
                Fazer Login
              </Button>
              <Button variant="link" className="text-white/50 hover:text-white/80" onClick={() => navigate('/')}>
                Voltar ao início
              </Button>
            </div>
          </div>
        </div>
      </AuthBackground>
    );
  }

  if (!invite) return null;

  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const isMaxUsesReached = invite.max_uses !== null && invite.uses_count >= invite.max_uses;
  const canAccept = invite.is_active && !isExpired && !isMaxUsesReached;

  return (
    <AuthBackground>
      <div className="max-w-[420px] w-full px-4 animate-fade-in">
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
              {canAccept ? 'Convite de Chefe de Categoria' : 'Convite Indisponível'}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

          <div className="space-y-5">
            {/* Status */}
            <div className="flex items-center justify-center gap-2">
              {canAccept ? (
                <Badge className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30 text-sm px-3 py-1">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Disponível
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30 text-sm px-3 py-1">
                  <XCircle className="h-4 w-4 mr-1" /> Indisponível
                </Badge>
              )}
            </div>

            {/* Description label */}
            {invite.label && (
              <p className="text-center text-sm text-white/70 italic">"{invite.label}"</p>
            )}

            {/* Categories */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-center text-white/80">
                Categorias que você irá gerenciar:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {categories.map((cat) => (
                  <Badge key={cat.id} className="bg-white/15 hover:bg-white/20 text-white border-white/20 text-sm px-3 py-1">
                    {cat.name}
                  </Badge>
                ))}
              </div>
              {categories.length === 0 && (
                <p className="text-sm text-white/40 text-center">Nenhuma categoria encontrada</p>
              )}
            </div>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
              <ShieldCheck size={12} />
              <span>Link seguro • Uso único • Aprovação obrigatória</span>
            </div>

            {/* Actions */}
            {userId ? (
              <div className="space-y-3">
                <div className="bg-white/10 rounded-xl p-3 text-center border border-white/10">
                  <p className="text-sm text-white/70">
                    Logado como: <span className="font-medium text-white/90">{userEmail}</span>
                  </p>
                </div>
                {canAccept ? (
                  <Button
                    className="auth-google-btn"
                    size="lg"
                    onClick={handleAccept}
                    disabled={accepting}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando solicitação...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Solicitar Acesso ({categories.length} categoria{categories.length !== 1 ? 's' : ''})
                      </>
                    )}
                  </Button>
                ) : isExpired ? (
                  <p className="text-center text-sm text-white/50">Este convite expirou.</p>
                ) : isMaxUsesReached ? (
                  <p className="text-center text-sm text-white/50">Limite de usos atingido.</p>
                ) : (
                  <p className="text-center text-sm text-white/50">Convite não está mais ativo.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-center text-white/55">
                  Entre com sua conta Google para solicitar acesso
                </p>
                <Button className="auth-google-btn" size="lg" onClick={handleGoogleLogin}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Entrar com Google
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/40 italic mb-2">
              Após solicitar, o administrador precisará aprovar seu acesso.
            </p>
            <Button variant="link" className="text-white/40 hover:text-white/70 text-[11px]" onClick={() => navigate('/')}>
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}
