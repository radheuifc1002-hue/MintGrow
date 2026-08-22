-- The sponsored user stake transaction creates a pending on-chain stake but must NOT
-- bypass admin review. This RPC records the real chain request ID while retaining
-- pending_admin_review status.
create or replace function public.record_stake_broadcast(p_id uuid,p_tx_hash text,p_onchain_request_id text,p_admin_wallet text default null)
returns public.staking_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_requests;
begin
 select * into r from staking_requests where id=p_id for update;
 if r.id is null then raise exception 'Stake request not found'; end if;
 if r.status<>'pending_admin_review' then raise exception 'Stake request is no longer awaiting admin review'; end if;
 update staking_requests set tx_hash=nullif(trim(p_tx_hash),''),onchain_request_id=nullif(trim(p_onchain_request_id),''),admin_wallet=coalesce(nullif(lower(trim(p_admin_wallet)),''),admin_wallet),updated_at=now() where id=p_id returning * into r;
 return r;
end;$$;
revoke all on function public.record_stake_broadcast(uuid,text,text,text) from public,anon,authenticated;grant execute on function public.record_stake_broadcast(uuid,text,text,text) to service_role;
