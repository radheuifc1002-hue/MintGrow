-- MintGrow backend-flow security baseline.
-- This migration intentionally stays on the website/Supabase side.
-- ERC-4337, EIP-7702, Paymaster and token contracts are not modified here.

-- The Edge Function is the trusted application gateway. Direct public table access
-- must not remain available as a second mutation path.
alter table public.players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.ad_events enable row level security;
alter table public.withdrawals enable row level security;
alter table public.referrals enable row level security;
alter table public.token_ledger enable row level security;

revoke all on table public.players from anon, authenticated;
revoke all on table public.game_sessions from anon, authenticated;
revoke all on table public.ad_events from anon, authenticated;
revoke all on table public.withdrawals from anon, authenticated;
revoke all on table public.referrals from anon, authenticated;
revoke all on table public.token_ledger from anon, authenticated;

-- Reward guardrails are separate from API rate limiting. They protect the economy
-- even if a caller can repeatedly reach the trusted Edge Function.
create table if not exists public.reward_daily_counters (
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  reward_date date not null default (now() at time zone 'UTC')::date,
  gameplay_tokens numeric(18,2) not null default 0 check (gameplay_tokens >= 0),
  ad_tokens numeric(18,2) not null default 0 check (ad_tokens >= 0),
  ad_count integer not null default 0 check (ad_count >= 0),
  primary key (telegram_id, reward_date)
);
alter table public.reward_daily_counters enable row level security;
revoke all on table public.reward_daily_counters from anon, authenticated;

