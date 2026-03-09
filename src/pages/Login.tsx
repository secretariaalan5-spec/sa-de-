/**
 * Login — Página de autenticação do administrador.
 *
 * Suporta login com e-mail/senha e OAuth (Google).
 * Validação com zod + feedback inline.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2, Chrome, User } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';

// ── Schemas de validação ───────────────────────────────────────────────────

const loginSchema = z.object({
    email: z.string().trim().email('E-mail inválido').max(255, 'E-mail muito longo'),
    password: z.string().min(8, 'Mínimo 8 caracteres').max(128, 'Senha muito longa'),
});

const signupSchema = z.object({
    fullName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100, 'Nome muito longo'),
    email: z.string().trim().email('E-mail inválido').max(255, 'E-mail muito longo'),
    password: z.string().min(8, 'Mínimo 8 caracteres').max(128, 'Senha muito longa'),
});

type FieldErrors = Record<string, string>;

export default function Login() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const navigate = useNavigate();

    /** Valida e retorna true se ok, false se erro. */
    const validate = (): boolean => {
        const schema = mode === 'login' ? loginSchema : signupSchema;
        const payload = mode === 'login' ? { email, password } : { fullName, email, password };
        const result = schema.safeParse(payload);
        if (result.success) {
            setFieldErrors({});
            return true;
        }
        const errors: FieldErrors = {};
        result.error.issues.forEach(issue => {
            const key = issue.path[0] as string;
            if (!errors[key]) errors[key] = issue.message;
        });
        setFieldErrors(errors);
        return false;
    };

    /** Trata login e cadastro dependendo do modo ativo. */
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;
                toast.success('Bem-vindo de volta!');
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                    options: { data: { full_name: fullName.trim() } },
                });
                if (error) throw error;

                if (data?.session) {
                    toast.success('Conta criada e logada com sucesso!');
                    navigate('/');
                    return;
                }

                toast.success('Conta criada! Verifique seu e-mail para confirmar e faça login.');
                setMode('login');
                setLoading(false);
                return;
            }

            navigate('/');
        } catch (error: any) {
            console.error('Erro na autenticação:', error);

            const errorMessages: Record<string, string> = {
                'User already registered': 'Este e-mail já está cadastrado.',
                'Email not confirmed': 'E-mail ainda não confirmado. Verifique sua caixa de entrada.',
                'Invalid login credentials': 'E-mail ou senha incorretos.',
            };

            const errorMessage = error.message?.includes('Email rate limit exceeded')
                ? 'Muitas tentativas seguidas. Aguarde alguns minutos.'
                : errorMessages[error.message] || error.message || 'Erro na autenticação.';

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    /** Login com Google OAuth */
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

    /** Esqueci minha senha */
    const handleForgotPassword = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            toast.error('Digite seu e-mail antes de solicitar a recuperação.');
            return;
        }
        const emailResult = z.string().email().safeParse(trimmedEmail);
        if (!emailResult.success) {
            toast.error('Digite um e-mail válido.');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
        } catch (error: any) {
            toast.error('Erro ao enviar e-mail: ' + (error.message || 'Tente novamente.'));
        } finally {
            setLoading(false);
        }
    };

    const FieldError = ({ field }: { field: string }) =>
        fieldErrors[field] ? <p className="text-[11px] text-destructive font-medium mt-1">{fieldErrors[field]}</p> : null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full animate-fade-in">

                {/* ── Card principal ── */}
                <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">

                    {/* Header com cor primária */}
                    <div className="bg-primary p-8 text-center">
                        <div className="bg-primary-foreground/20 p-3 rounded-xl backdrop-blur-sm inline-flex mb-4">
                            <LogIn className="w-8 h-8 text-primary-foreground" />
                        </div>
                        <h1 className="text-2xl font-bold text-primary-foreground mb-1">
                            {mode === 'login' ? 'Área Administrativa' : 'Criar Nova Conta'}
                        </h1>
                        <p className="text-primary-foreground/80 text-sm">Escala eMulti & Serviços</p>
                    </div>

                    {/* ── Formulário ── */}
                    <form onSubmit={handleAuth} className="p-8 space-y-5">
                        <div className="space-y-4">

                            {/* Campo Nome (apenas no cadastro) */}
                            {mode === 'signup' && (
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Nome Completo</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="fullName"
                                            type="text"
                                            placeholder="Seu nome"
                                            value={fullName}
                                            onChange={(e) => { setFullName(e.target.value); setFieldErrors(p => ({ ...p, fullName: '' })); }}
                                            className="pl-10"
                                            required
                                            maxLength={100}
                                        />
                                    </div>
                                    <FieldError field="fullName" />
                                </div>
                            )}

                            {/* Campo E-mail */}
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@exemplo.com"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }}
                                        className="pl-10"
                                        required
                                        maxLength={255}
                                    />
                                </div>
                                <FieldError field="email" />
                            </div>

                            {/* Campo Senha */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }}
                                        className="pl-10 pr-10"
                                        required
                                        maxLength={128}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <FieldError field="password" />
                            </div>
                        </div>

                        {/* Link esqueci minha senha */}
                        {mode === 'login' && (
                            <div className="text-right -mt-2">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="text-xs text-primary hover:underline font-medium"
                                >
                                    Esqueci minha senha
                                </button>
                            </div>
                        )}

                        {/* Botão principal */}
                        <Button
                            type="submit"
                            className="w-full h-11 font-semibold shadow-lg shadow-primary/20"
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

                        {/* Separador */}
                        <div className="flex items-center gap-3">
                            <Separator className="flex-1" />
                            <span className="text-xs text-muted-foreground">ou</span>
                            <Separator className="flex-1" />
                        </div>

                        {/* Login Google */}
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

                        {/* Link para trocar modo */}
                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setFieldErrors({}); }}
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                {mode === 'login'
                                    ? 'Não tem uma conta? Clique aqui para criar'
                                    : 'Já tem uma conta? Clique aqui para entrar'}
                            </button>
                        </div>

                        {/* Rodapé do card */}
                        <div className="pt-2 text-center border-t border-border italic">
                            <p className="text-[10px] text-muted-foreground">
                                Acesso restrito a administradores autorizados.
                            </p>
                        </div>
                    </form>
                </div>

                {/* ── Brand Footer ── */}
                <div className="mt-8 text-center flex flex-col items-center">
                    <img src="/logo-saude-plus.png" alt="Saúde+" className="h-8 mb-2 opacity-50 grayscale" />
                    <p className="text-muted-foreground text-xs">© 2025 Saúde+ Gestão de Escalas</p>
                </div>
            </div>
        </div>
    );
}
