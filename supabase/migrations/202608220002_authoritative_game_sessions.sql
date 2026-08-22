-- Server-authoritative game session settlement.
-- The browser may submit a score, but it may not submit the reward amount.

alter table public.game_sessions add column if not exists client_session_id text;
alter table public.game_sessions add column if not exists settled_at timestamptz;
alter table public.game_sessions add column if not exists status text not null default 'active';

create unique index if not exists game_sessions_client_session_id_idx
  on public.game_sessions(client_session_id)
  where client_session_id is not null;

create or replace function public.start_game_session(
  p_telegram_id text,
  p_client_session_id text
)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare row_session public.game_sessions;
begin
  if nullif(trim(p_client_session_id), '') is null or length(p_client_session_id) > 128 then raise exception 'Invalid game session id'; end if;
  if not exists (select 1 from players where telegram_id = p_telegram_id) then raise exception 'Player not found'; end if;

  insert into game_sessions(telegram_id, client_session_id, status, started_at)
  values(p_telegram_id, trim(p_client_session_id), 'active', now())
  on conflict (client_session_id) do nothing
  returning * into row_session;

  if row_session.id is null then
    select * into row_session from game_sessions where client_session_id = trim(p_client_session_id);
    if row_session.telegram_id <> p_telegram_id then raise exception 'Game session ownership mismatch'; end if;
  end if;
  return row_session;
end;
$$;

create or replace function public.settle_game_session(
  p_telegram_id text,
  p_client_session_id text,
  p_score integer,
  p_moves integer,
  p_level integer,
  p_max_tile integer,
  p_board jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.game_sessions;
  player_row public.players;
  counter public.reward_daily_counters;
  before_balance numeric;
  gameplay_reward numeric;
  level_reward numeric := 0;
  accepted numeric;
  remaining numeric;
  derived_level integer := 1;
  i integer;
  level_rewards numeric[] := array[50,100,250,500,1000,2000,4000,8000];
  score_thresholds integer[] := array[0,500,1500,3500,7500,15000,30000,60000,120000];
begin
  if p_score is null or p_score < 0 or p_score > 10000000 then raise exception 'Invalid score'; end if;
  if p_moves is null or p_moves < 1 or p_moves > 10000 then raise exception 'Invalid move count'; end if;
  if p_score > p_moves * 10000 then raise exception 'Score progression is invalid'; end if;
  if p_max_tile is null or p_max_tile < 2 or p_max_tile > 1073741824 then raise exception 'Invalid max tile'; end if;

  select * into session_row from game_sessions
  where client_session_id = trim(p_client_session_id) and telegram_id = p_telegram_id
  for update;
  if session_row.id is null then raise exception 'Game session not found'; end if;
  if session_row.status <> 'active' or session_row.settled_at is not null then return jsonb_build_object('ok', false, 'reason', 'already_settled'); end if;
  if now() < session_row.started_at + interval '2 seconds' then raise exception 'Game session ended too quickly'; end if;
  if now() > session_row.started_at + interval '24 hours' then raise exception 'Game session expired'; end if;

  select * into player_row from players where telegram_id = p_telegram_id for update;
  if player_row.telegram_id is null then raise exception 'Player not found'; end if;

  -- Level rewards are server-owned. The submitted p_level is informational only.
  for i in 1..8 loop
    if p_score >= score_thresholds[i] and player_row.level < i then level_reward := level_reward + level_rewards[i]; end if;
  end loop;
  for i in 1..array_length(score_thresholds,1) loop
    if p_score >= score_thresholds[i] then derived_level := i; end if;
  end loop;

  -- Deterministic server-side gameplay reward. The client reward calculation is ignored.
  gameplay_reward := least(1000, round(p_score * 0.12, 2));
  accepted := gameplay_reward + level_reward;

  insert into reward_daily_counters(telegram_id, reward_date)
  values(p_telegram_id, (now() at time zone 'UTC')::date)
  on conflict (telegram_id, reward_date) do nothing;
  select * into counter from reward_daily_counters
  where telegram_id = p_telegram_id and reward_date = (now() at time zone 'UTC')::date
  for update;

  remaining := greatest(0, 5000 - counter.gameplay_tokens);
  accepted := least(accepted, remaining);

  before_balance := player_row.total_tokens;
  update players set
    total_tokens = round(total_tokens + accepted, 2),
    best_score = greatest(best_score, p_score),
    level = greatest(level, derived_level),
    games_played = games_played + 1
  where telegram_id = p_telegram_id
  returning * into player_row;

  update game_sessions set
    score = p_score, moves = p_moves, level = derived_level, tokens_earned = accepted,
    max_tile = p_max_tile, board = p_board, ended_at = now(), settled_at = now(), status = 'settled'
  where id = session_row.id;

  update reward_daily_counters set gameplay_tokens = gameplay_tokens + accepted
  where telegram_id = p_telegram_id and reward_date = (now() at time zone 'UTC')::date;

  if accepted > 0 then
    insert into token_ledger(telegram_id, amount, balance_before, balance_after, reason, reference_type, reference_id, created_by)
    values(p_telegram_id, accepted, before_balance, player_row.total_tokens, 'Server-settled game reward', 'game_session', session_row.id::text, 'mintgrow-api');
  end if;

  return jsonb_build_object(
    'ok', true,
    'session_id', session_row.id,
    'gameplay_reward', gameplay_reward,
    'level_reward', level_reward,
    'reward', accepted,
    'level', player_row.level,
    'player', to_jsonb(player_row)
  );
end;
$$;

revoke all on function public.start_game_session(text,text) from public, anon, authenticated;
revoke all on function public.settle_game_session(text,text,integer,integer,integer,integer,jsonb) from public, anon, authenticated;
grant execute on function public.start_game_session(text,text) to service_role;
grant execute on function public.settle_game_session(text,text,integer,integer,integer,integer,jsonb) to service_role;
