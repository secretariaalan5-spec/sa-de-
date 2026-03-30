
-- Add 'professional' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'professional';

-- Create a validation trigger to enforce field requirements per role
CREATE OR REPLACE FUNCTION public.validate_user_role_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Chefe de Categoria must have category_id
  IF NEW.role = 'category_chief' AND NEW.category_id IS NULL THEN
    RAISE EXCEPTION 'Chefe de Categoria deve ter uma categoria_id definida';
  END IF;

  -- Gerente de Unidade must have unit_id
  IF NEW.role = 'unit_manager' AND NEW.unit_id IS NULL THEN
    RAISE EXCEPTION 'Gerente de Unidade deve ter uma unit_id definida';
  END IF;

  -- Profissional must have category_id and unit_id
  IF NEW.role = 'professional' AND (NEW.category_id IS NULL OR NEW.unit_id IS NULL) THEN
    RAISE EXCEPTION 'Profissional deve ter category_id e unit_id definidos';
  END IF;

  -- Admin and RH: clear category_id and unit_id (they don't need them)
  IF NEW.role IN ('admin', 'rh') THEN
    NEW.category_id := NULL;
    NEW.unit_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_validate_user_role_fields ON public.user_roles;
CREATE TRIGGER trg_validate_user_role_fields
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_role_fields();
