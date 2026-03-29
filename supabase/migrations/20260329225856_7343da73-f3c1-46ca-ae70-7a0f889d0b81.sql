
-- ============================================================
-- HELPER FUNCTIONS (security definer to avoid recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role_in_team(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_category(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT category FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_unit_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_rh(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'rh'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_category_chief(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'category_chief'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_unit_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'unit_manager'
  )
$$;

-- ============================================================
-- PROFESSIONAL_USERS
-- ============================================================

DROP POLICY IF EXISTS "Team admins can delete professional_users" ON public.professional_users;
DROP POLICY IF EXISTS "Team admins can update professional_users" ON public.professional_users;
DROP POLICY IF EXISTS "Team admins can view professional_users" ON public.professional_users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.professional_users;
DROP POLICY IF EXISTS "Users can view own professional_user" ON public.professional_users;

CREATE POLICY "pu_select" ON public.professional_users FOR SELECT TO authenticated
USING (
  (user_id = auth.uid())
  OR (
    team_id = get_user_team_id(auth.uid())
    AND (
      is_admin(auth.uid())
      OR is_rh(auth.uid())
      OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
      OR (is_unit_manager(auth.uid()) AND unit_id = get_user_unit_id(auth.uid()))
    )
  )
);

CREATE POLICY "pu_insert" ON public.professional_users FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR (
    team_id = get_user_team_id(auth.uid())
    AND (
      is_admin(auth.uid())
      OR (is_unit_manager(auth.uid()) AND unit_id = get_user_unit_id(auth.uid()))
    )
  )
);

CREATE POLICY "pu_update" ON public.professional_users FOR UPDATE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
    OR (is_unit_manager(auth.uid()) AND unit_id = get_user_unit_id(auth.uid()))
  )
);

CREATE POLICY "pu_delete" ON public.professional_users FOR DELETE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND is_admin(auth.uid())
);

-- ============================================================
-- SHIFT_ENTRIES
-- ============================================================

DROP POLICY IF EXISTS "Chiefs can manage shifts for their category" ON public.shift_entries;
DROP POLICY IF EXISTS "Professionals can view own shifts" ON public.shift_entries;
DROP POLICY IF EXISTS "Unit managers can view unit shifts" ON public.shift_entries;

CREATE POLICY "se_select" ON public.shift_entries FOR SELECT TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR is_rh(auth.uid())
    OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
    OR (is_unit_manager(auth.uid()) AND professional_id IN (
      SELECT id FROM public.professional_users WHERE unit_id = get_user_unit_id(auth.uid())
    ))
    OR (professional_id IN (
      SELECT id FROM public.professional_users WHERE user_id = auth.uid()
    ))
  )
);

CREATE POLICY "se_insert" ON public.shift_entries FOR INSERT TO authenticated
WITH CHECK (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
  )
);

CREATE POLICY "se_update" ON public.shift_entries FOR UPDATE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
  )
);

CREATE POLICY "se_delete" ON public.shift_entries FOR DELETE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
  )
);

-- ============================================================
-- PROFESSIONAL_LEAVE_REQUESTS
-- ============================================================

DROP POLICY IF EXISTS "admins_manage_all_team_leaves" ON public.professional_leave_requests;
DROP POLICY IF EXISTS "unit_managers_manage_unit_leaves" ON public.professional_leave_requests;
DROP POLICY IF EXISTS "users_insert_own_leave_requests" ON public.professional_leave_requests;
DROP POLICY IF EXISTS "users_select_own_leave_requests" ON public.professional_leave_requests;

CREATE POLICY "lr_select" ON public.professional_leave_requests FOR SELECT TO authenticated
USING (
  (user_id = auth.uid())
  OR (
    team_id = get_user_team_id(auth.uid())
    AND (
      is_admin(auth.uid())
      OR is_rh(auth.uid())
      OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
      OR (is_unit_manager(auth.uid()) AND professional_id IN (
        SELECT id::text FROM public.professional_users WHERE unit_id = get_user_unit_id(auth.uid())
      ))
    )
  )
);

CREATE POLICY "lr_insert" ON public.professional_leave_requests FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR (
    team_id = get_user_team_id(auth.uid())
    AND (
      is_admin(auth.uid())
      OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
      OR (is_unit_manager(auth.uid()) AND professional_id IN (
        SELECT id::text FROM public.professional_users WHERE unit_id = get_user_unit_id(auth.uid())
      ))
    )
  )
);

CREATE POLICY "lr_update" ON public.professional_leave_requests FOR UPDATE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR (is_category_chief(auth.uid()) AND category = get_user_category(auth.uid()))
  )
);

CREATE POLICY "lr_delete" ON public.professional_leave_requests FOR DELETE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND is_admin(auth.uid())
);

-- ============================================================
-- UNITS
-- ============================================================

DROP POLICY IF EXISTS "Team members can delete units" ON public.units;
DROP POLICY IF EXISTS "Team members can insert units" ON public.units;
DROP POLICY IF EXISTS "Team members can update units" ON public.units;
DROP POLICY IF EXISTS "Team members can view units" ON public.units;
DROP POLICY IF EXISTS "managers_update_own_unit" ON public.units;

CREATE POLICY "units_select" ON public.units FOR SELECT TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR is_rh(auth.uid())
    OR is_category_chief(auth.uid())
    OR (is_unit_manager(auth.uid()) AND id = get_user_unit_id(auth.uid()))
  )
);

CREATE POLICY "units_insert" ON public.units FOR INSERT TO authenticated
WITH CHECK (
  team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid())
);

