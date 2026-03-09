import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * When a user logs in, check if they have a pending team_members invite
 * matching their email and auto-accept it, linking their user_id.
 */
export function useAutoAcceptInvite() {
  useEffect(() => {
    const accept = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Find pending invite for this email
      const { data: invite } = await supabase
        .from('team_members' as any)
        .select('*')
        .eq('member_email', user.email.toLowerCase())
        .eq('status', 'pending')
        .is('member_id', null)
        .maybeSingle() as any;

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

      // Update profile team_id to match the invite's team
      if (invite.team_id) {
        await supabase
          .from('profiles')
          .update({ team_id: invite.team_id } as any)
          .eq('user_id', user.id);
      }
    };

    accept();
  }, []);
}
