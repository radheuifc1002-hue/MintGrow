-- MintGrow production data/rewards layer.
-- This migration is intentionally destructive for the current TEST dataset.
-- It preserves auth.users and public.admin_users.

-- Reset known test application data first.
truncate table public.referrals;
truncate table public.ad_events;
truncate table public.game_sessions;
truncate table public.withdrawals;
truncate table public.players;

-- Production identity invariants.
create unique index if not exists players_telegram_id_uidx
  on public.players(telegram_id);

create unique index if not exists players_referral_code_uidx
  on public.players(upper(referral_code))
  where referral_code is not null and referral_code <> '';

-- Idempotency keys for client retries.
alter table public.game_sessions add column if not exists client_session_id text;
alter table public.ad_events add column if not exists client_event_id text;
create unique index if not exists game_sessions_client_session_id_uidx
  on public.game_sessions(client_session_id)
  where client_session_id is not null;
create unique index if not exists ad_events_client_event_id_uidx
  on public.ad_events(client_event_id)
  where client_event_id is not null;

-- Stable database-generated referral code.
create or replace function public.ensure_referral_code(p_telegram_id text)
returns text language plpgsql security definer set search_path = public as $$
declare existing_code text; candidate text; suffix text;
begin
  select referral_code into existing_code from public.players where telegram_id = p_telegram_id;
  if existing_code is not null and existing_code <> '' then return existing_code; end if;
  loop
    candidate := 'MG' || right(regexp_replace(p_telegram_id, '[^0-9]', '', 'g'), 6);
    suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    candidate := left(candidate || suffix, 20);
    begin
      update public.players set referral_code = candidate
      where telegram_id = p_telegram_id and coalesce(referral_code, '') = ''
      returning referral_code into existing_code;
      if existing_code is not null then return existing_code; end if;
    exception when unique_violation then
    end;
  end loop;
end;
$$;

-- Atomic registration; first registration gets exactly 100 MG.
create or replace function public.complete_player_registration(p_telegram_id text, p_username text)
returns public.players language plpgsql security definer set search_path = public as $$
declare updated_player public.players;
begin
  update public.players
  set username = left(trim(p_username), 32),
      is_registered = true,
      total_tokens = case when is_registered then total_tokens else round(total_tokens + 100, 2) end
  where telegram_id = p_telegram_id
  returning * into updated_player;
  if updated_player.telegram_id is null then raise exception 'Player % not found', p_telegram_id; end if;
  perform public.ensure_referral_code(p_telegram_id);
  select * into updated_player from public.players where telegram_id = p_telegram_id;
  return updated_player;
end;
$$;

-- Atomic game completion.
create or replace function public.record_game_session(
  p_telegram_id text, p_client_session_id text, p_score integer, p_moves integer,
  p_level integer, p_tokens_earned numeric, p_max_tile integer default 2,
  p_board jsonb default null, p_started_at timestamptz default now(), p_ended_at timestamptz default now())
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare session_row public.game_sessions;
begin
  if p_score < 0 or p_moves < 0 or p_tokens_earned < 0 then raise exception 'Invalid game session values'; end if;
  insert into public.game_sessions(telegram_id, client_session_id, score, moves, level, tokens_earned, max_tile, board, started_at, ended_at)
  values(p_telegram_id, p_client_session_id, p_score, p_moves, greatest(p_level,1), p_tokens_earned, greatest(p_max_tile,2), p_board, p_started_at, p_ended_at)
  on conflict (client_session_id) do update set score=excluded.score, moves=excluded.moves, level=excluded.level,
    tokens_earned=excluded.tokens_earned, max_tile=excluded.max_tile, board=excluded.board, ended_at=excluded.ended_at
  returning * into session_row;
  update public.players set games_played=(select count(*)::integer from public.game_sessions where telegram_id=p_telegram_id)
  where telegram_id=p_telegram_id;
  return session_row;
end;
$$;

-- Atomic ad event and watched counter.
create or replace function public.record_ad_event(
  p_telegram_id text, p_client_event_id text, p_placement text, p_watched boolean,
  p_reward_tokens numeric default 0, p_error text default null)
returns public.ad_events language plpgsql security definer set search_path = public as $$
declare event_row public.ad_events; inserted_new boolean := false;
begin
  if p_reward_tokens < 0 then raise exception 'Invalid reward amount'; end if;
  insert into public.ad_events(telegram_id, client_event_id, placement, provider, watched, error, reward_tokens)
  values(p_telegram_id,p_client_event_id,p_placement,'monetag',coalesce(p_watched,false),p_error,p_reward_tokens)
  on conflict (client_event_id) do nothing returning * into event_row;
  inserted_new := event_row.id is not null;
  if not inserted_new then
    select * into event_row from public.ad_events where client_event_id=p_client_event_id;
  elsif p_watched then
    update public.players set ads_watched=ads_watched+1 where telegram_id=p_telegram_id;
  end if;
  return event_row;
end;
$$;

-- Atomic gameplay/token credit.
create or replace function public.credit_player_tokens(p_telegram_id text, p_amount numeric, p_best_score integer default null, p_level integer default null)
returns public.players language plpgsql security definer set search_path = public as $$
declare updated_player public.players;
begin
  if p_amount <= 0 then raise exception 'Token credit amount must be positive'; end if;
  update public.players set total_tokens=round(total_tokens+p_amount,2),
    best_score=greatest(best_score,coalesce(p_best_score,best_score)), level=greatest(level,coalesce(p_level,level))
  where telegram_id=p_telegram_id returning * into updated_player;
  if updated_player.telegram_id is null then raise exception 'Player % not found',p_telegram_id; end if;
  return updated_player;
