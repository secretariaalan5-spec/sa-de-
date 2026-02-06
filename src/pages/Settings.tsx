import { useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2, AlertTriangle, Globe, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
// Storage keys for service schedule data
const SERVICE_STORAGE_KEYS = {
  professionals: 'serviceProfessionals',
  entries: 'serviceSchedule_entries',
  creditsUsed: 'serviceSchedule_creditsUsed',
  leaveRequests: 'leaveRequests',
};

interface FullBackupData {
  emult: ReturnType<typeof JSON.parse>;
  serviceSchedule: {
    professionals: unknown[];
    entries: unknown[];
    creditsUsed: Record<string, number>;
    leaveRequests: unknown[];
  };
  backupVersion: number;
  backupDate: string;
}

export default function Settings() {
  const { exportData, importData, resetData } = useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleExport = () => {
    // Get eMult data
    const emultData = JSON.parse(exportData());
    
    // Get service schedule data from localStorage
    const serviceProfessionals = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEYS.professionals) || '[]');
    const serviceEntries = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEYS.entries) || '[]');
    const serviceCreditsUsed = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEYS.creditsUsed) || '{}');
    const leaveRequests = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEYS.leaveRequests) || '[]');

    const fullBackup: FullBackupData = {
      emult: emultData,
      serviceSchedule: {
        professionals: serviceProfessionals,
        entries: serviceEntries,
        creditsUsed: serviceCreditsUsed,
        leaveRequests: leaveRequests,
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

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        
        // Check if it's the new full backup format (version 2)
        if (parsed.backupVersion === 2 && parsed.emult && parsed.serviceSchedule) {
          // Import eMult data
          const emultSuccess = importData(JSON.stringify(parsed.emult));
          
          // Import service schedule data
          localStorage.setItem(SERVICE_STORAGE_KEYS.professionals, JSON.stringify(parsed.serviceSchedule.professionals || []));
          localStorage.setItem(SERVICE_STORAGE_KEYS.entries, JSON.stringify(parsed.serviceSchedule.entries || []));
          localStorage.setItem(SERVICE_STORAGE_KEYS.creditsUsed, JSON.stringify(parsed.serviceSchedule.creditsUsed || {}));
          localStorage.setItem(SERVICE_STORAGE_KEYS.leaveRequests, JSON.stringify(parsed.serviceSchedule.leaveRequests || []));
          
          if (emultSuccess) {
            toast.success('Backup completo importado com sucesso');
            // Reload to refresh all hooks
            window.location.reload();
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
      } catch {
        toast.error('Erro ao ler arquivo de backup');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (confirm('ATENÇÃO: Isso apagará TODOS os dados (eMult + Escalas de Serviço). Esta ação não pode ser desfeita. Continuar?')) {
      if (confirm('Tem certeza? Todos os profissionais, unidades, escalas e pedidos de folga serão perdidos.')) {
        // Reset eMult data
        resetData();
        
        // Reset service schedule data
        localStorage.removeItem(SERVICE_STORAGE_KEYS.professionals);
        localStorage.removeItem(SERVICE_STORAGE_KEYS.entries);
        localStorage.removeItem(SERVICE_STORAGE_KEYS.creditsUsed);
        localStorage.removeItem(SERVICE_STORAGE_KEYS.leaveRequests);
        
        toast.success('Todos os dados foram resetados');
        window.location.reload();
      }
    }
  };

  const handlePublishToPortal = async () => {
    setIsPublishing(true);
    try {
      // Get eMult data
      const emultData = JSON.parse(exportData());
      
      // Get service schedule data from localStorage
      const serviceProfessionals = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEYS.professionals) || '[]');
      const nurseEntries = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEYS.entries) || '[]').filter(
        (e: { type: string }) => e.type === 'nurse'
      );
      const techEntries = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEYS.entries) || '[]').filter(
        (e: { type: string }) => e.type === 'tech'
      );

      const emult_data = {
        professionals: emultData.professionals || [],
        units: emultData.units || [],
        functions: emultData.functions || [],
        schedule: emultData.schedule || [],
      };

      const service_data = {
        professionals: serviceProfessionals,
        nurseEntries,
        techEntries,
      };

      const { error } = await supabase
        .from('portal_schedules')
        .insert({
          emult_data,
          service_data,
        });

      if (error) throw error;

      toast.success('Escalas publicadas no portal com sucesso!');
    } catch (error) {
      console.error('Erro ao publicar:', error);
      toast.error('Erro ao publicar escalas. Tente novamente.');
    } finally {
      setIsPublishing(false);
    }
  };

  const getPortalUrl = () => {
    return `${window.location.origin}/portal`;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Backup, restauração de dados e publicação no portal"
      />

      <div className="space-y-6 max-w-2xl">

        {/* Portal */}
        <div className="form-section border-primary/30 bg-primary/5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Portal de Visualização
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Publique as escalas para que os gerentes de unidade possam visualizar. 
            O portal é público e mostra apenas as informações de escala (sem dados de créditos ou folgas).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handlePublishToPortal} disabled={isPublishing}>
              {isPublishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {isPublishing ? 'Publicando...' : 'Publicar no Portal'}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(getPortalUrl(), '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir Portal
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Link do portal: <code className="bg-muted px-1 rounded">{getPortalUrl()}</code>
          </p>
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
