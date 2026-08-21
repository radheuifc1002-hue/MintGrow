-- Consolidated admin dashboard read API.
-- Returns only data needed by the authenticated super/admin panel.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'overview', jsonb_build_object(
      'total_users', (SELECT count(*) FROM public.players),
      'registered_users', (SELECT count(*) FROM public.players WHERE is_registered = true),
      'total_mg', COALESCE((SELECT sum(total_tokens) FROM public.players), 0),
      'pending_mg', COALESCE((SELECT sum(pending_tokens) FROM public.players), 0),
      'withdrawn_mg', COALESCE((SELECT sum(withdrawn_tokens) FROM public.players), 0),
      'total_ads', (SELECT count(*) FROM public.ad_events WHERE watched = true),
      'total_games', (SELECT count(*) FROM public.game_sessions),
      'total_referrals', (SELECT count(*) FROM public.referrals),
      'pending_withdrawals', (SELECT count(*) FROM public.withdrawals WHERE status = 'pending'),
      'pending_withdrawal_mg', COALESCE((SELECT sum(amount) FROM public.withdrawals WHERE status = 'pending'), 0)
    ),
    'recent_players', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
      FROM (SELECT * FROM public.players ORDER BY created_at DESC LIMIT 50) p
    ), '[]'::jsonb),
    'recent_withdrawals', COALESCE((
      SELECT jsonb_agg(to_jsonb(w) ORDER BY w.created_at DESC)
      FROM (SELECT * FROM public.withdrawals ORDER BY created_at DESC LIMIT 50) w
    ), '[]'::jsonb),
    'recent_referrals', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM public.referrals ORDER BY created_at DESC LIMIT 50) r
    ), '[]'::jsonb),
    'recent_ads', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
      FROM (SELECT * FROM public.ad_events ORDER BY created_at DESC LIMIT 50) a
    ), '[]'::jsonb),
    'recent_games', COALESCE((
      SELECT jsonb_agg(to_jsonb(g) ORDER BY g.created_at DESC)
      FROM (SELECT * FROM public.game_sessions ORDER BY created_at DESC LIMIT 50) g
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard() TO authenticated;