CREATE POLICY "units_update" ON public.units FOR UPDATE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid())
);

CREATE POLICY "units_delete" ON public.units FOR DELETE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid())
);

-- ============================================================
-- ADMIN_STATES
-- ============================================================

DROP POLICY IF EXISTS "Team owner manages admin_states" ON public.admin_states;
DROP POLICY IF EXISTS "Users can create own admin state" ON public.admin_states;
DROP POLICY IF EXISTS "Users can delete own admin state" ON public.admin_states;
DROP POLICY IF EXISTS "Users can update own admin state" ON public.admin_states;
DROP POLICY IF EXISTS "Users can view own admin state" ON public.admin_states;

CREATE POLICY "as_select" ON public.admin_states FOR SELECT TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR is_rh(auth.uid())
    OR is_category_chief(auth.uid())
    OR user_id = auth.uid()
  )
);

CREATE POLICY "as_insert" ON public.admin_states FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  AND (is_admin(auth.uid()) OR is_category_chief(auth.uid()))
);

CREATE POLICY "as_update" ON public.admin_states FOR UPDATE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (is_admin(auth.uid()) OR is_category_chief(auth.uid()))
);

CREATE POLICY "as_delete" ON public.admin_states FOR DELETE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND is_admin(auth.uid())
);

-- ============================================================
-- TEAM_MEMBERS
-- ============================================================

DROP POLICY IF EXISTS "Members accept invites" ON public.team_members;
DROP POLICY IF EXISTS "Members see their teams" ON public.team_members;
DROP POLICY IF EXISTS "Owners manage their team" ON public.team_members;

CREATE POLICY "tm_select" ON public.team_members FOR SELECT TO authenticated
USING (
  (member_email = (auth.jwt() ->> 'email'))
  OR (
    team_id = get_user_team_id(auth.uid())
    AND (is_admin(auth.uid()) OR is_rh(auth.uid()))
  )
);

CREATE POLICY "tm_insert" ON public.team_members FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid() AND is_admin(auth.uid())
);

CREATE POLICY "tm_update" ON public.team_members FOR UPDATE TO authenticated
USING (
  (member_email = (auth.jwt() ->> 'email'))
  OR (owner_id = auth.uid() AND is_admin(auth.uid()))
);

CREATE POLICY "tm_delete" ON public.team_members FOR DELETE TO authenticated
USING (
  owner_id = auth.uid() AND is_admin(auth.uid())
);

-- ============================================================
-- TEAM_INVITES
-- ============================================================

DROP POLICY IF EXISTS "Team members can create invites" ON public.team_invites;
DROP POLICY IF EXISTS "Team members can view invites" ON public.team_invites;
DROP POLICY IF EXISTS "Team members view own team invites" ON public.team_invites;
DROP POLICY IF EXISTS "Users can claim invite" ON public.team_invites;

CREATE POLICY "ti_select" ON public.team_invites FOR SELECT TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (is_admin(auth.uid()) OR is_rh(auth.uid()))
);

CREATE POLICY "ti_insert" ON public.team_invites FOR INSERT TO authenticated
WITH CHECK (
  team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid())
);

CREATE POLICY "ti_update" ON public.team_invites FOR UPDATE TO authenticated
USING (
  (used_by IS NULL OR used_by = auth.uid())
  OR (team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid()))
);

-- ============================================================
-- PORTAL_INVITES
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete own invites" ON public.portal_invites;
DROP POLICY IF EXISTS "Admins can insert own invites" ON public.portal_invites;
DROP POLICY IF EXISTS "Admins can update own invites" ON public.portal_invites;
DROP POLICY IF EXISTS "Authenticated read invite by code" ON public.portal_invites;

CREATE POLICY "pi_select" ON public.portal_invites FOR SELECT TO authenticated
USING (true);

CREATE POLICY "pi_insert" ON public.portal_invites FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid() AND is_admin(auth.uid()));

CREATE POLICY "pi_update" ON public.portal_invites FOR UPDATE TO authenticated
USING (admin_id = auth.uid() AND is_admin(auth.uid()));

CREATE POLICY "pi_delete" ON public.portal_invites FOR DELETE TO authenticated
USING (admin_id = auth.uid() AND is_admin(auth.uid()));

-- ============================================================
-- PORTAL_SCHEDULES
-- ============================================================

DROP POLICY IF EXISTS "Users can manage own schedules" ON public.portal_schedules;
DROP POLICY IF EXISTS "Users can view schedules" ON public.portal_schedules;

CREATE POLICY "ps_select" ON public.portal_schedules FOR SELECT TO authenticated
USING (true);

CREATE POLICY "ps_insert" ON public.portal_schedules FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (is_admin(auth.uid()) OR is_category_chief(auth.uid()))
);

CREATE POLICY "ps_update" ON public.portal_schedules FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND (is_admin(auth.uid()) OR is_category_chief(auth.uid()))
);

CREATE POLICY "ps_delete" ON public.portal_schedules FOR DELETE TO authenticated
USING (
  user_id = auth.uid() AND is_admin(auth.uid())
);

-- ============================================================
-- USER_ROLES
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "ur_select" ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid()))
);

CREATE POLICY "ur_insert" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR is_admin(auth.uid())
);

CREATE POLICY "ur_update" ON public.user_roles FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) AND team_id = get_user_team_id(auth.uid()));

CREATE POLICY "ur_delete" ON public.user_roles FOR DELETE TO authenticated
USING (is_admin(auth.uid()) AND team_id = get_user_team_id(auth.uid()));
