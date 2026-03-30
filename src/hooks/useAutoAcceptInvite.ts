import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';

/**
 * When a user logs in, check if they have a pending team_members invite
 * matching their email and auto-accept it, creating the user_role.
 */
export function useAutoAcceptInvite() {
  useEffect(() => {
    const accept = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Also check for pending_invite_token from Google OAuth redirect
      const pendingToken = localStorage.getItem('pending_invite_token');
      
      let invite: any = null;

      if (pendingToken) {
        localStorage.removeItem('pending_invite_token');
        const { data } = await supabase
          .from('team_members' as any)
          .select('*')
          .eq('invite_token', pendingToken)
          .eq('status', 'pending')
          .maybeSingle() as any;
        invite = data;
      }

      // Fallback: find by email
      if (!invite) {
        const { data } = await supabase
          .from('team_members' as any)
          .select('*')
          .eq('member_email', user.email.toLowerCase())
          .eq('status', 'pending')
          .is('member_id', null)
          .maybeSingle() as any;
        invite = data;
      }

      if (!invite) return;

      // Accept: set member_id and status
      await supabase
        .from('team_members' as any)
        .update({
          member_id: user.id,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        } as any)
        .eq('id', invite.id) as any;

      // Update profile team_id
      if (invite.team_id) {
        await supabase
          .from('profiles')
          .update({ team_id: invite.team_id } as any)
          .eq('user_id', user.id);
      }

      // Create/update user_role
      const perms = invite.permissions || {};
      const roleData: any = {
        user_id: user.id,
        role: invite.role || 'admin',
        team_id: invite.team_id,
        category_id: perms.pending_category_id || null,
        unit_id: perms.pending_unit_id || null,
      };

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingRole) {
        await supabase.from('user_roles').update(roleData).eq('id', existingRole.id);
      } else {
        await supabase.from('user_roles').insert(roleData);
      }
    };

    accept();
  }, []);
}
