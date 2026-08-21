-- MintGrow database-backed activity/rewards layer.
-- Keeps the existing players/referrals/ad_events/game_sessions tables and adds
-- atomic RPCs so the client no longer performs read-modify-write for counters.

alter table public.game_sessions
  add column if not exists client_session_id text;

alter table public.ad_events
  add column if not exists client_event_id text;

create unique index if not exists game_sessions_client_session_id_uidx
  on public.game_sessions(client_session_id)
  where client_session_id is not null;

create unique index if not exists ad_events_client_event_id_uidx
  on public.ad_events(client_event_id)
  where client_event_id is not null;

-- Generate a stable unique referral code inside the database for new players.
create or replace function public.ensure_referral_code(p_telegram_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  candidate text;
  suffix text;
begin
  select referral_code into existing_code
  from public.players
  where telegram_id = p_telegram_id;

  if existing_code is not null and existing_code <> '' then
    return existing_code;
  end if;

  loop
    candidate := 'MG' || right(regexp_replace(p_telegram_id, '[^0-9]', '', 'g'), 6);
    suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    candidate := left(candidate || suffix, 20);
    begin
      update public.players
      set referral_code = candidate
      where telegram_id = p_telegram_id
        and (referral_code is null or referral_code = '')
      returning referral_code into existing_code;
      if existing_code is not null then
        return existing_code;
      end if;
    exception when unique_violation then
      -- Retry with a new random suffix.
    end;
  end loop;
end;
$$;

-- Atomic game completion. A client session id makes retries idempotent.
create or replace function public.record_game_session(
  p_telegram_id text,
  p_client_session_id text,
  p_score integer,
  p_moves integer,
  p_level integer,
  p_tokens_earned numeric,
  p_max_tile integer default 2,
  p_board jsonb default null,
  p_started_at timestamptz default now(),
  p_ended_at timestamptz default now()
)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.game_sessions;
begin
  if p_score < 0 or p_moves < 0 or p_tokens_earned < 0 then
    raise exception 'Invalid game session values';
  end if;

  insert into public.game_sessions(
    telegram_id, client_session_id, score, moves, level,
    tokens_earned, max_tile, board, started_at, ended_at
  )
  values(
    p_telegram_id, p_client_session_id, p_score, p_moves, greatest(p_level, 1),
    p_tokens_earned, greatest(p_max_tile, 2), p_board, p_started_at, p_ended_at
  )
  on conflict (client_session_id) do update set
    score = excluded.score,
    moves = excluded.moves,
    level = excluded.level,
    tokens_earned = excluded.tokens_earned,
    max_tile = excluded.max_tile,
    board = excluded.board,
    ended_at = excluded.ended_at
  returning * into session_row;

  update public.players
  set games_played = (
    select count(*)::integer
    from public.game_sessions
    where telegram_id = p_telegram_id
  )
  where telegram_id = p_telegram_id;

  return session_row;
end;
$$;

-- Atomic ad event + watched counter. Client event id prevents duplicate retries.
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
  inserted_new boolean := false;
begin
  if p_reward_tokens < 0 then
    raise exception 'Invalid reward amount';
  end if;

  insert into public.ad_events(
    telegram_id, client_event_id, placement, provider,
    watched, error, reward_tokens
  )
  values(
    p_telegram_id, p_client_event_id, p_placement, 'monetag',
    coalesce(p_watched, false), p_error, p_reward_tokens
  )
  on conflict (client_event_id) do nothing
  returning * into event_row;

  inserted_new := event_row.id is not null;

  if not inserted_new then
    select * into event_row
    from public.ad_events
    where client_event_id = p_client_event_id;
  elsif p_watched then
    update public.players
    set ads_watched = ads_watched + 1
    where telegram_id = p_telegram_id;
  end if;

  return event_row;
end;
$$;

-- Atomic token credit for gameplay/reward operations.
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
begin
  if p_amount <= 0 then
    raise exception 'Token credit amount must be positive';
  end if;

  update public.players
  set total_tokens = round(total_tokens + p_amount, 2),
      best_score = greatest(best_score, coalesce(p_best_score, best_score)),
      level = greatest(level, coalesce(p_level, level))
  where telegram_id = p_telegram_id
  returning * into updated_player;

  if updated_player.telegram_id is null then
    raise exception 'Player % not found', p_telegram_id;
  end if;

  return updated_player;
end;
$$;

-- One atomic referral operation. It creates the relationship, gives the
-- referee the 100 MG welcome bonus, gives the referrer the 500 MG direct
-- bonus, and increments direct_referral_count exactly once.
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
begin
  if normalized_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into referee
  from public.players
  where telegram_id = p_referee_telegram_id
  for update;

  if referee.telegram_id is null then
    return jsonb_build_object('ok', false, 'reason', 'referee_not_found');
  end if;

  if referee.referred_by is not null and referee.referred_by <> '' then
    return jsonb_build_object('ok', false, 'reason', 'already_referred');
  end if;

  select * into referrer
  from public.players
  where upper(referral_code) = normalized_code
  for update;

  if referrer.telegram_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  if referrer.telegram_id = referee.telegram_id then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  update public.players
  set referred_by = normalized_code,
      total_tokens = round(total_tokens + 100, 2)
  where telegram_id = referee.telegram_id;

  update public.players
  set direct_referral_count = direct_referral_count + 1,
      total_tokens = round(total_tokens + 500, 2),
      referral_tokens_earned = round(referral_tokens_earned + 500, 2)
  where telegram_id = referrer.telegram_id;

  insert into public.referrals(
    referrer_telegram_id, referee_telegram_id, level, tokens_earned
  )
  values(referrer.telegram_id, referee.telegram_id, 1, 500)
  on conflict (referrer_telegram_id, referee_telegram_id) do update
    set tokens_earned = greatest(public.referrals.tokens_earned, excluded.tokens_earned);

  select * into referral_row
  from public.referrals
  where referrer_telegram_id = referrer.telegram_id
    and referee_telegram_id = referee.telegram_id;

  return jsonb_build_object(
    'ok', true,
    'welcome_bonus', 100,
    'referrer_bonus', 500,
    'referrer_telegram_id', referrer.telegram_id,
    'referral_id', referral_row.id
  );
end;
$$;

-- The mini app currently uses the public anon client, so these RPCs are
-- explicitly executable by anon/authenticated. The RPCs validate the target
-- player and perform the mutations atomically; later we can move identity
-- verification to Telegram init-data verification without changing callers.
grant execute on function public.ensure_referral_code(text) to anon, authenticated;
grant execute on function public.record_game_session(text, text, integer, integer, integer, numeric, integer, jsonb, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.record_ad_event(text, text, text, boolean, numeric, text) to anon, authenticated;
grant execute on function public.credit_player_tokens(text, numeric, integer, integer) to anon, authenticated;
grant execute on function public.apply_referral_code(text, text) to anon, authenticated;
