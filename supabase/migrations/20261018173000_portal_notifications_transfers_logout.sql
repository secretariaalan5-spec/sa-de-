-- =====================================================================
-- Migration: Portal - Notificações Ativas, Histórico Completo de Transferências
-- Data: 18/10/2026
-- =====================================================================

-- 1. Tabela de rastreamento de leitura de notificações no Portal do Profissional
CREATE TABLE IF NOT EXISTS public.portal_notification_reads (
  employee_id     uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, notification_id)
);
CREATE INDEX IF NOT EXISTS idx_portal_notif_reads_emp ON public.portal_notification_reads(employee_id);
ALTER TABLE public.portal_notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_notification_reads FROM anon, authenticated;

-- 2. Atualizar portal_get_dashboard_data para retornar:
--    - transfers (histórico de transferências de unidade com nome de origem e destino)
--    - notifications (avisos gerais da equipe e notificações nominais do profissional)
CREATE OR REPLACE FUNCTION public.portal_get_dashboard_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp_id        uuid;
  v_team_id       uuid;
  v_emp_name      text;
  v_profile       jsonb;
  v_schedules     jsonb;
  v_leaves        jsonb;
  v_credits       jsonb;
  v_transfers     jsonb;
  v_notifications jsonb;
  v_shifts        numeric;
  v_manual        numeric;
  v_used          numeric;
  v_balance       numeric;
BEGIN
  v_emp_id := public.portal_session_employee(p_token);
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  -- Perfil e dados da equipe
  SELECT
    e.team_id,
    e.name,
    jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'avatar_url', e.avatar_url,
      'category_name', coalesce(c.name, '—'),
      'unit_name', coalesce(u.name, '—'),
      'terms_accepted_at', e.terms_accepted_at,
      'needs_terms', e.terms_version IS DISTINCT FROM public.portal_current_terms_version()
    )
  INTO v_team_id, v_emp_name, v_profile
  FROM public.employees e
  LEFT JOIN public.categories c ON c.id = e.category_id
  LEFT JOIN public.units u ON u.id = e.unit_id
  WHERE e.id = v_emp_id;

  -- 1. Escalas (com turno, atividade/observações e créditos)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'date', s.date,
      'type', s.type,
      'shift_type', s.shift_type,
      'unit_name', coalesce(u.name, '—'),
      'observations', s.observations,
      'credit_amount', s.credit_amount
    ) ORDER BY s.date DESC
  ), '[]'::jsonb)
  INTO v_schedules
  FROM public.schedules s
  LEFT JOIN public.units u ON u.id = s.unit_id
  WHERE s.employee_id = v_emp_id;

  -- 2. Pedidos de folga com datas e justificativas
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'status', l.status,
      'days_requested', l.days_requested,
      'leave_dates', l.leave_dates,
      'observations', l.observations,
      'created_at', l.created_at,
      'decided_at', l.decided_at
    ) ORDER BY l.created_at DESC
  ), '[]'::jsonb)
  INTO v_leaves
  FROM public.leave_requests l
  WHERE l.employee_id = v_emp_id;

  -- 3. Histórico de transferências entre unidades
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', th.id,
      'from_unit_name', coalesce(u_from.name, 'Sem Unidade'),
      'to_unit_name', coalesce(u_to.name, 'Sem Unidade'),
      'transferred_at', th.transferred_at
    ) ORDER BY th.transferred_at DESC
  ), '[]'::jsonb)
  INTO v_transfers
  FROM public.transfer_history th
  LEFT JOIN public.units u_from ON u_from.id = th.from_unit_id
  LEFT JOIN public.units u_to   ON u_to.id   = th.to_unit_id
  WHERE th.employee_id = v_emp_id;

  -- 4. Créditos detalhados
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', lc.id,
      'amount', lc.amount,
      'origin', lc.origin,
      'notes', lc.notes,
      'created_at', lc.created_at
    ) ORDER BY lc.created_at DESC
  ), '[]'::jsonb)
  INTO v_credits
  FROM public.leave_credits lc
  WHERE lc.employee_id = v_emp_id;

  -- 5. Notificações do Portal (Avisos globais da equipe + Notificações sobre este profissional)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'title', n.title,
      'message', n.message,
      'is_global', coalesce(n.is_global_banner, false),
      'priority', coalesce(n.priority, 'normal'),
      'created_at', n.created_at,
      'is_read', (r.read_at IS NOT NULL)
    ) ORDER BY n.created_at DESC
  ), '[]'::jsonb)
  INTO v_notifications
  FROM (
    SELECT DISTINCT ON (n.id) n.id, n.title, n.message, n.is_global_banner, n.priority, n.created_at
    FROM public.notifications n
    WHERE n.team_id = v_team_id
      AND (
        n.is_global_banner = true
        OR n.title ILIKE '%comunicado%'
        OR n.title ILIKE '%aviso%'
        OR (v_emp_name IS NOT NULL AND v_emp_name <> '' AND n.message ILIKE ('%' || v_emp_name || '%'))
      )
    ORDER BY n.id, n.created_at DESC
    LIMIT 40
  ) n
  LEFT JOIN public.portal_notification_reads r
    ON r.notification_id = n.id AND r.employee_id = v_emp_id;

  -- 6. Totais e Saldo
  SELECT
    coalesce(sum(CASE WHEN origin = 'extra_shift' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN origin NOT IN ('extra_shift', 'leave_used') THEN amount ELSE 0 END), 0),
    abs(coalesce(sum(CASE WHEN origin = 'leave_used' THEN amount ELSE 0 END), 0)),
    coalesce(sum(amount), 0)
  INTO v_shifts, v_manual, v_used, v_balance
  FROM public.leave_credits
  WHERE employee_id = v_emp_id;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', v_profile,
    'summary', jsonb_build_object(
      'shifts', v_shifts,
      'manual', v_manual,
      'used', v_used,
      'balance', v_balance
    ),
    'schedules', v_schedules,
    'leaves', v_leaves,
    'transfers', v_transfers,
    'credits', v_credits,
    'notifications', v_notifications
  );
