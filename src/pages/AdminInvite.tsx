import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, MapPin, UserCheck, Clock, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { useProfessionalPortal } from '@/hooks/useProfessionalPortal';
import { toast } from 'sonner';

export default function AdminInvite() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const teamIdFromUrl = searchParams.get('team');
    const { session, professionalUser, loading, loginWithGoogle, logout, registerProfessional, refreshProfile } = useProfessionalPortal();

    const [fullName, setFullName] = useState('');
    const [teamInfo, setTeamInfo] = useState<{ name: string } | null>(null);
    const [fetchingTeam, setFetchingTeam] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch team info
    useEffect(() => {
        if (teamIdFromUrl) {
            setFetchingTeam(true);
            supabase
                .from('teams')
                .select('name')
                .eq('id', teamIdFromUrl)
                .maybeSingle()
                .then(({ data }) => {
                    if (data) setTeamInfo(data as { name: string });
                    setFetchingTeam(false);
                });
        }
    }, [teamIdFromUrl]);

    // Handle registration
    const handleRequestAccess = async () => {
        if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
            toast.error('Digite seu nome completo');
            return;
        }
        if (!teamIdFromUrl) return;

        setIsSubmitting(true);
        const ok = await registerProfessional(teamIdFromUrl, 'manager', fullName.trim());
        setIsSubmitting(false);
        if (ok) {
            toast.success('Solicitação de acesso administrativo enviada!');
        }
    };

    if (loading || fetchingTeam) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <Shield className="w-12 h-12 text-primary/20 animate-pulse mx-auto" />
                    <p className="text-sm text-muted-foreground animate-pulse">Carregando convite...</p>
                </div>
            </div>
        );
    }

    // If not logged in
    if (!session) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <div className="max-w-md w-full space-y-8 animate-fade-in">
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto ring-8 ring-white shadow-xl">
                            <Shield className="w-10 h-10 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900">Área de Gestão</h1>
                            <p className="text-slate-500 mt-2 font-medium">Faça login para solicitar acesso administrativo</p>
                        </div>
                    </div>

                    <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl">
                        <CardContent className="p-8 space-y-6">
                            {teamInfo && (
                                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                                    <p className="text-xs font-bold text-primary uppercase tracking-widest">Equipe Alvo</p>
                                    <p className="text-xl font-black text-slate-800 mt-1">{teamInfo.name}</p>
                                </div>
                            )}

                            <Button
                                onClick={loginWithGoogle}
                                className="w-full h-14 text-base font-bold rounded-2xl shadow-lg hover:shadow-primary/20 transition-all gap-3 bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
                            >
                                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                                Entrar com Google
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // If logged in but has a different team (and it's not manager) or is already approved
    // We handle data isolation: if they use a new link, they should register for the new team.
    const isAlreadyRegisteredForThisTeam = professionalUser?.team_id === teamIdFromUrl && professionalUser?.category === 'manager';

    if (isAlreadyRegisteredForThisTeam) {
        if (professionalUser.status === 'approved') {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                    <Card className="max-w-md w-full border-none shadow-2xl p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black">Acesso Já Liberado</h2>
                            <p className="text-muted-foreground text-sm">Você já é um gestor desta equipe. Pode prosseguir para o painel principal.</p>
                        </div>
                        <Button onClick={() => navigate('/')} className="w-full rounded-xl py-6 font-bold text-lg">
                            Ir para o Painel
                        </Button>
                        <button onClick={logout} className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 mx-auto underline">
                            <LogOut className="w-3 h-3" /> Sair
                        </button>
                    </Card>
                </div>
            );
        }

        if (professionalUser.status === 'pending') {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                    <Card className="max-w-md w-full border-none shadow-2xl p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                            <Clock className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black">Aguardando Aprovação</h2>
                            <p className="text-muted-foreground text-sm">Sua solicitação de acesso administrativo para a equipe <strong>{teamInfo?.name}</strong> está sendo analisada.</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Logado como</p>
                            <p className="text-sm font-bold text-slate-700">{session.user.email}</p>
                        </div>
                        <Button variant="outline" onClick={() => window.location.reload()} className="w-full rounded-xl">
                            Atualizar Status
                        </Button>
                        <button onClick={logout} className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 mx-auto underline">
                            <LogOut className="w-3 h-3" /> Sair de outra conta
                        </button>
                    </Card>
                </div>
            );
        }
    }

    // Final Registration Screen (Invite Landed)
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full space-y-8 animate-fade-in">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-violet-200">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Convite Administrativo</h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium">Complete seu cadastro para gerir esta equipe</p>
                    </div>
                </div>

                <Card className="border-none shadow-2xl overflow-hidden">
                    <div className="h-2 bg-violet-600 w-full" />
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-violet-50 border border-violet-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                        <MapPin className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-violet-400 leading-none">Equipe</p>
                                        <p className="font-black text-slate-800">{teamInfo?.name || 'Carregando...'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-xs uppercase font-bold text-slate-500">Seu Nome Completo</Label>
                                <Input
                                    id="fullName"
                                    placeholder="Ex: João Silva Sauro"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="h-12 rounded-xl focus:ring-violet-500 border-slate-200"
                                />
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                                <UserCheck className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">E-mail verificado</p>
                                    <p className="text-sm font-medium text-slate-600 overflow-hidden text-ellipsis max-w-[200px]">{session.user.email}</p>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleRequestAccess}
                            disabled={isSubmitting || !teamIdFromUrl}
                            className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition-all gap-2"
                        >
                            {isSubmitting ? <Clock className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                            Solicitar Acesso à Gestão
                        </Button>

                        <div className="flex flex-col gap-3">
                            <p className="text-[10px] text-center text-slate-400 px-4 leading-relaxed">
                                Sua solicitação passará por aprovação do administrador atual.
                                Você receberá uma notificação quando liberado.
                            </p>
                            <div className="w-full h-px bg-slate-100" />
                            <button onClick={logout} className="text-xs text-slate-400 hover:text-rose-500 flex items-center justify-center gap-1 mx-auto transition-colors">
                                Fazer logout da conta atual
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
