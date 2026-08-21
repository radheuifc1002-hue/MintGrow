-- MintGrow production reset + Telegram identity integrity.
-- This migration is intentionally destructive for the current TEST dataset.
-- It preserves auth.users and public.admin_users.
-- Apply only because the existing players/activity rows are known test data.

-- Clear dependent activity first.
truncate table public.referrals;
truncate table public.ad_events;
truncate table public.game_sessions;
truncate table public.withdrawals;

-- Clear test player profiles, but keep the admin authorization table intact.
truncate table public.players;

-- Production invariant: one Telegram identity = one player.
create unique index if not exists players_telegram_id_uidx
  on public.players(telegram_id);

-- Referral codes must also be unique in production.
create unique index if not exists players_referral_code_uidx
  on public.players(upper(referral_code))
  where referral_code is not null and referral_code <> '';
