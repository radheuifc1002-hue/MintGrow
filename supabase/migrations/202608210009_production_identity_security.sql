-- Production identity/security hardening for MintGrow.
-- This migration does NOT delete data. It prepares identity binding and safer RPC primitives.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- One Telegram identity must map to one player.
CREATE UNIQUE INDEX IF NOT EXISTS players_telegram_id_unique_idx
  ON public.players (telegram_id);

-- Referral codes must be unique and case-normalized by application/RPC code.
CREATE UNIQUE INDEX IF NOT EXISTS players_referral_code_unique_idx
  ON public.players (referral_code)
  WHERE referral_code IS NOT NULL AND referral_code <> '';

-- Prevent users from directly mutating financial/activity state through the REST API.
REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ad_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.game_sessions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.withdrawals FROM anon, authenticated;

GRANT SELECT ON public.players, public.referrals, public.ad_events, public.game_sessions, public.withdrawals TO authenticated;

-- Admin reads are intentionally centralized through the existing is_admin() check.
DROP POLICY IF EXISTS admin_read_players ON public.players;
CREATE POLICY admin_read_players ON public.players
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_read_referrals ON public.referrals;
CREATE POLICY admin_read_referrals ON public.referrals
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_read_ad_events ON public.ad_events;
CREATE POLICY admin_read_ad_events ON public.ad_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_read_game_sessions ON public.game_sessions;
CREATE POLICY admin_read_game_sessions ON public.game_sessions
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_read_withdrawals ON public.withdrawals;
CREATE POLICY admin_read_withdrawals ON public.withdrawals
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Explicitly disallow arbitrary client-side execution of privileged functions unless
-- the function itself performs its own identity/authorization checks.
COMMENT ON SCHEMA public IS 'MintGrow production schema: financial state is mutated only by SECURITY DEFINER RPCs with authorization/idempotency checks.';
