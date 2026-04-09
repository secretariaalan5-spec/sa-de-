import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Users, UserCog } from 'lucide-react';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UnitDetailDialogProps {
  unitId: string | null;
  unitName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnitDetailDialog({ unitId, unitName, open, onOpenChange }: UnitDetailDialogProps) {
  const { isAdmin, isRH, isChief, isManager } = useAuthContext();
  const [managers, setManagers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const canViewContacts = isAdmin || isRH || isChief || isManager;

  useEffect(() => {
    async function load() {
      if (!unitId || !open) return;
      setLoading(true);
      try {
        // 1. Fetch professionals
        const { data: emps } = await supabase.from('employees').select('*').eq('unit_id', unitId).eq('active', true).order('name');
        
        // 2. Fetch managers (simplest way assuming user_roles has fkey to profiles, but let's just query both manually to be safe)
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('unit_id', unitId).eq('role', 'unit_manager');
        let mgrs: any[] = [];
        if (roles && roles.length > 0) {
          const userIds = roles.map(r => r.user_id);
          const { data: profs } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
          mgrs = profs || [];
        }

        // 3. Fetch categories mapping
        const { data: cats } = await supabase.from('categories').select('id, name, color');
        const catMap: Record<string, any> = {};
        cats?.forEach(c => { catMap[c.id] = c; });

        setEmployees(emps || []);
        setManagers(mgrs);
        setCategories(catMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [unitId, open]);

  // Group employees by category
  const groupedEmployees = employees.reduce((acc, emp) => {
    const catId = emp.category_id || 'sem-categoria';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(emp);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Unidade: {unitName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Carregando dados...</div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              
              {/* Managers Section */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  <UserCog size={16} /> Gerência
                </h3>
                {managers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum gerente designado.</p>
                ) : (
                  <div className="space-y-2">
                    {managers.map(m => (
                      <div key={m.user_id} className="flex flex-col bg-muted/30 p-3 rounded-lg border border-border">
                        <span className="font-medium text-sm">{m.display_name || 'Usuário sem nome'}</span>
                        <span className="text-xs text-muted-foreground">Gerente de Unidade</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Employees Section */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider border-b pb-2">
                  <Users size={16} /> Profissionais ({employees.length})
                </h3>
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum profissional lotado nesta unidade.</p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedEmployees).map(([catId, emps]: [string, any[]]) => {
                      const cat = categories[catId];
                      return (
                        <div key={catId} className="space-y-3">
                          <div className="flex items-center gap-2">
                            {cat ? (
                              <Badge variant="secondary" style={{ borderColor: cat.color, color: cat.color }}>
                                {cat.name}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Sem Categoria</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">({emps.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {emps.map(emp => {
                              const phoneClean = emp.phone ? emp.phone.replace(/\D/g, '') : '';
                              const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean}` : '#';

                              return (
                                <div key={emp.id} className="bg-card p-3 rounded-lg border border-border flex flex-col gap-1.5 shadow-sm transition-colors hover:bg-muted/30">
                                  <p className="font-semibold text-sm line-clamp-1" title={emp.name}>{emp.name}</p>
                                  
                                  {canViewContacts && emp.phone && (
                                    <a 
                                      href={waLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Conversar no WhatsApp"
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[11px] font-medium hover:bg-green-500/20 hover:border-green-500/40 hover:shadow-[0_0_12px_rgba(34,197,94,0.2)] transition-all duration-200 w-fit mt-1"
                                    >
                                      <WhatsAppIcon size={13} />
                                      {emp.phone}
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
