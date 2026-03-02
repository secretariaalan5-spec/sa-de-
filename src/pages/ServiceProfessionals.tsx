import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Stethoscope, Syringe, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceProfessional } from '@/types/serviceSchedule';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 10;

export default function ServiceProfessionalsPage() {
    const { professionals, addProfessional, updateProfessional, deleteProfessional } = useServiceProfessionals();
    const { requests } = useLeaveRequests();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'nurse' | 'tech'>('nurse');
    const [nursePage, setNursePage] = useState(1);
    const [techPage, setTechPage] = useState(1);
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

    const filtered = useMemo(() => {
        let list = professionals;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(term));
        }
        return list;
    }, [professionals, searchTerm]);

    const nurses = useMemo(() => filtered.filter(p => p.category === 'nurse'), [filtered]);
    const techs = useMemo(() => filtered.filter(p => p.category === 'tech'), [filtered]);

    const paginatedNurses = nurses.slice(0, nursePage * ITEMS_PER_PAGE);
    const paginatedTechs = techs.slice(0, techPage * ITEMS_PER_PAGE);

    // Reset pages when search changes
    useEffect(() => {
        setNursePage(1);
        setTechPage(1);
    }, [searchTerm]);

    const today = format(new Date(), 'yyyy-MM-dd');

    const ProfessionalCard = ({ prof }: { prof: ServiceProfessional }) => {
        const isOnLeave = requests.some(r =>
            r.professionalId === prof.id &&
            r.leaveDates.includes(today)
        );

        const isNurse = prof.category === 'nurse';

        return (
            <div className={cn(
                "flex flex-col p-4 border rounded-xl transition-all group",
                !prof.active
                    ? "bg-muted/40 border-dashed"
                    : isOnLeave
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                        : isNurse
                            ? "bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30"
                            : "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30",
                "hover:shadow-md"
            )}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground truncate" title={prof.name}>{prof.name}</span>
                            {isOnLeave && (
                                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="De Folga Hoje" />
                            )}
                        </div>
                        <span className={cn(
                            "text-[10px] uppercase font-bold tracking-wider",
                            isOnLeave ? "text-amber-600" : isNurse ? "text-blue-600" : "text-emerald-600"
                        )}>
                            {prof.monthlyHours}h mensal • {isNurse ? 'Enfermeiro' : 'Técnico'}
                        </span>
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(prof)}>
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteProfessional(prof.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                    {isOnLeave && (
                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            De Folga (Hoje)
                        </span>
                    )}
                    {!prof.active && (
                        <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            Inativo
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <PageHeader
                    title="Cadastro de Profissionais"
                    description="Gerencie enfermeiros e técnicos para as escalas de serviço"
                />

                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="shadow-lg shadow-primary/20">
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Profissional
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div>
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Nome Completo</Label>
                                <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome do profissional" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Categoria</Label>
                                    <Select value={form.category} onValueChange={(value: 'nurse' | 'tech') => setForm(prev => ({ ...prev, category: value }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="nurse">Enfermeiro</SelectItem>
                                            <SelectItem value="tech">Técnico</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Carga Horária Mensal</Label>
                                    <Input type="number" value={form.monthlyHours} onChange={(e) => setForm(prev => ({ ...prev, monthlyHours: Number(e.target.value) }))} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg">
                                <Switch checked={form.active} onCheckedChange={(checked) => setForm(prev => ({ ...prev, active: checked }))} />
                                <Label className="text-sm font-medium cursor-pointer">Profissional em atividade</Label>
                            </div>
                            <Button onClick={handleSubmit} className="w-full h-11">{editingId ? 'Salvar Alterações' : 'Cadastrar Profissional'}</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search & Tabs Controls */}
            <div className="flex flex-col gap-6">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 bg-card shadow-sm"
                    />
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'nurse' | 'tech')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl mb-6">
                        <TabsTrigger value="nurse" className="rounded-lg h-10 data-[state=active]:shadow-md transition-all gap-2">
                            <Stethoscope className="w-4 h-4" />
                            <span className="font-bold">Enfermeiros</span>
                            <span className="hidden sm:inline bg-muted py-0.5 px-2 rounded-full text-[10px]">{nurses.length}</span>
                        </TabsTrigger>
                        <TabsTrigger value="tech" className="rounded-lg h-10 data-[state=active]:shadow-md transition-all gap-2">
                            <Syringe className="w-4 h-4" />
                            <span className="font-bold">Técnicos</span>
                            <span className="hidden sm:inline bg-muted py-0.5 px-2 rounded-full text-[10px]">{techs.length}</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="nurse" className="focus-visible:outline-none">
                        {nurses.length === 0 ? (
                            <div className="text-center py-12 bg-card rounded-2xl border border-dashed">
                                <p className="text-muted-foreground text-sm">Nenhum enfermeiro encontrado.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {paginatedNurses.map(prof => <ProfessionalCard key={prof.id} prof={prof} />)}
                                </div>
                                {paginatedNurses.length < nurses.length && (
                                    <div className="flex justify-center pt-2">
                                        <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setNursePage(p => p + 1)}>
                                            Ver mais {nurses.length - paginatedNurses.length} profissionais
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="tech" className="focus-visible:outline-none">
                        {techs.length === 0 ? (
                            <div className="text-center py-12 bg-card rounded-2xl border border-dashed">
                                <p className="text-muted-foreground text-sm">Nenhum técnico encontrado.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {paginatedTechs.map(prof => <ProfessionalCard key={prof.id} prof={prof} />)}
                                </div>
                                {paginatedTechs.length < techs.length && (
                                    <div className="flex justify-center pt-2">
                                        <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setTechPage(p => p + 1)}>
                                            Ver mais {techs.length - paginatedTechs.length} profissionais
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
