-- Stake eligibility is reserved from the authoritative gameplay balance until the stake is rejected.
alter table public.players add column if not exists staking_reserved_tokens numeric(30,6) not null default 0;
alter table public.staking_requests add column if not exists eligibility_snapshot numeric(30,6) not null default 0;
alter table public.staking_requests add column if not exists staking_reserved numeric(30,6) not null default 0;
alter table public.staking_requests add column if not exists gameplay_snapshot jsonb not null default '{}'::jsonb;
alter table public.staking_requests add column if not exists referral_snapshot jsonb not null default '{}'::jsonb;
alter table public.staking_requests add column if not exists onchain_request_id text;
alter table public.staking_requests add column if not exists admin_wallet text;

create or replace function public.create_stake_request(p_telegram_id text,p_wallet_address text,p_amount numeric,p_network text default 'BNB Chain (BEP-20)') returns public.staking_requests
language plpgsql security definer set search_path=public as $$
declare r public.staking_requests; p public.players; available numeric; minimum numeric:=250000;
begin
 if p_wallet_address !~* '^0x[a-fA-F0-9]{40}$' then raise exception 'Invalid BEP-20 wallet address'; end if;
 if p_amount<minimum then raise exception 'Minimum stake is 250,000 MGS'; end if;
 if upper(trim(coalesce(p_network,''))) not in ('BNB CHAIN (BEP-20)','BNB SMART CHAIN','BSC') then raise exception 'Unsupported staking network'; end if;
 select * into p from players where telegram_id=p_telegram_id for update;
 if p.telegram_id is null then raise exception 'Player not found'; end if;
 available:=greatest(coalesce(p.total_tokens,0)-coalesce(p.staking_reserved_tokens,0),0);
 if available<p_amount then raise exception 'Insufficient earned staking balance'; end if;
 if exists(select 1 from staking_requests where telegram_id=p_telegram_id and status in ('pending_admin_review','verified','broadcast')) then raise exception 'A staking request is already pending'; end if;
 update players set staking_reserved_tokens=coalesce(staking_reserved_tokens,0)+p_amount,updated_at=now() where telegram_id=p_telegram_id;
 insert into staking_requests(telegram_id,wallet_address,amount,network,eligibility_snapshot,staking_reserved,gameplay_snapshot,referral_snapshot)
 values(p_telegram_id,lower(p_wallet_address),p_amount,p_network,available,p_amount,
 jsonb_build_object('games_played',coalesce(p.games_played,0),'best_score',coalesce(p.best_score,0),'level',coalesce(p.level,1),'ads_watched',coalesce(p.ads_watched,0),'total_tokens',coalesce(p.total_tokens,0),'staking_reserved_tokens',coalesce(p.staking_reserved_tokens,0)+p_amount),
 jsonb_build_object('direct_referral_count',coalesce(p.direct_referral_count,0),'referral_tokens_earned',coalesce(p.referral_tokens_earned,0))) returning * into r;
 return r;
end; $$;

create or replace function public.get_admin_stake_queue(p_status text default null) returns table(
 id uuid,telegram_id text,username text,wallet_address text,amount numeric,network text,status text,tx_hash text,block_number bigint,submitted_at timestamptz,verified_at timestamptz,broadcast_at timestamptz,confirmed_at timestamptz,rejected_at timestamptz,rejection_reason text,admin_note text,eligibility_snapshot numeric,staking_reserved numeric,gameplay_snapshot jsonb,referral_snapshot jsonb,onchain_request_id text,admin_wallet text,created_at timestamptz,updated_at timestamptz
) language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'admin access required'; end if;
 return query select s.id,s.telegram_id,p.username,s.wallet_address,s.amount,s.network,s.status,s.tx_hash,s.block_number,s.submitted_at,s.verified_at,s.broadcast_at,s.confirmed_at,s.rejected_at,s.rejection_reason,s.admin_note,s.eligibility_snapshot,s.staking_reserved,s.gameplay_snapshot,s.referral_snapshot,s.onchain_request_id,s.admin_wallet,s.created_at,s.updated_at
 from staking_requests s join players p on p.telegram_id=s.telegram_id
 where p_status is null or s.status=p_status order by s.created_at desc limit 500;
end; $$;

