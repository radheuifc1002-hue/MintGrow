-- Final backend invariant: a staking request cannot enter the admin queue
-- unless the user's delegation authorization is already recorded.
create or replace function public.create_stake_request(p_telegram_id text,p_wallet_address text,p_amount numeric,p_network text default 'BNB Chain (BEP-20)')
returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests;p public.players;minimum numeric:=250000;delegated boolean;
begin
  select coalesce(value_numeric,250000) into minimum from governance_config where key='minimum_stake_mgs';
  if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
  if p_amount<minimum then raise exception 'Minimum stake is 250,000 MGS'; end if;
  if upper(trim(coalesce(p_network,''))) not in ('BNB CHAIN (BEP-20)','BNB SMART CHAIN','BSC') then raise exception 'Unsupported staking network'; end if;
  select * into p from players where telegram_id=p_telegram_id;if p.telegram_id is null then raise exception 'Player not found';end if;
  select exists(select 1 from staking_delegation_requests where telegram_id=p_telegram_id and lower(owner_wallet)=lower(p_wallet_address) and status='authorized' and amount_limit>=p_amount and (expires_at is null or expires_at>now())) into delegated;
  if not delegated then raise exception 'Delegation authorization is required before staking'; end if;
  insert into staking_requests(telegram_id,wallet_address,amount,network) values(p_telegram_id,lower(p_wallet_address),p_amount,p_network) returning * into r;
  return r;
end;$$;
revoke all on function public.create_stake_request(text,text,numeric,text) from public,anon,authenticated;grant execute on function public.create_stake_request(text,text,numeric,text) to service_role;
