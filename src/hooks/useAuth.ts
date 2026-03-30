import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'category_chief' | 'unit_manager' | 'rh';

export interface UserRoleInfo {
  role: UserRole;
  category_id: string | null;
  unit_id: string | null;
  team_id: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role, category_id, unit_id, team_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setRoleInfo({
        role: data.role as UserRole,
        category_id: data.category_id,
        unit_id: data.unit_id,
        team_id: data.team_id,
      });
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRoleInfo(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRoleInfo(null);
  }, []);

  const isAdmin = roleInfo?.role === 'admin';
  const isRH = roleInfo?.role === 'rh';
  const isChief = roleInfo?.role === 'category_chief';
  const isManager = roleInfo?.role === 'unit_manager';

  return {
    session,
    user: session?.user ?? null,
    roleInfo,
    loading,
    signOut,
    isAdmin,
    isRH,
    isChief,
    isManager,
  };
}