END;
$$;

-- 3. Função para marcar notificação como lida no Portal
CREATE OR REPLACE FUNCTION public.portal_mark_notification_read(p_token text, p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  v_emp_id := public.portal_session_employee(p_token);
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  INSERT INTO public.portal_notification_reads (employee_id, notification_id)
  VALUES (v_emp_id, p_notification_id)
  ON CONFLICT (employee_id, notification_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Função para marcar TODAS as notificações como lidas no Portal
CREATE OR REPLACE FUNCTION public.portal_mark_all_notifications_read(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp_id   uuid;
  v_team_id  uuid;
  v_emp_name text;
BEGIN
  v_emp_id := public.portal_session_employee(p_token);
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  SELECT team_id, name INTO v_team_id, v_emp_name
  FROM public.employees
  WHERE id = v_emp_id;

  INSERT INTO public.portal_notification_reads (employee_id, notification_id)
  SELECT DISTINCT v_emp_id, n.id
  FROM public.notifications n
  WHERE n.team_id = v_team_id
    AND (
      n.is_global_banner = true
      OR n.title ILIKE '%comunicado%'
      OR n.title ILIKE '%aviso%'
      OR (v_emp_name IS NOT NULL AND v_emp_name <> '' AND n.message ILIKE ('%' || v_emp_name || '%'))
    )
  ON CONFLICT (employee_id, notification_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Função de Logout explícito no Portal (encerra a sessão no banco)
CREATE OR REPLACE FUNCTION public.portal_logout(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_token IS NOT NULL AND length(p_token) >= 32 THEN
    DELETE FROM public.portal_sessions
    WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Permissões RPC públicas
GRANT EXECUTE ON FUNCTION public.portal_mark_notification_read(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mark_all_notifications_read(text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_logout(text)                      TO anon, authenticated;
