-- Link every stake request to the exact delegation authorization that enabled it.
alter table public.staking_requests add column if not exists delegation_request_id uuid references public.staking_delegation_requests(id);
create index if not exists staking_requests_delegation_idx on public.staking_requests(delegation_request_id);

create or replace function public.create_stake_request(p_telegram_id text,p_wallet_address text,p_amount numeric,p_network text default 'BNB Chain (BEP-20)')
returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests;p public.players;minimum numeric:=250000;delegation_id uuid;
begin
  select coalesce(value_numeric,250000) into minimum from governance_config where key='minimum_stake_mgs';
  if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
  if p_amount<minimum then raise exception 'Minimum stake is 250,000 MGS'; end if;
  if upper(trim(coalesce(p_network,''))) not in ('BNB CHAIN (BEP-20)','BNB SMART CHAIN','BSC') then raise exception 'Unsupported staking network'; end if;
  select * into p from players where telegram_id=p_telegram_id;if p.telegram_id is null then raise exception 'Player not found';end if;
  select id into delegation_id from staking_delegation_requests where telegram_id=p_telegram_id and lower(owner_wallet)=lower(p_wallet_address) and status='authorized' and amount_limit>=p_amount and (expires_at is null or expires_at>now()) order by authorized_at desc nulls last,created_at desc limit 1;
  if delegation_id is null then raise exception 'Delegation authorization is required before staking'; end if;
  insert into staking_requests(telegram_id,wallet_address,amount,network,delegation_request_id) values(p_telegram_id,lower(p_wallet_address),p_amount,p_network,delegation_id) returning * into r;
  return r;
end;$$;
revoke all on function public.create_stake_request(text,text,numeric,text) from public,anon,authenticated;grant execute on function public.create_stake_request(text,text,numeric,text) to service_role;

-- Claim requests are staking-contract rewards, never the game's off-chain balance.
create or replace function public.create_staking_claim_request(p_telegram_id text,p_wallet_address text,p_amount numeric)
returns public.staking_claim_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_claim_requests; minimum_claim numeric; stake_ok boolean;
begin
  select coalesce(value_numeric,25000) into minimum_claim from governance_config where key='minimum_mg_claim';
  if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
  if p_amount < minimum_claim then raise exception 'Minimum MG claim is 25,000'; end if;
  select exists(select 1 from staking_requests where telegram_id=p_telegram_id and status='confirmed') into stake_ok;
  if not stake_ok then raise exception 'A confirmed stake is required before claiming MG rewards'; end if;
  if not exists(select 1 from players where telegram_id=p_telegram_id) then raise exception 'Player not found'; end if;
  insert into staking_claim_requests(telegram_id,wallet_address,amount) values(p_telegram_id,lower(p_wallet_address),p_amount) returning * into r;
  return r;
end;$$;
revoke all on function public.create_staking_claim_request(text,text,numeric) from public,anon,authenticated;grant execute on function public.create_staking_claim_request(text,text,numeric) to service_role;
