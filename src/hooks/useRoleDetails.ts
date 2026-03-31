import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { UserRoleInfo } from './useAuth';

export function useRoleDetails(roleInfo: UserRoleInfo | null) {
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [unitName, setUnitName] = useState<string | null>(null);

  useEffect(() => {
    if (!roleInfo) return;

    const fetchDetails = async () => {
      // Fetch category names for chiefs
      if (roleInfo.role === 'category_chief' && roleInfo.category_ids.length > 0) {
        const { data } = await supabase
          .from('categories')
          .select('name')
          .in('id', roleInfo.category_ids);
        setCategoryNames((data ?? []).map((c: any) => c.name));
      } else if (roleInfo.category_id) {
        const { data } = await supabase
          .from('categories')
          .select('name')
          .eq('id', roleInfo.category_id)
          .maybeSingle();
        if (data) setCategoryNames([data.name]);
      }

      // Fetch unit name for managers
      if (roleInfo.role === 'unit_manager' && roleInfo.unit_id) {
        const { data } = await supabase
          .from('units')
          .select('name')
          .eq('id', roleInfo.unit_id)
          .maybeSingle();
        if (data) setUnitName(data.name);
      }
    };

    fetchDetails();
  }, [roleInfo]);

  const roleDescription = (): string => {
    if (!roleInfo) return '';
    switch (roleInfo.role) {
      case 'admin': return 'Acesso total ao sistema';
      case 'rh': return 'Visualização geral (somente leitura)';
      case 'category_chief':
        return categoryNames.length > 0
          ? `Chefe: ${categoryNames.join(', ')}`
          : 'Chefe de Categoria';
      case 'unit_manager':
        return unitName ? `Gerente: ${unitName}` : 'Gerente de Unidade';
      case 'professional': return 'Profissional';
      default: return '';
    }
  };

  return { categoryNames, unitName, roleDescription: roleDescription() };
}
