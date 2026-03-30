import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, Trash2, Users, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAppData } from '@/hooks/useAppData';
import { cn } from '@/lib/utils';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

interface UnitRow {
  id: string;
  name: string;
  type: string;
  active: boolean;
  manager_id: string | null;
  created_at: string;
}

const UNIT_TYPES = ['UBS', 'ESF', 'NASF', 'Hospital', 'CAPS', 'CEO', 'Secretaria', 'Outro'];

export default function Units() {
  const { teamId } = useAppData();
  const { canWrite } = useTeamPermissions();
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [profCounts, setProfCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [form, setForm] = useState({ name: '', type: '', active: true });

  const fetchUnits = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('team_id', teamId)
        .order('name');
      if (error) throw error;
      setUnits(data || []);

      // Count professionals per unit
      const { data: profs } = await supabase
        .from('professional_users')
        .select('unit_id')
        .eq('team_id', teamId)
        .not('unit_id', 'is', null) as any;

      const counts: Record<string, number> = {};
      (profs || []).forEach((p: any) => {
        if (p.unit_id) counts[p.unit_id] = (counts[p.unit_id] || 0) + 1;
      });
      setProfCounts(counts);
    } catch (err) {
      console.error('Erro ao carregar unidades:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: '', active: true });
    setDialogOpen(true);
  };

  const openEdit = (unit: UnitRow) => {
    setEditing(unit);
    setForm({ name: unit.name, type: unit.type, active: unit.active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Preencha o nome da unidade'); return; }
    if (!teamId) return;

    try {
      if (editing) {
        const { error } = await supabase
          .from('units')
          .update({ name: form.name, type: form.type, active: form.active })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Unidade atualizada');
      } else {
        const { error } = await supabase
          .from('units')
          .insert({ team_id: teamId, name: form.name, type: form.type, active: form.active });
        if (error) throw error;
        toast.success('Unidade cadastrada');
      }
      setDialogOpen(false);
      fetchUnits();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar unidade');
    }
  };

  const handleDelete = async (unit: UnitRow) => {
    if (!confirm(`Excluir "${unit.name}"? Profissionais vinculados perderão a referência à unidade.`)) return;
    try {
      const { error } = await supabase.from('units').delete().eq('id', unit.id);
      if (error) throw error;
      toast.success('Unidade excluída');
      fetchUnits();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir unidade');
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  const activeUnits = units.filter(u => u.active);
  const inactiveUnits = units.filter(u => !u.active);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Unidades de Saúde"
        description="Gerencie as unidades de saúde da sua equipe"
        action={canWrite() && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Unidade
          </Button>
        )}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold">{activeUnits.length}</p>
              <p className="text-xs text-muted-foreground">Unidades Ativas</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold">{Object.values(profCounts).reduce((a, b) => a + b, 0)}</p>
              <p className="text-xs text-muted-foreground">Profissionais Alocados</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold">{inactiveUnits.length}</p>
              <p className="text-xs text-muted-foreground">Inativas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Units List */}
      {units.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma unidade cadastrada"
          description="Comece adicionando as unidades de saúde da sua equipe"
          actionLabel={canWrite() ? 'Cadastrar Unidade' : undefined}
          onAction={canWrite() ? openNew : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {units.map(unit => (
            <Card key={unit.id} className={cn(
              'group hover:border-primary/30 transition-all',
              !unit.active && 'opacity-60'
            )}>
              <CardHeader className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      unit.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">{unit.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {unit.type && (
                          <Badge variant="secondary" className="text-[10px]">{unit.type}</Badge>
                        )}
                        <Badge variant={unit.active ? 'outline' : 'destructive'} className="text-[10px]">
                          {unit.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {profCounts[unit.id] || 0} profissional(is)
                      </p>
                    </div>
                  </div>
                  {canWrite() && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(unit)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(unit)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
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
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da unidade"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {UNIT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={v => setForm({ ...form, active: v })}
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
