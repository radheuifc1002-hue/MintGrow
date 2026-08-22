-- Admin-only operational RPCs for delegation, stake and staking-contract reward claims.
create or replace function public.admin_get_staking_queue()
returns jsonb language plpgsql security definer set search_path=public as $$
declare stakes jsonb; delegations jsonb; claims jsonb;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into stakes from public.staking_requests x where x.status in ('pending_admin_review','verified','broadcast');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into delegations from public.staking_delegation_requests x where x.status='authorized';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into claims from public.staking_claim_requests x where x.status in ('pending_onchain_claim','broadcast');
  return jsonb_build_object('stakes',stakes,'delegations',delegations,'claims',claims);
end;$$;

create or replace function public.admin_update_staking_claim(p_id uuid,p_action text,p_tx_hash text default null,p_block_number bigint default null,p_rejection_reason text default null)
returns public.staking_claim_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_claim_requests; next_status text; admin_id uuid:=auth.uid();
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  next_status:=case p_action when 'broadcast' then 'broadcast' when 'confirm' then 'confirmed' when 'reject' then 'rejected' when 'cancel' then 'cancelled' else null end;
  if next_status is null then raise exception 'Invalid claim action'; end if;
  select * into r from staking_claim_requests where id=p_id for update;
  if r.id is null then raise exception 'Claim not found'; end if;
  if p_action='broadcast' and r.status<>'pending_onchain_claim' then raise exception 'Claim is not awaiting broadcast'; end if;
  if p_action='confirm' and r.status<>'broadcast' then raise exception 'Claim must be broadcast first'; end if;
  if p_action='confirm' and nullif(trim(coalesce(p_tx_hash,'')),'') is null then raise exception 'Transaction hash required'; end if;
  update staking_claim_requests set status=next_status,tx_hash=coalesce(nullif(trim(p_tx_hash),''),tx_hash),block_number=coalesce(p_block_number,block_number),broadcast_at=case when p_action='broadcast' then now() else broadcast_at end,confirmed_at=case when p_action='confirm' then now() else confirmed_at end,rejected_at=case when p_action='reject' then now() else rejected_at end,rejection_reason=case when p_action='reject' then nullif(trim(p_rejection_reason),'') else rejection_reason end,updated_at=now() where id=r.id returning * into r;
  insert into admin_audit_log(admin_user_id,action,target_type,target_id,before_data,after_data,reason) values(admin_id,'STAKING_CLAIM_'||upper(p_action),'staking_claim',r.id::text,null,jsonb_build_object('status',r.status,'amount',r.amount,'wallet_address',r.wallet_address,'tx_hash',r.tx_hash),p_rejection_reason);
  return r;
end;$$;

create or replace function public.admin_update_delegation(p_id uuid,p_action text,p_note text default null)
returns public.staking_delegation_requests language plpgsql security definer set search_path=public as $$
declare r public.staking_delegation_requests; next_status text; admin_id uuid:=auth.uid();
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  next_status:=case p_action when 'revoke' then 'revoked' when 'reject' then 'rejected' else null end;
  if next_status is null then raise exception 'Invalid delegation action'; end if;
  select * into r from staking_delegation_requests where id=p_id for update;
  if r.id is null then raise exception 'Delegation request not found'; end if;
  update staking_delegation_requests set status=next_status,admin_note=coalesce(p_note,admin_note),updated_at=now() where id=r.id returning * into r;
  insert into admin_audit_log(admin_user_id,action,target_type,target_id,before_data,after_data,reason) values(admin_id,'DELEGATION_'||upper(p_action),'staking_delegation',r.id::text,null,jsonb_build_object('status',r.status,'owner_wallet',r.owner_wallet,'delegate_address',r.delegate_address,'amount_limit',r.amount_limit),p_note);
  return r;
end;$$;
revoke all on function public.admin_get_staking_queue() from public,anon,authenticated;revoke all on function public.admin_update_staking_claim(uuid,text,text,bigint,text) from public,anon,authenticated;revoke all on function public.admin_update_delegation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_get_staking_queue() to authenticated;grant execute on function public.admin_update_staking_claim(uuid,text,text,bigint,text) to authenticated;grant execute on function public.admin_update_delegation(uuid,text,text) to authenticated;
