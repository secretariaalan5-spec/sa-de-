import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Briefcase, Plus, Pencil, Trash2 } from 'lucide-react';
import { ProfessionalFunction } from '@/types';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899',
  '#6366F1', '#14B8A6', '#84CC16', '#F97316', '#DC2626', '#D946EF',
];

export default function Functions() {
  const { data, addFunction, updateFunction, deleteFunction } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProfessionalFunction | null>(null);
  const [form, setForm] = useState({
    name: '',
    color: PRESET_COLORS[0],
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] });
    setDialogOpen(true);
  };

  const openEdit = (func: ProfessionalFunction) => {
    setEditing(func);
    setForm({
      name: func.name,
      color: func.color,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Preencha o nome da função');
      return;
    }

    if (editing) {
      updateFunction(editing.id, form);
      toast.success('Função atualizada');
    } else {
      addFunction(form);
      toast.success('Função cadastrada');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    const professionalsUsing = data.professionals.filter(p => p.functionId === id);
    if (professionalsUsing.length > 0) {
      toast.error(`Não é possível excluir. ${professionalsUsing.length} profissional(is) usa(m) esta função.`);
      return;
    }
    if (confirm(`Excluir a função ${name}?`)) {
      deleteFunction(id);
      toast.success('Função excluída');
    }
  };

  // Count professionals per function
  const getProfessionalCount = (funcId: string) => {
    return data.professionals.filter(p => p.functionId === funcId).length;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Funções" 
        description="Gerencie as funções profissionais"
        action={
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Função
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.functions.map((func) => (
          <div 
            key={func.id} 
            className="form-section flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: func.color + '20' }}
              >
                <Briefcase className="w-5 h-5" style={{ color: func.color }} />
              </div>
              <div>
                <p className="font-medium">{func.name}</p>
                <p className="text-sm text-muted-foreground">
                  {getProfessionalCount(func.id)} profissional(is)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(func)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(func.id, func.name)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Função' : 'Nova Função'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Psicólogo"
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      form.color === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
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
