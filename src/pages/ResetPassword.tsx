/**
 * ResetPassword — Página de redefinição de senha.
 * O usuário chega aqui via link de recuperação enviado por e-mail.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
    password: z.string().min(8, 'Mínimo 8 caracteres').max(128, 'Senha muito longa'),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
});

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isRecovery, setIsRecovery] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsRecovery(true);
            }
        });

        // Check hash for recovery token
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
            setIsRecovery(true);
        }

        return () => subscription.unsubscribe();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        const result = passwordSchema.safeParse({ password, confirmPassword });
        if (!result.success) {
            const errors: Record<string, string> = {};
            result.error.issues.forEach(issue => {
                const key = issue.path[0] as string;
                if (!errors[key]) errors[key] = issue.message;
            });
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setSuccess(true);
            toast.success('Senha redefinida com sucesso!');
            setTimeout(() => navigate('/login'), 2000);
        } catch (error: any) {
            toast.error('Erro ao redefinir senha: ' + (error.message || 'Tente novamente.'));
        } finally {
            setLoading(false);
        }
    };

    if (!isRecovery && !success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="max-w-md w-full text-center space-y-4">
                    <KeyRound className="w-12 h-12 text-muted-foreground mx-auto" />
                    <h1 className="text-xl font-bold text-foreground">Link de recuperação inválido</h1>
                    <p className="text-sm text-muted-foreground">Use o link enviado por e-mail ou solicite um novo na tela de login.</p>
                    <Button onClick={() => navigate('/login')} variant="outline">Voltar ao Login</Button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="max-w-md w-full text-center space-y-4 animate-fade-in">
                    <CheckCircle2 className="w-16 h-16 text-accent mx-auto" />
                    <h1 className="text-xl font-bold text-foreground">Senha redefinida!</h1>
                    <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full animate-fade-in">
                <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
                    <div className="bg-primary p-8 text-center">
                        <div className="bg-primary-foreground/20 p-3 rounded-xl backdrop-blur-sm inline-flex mb-4">
                            <KeyRound className="w-8 h-8 text-primary-foreground" />
                        </div>
                        <h1 className="text-2xl font-bold text-primary-foreground mb-1">Nova Senha</h1>
                        <p className="text-primary-foreground/80 text-sm">Defina sua nova senha de acesso</p>
                    </div>

                    <form onSubmit={handleReset} className="p-8 space-y-5">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Nova Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Mínimo 8 caracteres"
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
                                {fieldErrors.password && <p className="text-[11px] text-destructive font-medium">{fieldErrors.password}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Repita a senha"
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: '' })); }}
                                        className="pl-10"
                                        required
                                        maxLength={128}
                                    />
                                </div>
                                {fieldErrors.confirmPassword && <p className="text-[11px] text-destructive font-medium">{fieldErrors.confirmPassword}</p>}
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                            {loading ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redefinindo...</>
                            ) : (
                                'Redefinir Senha'
                            )}
                        </Button>

                        <div className="text-center">
                            <button type="button" onClick={() => navigate('/login')} className="text-sm text-primary hover:underline font-medium">
                                Voltar ao Login
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
