import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Link as LinkIcon } from 'lucide-react';

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
  const navigate = useNavigate();

  useEffect(() => {
    loadInvite();
  }, []);

  const loadInvite = async () => {
    try {
      const token = new URLSearchParams(window.location.search).get('token');
      
      if (!token) {
        setError('Token de convite não fornecido.');
        setLoading(false);
        return;
      }

      // Carregar convite
      const { data: inviteData, error: inviteError } = await supabase
        .from('category_invites')
        .select('*')
        .eq('token', token)
        .single();

      if (inviteError || !inviteData) {
        setError('Convite não encontrado ou inválido.');
        setLoading(false);
        return;
      }

      setInvite(inviteData);

      // Carregar categorias
      if (inviteData.category_ids.length > 0) {
        const { data: catsData } = await supabase
          .from('categories')
          .select('id, name')
          .in('id', inviteData.category_ids);
        
        setCategories(catsData ?? []);
      }

      // Verificar usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
      }

      setLoading(false);
    } catch (err) {
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
      
      // Aguardar um momento e redirecionar
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      toast.error('Erro ao processar convite.');
    } finally {
      setAccepting(false);
    }
  };

  const handleLogin = () => {
    navigate('/login');
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
          <CardContent className="text-center">
            <Button onClick={() => navigate('/')}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const isAccepted = invite.accepted_by !== null;
  const isMaxUsesReached = invite.max_uses !== null && invite.uses_count >= invite.max_uses;
  const canAccept = invite.is_active && !isExpired && !isAccepted && !isMaxUsesReached;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <LinkIcon className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4">
            {isAccepted ? 'Convite já Aceito' : canAccept ? 'Convite de Chefe de Categoria' : 'Convite Indisponível'}
          </CardTitle>
          <CardDescription>
            {invite.label || 'Convite para múltiplas categorias'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-center gap-2">
            {isAccepted ? (
              <Badge variant="secondary" className="text-sm">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Aceito em {invite.accepted_at ? new Date(invite.accepted_at).toLocaleDateString('pt-BR') : ''}
              </Badge>
            ) : canAccept ? (
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
            <p className="text-sm font-medium text-center">Categorias atribuídas:</p>
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

          {/* Informações de uso */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Usos: {invite.uses_count}/{invite.max_uses ?? '∞'}</p>
            {invite.expires_at && (
              <p>Expira em: {new Date(invite.expires_at).toLocaleDateString('pt-BR')}</p>
            )}
          </div>

          {/* Ações */}
          <div className="space-y-3">
            {userEmail ? (
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
                        Aceitar Convite
                      </>
                    )}
                  </Button>
                ) : isAccepted ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Este convite já foi aceito anteriormente.
                  </p>
                ) : isExpired ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Este convite expirou.
                  </p>
                ) : isMaxUsesReached ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Limite de usos atingido.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-sm text-center text-muted-foreground">
                  Você precisa estar logado para aceitar este convite.
                </p>
                <Button className="w-full" size="lg" onClick={handleLogin}>
                  Fazer Login
                </Button>
              </>
            )}
          </div>

          {/* Voltar */}
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
