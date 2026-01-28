import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Plus, Trash2, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function Restrictions() {
  const { data, addRestriction, deleteRestriction } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [restrictionType, setRestrictionType] = useState<'unit' | 'professional'>('unit');
  const [form, setForm] = useState({
    professionalId: '',
    targetId: '',
    reason: '',
  });

  const openNew = (type: 'unit' | 'professional') => {
    setRestrictionType(type);
    setForm({ professionalId: '', targetId: '', reason: '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.professionalId || !form.targetId) {
      toast.error('Selecione todos os campos');
      return;
    }

    // Check duplicate
    const exists = data.restrictions.find(r => 
      r.type === restrictionType &&
      r.professionalId === form.professionalId &&
      r.targetId === form.targetId
    );

    if (exists) {
      toast.error('Esta restrição já existe');
      return;
    }

    addRestriction({
      type: restrictionType,
      professionalId: form.professionalId,
      targetId: form.targetId,
      reason: form.reason,
    });
    toast.success('Restrição cadastrada');
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir esta restrição?')) {
      deleteRestriction(id);
      toast.success('Restrição excluída');
    }
  };

  const getProfessional = (id: string) => data.professionals.find(p => p.id === id);
  const getUnit = (id: string) => data.units.find(u => u.id === id);

  const unitRestrictions = data.restrictions.filter(r => r.type === 'unit');
  const professionalRestrictions = data.restrictions.filter(r => r.type === 'professional');

  const activeProfessionals = data.professionals.filter(p => p.active);

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Restrições" 
        description="Configure restrições de escala"
      />

      <Tabs defaultValue="unit" className="space-y-6">
        <TabsList>
          <TabsTrigger value="unit" className="gap-2">
            <Building2 className="w-4 h-4" />
            Por Unidade
          </TabsTrigger>
          <TabsTrigger value="professional" className="gap-2">
            <Users className="w-4 h-4" />
            Entre Profissionais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unit" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openNew('unit')}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Restrição
            </Button>
          </div>

          {unitRestrictions.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Nenhuma restrição por unidade"
              description="Defina quais profissionais não podem atuar em determinadas unidades"
              actionLabel="Adicionar Restrição"
              onAction={() => openNew('unit')}
            />
          ) : (
            <div className="form-section overflow-x-auto">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th className="text-left">Profissional</th>
                    <th className="text-left">Unidade Restrita</th>
                    <th className="text-left">Motivo</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRestrictions.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{getProfessional(r.professionalId)?.name || '-'}</td>
                      <td>{getUnit(r.targetId)?.name || '-'}</td>
                      <td className="text-muted-foreground">{r.reason || '-'}</td>
                      <td className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="professional" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openNew('professional')}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Restrição
            </Button>
          </div>

          {professionalRestrictions.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Nenhuma restrição entre profissionais"
              description="Defina quais profissionais não podem trabalhar juntos"
              actionLabel="Adicionar Restrição"
              onAction={() => openNew('professional')}
            />
          ) : (
            <div className="form-section overflow-x-auto">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th className="text-left">Profissional 1</th>
                    <th className="text-left">Profissional 2</th>
                    <th className="text-left">Motivo</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {professionalRestrictions.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{getProfessional(r.professionalId)?.name || '-'}</td>
                      <td className="font-medium">{getProfessional(r.targetId)?.name || '-'}</td>
                      <td className="text-muted-foreground">{r.reason || '-'}</td>
                      <td className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>
              {restrictionType === 'unit' ? 'Restrição por Unidade' : 'Restrição entre Profissionais'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Profissional *</Label>
              <Select value={form.professionalId} onValueChange={(v) => setForm({ ...form, professionalId: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {activeProfessionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{restrictionType === 'unit' ? 'Unidade Restrita *' : 'Não pode trabalhar com *'}</Label>
              <Select value={form.targetId} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {restrictionType === 'unit' ? (
                    data.units.filter(u => u.active).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))
                  ) : (
                    activeProfessionals
                      .filter(p => p.id !== form.professionalId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Descreva o motivo"
              />
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
