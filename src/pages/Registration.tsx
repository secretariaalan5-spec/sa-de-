import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { usePortalInvites, InviteAccessLevel, PortalInvite } from '@/hooks/usePortalInvites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Copy, Check, Plus, Trash2,
    Stethoscope, Syringe, Link2, Globe, RefreshCw,
    ToggleLeft, ToggleRight, Users, QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Página de Cadastro / Links de Convite ──────────────────────────────────

export default function Registration() {
    const { userId } = useAppData();
    const {
        invites, loading, createInvite, toggleInvite, deleteInvite,
    } = usePortalInvites(userId);

    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({
        label: '',
        access_level: '' as InviteAccessLevel | '',
        max_uses: '',
    });

    // ── URL base do portal ──
    const getInviteUrl = (invite: PortalInvite) =>
        `${window.location.origin}/portal?admin=${userId || ''}&role=${invite.access_level}`;

    // ── Clipboard helper ──
    const copyToClipboard = (text: string, key: string) => {
        if (!text) {
            toast.error('O link ainda não está pronto.');
            return;
        }
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopiedKey(key);
            toast.success('Copiado!');
            setTimeout(() => setCopiedKey(null), 2000);
        } catch {
            toast.error('Erro ao copiar.');
        }
        document.body.removeChild(textArea);
    };

    // ── WhatsApp share ──
    const shareOnWhatsApp = (invite: PortalInvite) => {
        const fullLink = getInviteUrl(invite);
        const catLabel = invite.access_level === 'nurse' ? 'Enfermeiros' :
            invite.access_level === 'tech' ? 'Técnicos' : 'eMult';
        const text =
            `*Escala de Serviço - ${catLabel}*\n\n` +
            `Olá! Você foi convidado(a) a se cadastrar no portal da Secretaria de Saúde como ${catLabel.slice(0, -1)}.\n\n` +
            `🔗 *Link de Cadastro:* ${fullLink}\n\n` +
            `📋 Clique no link, entre com sua conta Google, informe seu nome e confirme sua função de ${catLabel.slice(0, -1)}.\n\n` +
            `_Após o cadastro, aguarde aprovação do administrador._`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    // ── Criar convite ──
    const handleCreate = async () => {
        if (!form.access_level) {
            toast.error('Selecione a categoria do convite.');
            return;
        }

        await createInvite({
            label: form.label || undefined as any,
            access_level: form.access_level as InviteAccessLevel,
            max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        });

        setForm({ label: '', access_level: '', max_uses: '' });
        setDialogOpen(false);
    };

    // ── Ícone da categoria ──
    const categoryIcon = (level: string) => {
        if (level === 'nurse') return <Stethoscope className="w-4 h-4" />;
        if (level === 'tech') return <Syringe className="w-4 h-4" />;
        return <Users className="w-4 h-4" />;
    };
    const categoryLabel = (level: string) => {
        if (level === 'nurse') return 'Enfermeiros';
        if (level === 'tech') return 'Técnicos';
        return 'eMult';
    };
    const categoryColor = (level: string) => {
        if (level === 'nurse') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
        if (level === 'tech') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
        return 'bg-primary/10 text-primary';
    };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <PageHeader
                    title="Cadastro de Profissionais"
                    description="Gere links de convite para que profissionais se cadastrem via Google"
                />

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="shadow-lg shadow-primary/20 gap-2">
                            <Plus className="w-4 h-4" />
                            Novo Convite
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Link de Convite</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div>
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Categoria</Label>
                                <Select value={form.access_level} onValueChange={(v) => setForm(prev => ({ ...prev, access_level: v as InviteAccessLevel }))}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Selecione a categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="nurse">
                                            <span className="flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Enfermeiros</span>
                                        </SelectItem>
                                        <SelectItem value="tech">
                                            <span className="flex items-center gap-2"><Syringe className="w-4 h-4" /> Técnicos</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Descrição (opcional)</Label>
                                <Input
                                    value={form.label}
                                    onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
                                    placeholder="Ex: Convite para novos enfermeiros"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Limite de usos (opcional)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.max_uses}
                                    onChange={(e) => setForm(prev => ({ ...prev, max_uses: e.target.value }))}
                                    placeholder="Ilimitado"
                                />
                            </div>
                            <Button onClick={handleCreate} className="w-full h-11 font-bold">
                                Criar Convite
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-5 max-w-4xl">

                {/* ── Info Banner ── */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                                <Globe className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm mb-1">Como funciona o cadastro</h3>
                                <p className="text-sm text-muted-foreground">
                                    Crie um convite por categoria abaixo. Cada link já define a função (Enfermeiro ou Técnico).
                                    O profissional clica no link, entra com Google, informa o nome e envia a solicitação.
                                    Você aprova na aba <strong>Aprovações Portal</strong> e ele aparece automaticamente na equipe.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Lista de Convites ── */}
                <div>
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Link2 className="w-4 h-4" />
                        Convites Criados ({invites.length})
                    </h3>

                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                            Carregando convites...
                        </div>
                    ) : invites.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <QrCode className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Nenhum convite criado ainda</p>
                                <p className="text-xs mt-1">Crie convites para rastrear quem acessa o portal por categoria.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {invites.map((invite) => (
                                <Card key={invite.id} className={cn(
                                    "transition-all hover:shadow-md",
                                    !invite.is_active && "opacity-60"
                                )}>
                                    <CardContent className="p-4 space-y-3">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={cn("p-1.5 rounded-lg", categoryColor(invite.access_level))}>
                                                    {categoryIcon(invite.access_level)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm truncate">{invite.label || invite.code}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className={cn("text-[10px] px-1.5", categoryColor(invite.access_level))}>
                                                            {categoryLabel(invite.access_level)}
                                                        </Badge>
                                                        {!invite.is_active && (
                                                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                                                                Revogado
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Code */}
                                        <div className="font-mono text-xs bg-muted/50 rounded-lg px-3 py-2 text-center font-bold tracking-widest text-muted-foreground">
                                            {invite.code}
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                            <span>Usos: <strong className="text-foreground">{invite.uses_count}</strong>{invite.max_uses ? ` / ${invite.max_uses}` : ''}</span>
                                            <span>Criado: {format(new Date(invite.created_at), 'dd/MM/yy', { locale: ptBR })}</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1.5">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 h-8 text-[11px] gap-1"
                                                onClick={() => copyToClipboard(getInviteUrl(invite), `invite-${invite.id}`)}
                                            >
                                                {copiedKey === `invite-${invite.id}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                                Copiar Link
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-8 text-[11px] gap-1 bg-[#25D366] hover:bg-[#128C7E] text-white border-0"
                                                onClick={() => shareOnWhatsApp(invite)}
                                            >
                                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                </svg>
                                                WhatsApp
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 shrink-0"
                                                onClick={() => toggleInvite(invite.id, !invite.is_active)}
                                                title={invite.is_active ? 'Revogar' : 'Reativar'}
                                            >
                                                {invite.is_active
                                                    ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                                                    : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                                }
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                                onClick={() => {
                                                    if (confirm('Excluir este convite permanentemente?')) deleteInvite(invite.id);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
