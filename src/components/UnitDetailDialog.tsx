import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Users, UserCog, Phone } from 'lucide-react';
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
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  <Users size={16} /> Profissionais ({employees.length})
                </h3>
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum profissional lotado nesta unidade.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {employees.map(emp => {
                      const cat = categories[emp.category_id];
                      return (
                        <div key={emp.id} className="bg-card p-3 rounded-lg border border-border flex flex-col gap-1.5 shadow-sm">
                          <p className="font-semibold text-sm line-clamp-1" title={emp.name}>{emp.name}</p>
                          
                          {cat && (
                            <div className="w-fit">
                              <Badge variant="secondary" className="text-[10px]" style={{ borderColor: cat.color, color: cat.color }}>
                                {cat.name}
                              </Badge>
                            </div>
                          )}

                          {canViewContacts && emp.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                              <Phone size={12} className="text-green-500" />
                              {emp.phone}
                            </p>
                          )}
                        </div>
                      )
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