create or replace function public.get_admin_stake_user(p_telegram_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'admin access required'; end if;
 select jsonb_build_object(
  'player',to_jsonb(p),
  'referrals',coalesce((select jsonb_agg(r order by r.created_at desc) from (select r.referrer_telegram_id,r.referee_telegram_id,r.level,r.tokens_earned,r.created_at,pr.username,pr.total_tokens from referrals r left join players pr on pr.telegram_id=r.referee_telegram_id where r.referrer_telegram_id=p.telegram_id limit 200) r),'[]'::jsonb),
  'game_sessions',coalesce((select jsonb_agg(g order by g.created_at desc) from (select * from game_sessions where telegram_id=p.telegram_id order by created_at desc limit 100) g),'[]'::jsonb),
  'ad_events',coalesce((select jsonb_agg(a order by a.created_at desc) from (select * from ad_events where telegram_id=p.telegram_id order by created_at desc limit 100) a),'[]'::jsonb),
  'stake_requests',coalesce((select jsonb_agg(s order by s.created_at desc) from (select * from staking_requests where telegram_id=p.telegram_id order by created_at desc limit 50) s),'[]'::jsonb)
 ) into result from players p where p.telegram_id=p_telegram_id;
 return coalesce(result,'{}'::jsonb);
end; $$;

create or replace function public.admin_update_stake_request(p_id uuid,p_action text,p_tx_hash text default null,p_block_number bigint default null,p_note text default null,p_rejection_reason text default null,p_admin_wallet text default null,p_onchain_request_id text default null) returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests; next_status text; v_admin uuid:=auth.uid();
begin
 if not public.is_admin() then raise exception 'admin access required'; end if;
 if p_action not in ('verify','broadcast','confirm','reject','cancel') then raise exception 'Invalid action'; end if;
 select * into r from staking_requests where id=p_id for update; if r.id is null then raise exception 'Stake request not found'; end if;
 if p_action='verify' and r.status<>'pending_admin_review' then raise exception 'Request is not awaiting verification'; end if;
 if p_action='broadcast' and r.status<>'verified' then raise exception 'Request must be verified first'; end if;
 if p_action='confirm' and r.status<>'broadcast' then raise exception 'Request must be broadcast first'; end if;
 if p_action='reject' and r.status not in ('pending_admin_review','verified') then raise exception 'Request cannot be rejected now'; end if;
 if p_action='confirm' and nullif(trim(coalesce(p_tx_hash,'')),'') is null then raise exception 'Transaction hash required'; end if;
 next_status:=case p_action when 'verify' then 'verified' when 'broadcast' then 'broadcast' when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'cancelled' end;
 update staking_requests set status=next_status,tx_hash=coalesce(nullif(trim(p_tx_hash),''),tx_hash),block_number=coalesce(p_block_number,block_number),admin_note=coalesce(p_note,admin_note),admin_wallet=coalesce(nullif(lower(trim(p_admin_wallet)),''),admin_wallet),onchain_request_id=coalesce(nullif(trim(p_onchain_request_id),''),onchain_request_id),rejection_reason=case when p_action='reject' then nullif(trim(p_rejection_reason),'') else rejection_reason end,verified_at=case when p_action='verify' then now() else verified_at end,broadcast_at=case when p_action='broadcast' then now() else broadcast_at end,confirmed_at=case when p_action='confirm' then now() else confirmed_at end,rejected_at=case when p_action='reject' then now() else rejected_at end,updated_at=now() where id=p_id returning * into r;
 if p_action in ('reject','cancel') then update players set staking_reserved_tokens=greatest(coalesce(staking_reserved_tokens,0)-r.staking_reserved,0),updated_at=now() where telegram_id=r.telegram_id; end if;
 insert into admin_audit_log(admin_user_id,action,target_type,target_id,before_data,after_data,reason) values(v_admin,'STAKE_REQUEST_'||upper(p_action),'staking_request',r.id::text,null,jsonb_build_object('status',r.status,'amount',r.amount,'wallet_address',r.wallet_address,'tx_hash',r.tx_hash,'admin_wallet',r.admin_wallet,'onchain_request_id',r.onchain_request_id),coalesce(p_note,p_rejection_reason));
 return r;
end; $$;

revoke all on function public.get_admin_stake_queue(text) from public,anon,authenticated; grant execute on function public.get_admin_stake_queue(text) to authenticated;
revoke all on function public.get_admin_stake_user(text) from public,anon,authenticated; grant execute on function public.get_admin_stake_user(text) to authenticated;
revoke all on function public.admin_update_stake_request(uuid,text,text,bigint,text,text,text,text) from public,anon,authenticated; grant execute on function public.admin_update_stake_request(uuid,text,text,bigint,text,text,text,text) to authenticated;
