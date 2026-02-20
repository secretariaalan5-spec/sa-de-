import { useRef, useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { generatePortalCode } from '@/contexts/AppDataContext';
import type { PortalCodes } from '@/contexts/AppDataContext';
import { Button } from '@/components/ui/button';
import {
  Download, Upload, Trash2, AlertTriangle, Copy,
  Check, RefreshCw, Globe, Database, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServiceState } from '@/hooks/useServiceState';
import { useSettingsActions } from '@/hooks/useSettingsActions';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface FullBackupData {
  emult: any;
  serviceSchedule: {
    professionals: any[];
    entries: any[];
    creditsUsed: Record<string, number>;
    leaveRequests: any[];
  };
  backupVersion: number;
  backupDate: string;
}

// ── Página principal ───────────────────────────────────────────────────────

export default function Settings() {
  const { exportData, importData, userId, portalCodes, updatePortalCodes } = useAppData();
  const { state: serviceState, updateServiceState } = useServiceState();
  const { resetAllCloudData } = useSettingsActions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // ── Status do portal ──
  const fetchLastPublish = async () => {
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase
        .from('portal_schedules')
        .select('published_at')
        .eq('user_id', userId)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) setLastPublished(data.published_at);
    } catch (err) {
      console.error('Erro ao buscar status do portal:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { fetchLastPublish(); }, []);

  // ── URL do portal ──
  const portalUrl = `${window.location.origin}/portal?admin=${userId || ''}`;

  // ── Clipboard ──
  const copyToClipboard = (text: string, key: string) => {
    if (!text) {
      toast.error('O link ainda não está pronto. Aguarde um momento.');
      return;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedKey(key);
      toast.success('Copiado!');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Fallback copy failed', err);
      toast.error('Erro ao copiar. Tente selecionar o texto manualmente.');
    }
    document.body.removeChild(textArea);
  };

  // ── Dados das equipes ──
  const teams = [
    {
      key: 'emult' as keyof PortalCodes,
      label: 'eMult',
      code: portalCodes.emult,
      bgClass: 'bg-primary/5 border-primary/20',
      badgeClass: 'bg-primary/15 text-primary',
      codeColor: 'text-primary',
    },
    {
      key: 'nurse' as keyof PortalCodes,
      label: 'Enfermeiros',
      code: portalCodes.nurse,
      bgClass: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      codeColor: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      key: 'tech' as keyof PortalCodes,
      label: 'Técnicos',
      code: portalCodes.tech,
      bgClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      codeColor: 'text-blue-700 dark:text-blue-300',
    },
  ];

  const shareOnWhatsApp = (label: string, code: string) => {
    const text =
      `*Escala eMulti - ${label}*\n\n` +
      `Olá equipe! A escala foi atualizada.\n\n` +
      `🔗 *Link:* ${portalUrl}\n` +
      `🔑 *Código de Acesso:* ${code}\n\n` +
      `_Acesse o link e digite o código para visualizar._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ── Exportação de backup completo ──
  const handleExport = () => {
    const emultData = JSON.parse(exportData());
    const fullBackup: FullBackupData = {
      emult: emultData,
      serviceSchedule: {
        professionals: serviceState.professionals,
        entries: serviceState.entries,
        creditsUsed: {},
        leaveRequests: serviceState.requests,
      },
      backupVersion: 2,
      backupDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala-completa-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup completo exportado!');
  };

  // ── Importação de backup ──
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.backupVersion === 2 && parsed.emult && parsed.serviceSchedule) {
          const emultSuccess = importData(JSON.stringify(parsed.emult));
          updateServiceState(() => ({
            professionals: parsed.serviceSchedule.professionals || [],
            entries: parsed.serviceSchedule.entries || [],
            requests: parsed.serviceSchedule.leaveRequests || [],
          }));
          if (emultSuccess) {
            toast.success('Backup importado com sucesso!');
            setTimeout(() => window.location.reload(), 1000);
          } else {
            toast.error('Erro ao importar dados eMult.');
          }
        } else {
          const success = importData(e.target?.result as string);
          if (success) toast.success('Dados importados (formato legado).');
          else toast.error('Erro ao importar. Verifique o arquivo.');
        }
      } catch {
        toast.error('Erro ao ler o arquivo de backup.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Reset ──
  const handleReset = async () => {
    const c1 = confirm('ATENÇÃO: Isso apagará TODOS os dados (eMult + Escalas de Serviço) da NUVEM. Esta ação não pode ser desfeita. Continuar?');
    if (!c1) return;
    const c2 = confirm('Tem certeza? Todos os profissionais, unidades, escalas e pedidos de folga serão perdidos para sempre em todos os seus dispositivos.');
    if (!c2) return;
    await resetAllCloudData();
    setTimeout(() => window.location.reload(), 1000);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Gerencie o acesso ao portal e faça backup dos dados"
      />

      <div className="space-y-5 max-w-3xl">

        {/* ── Portal ── */}
        <section className="form-section">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary shrink-0" />
              Portal de Visualização
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => window.open(portalUrl, '_blank')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Portal
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Compartilhe o link e o código de cada equipe. O acesso é separado por grupo.
          </p>

          {/* Status de publicação */}
          <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2 mb-4">
            <span className="text-muted-foreground font-medium">Status:</span>
            {loadingStatus ? (
              <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : lastPublished ? (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Publicado em {format(new Date(lastPublished), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            ) : (
              <span className="text-amber-600 font-medium">Nunca publicado</span>
            )}
            <button
              onClick={fetchLastPublish}
              className="ml-auto text-primary hover:text-primary/70 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar
            </button>
          </div>

          {/* Cards por equipe */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {teams.map(team => {
              const fullLink = `${portalUrl}&code=${team.code}`;
              return (
                <div key={team.key} className={cn('rounded-xl border p-4 flex flex-col gap-3', team.bgClass)}>

                  {/* Badge da equipe */}
                  <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full self-start', team.badgeClass)}>
                    {team.label}
                  </span>

                  {/* Código */}
                  <div className={cn('font-mono font-bold text-xl tracking-widest text-center py-1 select-all', team.codeColor)}>
                    {team.code}
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8 text-[11px] bg-white/60 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20"
                      onClick={() => copyToClipboard(team.code, `code-${team.key}`)}
                    >
                      {copiedKey === `code-${team.key}`
                        ? <Check className="w-3 h-3 text-green-600" />
                        : <Copy className="w-3 h-3" />}
                      Código
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8 text-[11px] bg-white/60 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20"
                      onClick={() => copyToClipboard(fullLink, `link-${team.key}`)}
                    >
                      {copiedKey === `link-${team.key}`
                        ? <Check className="w-3 h-3 text-green-600" />
                        : <Copy className="w-3 h-3" />}
                      Link
                    </Button>
                  </div>

                  {/* WhatsApp */}
                  <Button
                    size="sm"
                    className="gap-2 h-9 text-[11px] bg-[#25D366] hover:bg-[#128C7E] text-white border-0"
                    onClick={() => shareOnWhatsApp(team.label, team.code)}
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Enviar via WhatsApp
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Backup & Restauração ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section className="form-section">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-primary" />
              Exportar Backup
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Salve todos os dados em JSON (eMult + Escalas de Serviço + Pedidos de Folga).
            </p>
            <Button onClick={handleExport} className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Exportar Backup
            </Button>
          </section>

          <section className="form-section">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-primary" />
              Restaurar Backup
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Importe um arquivo de backup. Os dados atuais serão completamente substituídos.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Backup
            </Button>
          </section>
        </div>

        {/* ── Zona de Perigo ── */}
        <section className="form-section border-destructive/30">
          <h3 className="font-semibold mb-1 text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Zona de Perigo
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Apaga permanentemente todos os dados (eMult + Escalas de Serviço) da nuvem e de todos os dispositivos.
            <strong className="text-destructive"> Esta ação é irreversível.</strong>
          </p>
          <Button variant="destructive" onClick={handleReset}>
            <Trash2 className="w-4 h-4 mr-2" />
            Resetar Todos os Dados
          </Button>
        </section>

      </div>
    </div>
  );
}
