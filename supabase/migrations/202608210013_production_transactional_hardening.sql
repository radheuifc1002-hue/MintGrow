-- MintGrow production integration hardening.
-- All player mutations used by the Mini App go through the verified Edge Function.
-- Adds ledger entries to financial movements and secure power-up RPCs.

create table if not exists public.powerup_grants (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  client_event_id text not null unique,
  powerup_type text not null check (powerup_type in ('undo','destroy','clear_blockers','shuffle')),
  created_at timestamptz not null default now()
);
alter table public.powerup_grants enable row level security;

create or replace function public.complete_player_registration(p_telegram_id text, p_username text)
returns public.players language plpgsql security definer set search_path=public as $$
declare updated_player public.players; before_balance numeric; was_registered boolean;
begin
  select is_registered,total_tokens into was_registered,before_balance from public.players where telegram_id=p_telegram_id for update;
  update public.players set username=left(trim(p_username),32), is_registered=true,
    total_tokens=case when coalesce(was_registered,false) then total_tokens else round(total_tokens+100,2) end
  where telegram_id=p_telegram_id returning * into updated_player;
  if updated_player.telegram_id is null then raise exception 'Player % not found',p_telegram_id; end if;
  perform public.ensure_referral_code(p_telegram_id);
  if not coalesce(was_registered,false) then
    insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by)
    values(p_telegram_id,100,coalesce(before_balance,0),updated_player.total_tokens,'Registration welcome bonus','registration',p_telegram_id,'mintgrow-api');
  end if;
  select * into updated_player from public.players where telegram_id=p_telegram_id;
  return updated_player;
end;
$$;

create or replace function public.credit_player_tokens(p_telegram_id text,p_amount numeric,p_best_score integer default null,p_level integer default null)
returns public.players language plpgsql security definer set search_path=public as $$
declare updated_player public.players; before_balance numeric;
begin
  if p_amount<=0 or p_amount>1000 then raise exception 'Invalid token credit amount'; end if;
  select total_tokens into before_balance from public.players where telegram_id=p_telegram_id for update;
  if before_balance is null then raise exception 'Player % not found',p_telegram_id; end if;
  update public.players set total_tokens=round(total_tokens+p_amount,2),best_score=greatest(best_score,coalesce(p_best_score,best_score)),level=greatest(level,coalesce(p_level,level)) where telegram_id=p_telegram_id returning * into updated_player;
  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by) values(p_telegram_id,p_amount,before_balance,updated_player.total_tokens,'Gameplay reward','game_reward',null,'mintgrow-api');
  return updated_player;
end;
$$;

create or replace function public.apply_referral_code(p_referee_telegram_id text,p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare referee public.players; referrer public.players; referral_row public.referrals; normalized_code text:=upper(trim(p_code)); referee_before numeric; referrer_before numeric;
begin
  if normalized_code='' then return jsonb_build_object('ok',false,'reason','invalid_code'); end if;
  select * into referee from public.players where telegram_id=p_referee_telegram_id for update;
  if referee.telegram_id is null then return jsonb_build_object('ok',false,'reason','referee_not_found'); end if;
  if coalesce(referee.referred_by,'')<>'' then return jsonb_build_object('ok',false,'reason','already_referred'); end if;
  select * into referrer from public.players where upper(referral_code)=normalized_code for update;
  if referrer.telegram_id is null then return jsonb_build_object('ok',false,'reason','invalid_code'); end if;
  if referrer.telegram_id=referee.telegram_id then return jsonb_build_object('ok',false,'reason','self_referral'); end if;
  referee_before:=referee.total_tokens; referrer_before:=referrer.total_tokens;
  update public.players set referred_by=normalized_code,total_tokens=round(total_tokens+100,2) where telegram_id=referee.telegram_id;
  update public.players set direct_referral_count=direct_referral_count+1,total_tokens=round(total_tokens+500,2),referral_tokens_earned=round(referral_tokens_earned+500,2) where telegram_id=referrer.telegram_id;
  insert into public.referrals(referrer_telegram_id,referee_telegram_id,level,tokens_earned) values(referrer.telegram_id,referee.telegram_id,1,500) on conflict(referrer_telegram_id,referee_telegram_id) do update set tokens_earned=greatest(public.referrals.tokens_earned,excluded.tokens_earned) returning * into referral_row;
  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by) values(p_referee_telegram_id,100,referee_before,referee_before+100,'Referral welcome bonus','referral',referral_row.id::text,'mintgrow-api'),(referrer.telegram_id,500,referrer_before,referrer_before+500,'Direct referral bonus','referral',referral_row.id::text,'mintgrow-api');
  return jsonb_build_object('ok',true,'welcome_bonus',100,'referrer_bonus',500,'referrer_telegram_id',referrer.telegram_id,'referral_id',referral_row.id);
