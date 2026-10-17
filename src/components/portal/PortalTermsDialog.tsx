import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, FileText, Camera, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  employeeName: string;
  onAccept: (consentPhoto: boolean) => Promise<void>;
  loading: boolean;
}

export default function PortalTermsDialog({ open, employeeName, onAccept, loading }: Props) {
  const [photoConsent, setPhotoConsent] = useState(true);
  const [agreedGeneral, setAgreedGeneral] = useState(false);

  const firstName = employeeName.split(' ')[0] || employeeName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedGeneral) return;
    await onAccept(photoConsent);
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-lg max-h-[92vh] overflow-y-auto p-5 sm:p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-semibold text-xs w-fit">
            <ShieldCheck size={14} />
            <span>Conformidade Legal & LGPD</span>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Termo de Uso e Ciência de Dados Funcionais
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Bem-vindo(a), <strong className="text-foreground">{firstName}</strong>! Para garantir sua segurança jurídica e a transparência das informações, leia e confirme os termos abaixo no seu primeiro acesso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Caixa de Texto dos Termos */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3 text-xs text-foreground/80 leading-relaxed max-h-56 overflow-y-auto">
            <div className="flex items-start gap-2">
              <Lock size={15} className="text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">1. Finalidade do Acesso (Art. 7º, II e III da LGPD)</strong>
                Este portal tem caráter estritamente institucional para consulta individual de escalas de trabalho, turnos, lotação, solicitações de folgas e saldo de créditos compensatórios decorrentes de plantões.
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText size={15} className="text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">2. Segurança e Sigilo do Código Pessoal</strong>
                Seu código de acesso é pessoal e intransferível. Todas as sessões são auditadas eletronicamente para resguardar a integridade dos seus dados funcionais e evitar acessos não autorizados.
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Camera size={15} className="text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">3. Uso da Foto de Perfil Institucional</strong>
                Ao carregar uma foto de identificação, você autoriza seu uso exclusivo para identificação visual nas escalas de serviço da Secretaria de Saúde e no painel institucional de equipe.
              </div>
            </div>
          </div>

          {/* Checkboxes de Consentimento */}
          <div className="space-y-3 pt-1">
            <label
              htmlFor="agree-general"
              className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <Checkbox
                id="agree-general"
                checked={agreedGeneral}
                onCheckedChange={(checked) => setAgreedGeneral(!!checked)}
                className="mt-0.5"
              />
              <span className="text-xs font-medium text-foreground leading-snug">
                Declaro que li e estou ciente das condições de uso do Portal do Profissional e autorizo o tratamento dos meus registros funcionais (obrigatório).
              </span>
            </label>

            <label
              htmlFor="photo-consent"
              className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <Checkbox
                id="photo-consent"
                checked={photoConsent}
                onCheckedChange={(checked) => setPhotoConsent(!!checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                Autorizo a exibição da minha foto de perfil nas grades de escalas e identificadores visuais do sistema de saúde.
              </span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={!agreedGeneral || loading}
            className="w-full font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-10 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Registrando Aceite...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Concordar e Acessar Meu Portal</span>
              </>
            )}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground">
            Registro eletrônico gravado com carimbo de tempo (UTC-3) conforme a Lei Federal nº 13.709/2018 (LGPD).
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
