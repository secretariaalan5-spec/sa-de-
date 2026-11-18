-- Permite que o Service Worker (sem sessão do usuário) renove a inscrição push
-- quando o navegador rotaciona o token (evento pushsubscriptionchange).
-- O endpoint antigo é um segredo longo e imprevisível, servindo como prova de posse.
CREATE OR REPLACE FUNCTION public.rotate_push_subscription(
  p_old_endpoint TEXT,
  p_new_endpoint TEXT,
  p_p256dh TEXT,
  p_auth_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row RECORD;
BEGIN
  IF p_old_endpoint IS NULL OR length(p_old_endpoint) < 40
     OR p_new_endpoint IS NULL OR length(p_new_endpoint) < 40 THEN
    RETURN 0;
  END IF;

  FOR v_row IN SELECT DISTINCT user_id FROM public.push_subscriptions WHERE endpoint = p_old_endpoint LOOP
    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
    VALUES (v_row.user_id, p_new_endpoint, p_p256dh, p_auth_key)
    ON CONFLICT (user_id, endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh, auth_key = EXCLUDED.auth_key;
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.push_subscriptions WHERE endpoint = p_old_endpoint;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_push_subscription(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_push_subscription(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
