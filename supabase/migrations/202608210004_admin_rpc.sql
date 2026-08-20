-- MintGrow protected admin operations.
-- All mutations verify the authenticated Supabase user is an admin and write audit data.

create or replace function public.admin_adjust_balance(
  p_telegram_id text,
  p_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_before numeric;
  v_after numeric;
  v_player public.players%rowtype;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if p_amount = 0 then raise exception 'amount cannot be zero'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'reason required'; end if;

  select * into v_player from public.players where telegram_id = p_telegram_id for update;
  if not found then raise exception 'player not found'; end if;

  v_before := coalesce(v_player.total_tokens, 0);
  v_after := v_before + p_amount;
  if v_after < 0 then raise exception 'insufficient balance'; end if;

  update public.players
    set total_tokens = v_after, updated_at = now()
    where telegram_id = p_telegram_id;

  insert into public.token_ledger
    (telegram_id, amount, balance_before, balance_after, reason, reference_type, created_by)
  values
    (p_telegram_id, p_amount, v_before, v_after, p_reason, 'admin_adjustment', v_admin::text);

  insert into public.admin_audit_log
    (admin_user_id, action, target_type, target_id, before_data, after_data, reason)
  values
    (v_admin, 'BALANCE_ADJUSTMENT', 'player', p_telegram_id,
     jsonb_build_object('total_tokens', v_before),
     jsonb_build_object('total_tokens', v_after), p_reason);

  return jsonb_build_object('success', true, 'telegram_id', p_telegram_id,
                            'balance_before', v_before, 'balance_after', v_after);
end;
$$;

create or replace function public.admin_set_player_frozen(
  p_telegram_id text,
  p_frozen boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_before boolean;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'reason required'; end if;

  -- The current players schema may not yet contain a frozen column.
  -- This function intentionally fails clearly until that column is added,
  -- rather than silently pretending the account was frozen.
  begin
    execute 'select is_frozen from public.players where telegram_id = $1 for update' into v_before using p_telegram_id;
  exception when undefined_column then
    raise exception 'players.is_frozen column is not installed yet';
  end;

  execute 'update public.players set is_frozen = $1, updated_at = now() where telegram_id = $2' using p_frozen, p_telegram_id;
  insert into public.admin_audit_log(admin_user_id, action, target_type, target_id, before_data, after_data, reason)
  values(v_admin, case when p_frozen then 'FREEZE_PLAYER' else 'UNFREEZE_PLAYER' end, 'player', p_telegram_id,
         jsonb_build_object('is_frozen', v_before), jsonb_build_object('is_frozen', p_frozen), p_reason);
  return jsonb_build_object('success', true, 'is_frozen', p_frozen);
end;
$$;

revoke all on function public.admin_adjust_balance(text, numeric, text) from public;
grant execute on function public.admin_adjust_balance(text, numeric, text) to authenticated;
revoke all on function public.admin_set_player_frozen(text, boolean, text) from public;
grant execute on function public.admin_set_player_frozen(text, boolean, text) to authenticated;
