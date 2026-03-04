import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Globe, RefreshCw, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Registration() {
    const { teamId } = useAppData();
    const [copied, setCopied] = useState(false);

    const portalLink = teamId
        ? `${window.location.origin}/portal?team=${teamId}`
        : '';

    const copyToClipboard = () => {
        if (!portalLink) {
            toast.error('Aguarde o carregamento da equipe.');
            return;
        }
        navigator.clipboard.writeText(portalLink).then(() => {
            setCopied(true);
            toast.success('Link copiado!');
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = portalLink;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            toast.success('Link copiado!');
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const shareOnWhatsApp = () => {
        const text =
            `*Portal do Profissional - Secretaria de Saúde*\n\n` +
            `Olá! Acesse o portal para ver suas escalas, créditos e solicitar folgas.\n\n` +
            `🔗 *Link de Acesso:* ${portalLink}\n\n` +
            `📋 Clique no link, entre com sua conta Google, escolha sua categoria profissional e aguarde aprovação.\n\n` +
            `_Após o cadastro, o administrador aprovará seu acesso._`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    if (!teamId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 opacity-20" />
                <p className="text-sm font-medium">Sincronizando perfil administrativo...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Cadastro de Profissionais"
                description="Compartilhe o link abaixo para que profissionais se cadastrem via Google"
            />

            <div className="space-y-5 max-w-2xl mt-6">
                {/* Info Banner */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                                <Globe className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm mb-1">Como funciona</h3>
                                <p className="text-sm text-muted-foreground">
                                    Compartilhe o link abaixo com seus profissionais (Enfermeiros, Técnicos ou eMult).
                                    Eles fazem login com Google, escolhem sua categoria e enviam a solicitação.
                                    Você aprova na aba <strong>Aprovações Portal</strong>.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Link Card */}
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-primary" />
                            <h3 className="font-bold">Link do Portal</h3>
                        </div>

                        <div className="font-mono text-xs bg-muted/50 rounded-xl px-4 py-3 break-all text-muted-foreground border">
                            {portalLink}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={copyToClipboard}
                                variant="outline"
                                className="flex-1 gap-2"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copiado!' : 'Copiar Link'}
                            </Button>
                            <Button
                                onClick={shareOnWhatsApp}
                                className="flex-1 gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-0"
                            >
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                WhatsApp
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
