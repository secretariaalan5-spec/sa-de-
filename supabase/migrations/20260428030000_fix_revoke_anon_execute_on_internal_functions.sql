-- =====================================================
-- SECURITY FIX: Revoke EXECUTE from anon on internal functions
-- These functions are trigger/internal helpers or require auth.
-- They should NEVER be callable by unauthenticated users.
-- =====================================================

-- Trigger/internal helpers — anon should have zero access
REVOKE EXECUTE ON FUNCTION public.trigger_send_push()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_leave_update()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_extra_schedule_calculate()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_extra_schedule_insert()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_leave_approved()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_schedule_delete()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_last_admin_role_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_audit_log()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_leave_request_conflicts()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_schedule_leave_conflicts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_credit_adjustment()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_pending_extra_credits()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invite_token()          FROM anon, authenticated;

-- Admin-only functions — anon must NOT call these
REVOKE EXECUTE ON FUNCTION public.approve_pending_user(uuid)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_pending_user(uuid, text)   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_user_completely(uuid)      FROM anon, authenticated;

-- Role-check helpers used in RLS policies — anon must not call directly
REVOKE EXECUTE ON FUNCTION public.user_is(text)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_is_any(text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_category_id()  FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_category_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_unit_id()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_team_id()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM anon;

-- Invite functions: keep for authenticated flow, block anon
REVOKE EXECUTE ON FUNCTION public.accept_category_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_invite_by_token(text) FROM anon;
