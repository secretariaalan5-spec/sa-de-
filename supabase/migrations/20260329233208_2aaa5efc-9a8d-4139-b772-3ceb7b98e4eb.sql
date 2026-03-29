
-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8B5CF6',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_select" ON public.categories FOR SELECT TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));
CREATE POLICY "cat_insert" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid()));
CREATE POLICY "cat_update" ON public.categories FOR UPDATE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid()));
CREATE POLICY "cat_delete" ON public.categories FOR DELETE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()) AND is_admin(auth.uid()));

-- 2. Add category_id FK to relevant tables
ALTER TABLE public.professional_users ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);
ALTER TABLE public.shift_entries ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);
ALTER TABLE public.professional_leave_requests ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);

-- 3. Add invite_token to team_members for unique invite links
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS invite_token text UNIQUE;

-- 4. Helper function: get user's category_id
CREATE OR REPLACE FUNCTION public.get_user_category_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT category_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 5. Update RLS policies to use category_id

-- professional_users
DROP POLICY IF EXISTS "pu_select" ON public.professional_users;
CREATE POLICY "pu_select" ON public.professional_users FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid()) OR (
      team_id = get_user_team_id(auth.uid()) AND (
        is_admin(auth.uid()) OR
        is_rh(auth.uid()) OR
        (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid())) OR
        (is_unit_manager(auth.uid()) AND unit_id = get_user_unit_id(auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "pu_update" ON public.professional_users;
CREATE POLICY "pu_update" ON public.professional_users FOR UPDATE TO authenticated
  USING (
    team_id = get_user_team_id(auth.uid()) AND (
      is_admin(auth.uid()) OR
      (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid())) OR
      (is_unit_manager(auth.uid()) AND unit_id = get_user_unit_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "pu_insert" ON public.professional_users;
CREATE POLICY "pu_insert" ON public.professional_users FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid()) OR (
      team_id = get_user_team_id(auth.uid()) AND (
        is_admin(auth.uid()) OR
        (is_unit_manager(auth.uid()) AND unit_id = get_user_unit_id(auth.uid()))
      )
    )
  );

-- shift_entries
DROP POLICY IF EXISTS "se_select" ON public.shift_entries;
CREATE POLICY "se_select" ON public.shift_entries FOR SELECT TO authenticated
  USING (
    team_id = get_user_team_id(auth.uid()) AND (
      is_admin(auth.uid()) OR
      is_rh(auth.uid()) OR
      (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid())) OR
      (is_unit_manager(auth.uid()) AND professional_id IN (
        SELECT id FROM professional_users WHERE unit_id = get_user_unit_id(auth.uid())
      )) OR
      (professional_id IN (
        SELECT id FROM professional_users WHERE user_id = auth.uid()
      ))
    )
  );

DROP POLICY IF EXISTS "se_insert" ON public.shift_entries;
CREATE POLICY "se_insert" ON public.shift_entries FOR INSERT TO authenticated
  WITH CHECK (
    team_id = get_user_team_id(auth.uid()) AND (
      is_admin(auth.uid()) OR
      (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "se_update" ON public.shift_entries;
CREATE POLICY "se_update" ON public.shift_entries FOR UPDATE TO authenticated
  USING (
    team_id = get_user_team_id(auth.uid()) AND (
      is_admin(auth.uid()) OR
      (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "se_delete" ON public.shift_entries;
CREATE POLICY "se_delete" ON public.shift_entries FOR DELETE TO authenticated
  USING (
    team_id = get_user_team_id(auth.uid()) AND (
      is_admin(auth.uid()) OR
      (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid()))
    )
  );

-- professional_leave_requests
DROP POLICY IF EXISTS "lr_select" ON public.professional_leave_requests;
CREATE POLICY "lr_select" ON public.professional_leave_requests FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid()) OR (
      team_id = get_user_team_id(auth.uid()) AND (
        is_admin(auth.uid()) OR
        is_rh(auth.uid()) OR
        (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid())) OR
        (is_unit_manager(auth.uid()) AND professional_id IN (
          SELECT id::text FROM professional_users WHERE unit_id = get_user_unit_id(auth.uid())
        ))
      )
    )
  );

DROP POLICY IF EXISTS "lr_insert" ON public.professional_leave_requests;
CREATE POLICY "lr_insert" ON public.professional_leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid()) OR (
      team_id = get_user_team_id(auth.uid()) AND (
        is_admin(auth.uid()) OR
        (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid())) OR
        (is_unit_manager(auth.uid()) AND professional_id IN (
          SELECT id::text FROM professional_users WHERE unit_id = get_user_unit_id(auth.uid())
        ))
      )
    )
  );

DROP POLICY IF EXISTS "lr_update" ON public.professional_leave_requests;
CREATE POLICY "lr_update" ON public.professional_leave_requests FOR UPDATE TO authenticated
  USING (
    team_id = get_user_team_id(auth.uid()) AND (
      is_admin(auth.uid()) OR
      (is_category_chief(auth.uid()) AND category_id = get_user_category_id(auth.uid()))
    )
  );
