-- Safe player metadata operations. Financial fields are never accepted from the client.

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
declare row_player public.players;
begin
  update public.players
  set username = case when p_username is null then username else left(trim(p_username),32) end,
      avatar_url = coalesce(p_avatar_url, avatar_url),
      wallet_address = case when p_wallet_address is null then wallet_address else left(trim(p_wallet_address),100) end,
      best_score = greatest(best_score, coalesce(p_best_score,best_score)),
      level = greatest(level, coalesce(p_level,level)),
      last_login_date = coalesce(p_last_login_date,last_login_date),
      login_streak = greatest(0, coalesce(p_login_streak,login_streak)),
      power_ups = coalesce(p_power_ups,power_ups),
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
declare row_player public.players; next_powerups jsonb;
begin
  if p_cost <= 0 or p_type not in ('undo','destroy','clear_blockers','shuffle') then raise exception 'invalid power-up'; end if;
  update public.players
  set total_tokens = round(total_tokens-p_cost,2),
      power_ups = jsonb_set(power_ups, ARRAY[p_type], to_jsonb(coalesce((power_ups->>p_type)::integer,0)+1), true)
  where telegram_id=p_telegram_id and total_tokens>=p_cost
  returning * into row_player;
  if row_player.telegram_id is null then raise exception 'insufficient balance or player missing'; end if;
  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by)
  values(p_telegram_id,-p_cost,row_player.total_tokens+p_cost,row_player.total_tokens,'Power-up purchase','powerup',p_type,'mintgrow-api');
  return row_player;
end;
$$;

create or replace function public.claim_daily_bonus(p_telegram_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare row_player public.players; today text := to_char(now() at time zone 'UTC','YYYY-MM-DD'); yesterday text := to_char((now() - interval '1 day') at time zone 'UTC','YYYY-MM-DD'); new_streak integer; reward numeric;
begin
  select * into row_player from public.players where telegram_id=p_telegram_id for update;
  if row_player.telegram_id is null then raise exception 'player not found'; end if;
  if row_player.last_login_date = today then return jsonb_build_object('ok',false,'reason','already_claimed','streak',row_player.login_streak,'tokens',0); end if;
  new_streak := case when row_player.last_login_date = yesterday then least(row_player.login_streak+1,7) else 1 end;
  reward := (array[50,100,150,200,250,350,500])[new_streak];
  update public.players set total_tokens=round(total_tokens+reward,2), login_streak=new_streak, last_login_date=today where telegram_id=p_telegram_id returning * into row_player;
  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by)
  values(p_telegram_id,reward,row_player.total_tokens-reward,row_player.total_tokens,'Daily bonus','daily_bonus',today,'mintgrow-api');
  return jsonb_build_object('ok',true,'tokens',reward,'streak',new_streak);
end;
$$;

revoke execute on function public.update_player_metadata(text,text,text,text,integer,integer,text,integer,jsonb) from public,anon,authenticated;
revoke execute on function public.spend_tokens_for_powerup(text,text,numeric) from public,anon,authenticated;
revoke execute on function public.claim_daily_bonus(text) from public,anon,authenticated;
grant execute on function public.update_player_metadata(text,text,text,text,integer,integer,text,integer,jsonb) to service_role;
grant execute on function public.spend_tokens_for_powerup(text,text,numeric) to service_role;
grant execute on function public.claim_daily_bonus(text) to service_role;