-- Server-side reward limits. These are deliberately conservative until the
-- authoritative game/ad settlement flows are finalized.
create or replace function public.credit_player_tokens(
  p_telegram_id text,
  p_amount numeric,
  p_best_score integer default null,
  p_level integer default null
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_player public.players;
  before_balance numeric;
  counter public.reward_daily_counters;
  accepted numeric;
  remaining numeric;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 250 then
    raise exception 'Invalid gameplay reward amount';
  end if;
  if p_best_score is not null and (p_best_score < 0 or p_best_score > 10000000) then
    raise exception 'Invalid game score';
  end if;

  insert into reward_daily_counters(telegram_id, reward_date)
  values (p_telegram_id, (now() at time zone 'UTC')::date)
  on conflict (telegram_id, reward_date) do nothing;

  select * into counter
  from reward_daily_counters
  where telegram_id = p_telegram_id
    and reward_date = (now() at time zone 'UTC')::date
  for update;

  remaining := greatest(0, 5000 - counter.gameplay_tokens);
  accepted := least(p_amount, remaining);
  if accepted <= 0 then
    raise exception 'Daily gameplay reward limit reached';
  end if;

  select total_tokens into before_balance
  from players where telegram_id = p_telegram_id for update;
  if before_balance is null then
    raise exception 'Player % not found', p_telegram_id;
  end if;

  update players
  set total_tokens = round(total_tokens + accepted, 2),
      best_score = greatest(best_score, coalesce(p_best_score, best_score)),
      level = greatest(level, coalesce(p_level, level))
  where telegram_id = p_telegram_id
  returning * into updated_player;

  update reward_daily_counters
  set gameplay_tokens = gameplay_tokens + accepted
  where telegram_id = p_telegram_id
    and reward_date = (now() at time zone 'UTC')::date;

  insert into token_ledger(
    telegram_id, amount, balance_before, balance_after, reason,
    reference_type, reference_id, created_by
  ) values (
    p_telegram_id, accepted, before_balance, updated_player.total_tokens,
    'Gameplay reward', 'game_reward', gen_random_uuid()::text, 'mintgrow-api'
  );

  return updated_player;
end;
$$;

-- Ad rewards remain bounded at the backend even when the client supplies a
-- watched flag. The provider-specific server callback can replace this later;
-- until then, one event id can only pay once and a player has a daily cap.
create or replace function public.record_ad_event(
  p_telegram_id text,
  p_client_event_id text,
  p_placement text,
  p_watched boolean,
  p_reward_tokens numeric default 0,
  p_error text default null
)
returns public.ad_events
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.ad_events;
  before_balance numeric;
  counter public.reward_daily_counters;
  accepted numeric := 0;
begin
  if nullif(trim(p_client_event_id), '') is null then
    raise exception 'client event id required';
  end if;
  if length(p_client_event_id) > 128 then
    raise exception 'client event id too long';
  end if;

  insert into ad_events(
    telegram_id, client_event_id, placement, provider, watched, error, reward_tokens
  ) values (
    p_telegram_id, p_client_event_id, left(coalesce(p_placement, 'unknown'), 80),
    'monetag', coalesce(p_watched, false), left(p_error, 500), 0
  ) on conflict(client_event_id) do nothing returning * into event_row;

  if event_row.id is null then
    select * into event_row from ad_events where client_event_id = p_client_event_id;
    return event_row;
  end if;

  if not coalesce(p_watched, false) then
    return event_row;
  end if;

  insert into reward_daily_counters(telegram_id, reward_date)
  values (p_telegram_id, (now() at time zone 'UTC')::date)
  on conflict (telegram_id, reward_date) do nothing;

  select * into counter from reward_daily_counters
  where telegram_id = p_telegram_id
    and reward_date = (now() at time zone 'UTC')::date
  for update;

  -- Current Monetag integration pays a fixed application reward. The client
  -- supplied amount is never trusted.
  if counter.ad_count >= 20 then
    return event_row;
  end if;
  if counter.ad_tokens >= 2000 then
    return event_row;
  end if;

  accepted := 100;
  select total_tokens into before_balance from players
  where telegram_id = p_telegram_id for update;
  if before_balance is null then
    raise exception 'Player % not found', p_telegram_id;
  end if;

  update players
  set ads_watched = ads_watched + 1,
      total_tokens = round(total_tokens + accepted, 2)
  where telegram_id = p_telegram_id;

  update ad_events
  set reward_tokens = accepted
  where id = event_row.id
  returning * into event_row;

  update reward_daily_counters
  set ad_tokens = ad_tokens + accepted,
      ad_count = ad_count + 1
  where telegram_id = p_telegram_id
    and reward_date = (now() at time zone 'UTC')::date;

  insert into token_ledger(
    telegram_id, amount, balance_before, balance_after, reason,
    reference_type, reference_id, created_by
  ) values (
    p_telegram_id, accepted, before_balance, before_balance + accepted,
    'Rewarded ad', 'ad_event', event_row.id::text, 'mintgrow-api'
  );

  return event_row;
end;
$$;

-- Referral application is one-time per referee. Keep it transactional and make
-- the bonus values server-owned rather than accepting them from the website.
create or replace function public.apply_referral_code(
  p_referee_telegram_id text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referee public.players;
  referrer public.players;
  referral_row public.referrals;
  normalized_code text := upper(trim(p_code));
  referee_before numeric;
  referrer_before numeric;
begin
  if normalized_code = '' or length(normalized_code) > 32 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into referee from players where telegram_id = p_referee_telegram_id for update;
  if referee.telegram_id is null then
    return jsonb_build_object('ok', false, 'reason', 'referee_not_found');
  end if;
  if coalesce(referee.referred_by, '') <> '' then
    return jsonb_build_object('ok', false, 'reason', 'already_referred');
  end if;

  select * into referrer from players
  where upper(referral_code) = normalized_code
  for update;
  if referrer.telegram_id is null or referrer.telegram_id = referee.telegram_id then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  referee_before := referee.total_tokens;
  referrer_before := referrer.total_tokens;

  update players set referred_by = normalized_code, total_tokens = round(total_tokens + 100, 2)
  where telegram_id = referee.telegram_id;
  update players set direct_referral_count = direct_referral_count + 1,
    total_tokens = round(total_tokens + 500, 2),
    referral_tokens_earned = round(referral_tokens_earned + 500, 2)
  where telegram_id = referrer.telegram_id;

  insert into referrals(referrer_telegram_id, referee_telegram_id, level, tokens_earned)
  values(referrer.telegram_id, referee.telegram_id, 1, 500)
  on conflict(referrer_telegram_id, referee_telegram_id)
  do update set tokens_earned = greatest(referrals.tokens_earned, excluded.tokens_earned)
  returning * into referral_row;

  insert into token_ledger(telegram_id, amount, balance_before, balance_after, reason, reference_type, reference_id, created_by)
  values
    (referee.telegram_id, 100, referee_before, referee_before + 100, 'Referral welcome bonus', 'referral', referral_row.id::text, 'mintgrow-api'),
    (referrer.telegram_id, 500, referrer_before, referrer_before + 500, 'Direct referral bonus', 'referral', referral_row.id::text, 'mintgrow-api');

  return jsonb_build_object('ok', true, 'welcome_bonus', 100, 'referrer_bonus', 500, 'referral_id', referral_row.id);
end;
$$;

-- Wallet input is validated at the server boundary. The browser's validation is
-- only UX and is never treated as authorization.
create or replace function public.submit_withdrawal_request(
  p_id text,
  p_telegram_id text,
  p_username text,
  p_amount numeric,
  p_wallet_address text,
  p_network text
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  created_withdrawal public.withdrawals;
  before_balance numeric;
  normalized_wallet text := lower(trim(p_wallet_address));
  withdrawal_id text := coalesce(nullif(trim(p_id), ''), gen_random_uuid()::text);
begin
  if p_amount is null or p_amount < 250000 then
    raise exception 'Minimum withdrawal is 250000 MG';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception 'Invalid withdrawal precision';
  end if;
  if normalized_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'Invalid BEP-20 wallet address';
  end if;
  if lower(trim(coalesce(p_network, ''))) not in ('bnb chain (bep-20)', 'bsc', 'bnb') then
    raise exception 'Unsupported withdrawal network';
  end if;
  if length(withdrawal_id) > 128 then
    raise exception 'Invalid withdrawal id';
  end if;

  select total_tokens into before_balance from players
  where telegram_id = p_telegram_id for update;
  if before_balance is null or before_balance < p_amount then
    raise exception 'Insufficient balance or missing player';
  end if;

  if exists (
    select 1 from withdrawals
    where telegram_id = p_telegram_id and status in ('pending','approved')
      and wallet_address = normalized_wallet
  ) then
    raise exception 'An active withdrawal for this wallet already exists';
  end if;

  update players set total_tokens = round(total_tokens - p_amount, 2),
    pending_tokens = round(pending_tokens + p_amount, 2)
  where telegram_id = p_telegram_id;

  insert into token_ledger(telegram_id, amount, balance_before, balance_after, reason, reference_type, reference_id, created_by)
  values(p_telegram_id, -p_amount, before_balance, before_balance - p_amount, 'Withdrawal request', 'withdrawal', withdrawal_id, 'mintgrow-api');

  insert into withdrawals(id, telegram_id, username, amount, wallet_address, network, status)
  values(withdrawal_id, p_telegram_id, left(trim(p_username), 32), p_amount, normalized_wallet, 'BNB Chain (BEP-20)', 'pending')
  returning * into created_withdrawal;

  return created_withdrawal;
exception when unique_violation then
  raise exception 'Withdrawal request already exists';
end;
$$;

-- These functions are only intended to be invoked by the verified Edge Function.
revoke all on function public.credit_player_tokens(text,numeric,integer,integer) from public, anon, authenticated;
revoke all on function public.record_ad_event(text,text,text,boolean,numeric,text) from public, anon, authenticated;
revoke all on function public.apply_referral_code(text,text) from public, anon, authenticated;
revoke all on function public.submit_withdrawal_request(text,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.credit_player_tokens(text,numeric,integer,integer) to service_role;
grant execute on function public.record_ad_event(text,text,text,boolean,numeric,text) to service_role;
grant execute on function public.apply_referral_code(text,text) to service_role;
grant execute on function public.submit_withdrawal_request(text,text,text,numeric,text,text) to service_role;
