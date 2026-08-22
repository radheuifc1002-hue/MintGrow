-- Lock remaining client-controlled economic/profile fields.

create or replace function public.update_player_metadata(
  p_telegram_id text,
  p_username text default null,
  p_avatar_url text default null,
  p_wallet_address text default null,
  p_best_score integer default null,
  p_level integer default null,
  p_last_login_date text default null,
  p_login_streak integer default null,
  p_power_ups jsonb default null
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare row_player public.players; normalized_wallet text;
begin
  normalized_wallet := lower(trim(coalesce(p_wallet_address, '')));
  if p_wallet_address is not null and normalized_wallet <> '' and normalized_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'Invalid BEP-20 wallet address';
  end if;

  update public.players
  set username = case when p_username is null then username else left(trim(p_username),32) end,
      avatar_url = coalesce(p_avatar_url, avatar_url),
      wallet_address = case when p_wallet_address is null then wallet_address else normalized_wallet end,
      updated_at = now()
  where telegram_id = p_telegram_id
  returning * into row_player;
  if row_player.telegram_id is null then raise exception 'Player % not found',p_telegram_id; end if;
  return row_player;
end;
$$;

create or replace function public.spend_tokens_for_powerup(
  p_telegram_id text,
  p_type text,
  p_cost numeric
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare row_player public.players; before_balance numeric; server_cost numeric;
begin
  server_cost := case p_type
    when 'undo' then 500
    when 'destroy' then 1000
    when 'clear_blockers' then 2000
    when 'shuffle' then 1500
    else 0
  end;
  if server_cost <= 0 then raise exception 'invalid power-up'; end if;

  select * into row_player from public.players where telegram_id=p_telegram_id for update;
  if row_player.telegram_id is null or row_player.total_tokens < server_cost then raise exception 'insufficient balance or player missing'; end if;
  before_balance := row_player.total_tokens;

  update public.players
  set total_tokens=round(total_tokens-server_cost,2),
      power_ups=jsonb_set(power_ups,ARRAY[p_type],to_jsonb(coalesce((power_ups->>p_type)::integer,0)+1),true)
  where telegram_id=p_telegram_id
  returning * into row_player;

  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by)
  values(p_telegram_id,-server_cost,before_balance,row_player.total_tokens,'Power-up purchase','powerup',p_type,'mintgrow-api');
  return row_player;
end;
$$;

create table if not exists public.powerup_daily_counters (
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  reward_date date not null default (now() at time zone 'UTC')::date,
  grants integer not null default 0 check (grants >= 0),
  primary key(telegram_id,reward_date)
);
alter table public.powerup_daily_counters enable row level security;
revoke all on table public.powerup_daily_counters from anon, authenticated;

create or replace function public.grant_powerup(
  p_telegram_id text,
  p_type text,
  p_client_event_id text
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare row_player public.players; grant_row public.powerup_grants; counter public.powerup_daily_counters;
begin
  if p_type not in ('undo','destroy','clear_blockers','shuffle') then raise exception 'invalid power-up'; end if;
  if nullif(trim(p_client_event_id),'') is null or length(p_client_event_id) > 128 then raise exception 'client event id required'; end if;

  insert into powerup_daily_counters(telegram_id,reward_date)
  values(p_telegram_id,(now() at time zone 'UTC')::date)
  on conflict(telegram_id,reward_date) do nothing;
  select * into counter from powerup_daily_counters
  where telegram_id=p_telegram_id and reward_date=(now() at time zone 'UTC')::date for update;
  if counter.grants >= 20 then raise exception 'Daily power-up grant limit reached'; end if;

  insert into powerup_grants(telegram_id,client_event_id,powerup_type)
  values(p_telegram_id,trim(p_client_event_id),p_type)
  on conflict(client_event_id) do nothing returning * into grant_row;

  select * into row_player from players where telegram_id=p_telegram_id for update;
  if row_player.telegram_id is null then raise exception 'player not found'; end if;
  if grant_row.id is not null then
    update players set power_ups=jsonb_set(power_ups,array[p_type],to_jsonb(coalesce((power_ups->>p_type)::integer,0)+1),true)
    where telegram_id=p_telegram_id returning * into row_player;
    update powerup_daily_counters set grants=grants+1 where telegram_id=p_telegram_id and reward_date=(now() at time zone 'UTC')::date;
  end if;
  return row_player;
end;
$$;

grant execute on function public.update_player_metadata(text,text,text,text,integer,integer,text,integer,jsonb) to service_role;
grant execute on function public.spend_tokens_for_powerup(text,text,numeric) to service_role;
grant execute on function public.grant_powerup(text,text,text) to service_role;
