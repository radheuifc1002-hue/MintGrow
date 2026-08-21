-- Verified Telegram identity RPC layer.
-- Only the Supabase service-role edge gateway may execute these functions.
-- The gateway verifies Telegram Mini App initData before calling them.

create or replace function public.ensure_player(
  p_telegram_id text,
  p_username text,
  p_avatar_url text default null
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  row_player public.players;
begin
  if nullif(trim(p_telegram_id), '') is null then raise exception 'telegram identity required'; end if;
  insert into public.players(telegram_id, username, avatar_url, referral_code)
  values (
    trim(p_telegram_id),
    left(coalesce(nullif(trim(p_username), ''), 'CryptoPlayer'), 32),
    p_avatar_url,
    'TMP_' || upper(substr(md5(gen_random_uuid()::text), 1, 12))
  )
  on conflict (telegram_id) do update
    set username = left(coalesce(nullif(trim(excluded.username), ''), public.players.username), 32),
        avatar_url = coalesce(excluded.avatar_url, public.players.avatar_url),
        updated_at = now();

  perform public.ensure_referral_code(trim(p_telegram_id));
  select * into row_player from public.players where telegram_id = trim(p_telegram_id);
  return row_player;
end;
$$;

-- Financial/activity RPCs are no longer callable directly with the public anon key.
-- They are reached through supabase/functions/mintgrow-api after Telegram verification.
revoke execute on function public.ensure_player(text,text,text) from public, anon, authenticated;
revoke execute on function public.ensure_referral_code(text) from public, anon, authenticated;
revoke execute on function public.complete_player_registration(text,text) from public, anon, authenticated;
revoke execute on function public.credit_player_tokens(text,numeric,integer,integer) from public, anon, authenticated;
revoke execute on function public.record_game_session(text,text,integer,integer,integer,numeric,integer,jsonb,timestamptz,timestamptz) from public, anon, authenticated;
revoke execute on function public.record_ad_event(text,text,text,boolean,numeric,text) from public, anon, authenticated;
revoke execute on function public.apply_referral_code(text,text) from public, anon, authenticated;
revoke execute on function public.submit_withdrawal_request(text,text,text,numeric,text,text) from public, anon, authenticated;

grant execute on function public.ensure_player(text,text,text) to service_role;
grant execute on function public.ensure_referral_code(text) to service_role;
grant execute on function public.complete_player_registration(text,text) to service_role;
grant execute on function public.credit_player_tokens(text,numeric,integer,integer) to service_role;
grant execute on function public.record_game_session(text,text,integer,integer,integer,numeric,integer,jsonb,timestamptz,timestamptz) to service_role;
grant execute on function public.record_ad_event(text,text,text,boolean,numeric,text) to service_role;
grant execute on function public.apply_referral_code(text,text) to service_role;
grant execute on function public.submit_withdrawal_request(text,text,text,numeric,text,text) to service_role;

-- Rewardable ad events credit MG exactly once because client_event_id is unique.
create or replace function public.record_ad_event(
  p_telegram_id text, p_client_event_id text, p_placement text, p_watched boolean,
  p_reward_tokens numeric default 0, p_error text default null)
returns public.ad_events
language plpgsql
security definer
set search_path = public
as $$
declare event_row public.ad_events; inserted_new boolean := false;
begin
  if p_reward_tokens < 0 then raise exception 'Invalid reward amount'; end if;
  if nullif(trim(p_client_event_id), '') is null then raise exception 'client event id required'; end if;

  insert into public.ad_events(telegram_id, client_event_id, placement, provider, watched, error, reward_tokens)
  values(p_telegram_id, p_client_event_id, left(coalesce(p_placement,'unknown'),80), 'monetag', coalesce(p_watched,false), p_error, p_reward_tokens)
  on conflict (client_event_id) do nothing returning * into event_row;
  inserted_new := event_row.id is not null;

  if not inserted_new then
    select * into event_row from public.ad_events where client_event_id=p_client_event_id;
    return event_row;
  end if;

  if p_watched then
    update public.players
    set ads_watched = ads_watched + 1,
        total_tokens = round(total_tokens + p_reward_tokens, 2)
    where telegram_id = p_telegram_id;
    if not found then raise exception 'Player % not found', p_telegram_id; end if;

    if p_reward_tokens > 0 then
      insert into public.token_ledger(telegram_id, amount, balance_before, balance_after, reason, reference_type, reference_id, created_by)
      select telegram_id, p_reward_tokens, total_tokens - p_reward_tokens, total_tokens,
             'Rewarded ad', 'ad_event', event_row.id::text, 'monetag-api'
      from public.players where telegram_id=p_telegram_id;
    end if;
  end if;
  return event_row;
end;
$$;

grant execute on function public.record_ad_event(text,text,text,boolean,numeric,text) to service_role;
revoke execute on function public.record_ad_event(text,text,text,boolean,numeric,text) from public, anon, authenticated;
