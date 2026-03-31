
-- Drop the old unique constraint that only allows one role per user
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Create a new unique constraint that allows multiple categories per role
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_category_unique 
ON public.user_roles (user_id, role, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'));
