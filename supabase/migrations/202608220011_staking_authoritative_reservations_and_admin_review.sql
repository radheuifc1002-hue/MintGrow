-- Authoritative off-chain reservation/reconciliation for V2 staking.
-- The database coordinates eligibility; the V2 staking contract remains the on-chain authority.
alter table public.players add column if not exists staking_reserved numeric(30,6) not null default 0;
alter table public.staking_requests add column if not exists onchain_request_id text;
alter table public.staking_requests add column if not exists eligibility_snapshot numeric(30,6) not null default 0;
alter table public.staking_requests add column if not exists staking_reserved numeric(30,6) not null default 0;
alter table public.staking_requests add column if not exists gameplay_snapshot jsonb not null default '{}'::jsonb;
alter table public.staking_requests add column if not exists referral_snapshot jsonb not null default '{}'::jsonb;
alter table public.staking_requests add column if not exists admin_wallet text;

create index if not exists staking_requests_onchain_idx on public.staking_requests(onchain_request_id) where onchain_request_id is not null;

create or replace function public.create_stake_request(p_telegram_id text,p_wallet_address text,p_amount numeric,p_network text default 'BNB Chain (BEP-20)')
returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests;p public.players;minimum numeric;available numeric;
begin
 select coalesce(value_numeric,250000) into minimum from governance_config where key='minimum_stake_mgs';
 if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
 if p_amount < minimum then raise exception 'Minimum stake is % MGS',minimum; end if;
 if upper(trim(coalesce(p_network,''))) not in ('BNB CHAIN (BEP-20)','BNB SMART CHAIN','BSC') then raise exception 'Unsupported staking network'; end if;
 select * into p from players where telegram_id=p_telegram_id for update;
 if p.telegram_id is null then raise exception 'Player not found'; end if;
 if exists(select 1 from staking_requests where telegram_id=p_telegram_id and status in ('pending_admin_review','verified','broadcast')) then raise exception 'A staking request is already pending'; end if;
 available:=p.total_tokens-coalesce(p.staking_reserved,0);
 if available < p_amount then raise exception 'Insufficient eligible earning balance'; end if;
 update players set staking_reserved=staking_reserved+p_amount where telegram_id=p_telegram_id;
 insert into staking_requests(telegram_id,wallet_address,amount,network,eligibility_snapshot,staking_reserved,gameplay_snapshot,referral_snapshot)
 values(p_telegram_id,lower(p_wallet_address),p_amount,p_network,available,p_amount,jsonb_build_object('games_played',p.games_played,'best_score',p.best_score,'level',p.level,'ads_watched',p.ads_watched,'total_tokens',p.total_tokens),jsonb_build_object('direct_referral_count',p.direct_referral_count,'referral_tokens_earned',p.referral_tokens_earned)) returning * into r;
 return r;
end;$$;
revoke all on function public.create_stake_request(text,text,numeric,text) from public,anon,authenticated;grant execute on function public.create_stake_request(text,text,numeric,text) to service_role;

create or replace function public.get_admin_stake_queue(p_status text default null)
returns setof jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'admin access required'; end if;
 return query select jsonb_build_object('id',r.id,'telegram_id',r.telegram_id,'username',p.username,'wallet_address',r.wallet_address,'amount',r.amount,'network',r.network,'status',r.status,'tx_hash',r.tx_hash,'block_number',r.block_number,'onchain_request_id',r.onchain_request_id,'eligibility_snapshot',r.eligibility_snapshot,'staking_reserved',r.staking_reserved,'gameplay_snapshot',r.gameplay_snapshot,'referral_snapshot',r.referral_snapshot,'admin_wallet',r.admin_wallet,'created_at',r.created_at,'updated_at',r.updated_at,'verified_at',r.verified_at,'broadcast_at',r.broadcast_at,'confirmed_at',r.confirmed_at,'rejected_at',r.rejected_at,'rejection_reason',r.rejection_reason)
 from staking_requests r join players p on p.telegram_id=r.telegram_id where p_status is null or r.status=p_status order by r.created_at desc limit 250;
end;$$;
revoke all on function public.get_admin_stake_queue(text) from public,anon;grant execute on function public.get_admin_stake_queue(text) to authenticated;

