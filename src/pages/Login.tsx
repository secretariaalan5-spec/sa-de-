import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2, Chrome } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Login() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const navigate = useNavigate();

    /** Trata login e cadastro dependendo do modo ativo. */
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success('Bem-vindo de volta!');
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                });
                if (error) throw error;

                // Se o Supabase retornar uma sessão imediatamente (confirmação automática ligada)
                if (data?.session) {
                    toast.success('Conta criada e logada com sucesso!');
                    navigate('/');
                    return;
                }

                toast.success('Conta criada! Verifique seu e-mail para confirmar (se necessário) e faça login.');
                setMode('login');
                setLoading(false);
                return;
            }

            navigate('/');
        } catch (error: any) {
            console.error('Erro na autenticação:', error);

            let errorMessage = 'Erro na autenticação. Verifique seus dados.';

            if (error.message === 'User already registered') {
                errorMessage = 'Este e-mail já está cadastrado.';
            } else if (error.message === 'Email not confirmed') {
                errorMessage = 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
            } else if (error.message === 'Invalid login credentials') {
                errorMessage = 'E-mail ou senha incorretos.';
            } else if (error.message.includes('Email rate limit exceeded')) {
                errorMessage = 'Muitas tentativas de cadastro seguidas. Por favor, aguarde alguns minutos ou desative a confirmação de e-mail no Supabase.';
            } else {
                errorMessage = error.message || errorMessage;
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            toast.error('Erro ao entrar com Google: ' + (error.message || 'Tente novamente.'));
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full animate-fade-in">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-primary p-8 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                <LogIn className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">
                            {mode === 'login' ? 'Área Administrativa' : 'Criar Nova Conta'}
                        </h1>
                        <p className="text-white/80 text-sm">Escala eMulti & Serviços</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleAuth} className="p-8 space-y-5">
                        <div className="space-y-4">
                            {mode === 'signup' && (
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Nome Completo</Label>
                                    <div className="relative">
                                        <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            id="fullName"
                                            type="text"
                                            placeholder="Seu nome"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@exemplo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/20"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {mode === 'login' ? 'Entrando...' : 'Criando Conta...'}
                                </>
                            ) : (
                                mode === 'login' ? 'Entrar no Sistema' : 'Cadastrar Administrador'
                            )}
                        </Button>

                        <div className="flex items-center gap-3">
                            <Separator className="flex-1" />
                            <span className="text-xs text-muted-foreground">ou</span>
                            <Separator className="flex-1" />
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full h-11"
                            onClick={handleGoogleLogin}
                            disabled={googleLoading || loading}
                        >
                            {googleLoading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Chrome className="w-4 h-4 mr-2" />
                            )}
                            Entrar com Google
                        </Button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                {mode === 'login'
                                    ? 'Não tem uma conta? Clique aqui para criar'
                                    : 'Já tem uma conta? Clique aqui para entrar'}
                            </button>
                        </div>

                        <div className="pt-2 text-center border-t border-slate-100 italic">
                            <p className="text-[10px] text-slate-400">
                                Acesso restrito a administradores autorizados.
                            </p>
                        </div>
                    </form>
                </div>

                {/* Brand Footer */}
                <div className="mt-8 text-center flex flex-col items-center">
                    <img src="/logo-saude-plus.png" alt="Saúde+" className="h-8 mb-2 opacity-50 grayscale" />
                    <p className="text-slate-400 text-xs">© 2025 Saúde+ Gestão de Escalas</p>
                </div>
            </div>
        </div>
    );
}
