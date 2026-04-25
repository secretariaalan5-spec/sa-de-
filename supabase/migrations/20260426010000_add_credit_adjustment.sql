-- =============================================
-- MIGRATION: Credit Adjustment Feature
-- Permite que admins adicionem saldo inicial / ajustes de crédito
-- com rastreabilidade completa e proteção contra saldo negativo.
-- =============================================

-- 1. Adicionar coluna 'notes' para auditoria obrigatória em ajustes
ALTER TABLE public.leave_credits 
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Garantir que ajustes com origin='initial_balance' ou 'adjustment'
--    sejam validados ANTES de serem inseridos (não deixar saldo negativo).
CREATE OR REPLACE FUNCTION public.validate_credit_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance numeric(5,1);
BEGIN
  -- Apenas valida para registros de ajuste com valor negativo
  IF NEW.origin IN ('initial_balance', 'adjustment') AND NEW.amount < 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM public.leave_credits
    WHERE employee_id = NEW.employee_id;

    IF (current_balance + NEW.amount) < 0 THEN
      RAISE EXCEPTION 'Ajuste inválido: o saldo resultante seria negativo (saldo atual: %, ajuste: %). Insira um valor menor ou corrija o saldo primeiro.', current_balance, NEW.amount;
    END IF;
  END IF;

  -- Garantir que ajustes manuais sempre tenham motivo
  IF NEW.origin IN ('initial_balance', 'adjustment') AND (NEW.notes IS NULL OR trim(NEW.notes) = '') THEN
    RAISE EXCEPTION 'Campo "Motivo" é obrigatório para ajustes manuais de saldo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_credit_adjustment ON public.leave_credits;
CREATE TRIGGER trg_validate_credit_adjustment
  BEFORE INSERT ON public.leave_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_credit_adjustment();

-- 3. Política RLS: Admins podem deletar APENAS créditos de ajuste manual
--    (initial_balance / adjustment). Nunca extra_shift ou leave_used.
DROP POLICY IF EXISTS "Admins can delete adjustment credits" ON public.leave_credits;
CREATE POLICY "Admins can delete adjustment credits" ON public.leave_credits
  FOR DELETE TO authenticated
  USING (
    user_is_any(ARRAY['admin']) 
    AND origin IN ('initial_balance', 'adjustment')
  );
