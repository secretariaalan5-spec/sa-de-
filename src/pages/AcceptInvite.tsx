import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Link as LinkIcon, Stethoscope } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<CategoryInvite | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
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

      if (error || !data?.success) {
        toast.error(data?.error || 'Erro ao aceitar convite.');
        return;
      }

      toast.success(data.message);
      setTimeout(() => navigate('/'), 2000);
    } catch {
      toast.error('Erro ao processar convite.');
    } finally {
      setAccepting(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Redirect to Google OAuth, coming back to this same page with the token
    const redirectUrl = `${window.location.origin}/aceite-convite?token=${token}`;
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <CardTitle className="mt-4">Carregando convite...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle className="mt-4 text-destructive">Erro</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm font-medium">Já tem acesso ao sistema?</p>
            <Button onClick={() => navigate('/login')} className="w-full">Fazer Login</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const isMaxUsesReached = invite.max_uses !== null && invite.uses_count >= invite.max_uses;
  const canAccept = invite.is_active && !isExpired && !isMaxUsesReached;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="bg-primary/10 p-3 rounded-2xl inline-flex mx-auto mb-2">
            <Stethoscope className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="mt-2">
            {canAccept ? 'Convite de Chefe de Categoria' : 'Convite Indisponível'}
          </CardTitle>
          <CardDescription>
            {invite.label || 'Você foi convidado para gerenciar categorias'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-center gap-2">
            {canAccept ? (
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Disponível
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-sm">
                <XCircle className="h-4 w-4 mr-1" /> Indisponível
              </Badge>
            )}
          </div>

          {/* Categorias */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-center">Categorias que você irá gerenciar:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => (
                <Badge key={cat.id} variant="outline" className="text-sm">
                  {cat.name}
                </Badge>
              ))}
            </div>
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">Nenhuma categoria encontrada</p>
            )}
          </div>

          {/* Ações */}
          <div className="space-y-3">
            {userId ? (
              <>
                <p className="text-sm text-center">
                  Logado como: <span className="font-medium">{userEmail}</span>
                </p>
                {canAccept ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleAccept}
                    disabled={accepting}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Aceitar Convite ({categories.length} categoria{categories.length !== 1 ? 's' : ''})
                      </>
                    )}
                  </Button>
                ) : isExpired ? (
                  <p className="text-center text-sm text-muted-foreground">Este convite expirou.</p>
                ) : isMaxUsesReached ? (
                  <p className="text-center text-sm text-muted-foreground">Limite de usos atingido.</p>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">Convite não está mais ativo.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-center text-muted-foreground">
                  Entre com sua conta Google para aceitar o convite
                </p>
                <Button className="w-full h-12 font-semibold gap-3" size="lg" onClick={handleGoogleLogin}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Entrar com Google
                </Button>
              </>
            )}
          </div>

          <div className="text-center">
            <Button variant="link" onClick={() => navigate('/')}>
              Voltar ao início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
