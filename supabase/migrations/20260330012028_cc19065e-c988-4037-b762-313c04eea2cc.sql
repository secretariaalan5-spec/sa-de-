
CREATE OR REPLACE FUNCTION public.validate_user_role_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Chefe de Categoria must have category_id
  IF NEW.role = 'category_chief' AND NEW.category_id IS NULL THEN
    RAISE EXCEPTION 'Chefe de Categoria deve ter uma categoria_id definida';
  END IF;

  -- Gerente de Unidade: unit_id is optional at creation (selected after login)
  -- No validation needed here anymore

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
$function$;
