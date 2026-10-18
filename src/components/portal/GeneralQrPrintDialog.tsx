import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  QrCode,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Download,
  Smartphone,
  Info,
} from 'lucide-react';
import logoSaude from '@/assets/logo-saude.png';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitName?: string | null;
}

export default function GeneralQrPrintDialog({ open, onOpenChange, unitName }: Props) {
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : 'https://saude.gov.br/portal';
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="print:hidden">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <QrCode size={18} />
            <span>Cartaz Oficial do Portal do Profissional</span>
          </div>
          <DialogTitle className="text-xl font-black">
            QR Code Geral para Mural e Impressão
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Imprima e fixe este cartaz no mural da unidade ou repasse à equipe. O profissional só precisa escanear o QR Code e digitar seu código pessoal de 3 dígitos.
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Ações Superior (Apenas na tela) */}
        <div className="print:hidden flex items-center justify-between gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-primary font-semibold">
            <Printer size={16} />
            <span>Formato pronto para folha A4 vertical</span>
          </div>
          <Button
            onClick={handlePrint}
            className="gap-2 h-9 text-xs font-bold shadow-md bg-primary hover:bg-primary/90 text-white"
          >
            <Printer size={15} />
            <span>Imprimir Cartaz Agora</span>
          </Button>
        </div>

        {/* ================================================================= */}
        {/* ÁREA IMPRIMÍVEL (A4 Vertical)                                     */}
        {/* ================================================================= */}
        <div
          ref={printAreaRef}
          className="printable-cartaz bg-white text-slate-900 border-2 border-slate-300 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0"
        >
          {/* Cabeçalho Institucional */}
          <div className="flex items-center justify-between border-b-2 border-slate-900/10 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={logoSaude}
                alt="Saúde+"
                className="w-14 h-14 object-contain rounded-xl border border-slate-200 p-1 bg-slate-50"
              />
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary block">
                  Secretaria Municipal de Saúde
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                  Portal do Profissional
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  Sistema Oficial de Escalas, Plantões e Folgas
                </p>
              </div>
            </div>

            {unitName && (
              <div className="text-right border-l pl-4 border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Unidade
                </span>
                <span className="text-sm font-black text-slate-800">
                  {unitName}
                </span>
              </div>
            )}
          </div>

          {/* Destaque Central: QR Code + Chamada */}
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="p-4 bg-white rounded-3xl border-4 border-primary/20 shadow-xl inline-block print:border-2 print:border-slate-800">
              <QRCodeSVG
                value={portalUrl}
                size={230}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-black text-xs uppercase tracking-wider">
                <Smartphone size={13} />
                Aponte a câmera do seu celular aqui
              </span>
              <p className="text-xs font-mono text-slate-500 select-all pt-1">
                {portalUrl}
              </p>
            </div>
          </div>

          {/* Passo a Passo Ilustrado */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500" />
              Como Acessar em 3 Passos Simples:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              {/* Passo 1 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center">
                  1
                </div>
                <h4 className="text-xs font-bold text-slate-900">Abra a Câmera</h4>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Aponte a câmera do seu celular para o QR Code acima e toque na notificação para abrir.
                </p>
              </div>

              {/* Passo 2 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center">
                  2
                </div>
                <h4 className="text-xs font-bold text-slate-900">Digite seu Código</h4>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Digite seu <strong>Código Pessoal de 3 dígitos</strong> fornecido pela sua coordenação ou RH.
                </p>
              </div>

              {/* Passo 3 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center">
                  3
                </div>
                <h4 className="text-xs font-bold text-slate-900">Consulte Tudo</h4>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Veja suas escalas, plantões extras e saldo de folgas atualizados em tempo real.
                </p>
              </div>
            </div>
          </div>

          {/* O que o Servidor pode fazer no Portal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
              <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1" />
              <span className="font-bold block text-slate-800 text-[11px]">Escalas do Mês</span>
              <span className="text-[10px] text-slate-500">Horários e postos</span>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
              <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1" />
              <span className="font-bold block text-slate-800 text-[11px]">Saldo de Folgas</span>
              <span className="text-[10px] text-slate-500">Créditos de plantão</span>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
              <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1" />
              <span className="font-bold block text-slate-800 text-[11px]">Foto de Perfil</span>
              <span className="text-[10px] text-slate-500">Personalize seu card</span>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
              <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1" />
              <span className="font-bold block text-slate-800 text-[11px]">Instalação Fácil</span>
              <span className="text-[10px] text-slate-500">Ícone no seu celular</span>
            </div>
          </div>

          {/* Rodapé de Segurança e LGPD */}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10.5px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span className="font-semibold text-slate-700">
                Acesso Seguro com Bloqueio Automático Anti-Fraude e Proteção LGPD
              </span>
            </div>
            <span className="font-mono text-[10px]">
              Secretaria de Saúde • Sistema Saúde+
            </span>
          </div>
        </div>

        {/* Estilo Global de Impressão */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-cartaz, .printable-cartaz * {
              visibility: visible;
            }
            .printable-cartaz {
              position: fixed;
              left: 0;
              top: 0;
              width: 100vw;
              height: 100vh;
              padding: 2.5cm 1.5cm;
              margin: 0;
              border: none !important;
              box-shadow: none !important;
            }
          }
        ` }} />
      </DialogContent>
    </Dialog>
  );
}