end;
$$;

create or replace function public.record_ad_event(p_telegram_id text,p_client_event_id text,p_placement text,p_watched boolean,p_reward_tokens numeric default 0,p_error text default null)
returns public.ad_events language plpgsql security definer set search_path=public as $$
declare event_row public.ad_events; before_balance numeric;
begin
  if nullif(trim(p_client_event_id),'') is null then raise exception 'client event id required'; end if;
  if p_reward_tokens<0 or p_reward_tokens>100 then raise exception 'Invalid ad reward amount'; end if;
  insert into public.ad_events(telegram_id,client_event_id,placement,provider,watched,error,reward_tokens) values(p_telegram_id,p_client_event_id,left(coalesce(p_placement,'unknown'),80),'monetag',coalesce(p_watched,false),p_error,p_reward_tokens) on conflict(client_event_id) do nothing returning * into event_row;
  if event_row.id is null then select * into event_row from public.ad_events where client_event_id=p_client_event_id; return event_row; end if;
  if p_watched then
    select total_tokens into before_balance from public.players where telegram_id=p_telegram_id for update;
    if before_balance is null then raise exception 'Player % not found',p_telegram_id; end if;
    update public.players set ads_watched=ads_watched+1,total_tokens=round(total_tokens+p_reward_tokens,2) where telegram_id=p_telegram_id;
    if p_reward_tokens>0 then insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by) values(p_telegram_id,p_reward_tokens,before_balance,before_balance+p_reward_tokens,'Rewarded ad','ad_event',event_row.id::text,'mintgrow-api'); end if;
  end if;
  return event_row;
end;
$$;

create or replace function public.claim_daily_bonus(p_telegram_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare row_player public.players; today text:=to_char(now() at time zone 'UTC','YYYY-MM-DD'); yesterday text:=to_char((now()-interval '1 day') at time zone 'UTC','YYYY-MM-DD'); new_streak integer; reward numeric; before_balance numeric;
begin
  select * into row_player from public.players where telegram_id=p_telegram_id for update;
  if row_player.telegram_id is null then raise exception 'player not found'; end if;
  if row_player.last_login_date=today then return jsonb_build_object('ok',false,'reason','already_claimed','streak',row_player.login_streak,'tokens',0); end if;
  new_streak:=case when row_player.last_login_date=yesterday then least(row_player.login_streak+1,7) else 1 end;
  reward:=(array[50,100,150,200,250,350,500])[new_streak]; before_balance:=row_player.total_tokens;
  update public.players set total_tokens=round(total_tokens+reward,2),login_streak=new_streak,last_login_date=today where telegram_id=p_telegram_id returning * into row_player;
  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by) values(p_telegram_id,reward,before_balance,row_player.total_tokens,'Daily bonus','daily_bonus',today,'mintgrow-api');
  return jsonb_build_object('ok',true,'tokens',reward,'streak',new_streak);
end;
$$;

create or replace function public.spend_tokens_for_powerup(p_telegram_id text,p_type text,p_cost numeric)
returns public.players language plpgsql security definer set search_path=public as $$
declare row_player public.players; before_balance numeric;
begin
  if p_cost<=0 or p_cost>100000 or p_type not in('undo','destroy','clear_blockers','shuffle') then raise exception 'invalid power-up'; end if;
  select total_tokens into before_balance from public.players where telegram_id=p_telegram_id for update;
  if before_balance is null or before_balance<p_cost then raise exception 'insufficient balance or player missing'; end if;
  update public.players set total_tokens=round(total_tokens-p_cost,2),power_ups=jsonb_set(power_ups,array[p_type],to_jsonb(coalesce((power_ups->>p_type)::integer,0)+1),true) where telegram_id=p_telegram_id returning * into row_player;
  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by) values(p_telegram_id,-p_cost,before_balance,row_player.total_tokens,'Power-up purchase','powerup',p_type,'mintgrow-api');
  return row_player;
end;
$$;

create or replace function public.consume_powerup(p_telegram_id text,p_type text)
returns public.players language plpgsql security definer set search_path=public as $$
declare row_player public.players; owned integer;
begin
  if p_type not in('undo','destroy','clear_blockers','shuffle') then raise exception 'invalid power-up'; end if;
  select * into row_player from public.players where telegram_id=p_telegram_id for update;
  if row_player.telegram_id is null then raise exception 'player not found'; end if;
  owned:=coalesce((row_player.power_ups->>p_type)::integer,0); if owned<=0 then raise exception 'power-up unavailable'; end if;
  update public.players set power_ups=jsonb_set(power_ups,array[p_type],to_jsonb(owned-1),true) where telegram_id=p_telegram_id returning * into row_player;
  return row_player;
