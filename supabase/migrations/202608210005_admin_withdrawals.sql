-- MintGrow protected withdrawal processing.
-- Requests are created by submit_withdrawal_request(), which moves the requested
-- amount from total_tokens into pending_tokens. Admin processing moves it from
-- pending_tokens to withdrawn_tokens on approval, or restores it to total_tokens
-- on rejection.

create or replace function public.admin_process_withdrawal(
  p_withdrawal_id text,
  p_action text,
  p_tx_hash text default null,
  p_rejection_reason text default null
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_withdrawal public.withdrawals%rowtype;
  v_before_total numeric;
  v_after_total numeric;
  v_before_pending numeric;
  v_after_pending numeric;
  v_before_withdrawn numeric;
  v_after_withdrawn numeric;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  if lower(trim(p_action)) not in ('approved', 'rejected') then
    raise exception 'action must be approved or rejected';
  end if;

  if lower(trim(p_action)) = 'approved' and nullif(trim(coalesce(p_tx_hash, '')), '') is null then
    raise exception 'transaction hash is required when approving a withdrawal';
  end if;

  if lower(trim(p_action)) = 'rejected' and nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'rejection reason is required when rejecting a withdrawal';
  end if;

  select * into v_withdrawal
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'withdrawal not found';
  end if;

  if v_withdrawal.status <> 'pending' then
    raise exception 'withdrawal has already been processed';
  end if;

  select total_tokens, pending_tokens, withdrawn_tokens
    into v_before_total, v_before_pending, v_before_withdrawn
  from public.players
  where telegram_id = v_withdrawal.telegram_id
  for update;

  if not found then
    raise exception 'player not found';
  end if;

  if v_before_pending < v_withdrawal.amount then
    raise exception 'player pending balance is lower than withdrawal amount';
  end if;

  if lower(trim(p_action)) = 'approved' then
    v_after_total := v_before_total;
    v_after_pending := round(v_before_pending - v_withdrawal.amount, 2);
    v_after_withdrawn := round(v_before_withdrawn + v_withdrawal.amount, 2);

    update public.players
    set pending_tokens = v_after_pending,
        withdrawn_tokens = v_after_withdrawn,
        updated_at = now()
    where telegram_id = v_withdrawal.telegram_id;

    update public.withdrawals
    set status = 'approved',
        tx_hash = nullif(trim(p_tx_hash), ''),
        rejection_reason = null,
        processed_at = now()
    where id = p_withdrawal_id;

    insert into public.token_ledger
      (telegram_id, amount, balance_before, balance_after, reason, reference_type, reference_id, created_by)
    values
      (v_withdrawal.telegram_id, 0, v_before_total, v_after_total,
       'Withdrawal approved: ' || v_withdrawal.id, 'withdrawal', v_withdrawal.id, v_admin::text);

    insert into public.admin_audit_log
      (admin_user_id, action, target_type, target_id, before_data, after_data, reason)
    values
      (v_admin, 'APPROVE_WITHDRAWAL', 'withdrawal', v_withdrawal.id,
       jsonb_build_object('status', v_withdrawal.status,
                          'total_tokens', v_before_total,
                          'pending_tokens', v_before_pending,
                          'withdrawn_tokens', v_before_withdrawn),
       jsonb_build_object('status', 'approved',
                          'tx_hash', nullif(trim(p_tx_hash), ''),
                          'total_tokens', v_after_total,
                          'pending_tokens', v_after_pending,
                          'withdrawn_tokens', v_after_withdrawn),
       'Withdrawal approved');
  else
    v_after_total := round(v_before_total + v_withdrawal.amount, 2);
    v_after_pending := round(v_before_pending - v_withdrawal.amount, 2);
    v_after_withdrawn := v_before_withdrawn;

    update public.players
    set total_tokens = v_after_total,
        pending_tokens = v_after_pending,
        updated_at = now()
    where telegram_id = v_withdrawal.telegram_id;

    update public.withdrawals
    set status = 'rejected',
        tx_hash = null,
        rejection_reason = trim(p_rejection_reason),
        processed_at = now()
    where id = p_withdrawal_id;

    insert into public.token_ledger
      (telegram_id, amount, balance_before, balance_after, reason, reference_type, reference_id, created_by)
    values
      (v_withdrawal.telegram_id, v_withdrawal.amount, v_before_total, v_after_total,
       'Withdrawal rejected and balance restored: ' || v_withdrawal.id, 'withdrawal', v_withdrawal.id, v_admin::text);

    insert into public.admin_audit_log
      (admin_user_id, action, target_type, target_id, before_data, after_data, reason)
    values
      (v_admin, 'REJECT_WITHDRAWAL', 'withdrawal', v_withdrawal.id,
       jsonb_build_object('status', v_withdrawal.status,
                          'total_tokens', v_before_total,
                          'pending_tokens', v_before_pending,
                          'withdrawn_tokens', v_before_withdrawn),
       jsonb_build_object('status', 'rejected',
                          'rejection_reason', trim(p_rejection_reason),
                          'total_tokens', v_after_total,
                          'pending_tokens', v_after_pending,
                          'withdrawn_tokens', v_after_withdrawn),
       trim(p_rejection_reason));
  end if;

  select * into v_withdrawal
  from public.withdrawals
  where id = p_withdrawal_id;

  return v_withdrawal;
end;
$$;

revoke all on function public.admin_process_withdrawal(text, text, text, text) from public;
grant execute on function public.admin_process_withdrawal(text, text, text, text) to authenticated;