create or replace function public.get_admin_stake_user(p_telegram_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'admin access required'; end if;
 select jsonb_build_object('player',to_jsonb(p),'referrals',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from referrals r where r.referrer_telegram_id=p_telegram_id),'[]'::jsonb),'game_sessions',coalesce((select jsonb_agg(to_jsonb(g) order by g.started_at desc) from game_sessions g where g.telegram_id=p_telegram_id limit 100),'[]'::jsonb),'ad_events',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from ad_events a where a.telegram_id=p_telegram_id limit 100),'[]'::jsonb),'stake_requests',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from staking_requests s where s.telegram_id=p_telegram_id),'[]'::jsonb)) into result from players p where p.telegram_id=p_telegram_id;
 return coalesce(result,'{}'::jsonb);
end;$$;
revoke all on function public.get_admin_stake_user(text) from public,anon;grant execute on function public.get_admin_stake_user(text) to authenticated;

-- Replace the admin transition RPC with the exact arguments used by the Admin Panel.
drop function if exists public.admin_update_stake_request(uuid,text,text,bigint,text,text);
create or replace function public.admin_update_stake_request(p_id uuid,p_action text,p_tx_hash text default null,p_block_number bigint default null,p_note text default null,p_rejection_reason text default null,p_admin_wallet text default null,p_onchain_request_id text default null)
returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests;next_status text;v_admin uuid:=auth.uid();
begin
 if not public.is_admin() then raise exception 'admin access required'; end if;
 if p_action not in ('verify','broadcast','confirm','reject','cancel') then raise exception 'Invalid action'; end if;
 select * into r from staking_requests where id=p_id for update;
 if r.id is null then raise exception 'Stake request not found'; end if;
 if p_action='verify' and r.status<>'pending_admin_review' then raise exception 'Request is not awaiting verification'; end if;
 if p_action='broadcast' and r.status<>'verified' then raise exception 'Request must be verified first'; end if;
 if p_action='confirm' and r.status<>'broadcast' then raise exception 'Request must be broadcast first'; end if;
 if p_action='reject' and r.status not in ('pending_admin_review','verified') then raise exception 'Request cannot be rejected now'; end if;
 if p_action='confirm' and nullif(trim(coalesce(p_tx_hash,'')),'') is null then raise exception 'Transaction hash required'; end if;
 next_status:=case p_action when 'verify' then 'verified' when 'broadcast' then 'broadcast' when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'cancelled' end;
 if p_action='confirm' then
   update players set total_tokens=total_tokens-r.amount,staking_reserved=greatest(staking_reserved-r.amount,0) where telegram_id=r.telegram_id and total_tokens>=r.amount and staking_reserved>=r.amount;
   if not found then raise exception 'Unable to consume reserved earning balance'; end if;
 elsif p_action in ('reject','cancel') then
   update players set staking_reserved=greatest(staking_reserved-r.amount,0) where telegram_id=r.telegram_id;
 end if;
 update staking_requests set status=next_status,tx_hash=coalesce(nullif(trim(p_tx_hash),''),tx_hash),block_number=coalesce(p_block_number,block_number),onchain_request_id=coalesce(nullif(trim(p_onchain_request_id),''),onchain_request_id),admin_note=coalesce(p_note,admin_note),admin_wallet=coalesce(nullif(lower(trim(p_admin_wallet)),''),admin_wallet),rejection_reason=case when p_action='reject' then nullif(trim(p_rejection_reason),'') else rejection_reason end,verified_at=case when p_action='verify' then now() else verified_at end,broadcast_at=case when p_action='broadcast' then now() else broadcast_at end,confirmed_at=case when p_action='confirm' then now() else confirmed_at end,rejected_at=case when p_action='reject' then now() else rejected_at end,updated_at=now() where id=p_id returning * into r;
 insert into admin_audit_log(admin_user_id,action,target_type,target_id,before_data,after_data,reason) values(v_admin,'STAKE_REQUEST_'||upper(p_action),'staking_request',r.id::text,null,jsonb_build_object('status',r.status,'amount',r.amount,'wallet_address',r.wallet_address,'tx_hash',r.tx_hash,'onchain_request_id',r.onchain_request_id,'admin_wallet',r.admin_wallet,'note',p_note),coalesce(p_rejection_reason,p_note));
 return r;
end;$$;
revoke all on function public.admin_update_stake_request(uuid,text,text,bigint,text,text,text,text) from public,anon;grant execute on function public.admin_update_stake_request(uuid,text,text,bigint,text,text,text,text) to authenticated;

-- No direct client writes. All game/economic mutations go through authenticated server APIs.
revoke all on public.players,public.game_sessions,public.ad_events,public.referrals,public.withdrawals,public.staking_requests from anon,authenticated;