end;
$$;

create or replace function public.grant_powerup(p_telegram_id text,p_type text,p_client_event_id text)
returns public.players language plpgsql security definer set search_path=public as $$
declare row_player public.players; grant_row public.powerup_grants;
begin
  if p_type not in('undo','destroy','clear_blockers','shuffle') then raise exception 'invalid power-up'; end if;
  if nullif(trim(p_client_event_id),'') is null then raise exception 'client event id required'; end if;
  insert into public.powerup_grants(telegram_id,client_event_id,powerup_type) values(p_telegram_id,p_client_event_id,p_type) on conflict(client_event_id) do nothing returning * into grant_row;
  if grant_row.id is not null then update public.players set power_ups=jsonb_set(power_ups,array[p_type],to_jsonb(coalesce((power_ups->>p_type)::integer,0)+1),true) where telegram_id=p_telegram_id returning * into row_player; else select * into row_player from public.players where telegram_id=p_telegram_id; end if;
  if row_player.telegram_id is null then raise exception 'player not found'; end if;
  return row_player;
end;
$$;

create or replace function public.submit_withdrawal_request(p_id text,p_telegram_id text,p_username text,p_amount numeric,p_wallet_address text,p_network text)
returns public.withdrawals language plpgsql security definer set search_path=public as $$
declare created_withdrawal public.withdrawals; referee_code text; ancestor_code text; ancestor_id text; level_no integer:=1; direct_required integer; pct numeric; reward numeric; before_balance numeric;
begin
  if p_amount<=0 then raise exception 'Withdrawal amount must be positive'; end if;
  if p_amount<250000 then raise exception 'Minimum withdrawal is 250000 MG'; end if;
  select total_tokens,referred_by into before_balance,referee_code from public.players where telegram_id=p_telegram_id for update;
  if before_balance is null or before_balance<p_amount then raise exception 'Insufficient balance or missing player'; end if;
  update public.players set total_tokens=round(total_tokens-p_amount,2),pending_tokens=round(pending_tokens+p_amount,2) where telegram_id=p_telegram_id;
  insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by) values(p_telegram_id,-p_amount,before_balance,before_balance-p_amount,'Withdrawal request','withdrawal',p_id,'mintgrow-api');
  ancestor_code:=referee_code;
  while ancestor_code is not null and level_no<=25 loop
    select telegram_id,referred_by into ancestor_id,referee_code from public.players where upper(referral_code)=upper(ancestor_code) for update;
    exit when ancestor_id is null;
    direct_required:=case when level_no in(1,2) then 2 when level_no=3 then 3 when level_no=4 then 4 when level_no=5 then 5 else 6 end;
    pct:=case when level_no=1 then .20 when level_no=2 then .15 when level_no=3 then .10 when level_no in(4,5) then .05 else .03 end;
    if (select direct_referral_count from public.players where telegram_id=ancestor_id)>=direct_required then
      reward:=round(p_amount*pct,2); select total_tokens into before_balance from public.players where telegram_id=ancestor_id for update;
      update public.players set total_tokens=round(total_tokens+reward,2),referral_tokens_earned=round(referral_tokens_earned+reward,2) where telegram_id=ancestor_id;
      insert into public.referrals(referrer_telegram_id,referee_telegram_id,level,tokens_earned) values(ancestor_id,p_telegram_id,level_no,reward) on conflict(referrer_telegram_id,referee_telegram_id) do update set level=excluded.level,tokens_earned=round(public.referrals.tokens_earned+excluded.tokens_earned,2);
      insert into public.token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by) values(ancestor_id,reward,before_balance,before_balance+reward,'Withdrawal referral commission','withdrawal_referral',p_id,'mintgrow-api');
    end if;
    ancestor_code:=referee_code; level_no:=level_no+1;
  end loop;
  insert into public.withdrawals(id,telegram_id,username,amount,wallet_address,network,status) values(p_id,p_telegram_id,p_username,p_amount,p_wallet_address,p_network,'pending') returning * into created_withdrawal;
  return created_withdrawal;
end;
$$;

grant execute on function public.complete_player_registration(text,text) to service_role;
grant execute on function public.credit_player_tokens(text,numeric,integer,integer) to service_role;
grant execute on function public.apply_referral_code(text,text) to service_role;
grant execute on function public.record_ad_event(text,text,text,boolean,numeric,text) to service_role;
grant execute on function public.claim_daily_bonus(text) to service_role;
grant execute on function public.spend_tokens_for_powerup(text,text,numeric) to service_role;
grant execute on function public.consume_powerup(text,text) to service_role;
grant execute on function public.grant_powerup(text,text,text) to service_role;
grant execute on function public.submit_withdrawal_request(text,text,text,numeric,text,text) to service_role;
