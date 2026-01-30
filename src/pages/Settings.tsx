import { useRef } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { exportData, importData, resetData } = useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const jsonString = exportData();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emult-escala-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup exportado com sucesso');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = importData(content);
      if (success) {
        toast.success('Dados importados com sucesso');
      } else {
        toast.error('Erro ao importar dados. Verifique o arquivo.');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (confirm('ATENÇÃO: Isso apagará TODOS os dados. Esta ação não pode ser desfeita. Continuar?')) {
      if (confirm('Tem certeza? Todos os profissionais, unidades e escalas serão perdidos.')) {
        resetData();
        toast.success('Dados resetados');
      }
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Backup e restauração de dados"
      />

      <div className="space-y-6 max-w-2xl">

        {/* Backup */}
        <div className="form-section">
          <h3 className="font-semibold mb-4">Backup</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Exporte seus dados em formato JSON para manter um backup seguro.
          </p>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Backup
          </Button>
        </div>

        {/* Restore */}
        <div className="form-section">
          <h3 className="font-semibold mb-4">Restaurar</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Importe um arquivo de backup previamente exportado. Os dados atuais serão substituídos.
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
            Apagar todos os dados do sistema. Esta ação é irreversível.
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
