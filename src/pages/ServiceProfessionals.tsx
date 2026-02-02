import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Stethoscope, Syringe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceProfessional } from '@/types/serviceSchedule';

export default function ServiceProfessionalsPage() {
    const { professionals, addProfessional, updateProfessional, deleteProfessional } = useServiceProfessionals();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: '',
        category: 'nurse' as 'nurse' | 'tech',
        monthlyHours: 200,
        active: true,
    });

    const resetForm = () => {
        setForm({ name: '', category: 'nurse', monthlyHours: 200, active: true });
        setEditingId(null);
    };

    const handleSubmit = () => {
        if (!form.name.trim()) return;
        
        if (editingId) {
            updateProfessional(editingId, form);
        } else {
            addProfessional(form);
        }
        resetForm();
        setDialogOpen(false);
    };

    const handleEdit = (prof: ServiceProfessional) => {
        setForm({
            name: prof.name,
            category: prof.category,
            monthlyHours: prof.monthlyHours,
            active: prof.active,
        });
        setEditingId(prof.id);
        setDialogOpen(true);
    };

    const nurses = professionals.filter(p => p.category === 'nurse');
    const techs = professionals.filter(p => p.category === 'tech');

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Cadastro de Profissionais"
                description="Gerencie enfermeiros e técnicos para as escalas de serviço"
            />

            <div className="flex justify-end">
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Profissional
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingId ? 'Editar Profissional' : 'Novo Profissional'}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Nome Completo</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Nome do profissional"
                                />
                            </div>
                            <div>
                                <Label>Categoria</Label>
                                <Select 
                                    value={form.category} 
                                    onValueChange={(value: 'nurse' | 'tech') => setForm(prev => ({ ...prev, category: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="nurse">Enfermeiro</SelectItem>
                                        <SelectItem value="tech">Técnico</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Carga Horária Mensal</Label>
                                <Input
                                    type="number"
                                    value={form.monthlyHours}
                                    onChange={(e) => setForm(prev => ({ ...prev, monthlyHours: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={form.active}
                                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, active: checked }))}
                                />
                                <Label>Ativo</Label>
                            </div>
                            <Button onClick={handleSubmit} className="w-full">
                                {editingId ? 'Salvar' : 'Cadastrar'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Nurses Section */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Enfermeiros ({nurses.length})</h3>
                </div>
                {nurses.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum enfermeiro cadastrado.</p>
                ) : (
                    <div className="space-y-2">
                        {nurses.map(prof => (
                            <div key={prof.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                    <span className="font-medium">{prof.name}</span>
                                    <span className="text-sm text-muted-foreground ml-2">({prof.monthlyHours}h/mês)</span>
                                    {!prof.active && (
                                        <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                                            Inativo
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => handleEdit(prof)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteProfessional(prof.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Techs Section */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Syringe className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Técnicos ({techs.length})</h3>
                </div>
                {techs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum técnico cadastrado.</p>
                ) : (
                    <div className="space-y-2">
                        {techs.map(prof => (
                            <div key={prof.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                    <span className="font-medium">{prof.name}</span>
                                    <span className="text-sm text-muted-foreground ml-2">({prof.monthlyHours}h/mês)</span>
                                    {!prof.active && (
                                        <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                                            Inativo
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => handleEdit(prof)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteProfessional(prof.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
