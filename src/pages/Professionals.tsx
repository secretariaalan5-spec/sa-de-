import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { Professional } from '@/types';
import { toast } from 'sonner';

export default function Professionals() {
  const { data, addProfessional, updateProfessional, deleteProfessional, getWeeklyHoursUsed } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [form, setForm] = useState({
    name: '',
    functionId: '',
    team: '',
    weeklyHours: 40,
    active: true,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', functionId: '', team: '', weeklyHours: 40, active: true });
    setDialogOpen(true);
  };

  const openEdit = (prof: Professional) => {
    setEditing(prof);
    setForm({
      name: prof.name,
      functionId: prof.functionId,
      team: prof.team,
      weeklyHours: prof.weeklyHours,
      active: prof.active,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.functionId) {
      toast.error('Preencha nome e função');
      return;
    }

    if (editing) {
      updateProfessional(editing.id, form);
      toast.success('Profissional atualizado');
    } else {
      addProfessional(form);
      toast.success('Profissional cadastrado');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Excluir ${name}? As escalas serão removidas.`)) {
      deleteProfessional(id);
      toast.success('Profissional excluído');
    }
  };

  const getFunction = (id: string) => data.functions.find(f => f.id === id);

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Profissionais" 
        description="Gerencie os profissionais da equipe eMult"
        action={
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Profissional
          </Button>
        }
      />

      {data.professionals.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum profissional cadastrado"
          description="Comece adicionando os profissionais da equipe eMult"
          actionLabel="Cadastrar Profissional"
          onAction={openNew}
        />
      ) : (
        <div className="form-section overflow-x-auto">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="text-left">Nome</th>
                <th className="text-left">Função</th>
                <th className="text-left">Equipe</th>
                <th className="text-center">CH Semanal</th>
                <th className="text-center">CH Usada</th>
                <th className="text-center">Status</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.professionals.map((prof) => {
                const func = getFunction(prof.functionId);
                const usedHours = getWeeklyHoursUsed(prof.id);
                return (
                  <tr key={prof.id}>
                    <td className="font-medium">{prof.name}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: func?.color || '#888' }}
                        />
                        {func?.name || '-'}
                      </div>
                    </td>
                    <td>{prof.team || '-'}</td>
                    <td className="text-center">{prof.weeklyHours}h</td>
                    <td className="text-center">
                      <span className={usedHours > prof.weeklyHours ? 'text-destructive font-semibold' : ''}>
                        {usedHours}h
                      </span>
                    </td>
                    <td className="text-center">
                      <StatusBadge active={prof.active} />
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(prof)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(prof.id, prof.name)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>Função *</Label>
              <Select value={form.functionId} onValueChange={(v) => setForm({ ...form, functionId: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {data.functions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Equipe eMult</Label>
              <Input
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value })}
                placeholder="Ex: Equipe 1"
              />
            </div>
            <div>
              <Label>Carga Horária Semanal</Label>
              <Input
                type="number"
                min={1}
                max={44}
                value={form.weeklyHours}
                onChange={(e) => setForm({ ...form, weeklyHours: parseInt(e.target.value) || 40 })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
