import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'category_chief' | 'unit_manager' | 'rh';

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

export interface UserRoleInfo {
  role: UserRole;
  category: string | null;
  unit_id: string | null;
  team_id: string | null;
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

const RH_PERMISSIONS: TeamPermissions = {
  escalas_servicos: true,
  escalas_emult: true,
  profissionais: true,
  unidades: true,
  folgas: true,
  relatorios: true,
  publicar: false,
  configuracoes: false,
  gerenciar_membros: false,
  is_owner: false,
};

const CHIEF_PERMISSIONS: TeamPermissions = {
  escalas_servicos: true,
  escalas_emult: true,
  profissionais: true,
  unidades: true,
  folgas: true,
  relatorios: true,
  publicar: true,
  configuracoes: false,
  gerenciar_membros: false,
  is_owner: false,
};

const MANAGER_PERMISSIONS: TeamPermissions = {
  escalas_servicos: false,
  escalas_emult: false,
  profissionais: true,
  unidades: false,
  folgas: true,
  relatorios: false,
  publicar: false,
  configuracoes: false,
  gerenciar_membros: false,
  is_owner: false,
};

export function useTeamPermissions() {
  const [permissions, setPermissions] = useState<TeamPermissions>(ALL_PERMISSIONS);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, category, unit_id, team_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData) {
        const info: UserRoleInfo = {
          role: roleData.role as UserRole,
          category: roleData.category,
          unit_id: roleData.unit_id,
          team_id: roleData.team_id,
        };
        setRoleInfo(info);

        switch (roleData.role) {
          case 'admin':
            setPermissions(ALL_PERMISSIONS);
            break;
          case 'rh':
            setPermissions(RH_PERMISSIONS);
            break;
          case 'category_chief':
            setPermissions(CHIEF_PERMISSIONS);
            break;
          case 'unit_manager':
            setPermissions(MANAGER_PERMISSIONS);
            break;
          default:
            setPermissions(ALL_PERMISSIONS);
        }
      } else {
        // Fallback: try get_member_permissions for backward compat
        const { data, error } = await supabase.rpc('get_member_permissions', {
          _user_id: user.id,
        }) as { data: TeamPermissions | null; error: any };

        if (!error && data) {
          setPermissions(data);
        } else {
          setPermissions(ALL_PERMISSIONS);
        }
        setRoleInfo({ role: 'admin', category: null, unit_id: null, team_id: null });
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

  /** Check if user has a specific role */
  const isRole = useCallback((role: UserRole) => {
    return roleInfo?.role === role;
  }, [roleInfo]);

  /** Check if current user can write (mutate) data - RH cannot */
  const canWrite = useCallback(() => {
    return roleInfo?.role !== 'rh';
  }, [roleInfo]);

  return {
    permissions,
    roleInfo,
    loading,
    can,
    canWrite,
    isRole,
    refresh: fetchPermissions,
  };
}
