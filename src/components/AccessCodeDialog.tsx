import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  KeyRound,
  Copy,
  RefreshCw,
  Check,
  Share2,
  ShieldCheck,
  Loader2,
  ExternalLink,
  QrCode,
  Download,
  Printer,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    name: string;
    phone?: string | null;
    unit_name?: string | null;
    category_name?: string | null;
  } | null;
}

export default function AccessCodeDialog({ open, onOpenChange, employee }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : '';
  const portalUrlWithCode = code ? `${portalUrl}?codigo=${code}` : portalUrl;

  useEffect(() => {
    if (!open || !employee?.id) {
      setCode(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    supabase
      .rpc('portal_admin_get_code', { p_employee_id: employee.id })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          toast.error('Erro ao carregar código de acesso: ' + error.message);
        } else {
          setCode(data);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, employee?.id]);

  const handleRegenerate = async () => {
    if (!employee?.id) return;
    const confirm = window.confirm(
      `Deseja realmente gerar um novo código para ${employee.name}? O código anterior deixará de funcionar imediatamente.`
    );
    if (!confirm) return;

    setRegenerating(true);
    try {
      const { data, error } = await supabase.rpc('portal_admin_regenerate_code', {
        p_employee_id: employee.id,
      });
      if (error) throw error;
      setCode(data);
      toast.success('Novo código gerado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao regerar código: ' + (err.message || ''));
    } finally {
      setRegenerating(false);
    }
  };

  const formattedCode = code || '•••';

  const getWhatsAppMessage = () => {
    const firstName = employee?.name.split(' ')[0] || '';
    return encodeURIComponent(
      `Olá, ${firstName}! 👋\n\n` +
      `Seu acesso ao *Portal do Profissional (Saúde+)* está liberado.\n\n` +
      `🔑 *Seu Código de Acesso:* *${formattedCode}*\n` +
      `🌐 *Acesse pelo link:* ${portalUrl}\n\n` +
      `No portal você acompanha suas escalas, plantões extras e saldo de folgas em tempo real.`
    );
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(formattedCode);
    setCopied(true);
    toast.success('Código copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyFullMessage = () => {
    if (!code) return;
    const msg = decodeURIComponent(getWhatsAppMessage());
    navigator.clipboard.writeText(msg);
    toast.success('Mensagem completa copiada para envio!');
  };

  const cleanPhone = employee?.phone?.replace(/\D/g, '') || '';
  const waPhone = cleanPhone.startsWith('55') ? cleanPhone : cleanPhone ? `55${cleanPhone}` : '';
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${getWhatsAppMessage()}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <KeyRound size={18} />
            <span>Acesso ao Portal do Profissional</span>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            {employee?.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {employee?.category_name || 'Profissional'} • {employee?.unit_name || 'Sem Unidade'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="code" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-10 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="code" className="text-xs font-semibold gap-1.5 rounded-lg">
              <KeyRound size={14} />
              <span>Código PIN (3 dígitos)</span>
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="text-xs font-semibold gap-1.5 rounded-lg">
              <QrCode size={14} />
              <span>QR Code Direto</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: CÓDIGO NUMÉRICO */}
          <TabsContent value="code" className="space-y-4 pt-3">
            {/* Box de Exibição do Código */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-center space-y-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Código de Acesso Pessoal (3 dígitos)
              </span>

              <div className="flex items-center justify-center gap-3">
                {loading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <Loader2 size={18} className="animate-spin text-primary" />
                    <span>Carregando código...</span>
                  </div>
                ) : (
                  <div className="font-mono text-4xl font-black tracking-[0.25em] text-primary selection:bg-primary/20">
                    {formattedCode}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  disabled={!code || loading}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerating || loading}
                  title="Gera um novo código e invalida as sessões ativas do servidor"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
                  <span>Regerar</span>
                </Button>
              </div>
            </div>

            {/* Links e Envio por WhatsApp */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Share2 size={13} className="text-primary" />
                Enviar para o Servidor:
              </span>

              <div className="grid grid-cols-2 gap-2">
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <WhatsAppIcon size={15} />
                    <span>Enviar no WhatsApp</span>
                  </a>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title="Telefone não cadastrado"
                    className="h-9 gap-1.5 text-xs text-muted-foreground"
                  >
                    <WhatsAppIcon size={14} />
                    <span>Sem WhatsApp</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyFullMessage}
                  disabled={!code || loading}
                  className="h-9 gap-1.5 text-xs font-medium"
                >
                  <Copy size={14} />
                  <span>Copiar Mensagem</span>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ABA 2: QR CODE ESCANEÁVEL COM INSTRUÇÕES RÁPIDAS */}
          <TabsContent value="qrcode" className="space-y-3 pt-3">
            <div className="p-4 rounded-2xl border border-border bg-white dark:bg-slate-900 shadow-xs flex flex-col items-center text-center space-y-3">
              {loading ? (
                <div className="h-44 w-44 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-200 inline-block">
                  <QRCodeSVG
                    value={portalUrlWithCode}
                    size={170}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              )}

              <div className="space-y-1">
                <p className="font-mono text-sm font-extrabold text-foreground tracking-wider">
                  CÓDIGO: {formattedCode}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Aponte a câmera do celular para entrar direto com o código preenchido.
                </p>
              </div>

              {/* Explicação Rápida de Como Funciona */}
              <div className="w-full text-left bg-muted/40 p-3 rounded-xl border border-border/60 space-y-1.5 text-xs">
                <span className="font-bold text-foreground text-[11px] uppercase tracking-wider block">
                  ⚡ Como funciona em 3 passos:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11.5px] leading-relaxed">
                  <li>O profissional abre a câmera do celular e aponta para o QR Code.</li>
                  <li>O link abre o Portal com o código já preenchido automaticamente.</li>
                  <li>No 1º acesso, confirma o Termo de Privacidade (LGPD) e já visualiza escalas e saldo.</li>
                </ol>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Informações de Segurança e LGPD */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5 text-[11.5px] text-muted-foreground mt-3">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Segurança & LGPD:</span>
          </div>
          <p className="leading-relaxed">
            O profissional acessa em modo <strong>somente leitura</strong> e assina digitalmente o Termo de Uso e Privacidade no primeiro login.
          </p>
          <div className="pt-1 flex items-center justify-between text-[11px] border-t border-border/50">
            <span>Link direto do portal:</span>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-mono inline-flex items-center gap-1 hover:underline"
            >
              /portal <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
