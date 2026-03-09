import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamPermissions {
  escalas_servicos: boolean;
  escalas_emult: boolean;
  profissionais: boolean;
  unidades: boolean;
  folgas: boolean;
  relatorios: boolean;
  publicar: boolean;
  configuracoes: boolean;
  gerenciar_membros: boolean;
  is_owner: boolean;
}

const ALL_PERMISSIONS: TeamPermissions = {
  escalas_servicos: true,
  escalas_emult: true,
  profissionais: true,
  unidades: true,
  folgas: true,
  relatorios: true,
  publicar: true,
  configuracoes: true,
  gerenciar_membros: true,
  is_owner: true,
};

export function useTeamPermissions() {
  const [permissions, setPermissions] = useState<TeamPermissions>(ALL_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_member_permissions', {
        _user_id: user.id,
      }) as { data: TeamPermissions | null; error: any };

      if (!error && data) {
        setPermissions(data);
      } else {
        // Default: owner permissions (backward compat for existing users)
        setPermissions(ALL_PERMISSIONS);
      }
    } catch {
      setPermissions(ALL_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const can = useCallback((permission: keyof Omit<TeamPermissions, 'is_owner'>) => {
    return permissions[permission] === true;
  }, [permissions]);

  return { permissions, loading, can, refresh: fetchPermissions };
}
