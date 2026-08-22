-- Backend gate: a withdrawal/claim request is only possible after a successfully
-- confirmed stake request. Solidity is intentionally untouched in this phase.
-- The minimum claim starts at 25,000 MG and is stored in governance_config so it
-- can be changed later without changing the website.
create table if not exists public.governance_config(key text primary key,value_numeric numeric,value_text text,updated_at timestamptz not null default now());
insert into public.governance_config(key,value_numeric) values('minimum_stake_mgs',250000),('minimum_mg_claim',25000) on conflict(key) do nothing;
revoke all on public.governance_config from anon,authenticated;

create or replace function public.submit_withdrawal_request(p_id text,p_telegram_id text,p_username text,p_amount numeric,p_wallet_address text,p_network text)
returns public.withdrawals language plpgsql security definer set search_path=public as $$
declare created_withdrawal public.withdrawals; updated_telegram_id text; referee_code text; ancestor_code text; ancestor_id text; level_no integer:=1; direct_required integer; pct numeric; reward numeric; minimum_claim numeric:=25000; stake_ok boolean;
begin
  select coalesce(value_numeric,25000) into minimum_claim from governance_config where key='minimum_mg_claim';
  select exists(select 1 from staking_requests where telegram_id=p_telegram_id and status='confirmed') into stake_ok;
  if not stake_ok then raise exception 'Stake must be successfully confirmed before withdrawal'; end if;
  if p_amount<=0 then raise exception 'Withdrawal amount must be positive'; end if;
  if p_amount<minimum_claim then raise exception 'Minimum withdrawal is 25,000 MG'; end if;
  if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
  update public.players set total_tokens=round(total_tokens-p_amount,2),pending_tokens=round(pending_tokens+p_amount,2)
  where telegram_id=p_telegram_id and total_tokens>=p_amount returning telegram_id,referred_by into updated_telegram_id,referee_code;
  if updated_telegram_id is null then raise exception 'Insufficient balance or missing player'; end if;
  ancestor_code:=referee_code;
  while ancestor_code is not null and level_no<=25 loop
    select telegram_id,referred_by into ancestor_id,referee_code from public.players where upper(referral_code)=upper(ancestor_code) for update; exit when ancestor_id is null;
    direct_required:=case when level_no in(1,2) then 2 when level_no=3 then 3 when level_no=4 then 4 when level_no=5 then 5 else 6 end;
    pct:=case when level_no=1 then .20 when level_no=2 then .15 when level_no=3 then .10 when level_no in(4,5) then .05 else .03 end;
    if (select direct_referral_count from public.players where telegram_id=ancestor_id)>=direct_required then reward:=round(p_amount*pct,2);update public.players set total_tokens=round(total_tokens+reward,2),referral_tokens_earned=round(referral_tokens_earned+reward,2) where telegram_id=ancestor_id;insert into public.referrals(referrer_telegram_id,referee_telegram_id,level,tokens_earned) values(ancestor_id,p_telegram_id,level_no,reward) on conflict(referrer_telegram_id,referee_telegram_id) do update set level=excluded.level,tokens_earned=round(public.referrals.tokens_earned+excluded.tokens_earned,2);end if;
    ancestor_code:=referee_code;level_no:=level_no+1;
  end loop;
  insert into public.withdrawals(id,telegram_id,username,amount,wallet_address,network,status) values(p_id,p_telegram_id,p_username,p_amount,lower(p_wallet_address),p_network,'pending') returning * into created_withdrawal;return created_withdrawal;
end;$$;
revoke all on function public.submit_withdrawal_request(text,text,text,numeric,text,text) from public,anon,authenticated;grant execute on function public.submit_withdrawal_request(text,text,text,numeric,text,text) to service_role;
