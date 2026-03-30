CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_role_unique
ON public.user_roles (user_id, role);

CREATE OR REPLACE FUNCTION public.prevent_last_admin_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_admins integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'admin' THEN
      RETURN OLD;
    END IF;

    SELECT COUNT(*) INTO remaining_admins
    FROM public.user_roles
    WHERE role = 'admin' AND id <> OLD.id;

    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'Não é permitido remover o último administrador do sistema.';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin' THEN
      SELECT COUNT(*) INTO remaining_admins
      FROM public.user_roles
      WHERE role = 'admin' AND id <> OLD.id;

      IF remaining_admins = 0 THEN
        RAISE EXCEPTION 'Não é permitido rebaixar o último administrador do sistema.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_role_delete ON public.user_roles;
CREATE TRIGGER trg_prevent_last_admin_role_delete
BEFORE DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_role_change();

DROP TRIGGER IF EXISTS trg_prevent_last_admin_role_update ON public.user_roles;
CREATE TRIGGER trg_prevent_last_admin_role_update
BEFORE UPDATE OF role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_role_change();