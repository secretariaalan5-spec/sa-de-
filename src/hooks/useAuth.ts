import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'category_chief' | 'unit_manager' | 'rh' | 'professional';

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
      return true;
    }
    return false;
  }, []);

  /**
   * Process a pending invite token stored in localStorage.
   * This happens after a Google OAuth redirect from the /registro page.
   */
  const processPendingInvite = useCallback(async (userId: string) => {
    const token = localStorage.getItem('pending_invite_token');
    if (!token) return;

    try {
      // Fetch the invite
      const { data: invite } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .maybeSingle();

      if (!invite) {
        localStorage.removeItem('pending_invite_token');
        return;
      }

      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        // User already has a role, just clean up
        localStorage.removeItem('pending_invite_token');
        return;
      }

      // Create user_role from invite
      await supabase.from('user_roles').insert({
        user_id: userId,
        role: invite.role,
        team_id: invite.team_id,
        category_id: invite.category_id,
        unit_id: invite.unit_id,
      });

      // Update profile team_id
      await supabase
        .from('profiles')
        .update({ team_id: invite.team_id } as any)
        .eq('user_id', userId);

      // Mark invite as used
      await supabase
        .from('invites')
        .update({ used: true, used_by: userId } as any)
        .eq('id', invite.id);

      // Re-fetch role
      await fetchRole(userId);
    } catch (err) {
      console.error('Error processing invite:', err);
    } finally {
      localStorage.removeItem('pending_invite_token');
    }
  }, [fetchRole]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const hasRole = await fetchRole(session.user.id);
        if (!hasRole) {
          // No role found — check for pending invite
          await processPendingInvite(session.user.id);
        }
      } else {
        setRoleInfo(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const hasRole = await fetchRole(session.user.id);
        if (!hasRole) {
          await processPendingInvite(session.user.id);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchRole, processPendingInvite]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRoleInfo(null);
  }, []);

  const isAdmin = roleInfo?.role === 'admin';
  const isRH = roleInfo?.role === 'rh';
  const isChief = roleInfo?.role === 'category_chief';
  const isManager = roleInfo?.role === 'unit_manager';
  const isProfessional = roleInfo?.role === 'professional';

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
    isProfessional,
  };
}
