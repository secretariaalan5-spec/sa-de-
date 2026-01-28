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
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Unit } from '@/types';
import { toast } from 'sonner';

const UNIT_TYPES = [
  'UBS',
  'ESF',
  'NASF',
  'Hospital',
  'CAPS',
  'CEO',
  'Secretaria',
  'Outro',
];

export default function Units() {
  const { data, addUnit, updateUnit, deleteUnit } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: '',
    active: true,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: '', active: true });
    setDialogOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setForm({
      name: unit.name,
      type: unit.type,
      active: unit.active,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Preencha o nome da unidade');
      return;
    }

    if (editing) {
      updateUnit(editing.id, form);
      toast.success('Unidade atualizada');
    } else {
      addUnit(form);
      toast.success('Unidade cadastrada');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Excluir ${name}? As escalas serão removidas.`)) {
      deleteUnit(id);
      toast.success('Unidade excluída');
    }
  };

  // Count schedules per unit
  const getScheduleCount = (unitId: string) => {
    return data.schedule.filter(s => s.unitId === unitId).length;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Unidades" 
        description="Gerencie as unidades de saúde"
        action={
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Unidade
          </Button>
        }
      />

      {data.units.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma unidade cadastrada"
          description="Comece adicionando as unidades de saúde"
          actionLabel="Cadastrar Unidade"
          onAction={openNew}
        />
      ) : (
        <div className="form-section overflow-x-auto">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="text-left">Nome</th>
                <th className="text-left">Tipo</th>
                <th className="text-center">Escalas</th>
                <th className="text-center">Status</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.units.map((unit) => (
                <tr key={unit.id}>
                  <td className="font-medium">{unit.name}</td>
                  <td>{unit.type || '-'}</td>
                  <td className="text-center">{getScheduleCount(unit.id)}</td>
                  <td className="text-center">
                    <StatusBadge active={unit.active} />
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(unit)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(unit.id, unit.name)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da unidade"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {UNIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label>Ativa</Label>
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
