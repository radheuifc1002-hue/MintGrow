-- Website/backend flow only. Solidity remains untouched.
-- Staking is the only principal action. The legacy withdrawals table is no longer
-- an application withdrawal path; reward claims use staking_claim_requests.

insert into public.governance_config(key,value_text) values('staking_delegate_address','') on conflict(key) do nothing;
insert into public.governance_config(key,value_numeric) values('minimum_stake_mgs',250000),('minimum_mg_claim',25000) on conflict(key) do nothing;

create table if not exists public.staking_delegation_requests(
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  owner_wallet text not null,
  delegate_address text not null,
  amount_limit numeric(30,6) not null default 0,
  status text not null default 'pending_user_authorization',
  authorization_tx_hash text,
  authorized_at timestamptz,
  expires_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delegation_owner_wallet_check check(owner_wallet ~* '^0x[a-fA-F0-9]{40}$'),
  constraint delegation_delegate_check check(delegate_address ~* '^0x[a-fA-F0-9]{40}$'),
  constraint delegation_amount_check check(amount_limit >= 0),
  constraint delegation_status_check check(status in ('pending_user_authorization','authorized','expired','revoked','rejected'))
);
create index if not exists staking_delegation_requests_user_idx on public.staking_delegation_requests(telegram_id,created_at desc);
create index if not exists staking_delegation_requests_status_idx on public.staking_delegation_requests(status,created_at desc);
alter table public.staking_delegation_requests enable row level security;
revoke all on public.staking_delegation_requests from anon,authenticated;

create table if not exists public.staking_claim_requests(
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  wallet_address text not null,
  amount numeric(30,6) not null,
  status text not null default 'pending_onchain_claim',
  tx_hash text,
  block_number bigint,
  requested_at timestamptz not null default now(),
  broadcast_at timestamptz,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staking_claim_amount_positive check(amount > 0),
  constraint staking_claim_wallet_check check(wallet_address ~* '^0x[a-fA-F0-9]{40}$'),
  constraint staking_claim_status_check check(status in ('pending_onchain_claim','broadcast','confirmed','rejected','cancelled'))
);
create index if not exists staking_claim_requests_user_idx on public.staking_claim_requests(telegram_id,created_at desc);
alter table public.staking_claim_requests enable row level security;
revoke all on public.staking_claim_requests from anon,authenticated;

create or replace function public.get_staking_config()
returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object(
  'minimum_stake_mgs',coalesce((select value_numeric from governance_config where key='minimum_stake_mgs'),250000),
  'minimum_mg_claim',coalesce((select value_numeric from governance_config where key='minimum_mg_claim'),25000),
  'staking_delegate_address',coalesce((select value_text from governance_config where key='staking_delegate_address'),'')
);
$$;

create or replace function public.create_delegation_request(p_telegram_id text,p_owner_wallet text,p_amount_limit numeric,p_expires_at timestamptz default null)
returns public.staking_delegation_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_delegation_requests; delegate text;
begin
  if p_owner_wallet !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid owner wallet'; end if;
  if p_amount_limit <= 0 then raise exception 'Delegation amount must be positive'; end if;
  select value_text into delegate from governance_config where key='staking_delegate_address';
  if delegate is null or delegate='' or delegate !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Staking delegate address is not configured'; end if;
  if not exists(select 1 from players where telegram_id=p_telegram_id) then raise exception 'Player not found'; end if;
  insert into staking_delegation_requests(telegram_id,owner_wallet,delegate_address,amount_limit,expires_at)
  values(p_telegram_id,lower(p_owner_wallet),lower(delegate),p_amount_limit,p_expires_at) returning * into r;
  return r;
end;
$$;

create or replace function public.record_delegation_authorized(p_telegram_id text,p_request_id uuid,p_authorization_tx_hash text,p_expires_at timestamptz default null)
returns public.staking_delegation_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_delegation_requests;
begin
  if nullif(trim(p_authorization_tx_hash),'') is null then raise exception 'Authorization transaction/signature reference required'; end if;
  select * into r from staking_delegation_requests where id=p_request_id and telegram_id=p_telegram_id for update;
  if r.id is null then raise exception 'Delegation request not found'; end if;
  if r.status <> 'pending_user_authorization' then raise exception 'Delegation request is not pending'; end if;
  update staking_delegation_requests set status='authorized',authorization_tx_hash=trim(p_authorization_tx_hash),authorized_at=now(),expires_at=coalesce(p_expires_at,expires_at),updated_at=now() where id=r.id returning * into r;
  return r;
end;
$$;

create or replace function public.get_my_delegation_requests(p_telegram_id text)
returns setof public.staking_delegation_requests language sql security definer set search_path=public as $$
select * from staking_delegation_requests where telegram_id=p_telegram_id order by created_at desc limit 20;
$$;

create or replace function public.create_staking_claim_request(p_telegram_id text,p_wallet_address text,p_amount numeric)
returns public.staking_claim_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_claim_requests; minimum_claim numeric; stake_ok boolean; total numeric;
begin
  select coalesce(value_numeric,25000) into minimum_claim from governance_config where key='minimum_mg_claim';
  if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
  if p_amount < minimum_claim then raise exception 'Minimum MG claim is 25,000'; end if;
  select exists(select 1 from staking_requests where telegram_id=p_telegram_id and status='confirmed') into stake_ok;
  if not stake_ok then raise exception 'A confirmed stake is required before claiming MG rewards'; end if;
  select total_tokens into total from players where telegram_id=p_telegram_id for update;
  if total is null then raise exception 'Player not found'; end if;
  if p_amount > total then raise exception 'Claim amount exceeds available backend reward balance'; end if;
  insert into staking_claim_requests(telegram_id,wallet_address,amount) values(p_telegram_id,lower(p_wallet_address),p_amount) returning * into r;
  return r;
end;
$$;

create or replace function public.get_my_staking_claims(p_telegram_id text)
returns setof public.staking_claim_requests language sql security definer set search_path=public as $$
select * from staking_claim_requests where telegram_id=p_telegram_id order by created_at desc limit 50;
$$;

-- Disable the legacy traditional withdrawal RPC. It must not be callable through the application anymore.
revoke all on function public.submit_withdrawal_request(text,text,text,numeric,text,text) from public,anon,authenticated,service_role;

revoke all on function public.get_staking_config() from public,anon,authenticated;
revoke all on function public.create_delegation_request(text,text,numeric,timestamptz) from public,anon,authenticated;
revoke all on function public.record_delegation_authorized(text,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.get_my_delegation_requests(text) from public,anon,authenticated;
revoke all on function public.create_staking_claim_request(text,text,numeric) from public,anon,authenticated;
revoke all on function public.get_my_staking_claims(text) from public,anon,authenticated;
grant execute on function public.get_staking_config() to service_role;
grant execute on function public.create_delegation_request(text,text,numeric,timestamptz) to service_role;
grant execute on function public.record_delegation_authorized(text,uuid,text,timestamptz) to service_role;
grant execute on function public.get_my_delegation_requests(text) to service_role;
grant execute on function public.create_staking_claim_request(text,text,numeric) to service_role;
grant execute on function public.get_my_staking_claims(text) to service_role;