end;
$$;

-- Atomic direct referral allocation: referee +100 MG, referrer +500 MG.
create or replace function public.apply_referral_code(p_referee_telegram_id text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare referee public.players; referrer public.players; referral_row public.referrals; normalized_code text:=upper(trim(p_code));
begin
  if normalized_code='' then return jsonb_build_object('ok',false,'reason','invalid_code'); end if;
  select * into referee from public.players where telegram_id=p_referee_telegram_id for update;
  if referee.telegram_id is null then return jsonb_build_object('ok',false,'reason','referee_not_found'); end if;
  if coalesce(referee.referred_by,'')<>'' then return jsonb_build_object('ok',false,'reason','already_referred'); end if;
  select * into referrer from public.players where upper(referral_code)=normalized_code for update;
  if referrer.telegram_id is null then return jsonb_build_object('ok',false,'reason','invalid_code'); end if;
  if referrer.telegram_id=referee.telegram_id then return jsonb_build_object('ok',false,'reason','self_referral'); end if;
  update public.players set referred_by=normalized_code,total_tokens=round(total_tokens+100,2) where telegram_id=referee.telegram_id;
  update public.players set direct_referral_count=direct_referral_count+1,total_tokens=round(total_tokens+500,2),referral_tokens_earned=round(referral_tokens_earned+500,2) where telegram_id=referrer.telegram_id;
  insert into public.referrals(referrer_telegram_id,referee_telegram_id,level,tokens_earned)
  values(referrer.telegram_id,referee.telegram_id,1,500)
  on conflict (referrer_telegram_id,referee_telegram_id) do update set tokens_earned=greatest(public.referrals.tokens_earned,excluded.tokens_earned);
  select * into referral_row from public.referrals where referrer_telegram_id=referrer.telegram_id and referee_telegram_id=referee.telegram_id;
  return jsonb_build_object('ok',true,'welcome_bonus',100,'referrer_bonus',500,'referrer_telegram_id',referrer.telegram_id,'referral_id',referral_row.id);
end;
$$;

-- Withdrawal transaction with 25-level referral allocation.
create or replace function public.submit_withdrawal_request(p_id text,p_telegram_id text,p_username text,p_amount numeric,p_wallet_address text,p_network text)
returns public.withdrawals language plpgsql security definer set search_path=public as $$
declare created_withdrawal public.withdrawals; updated_telegram_id text; referee_code text; ancestor_code text; ancestor_id text;
level_no integer:=1; direct_required integer; pct numeric; reward numeric;
begin
  if p_amount<=0 then raise exception 'Withdrawal amount must be positive'; end if;
  if p_amount<250000 then raise exception 'Minimum withdrawal is 250000 MG'; end if;
  update public.players set total_tokens=round(total_tokens-p_amount,2),pending_tokens=round(pending_tokens+p_amount,2)
  where telegram_id=p_telegram_id and total_tokens>=p_amount returning telegram_id,referred_by into updated_telegram_id,referee_code;
  if updated_telegram_id is null then raise exception 'Insufficient balance or missing player'; end if;
  ancestor_code:=referee_code;
  while ancestor_code is not null and level_no<=25 loop
    select telegram_id,referred_by into ancestor_id,referee_code from public.players where upper(referral_code)=upper(ancestor_code) for update;
    exit when ancestor_id is null;
    direct_required:=case when level_no in(1,2) then 2 when level_no=3 then 3 when level_no=4 then 4 when level_no=5 then 5 else 6 end;
    pct:=case when level_no=1 then .20 when level_no=2 then .15 when level_no=3 then .10 when level_no in(4,5) then .05 else .03 end;
    if (select direct_referral_count from public.players where telegram_id=ancestor_id)>=direct_required then
      reward:=round(p_amount*pct,2);
      update public.players set total_tokens=round(total_tokens+reward,2),referral_tokens_earned=round(referral_tokens_earned+reward,2) where telegram_id=ancestor_id;
      insert into public.referrals(referrer_telegram_id,referee_telegram_id,level,tokens_earned)
      values(ancestor_id,p_telegram_id,level_no,reward)
      on conflict(referrer_telegram_id,referee_telegram_id) do update set level=excluded.level,tokens_earned=round(public.referrals.tokens_earned+excluded.tokens_earned,2);
    end if;
    ancestor_code:=referee_code; level_no:=level_no+1;
  end loop;
  insert into public.withdrawals(id,telegram_id,username,amount,wallet_address,network,status)
  values(p_id,p_telegram_id,p_username,p_amount,p_wallet_address,p_network,'pending') returning * into created_withdrawal;
  return created_withdrawal;
end;
$$;

grant execute on function public.ensure_referral_code(text) to anon,authenticated;
grant execute on function public.complete_player_registration(text,text) to anon,authenticated;
grant execute on function public.record_game_session(text,text,integer,integer,integer,numeric,integer,jsonb,timestamptz,timestamptz) to anon,authenticated;
grant execute on function public.record_ad_event(text,text,text,boolean,numeric,text) to anon,authenticated;
grant execute on function public.credit_player_tokens(text,numeric,integer,integer) to anon,authenticated;
grant execute on function public.apply_referral_code(text,text) to anon,authenticated;
grant execute on function public.submit_withdrawal_request(text,text,text,numeric,text,text) to anon,authenticated;
