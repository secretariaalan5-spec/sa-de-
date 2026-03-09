/**
 * Login — Autenticação exclusiva via Google OAuth.
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Chrome, Stethoscope } from 'lucide-react';

export default function Login() {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin },
            });
            if (error) throw error;
        } catch (error: any) {
            toast.error('Erro ao entrar com Google: ' + (error.message || 'Tente novamente.'));
            setLoading(false);
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
                        <h1 className="text-2xl font-bold text-primary-foreground mb-1">Área Administrativa</h1>
                        <p className="text-primary-foreground/80 text-sm">Escala eMulti & Serviços</p>
                    </div>

                    {/* Login */}
                    <div className="p-8 space-y-5">
                        <p className="text-center text-sm text-muted-foreground">
                            Acesse com sua conta Google institucional
                        </p>

                        <Button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full h-12 font-semibold text-[15px] gap-2.5 shadow-lg shadow-primary/20"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Chrome className="w-5 h-5" />
                            )}
                            {loading ? 'Conectando...' : 'Entrar com Google'}
                        </Button>

                        <div className="pt-2 text-center border-t border-border italic">
                            <p className="text-[10px] text-muted-foreground">
                                Acesso restrito a administradores autorizados.
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
