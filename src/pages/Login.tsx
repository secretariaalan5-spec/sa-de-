import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            toast.success('Bem-vindo de volta! Login realizado com sucesso.');
            navigate('/');
        } catch (error: any) {
            console.error('Erro no login:', error.message);
            toast.error('Erro ao entrar. Verifique suas credenciais.');
        } finally {
            setLoading(false);
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
                        <h1 className="text-2xl font-bold text-white mb-1">Área Administrativa</h1>
                        <p className="text-white/80 text-sm">Escala eMulti & Serviços</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="p-8 space-y-6">
                        <div className="space-y-4">
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
                                    Entrando...
                                </>
                            ) : (
                                'Entrar no Sistema'
                            )}
                        </Button>

                        <div className="pt-2 text-center">
                            <p className="text-xs text-slate-400">
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
