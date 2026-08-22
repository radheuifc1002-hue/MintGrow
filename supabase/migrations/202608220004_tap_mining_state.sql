create table if not exists public.tap_mining_state (
  telegram_id text primary key references public.players(telegram_id) on delete cascade,
  taps bigint not null default 0,
  mined_tokens numeric(30,6) not null default 0,
  mining_power integer not null default 1,
  mining_level integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.tap_mining_state enable row level security;
revoke all on table public.tap_mining_state from anon, authenticated;

create or replace function public.record_mining_taps(p_telegram_id text,p_taps integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.tap_mining_state; reward numeric; before_balance numeric; p public.players;
begin
  if p_taps < 1 or p_taps > 100 then raise exception 'Invalid tap batch'; end if;
  select * into p from players where telegram_id=p_telegram_id for update;
  if p.telegram_id is null then raise exception 'Player not found'; end if;
  insert into tap_mining_state(telegram_id) values(p_telegram_id) on conflict do nothing;
  select * into s from tap_mining_state where telegram_id=p_telegram_id for update;
  reward := round(p_taps * (0.05 * power(1.12, s.mining_power-1)), 6);
  before_balance := p.total_tokens;
  update players set total_tokens=round(total_tokens+reward,6),updated_at=now() where telegram_id=p_telegram_id returning * into p;
  update tap_mining_state set taps=taps+p_taps,mined_tokens=mined_tokens+reward,updated_at=now() where telegram_id=p_telegram_id returning * into s;
  insert into token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by)
  values(p_telegram_id,reward,before_balance,p.total_tokens,'Tap-to-mine reward','tap_mining',p_telegram_id,'mintgrow-api');
  return jsonb_build_object('profile',to_jsonb(p),'state',to_jsonb(s),'reward',reward);
end;$$;

create or replace function public.upgrade_mining(p_telegram_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.tap_mining_state; p public.players; cost numeric; before_balance numeric;
begin
  select * into p from players where telegram_id=p_telegram_id for update;
  if p.telegram_id is null then raise exception 'Player not found'; end if;
  insert into tap_mining_state(telegram_id) values(p_telegram_id) on conflict do nothing;
  select * into s from tap_mining_state where telegram_id=p_telegram_id for update;
  cost := round(25 * power(2.1,s.mining_level-1),2);
  if p.total_tokens < cost then raise exception 'Insufficient tokens'; end if;
  before_balance:=p.total_tokens;
  update players set total_tokens=round(total_tokens-cost,6),updated_at=now() where telegram_id=p_telegram_id returning * into p;
  update tap_mining_state set mining_power=min(mining_power+1,100),mining_level=min(mining_level+1,100),updated_at=now() where telegram_id=p_telegram_id returning * into s;
  insert into token_ledger(telegram_id,amount,balance_before,balance_after,reason,reference_type,reference_id,created_by)
  values(p_telegram_id,-cost,before_balance,p.total_tokens,'Tap-to-mine upgrade','tap_upgrade',p_telegram_id,'mintgrow-api');
  return jsonb_build_object('profile',to_jsonb(p),'state',to_jsonb(s),'cost',cost);
end;$$;

grant execute on function public.record_mining_taps(text,integer) to service_role;
grant execute on function public.upgrade_mining(text) to service_role;
