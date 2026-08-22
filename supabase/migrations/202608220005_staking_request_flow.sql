-- Website/backend-only staking request workflow. No Solidity changes.
-- The backend records intent and verification; the admin multisig performs the actual on-chain stake later.
create table if not exists public.staking_requests (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  wallet_address text not null,
  amount numeric(30,6) not null,
  network text not null default 'BNB Chain (BEP-20)',
  status text not null default 'pending_admin_review',
  tx_hash text,
  block_number bigint,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  broadcast_at timestamptz,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staking_requests_amount_positive check (amount > 0),
  constraint staking_requests_status_check check(status in ('pending_admin_review','verified','broadcast','confirmed','rejected','cancelled'))
);
create index if not exists staking_requests_status_idx on public.staking_requests(status,created_at desc);
create index if not exists staking_requests_telegram_idx on public.staking_requests(telegram_id,created_at desc);
alter table public.staking_requests enable row level security;
revoke all on public.staking_requests from anon,authenticated;

create or replace function public.create_stake_request(p_telegram_id text,p_wallet_address text,p_amount numeric,p_network text default 'BNB Chain (BEP-20)')
returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests; p public.players; minimum numeric:=250000;
begin
  if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
  if p_amount < minimum then raise exception 'Minimum stake is 250,000 MGS'; end if;
  if upper(trim(coalesce(p_network,''))) not in ('BNB CHAIN (BEP-20)','BNB SMART CHAIN','BSC') then raise exception 'Unsupported staking network'; end if;
  select * into p from players where telegram_id=p_telegram_id;
  if p.telegram_id is null then raise exception 'Player not found'; end if;
  insert into staking_requests(telegram_id,wallet_address,amount,network) values(p_telegram_id,lower(p_wallet_address),p_amount,p_network) returning * into r;
  return r;
end;$$;

create or replace function public.get_my_stake_requests(p_telegram_id text)
returns setof public.staking_requests language sql security definer set search_path=public as $$
 select * from public.staking_requests where telegram_id=p_telegram_id order by created_at desc limit 50;
$$;
revoke all on function public.create_stake_request(text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.get_my_stake_requests(text) from public,anon,authenticated;
grant execute on function public.create_stake_request(text,text,numeric,text) to service_role;
grant execute on function public.get_my_stake_requests(text) to service_role;

-- Admin transition RPCs keep status changes atomic and auditable.
create or replace function public.admin_update_stake_request(p_id uuid,p_action text,p_tx_hash text default null,p_block_number bigint default null,p_note text default null,p_rejection_reason text default null)
returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests; next_status text;
begin
  if not exists(select 1 from admin_users au where au.user_id=auth.uid() and coalesce(au.is_active,true)) then raise exception 'Admin access denied'; end if;
  if p_action not in ('verify','broadcast','confirm','reject','cancel') then raise exception 'Invalid action'; end if;
  next_status:=case p_action when 'verify' then 'verified' when 'broadcast' then 'broadcast' when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'cancelled' end;
  select * into r from staking_requests where id=p_id for update;
  if r.id is null then raise exception 'Stake request not found'; end if;
  if p_action='verify' and r.status<>'pending_admin_review' then raise exception 'Request is not awaiting verification'; end if;
  if p_action='broadcast' and r.status<>'verified' then raise exception 'Request must be verified first'; end if;
  if p_action='confirm' and r.status<>'broadcast' then raise exception 'Request must be broadcast first'; end if;
  if p_action='reject' and r.status not in ('pending_admin_review','verified') then raise exception 'Request cannot be rejected now'; end if;
  if p_action='confirm' and nullif(trim(coalesce(p_tx_hash,'')),'') is null then raise exception 'Transaction hash required'; end if;
  update staking_requests set status=next_status,tx_hash=coalesce(nullif(trim(p_tx_hash),''),tx_hash),block_number=coalesce(p_block_number,block_number),admin_note=coalesce(p_note,admin_note),rejection_reason=case when p_action='reject' then nullif(trim(p_rejection_reason),'') else rejection_reason end,verified_at=case when p_action='verify' then now() else verified_at end,broadcast_at=case when p_action='broadcast' then now() else broadcast_at end,confirmed_at=case when p_action='confirm' then now() else confirmed_at end,rejected_at=case when p_action='reject' then now() else rejected_at end,updated_at=now() where id=p_id returning * into r;
  insert into admin_audit_log(action,admin_user_id,entity_type,entity_id,details) values('staking_request_'||p_action,auth.uid(),'staking_request',r.id::text,jsonb_build_object('status',r.status,'amount',r.amount,'wallet_address',r.wallet_address,'tx_hash',r.tx_hash,'note',p_note,'rejection_reason',p_rejection_reason));
  return r;
end;$$;
revoke all on function public.admin_update_stake_request(uuid,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_stake_request(uuid,text,text,bigint,text,text) to authenticated;
