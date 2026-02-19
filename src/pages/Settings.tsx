import { useRef, useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2, AlertTriangle, Copy, Link, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServiceState } from '@/hooks/useServiceState';
import { useSettingsActions } from '@/hooks/useSettingsActions';

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

export default function Settings() {
  const { exportData, importData } = useAppData();
  const { state: serviceState, updateServiceState } = useServiceState();
  const { resetAllCloudData } = useSettingsActions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // ── Buscar status do portal ──
  const fetchLastPublish = async () => {
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase
        .from('portal_schedules')
        .select('published_at')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLastPublished(data.published_at);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchLastPublish();
  }, []);

  // ── Link do portal ──
  const portalUrl = `${window.location.origin}/portal`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      toast.success('Copiado!');
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const portalGroups = [
    {
      key: 'emult',
      label: 'eMult',
      code: 'EMULT2025',
      color: 'bg-primary/10 border-primary/30 text-primary',
      badge: 'bg-primary/10 text-primary',
    },
    {
      key: 'nurse',
      label: 'Enfermeiros',
      code: 'ENFERMEIRO2025',
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    {
      key: 'tech',
      label: 'Técnicos',
      code: 'TECNICO2025',
      color: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
  ];

  const handleExport = () => {
    // Get eMult data from cloud hook
    const emultData = JSON.parse(exportData());

    const fullBackup: FullBackupData = {
      emult: emultData,
      serviceSchedule: {
        professionals: serviceState.professionals,
        entries: serviceState.entries,
        creditsUsed: {}, // Placeholder as it's computed now
        leaveRequests: serviceState.requests,
      },
      backupVersion: 2,
      backupDate: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(fullBackup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala-completa-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup completo exportado (eMult + Escalas de Serviço)');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = JSON.parse(content);

        // Check if it's the new full backup format (version 2)
        if (parsed.backupVersion === 2 && parsed.emult && parsed.serviceSchedule) {
          // Import eMult data
          const emultSuccess = importData(JSON.stringify(parsed.emult));

          // Import service schedule data directly to cloud state
          updateServiceState(() => ({
            professionals: parsed.serviceSchedule.professionals || [],
            entries: parsed.serviceSchedule.entries || [],
            requests: parsed.serviceSchedule.leaveRequests || [],
          }));

          if (emultSuccess) {
            toast.success('Backup completo importado com sucesso');
            // Reload to ensure all components sync with new cloud state
            setTimeout(() => window.location.reload(), 1000);
          } else {
            toast.error('Erro ao importar dados eMult');
          }
        } else {
          // Legacy format - try to import as eMult only
          const success = importData(content);
          if (success) {
            toast.success('Dados eMult importados (formato antigo)');
          } else {
            toast.error('Erro ao importar dados. Verifique o arquivo.');
          }
        }
      } catch (err) {
        console.error('Erro na importação:', err);
        toast.error('Erro ao ler arquivo de backup');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (confirm('ATENÇÃO: Isso apagará TODOS os dados (eMult + Escalas de Serviço) na NUVEM. Esta ação não pode ser desfeita. Continuar?')) {
      if (confirm('Tem certeza? Todos os profissionais, unidades, escalas e pedidos de folga serão perdidos para sempre em todos os seus dispositivos.')) {
        await resetAllCloudData();
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  };


  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Backup, restauração e links de acesso"
      />

      <div className="space-y-6 max-w-2xl">

        {/* ── Link do Portal ── */}
        <div className="form-section">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <Link className="w-4 h-4 text-primary" />
            Link do Portal de Visualização
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Copie o link abaixo e envie para os profissionais. Cada grupo usa um código diferente para acessar apenas a sua escala.
          </p>

          {/* Status da Publicação */}
          <div className="mb-4 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Status do Portal:</span>
            {loadingStatus ? (
              <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : lastPublished ? (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Publicado em {format(new Date(lastPublished), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            ) : (
              <span className="text-amber-600 font-medium">Nunca publicado</span>
            )}
            <button
              onClick={fetchLastPublish}
              className="ml-auto text-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar status
            </button>
          </div>

          {/* URL */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-muted rounded-lg px-4 py-2.5 font-mono text-sm border border-border text-primary underline underline-offset-2 hover:bg-muted/70 transition-colors truncate block"
            >
              {portalUrl}
            </a>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(portalUrl, '_blank')}
              >
                <Link className="w-4 h-4" />
                Abrir Portal
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => copyToClipboard(portalUrl, 'url')}
              >
                {copiedKey === 'url'
                  ? <Check className="w-4 h-4 text-green-600" />
                  : <Copy className="w-4 h-4" />}
                {copiedKey === 'url' ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          </div>

          {/* Códigos por grupo */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Códigos de acesso por grupo
          </p>
          <div className="space-y-3">
            {portalGroups.map(group => (
              <div
                key={group.key}
                className={cn('rounded-xl border p-4 flex items-center justify-between gap-3', group.color)}
              >
                <div className="min-w-0">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full mb-1 inline-block', group.badge)}>
                    {group.label}
                  </span>
                  <div className="font-mono font-bold text-xl tracking-widest">{group.code}</div>
                  <p className="text-xs opacity-60 mt-0.5 truncate">
                    "{`Acesse ${portalUrl} — código: ${group.code}`}"
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => copyToClipboard(group.code, `code-${group.key}`)}
                  >
                    {copiedKey === `code-${group.key}`
                      ? <Check className="w-3.5 h-3.5" />
                      : <Copy className="w-3.5 h-3.5" />}
                    Código
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        `Acesse ${portalUrl} e use o código ${group.code} para visualizar sua escala.`,
                        `msg-${group.key}`
                      )
                    }
                  >
                    {copiedKey === `msg-${group.key}`
                      ? <Check className="w-3.5 h-3.5" />
                      : <Copy className="w-3.5 h-3.5" />}
                    Mensagem
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Backup */}
        <div className="form-section">
          <h3 className="font-semibold mb-4">Backup Completo</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Exporte todos os dados em formato JSON (Escalas eMult + Escalas de Serviço + Pedidos de Folga).
          </p>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Backup Completo
          </Button>
        </div>

        {/* Restore */}
        <div className="form-section">
          <h3 className="font-semibold mb-4">Restaurar</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Importe um arquivo de backup. Os dados atuais serão substituídos.
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
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar Backup
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="form-section border-destructive/50">
          <h3 className="font-semibold mb-4 text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Zona de Perigo
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Apagar todos os dados do sistema (eMult + Escalas de Serviço). Esta ação é irreversível.
          </p>
          <Button variant="destructive" onClick={handleReset}>
            <Trash2 className="w-4 h-4 mr-2" />
            Resetar Todos os Dados
          </Button>
        </div>
      </div>
    </div>
  );
}
