-- MintGrow core schema, auth-facing player identity, game sessions, ads, and payout operations.
create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  telegram_id text unique not null,
  username text not null default 'CryptoPlayer',
  avatar_url text,
  referral_code text unique not null,
  referred_by text references public.players(referral_code) on delete set null,
  direct_referral_count integer not null default 0 check (direct_referral_count >= 0),
  referral_tokens_earned numeric(18,2) not null default 0,
  total_tokens numeric(18,2) not null default 0 check (total_tokens >= 0),
  pending_tokens numeric(18,2) not null default 0 check (pending_tokens >= 0),
  withdrawn_tokens numeric(18,2) not null default 0 check (withdrawn_tokens >= 0),
  wallet_address text not null default '',
  level integer not null default 1 check (level >= 1),
  games_played integer not null default 0 check (games_played >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  ads_watched integer not null default 0 check (ads_watched >= 0),
  last_login_date text,
  login_streak integer not null default 0 check (login_streak >= 0),
  power_ups jsonb not null default '{"undo":0,"destroy":0,"clear_blockers":0,"shuffle":0}'::jsonb,
  is_registered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  score integer not null default 0,
  moves integer not null default 0,
  level integer not null default 1,
  tokens_earned numeric(18,2) not null default 0,
  max_tile integer not null default 2,
  board jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  telegram_id text references public.players(telegram_id) on delete set null,
  placement text not null,
  provider text not null default 'monetag',
  watched boolean not null default false,
  error text,
  reward_tokens numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null references public.players(telegram_id) on delete cascade,
  username text not null,
  amount numeric(18,2) not null check (amount > 0),
  wallet_address text not null,
  network text not null default 'BNB Chain (BEP-20)',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  tx_hash text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_telegram_id text not null references public.players(telegram_id) on delete cascade,
  referee_telegram_id text not null references public.players(telegram_id) on delete cascade,
  level integer not null default 1,
  tokens_earned numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (referrer_telegram_id, referee_telegram_id)
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists players_touch_updated_at on public.players;
create trigger players_touch_updated_at before update on public.players
for each row execute function public.touch_updated_at();

alter table public.players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.ad_events enable row level security;
alter table public.withdrawals enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "anon mini app can upsert players" on public.players;
create policy "anon mini app can upsert players" on public.players for all using (true) with check (true);
drop policy if exists "anon mini app can manage game sessions" on public.game_sessions;
create policy "anon mini app can manage game sessions" on public.game_sessions for all using (true) with check (true);
drop policy if exists "anon mini app can insert ad events" on public.ad_events;
create policy "anon mini app can insert ad events" on public.ad_events for insert with check (true);
drop policy if exists "anon mini app can manage withdrawals" on public.withdrawals;
create policy "anon mini app can manage withdrawals" on public.withdrawals for all using (true) with check (true);
drop policy if exists "anon mini app can read referrals" on public.referrals;
create policy "anon mini app can read referrals" on public.referrals for select using (true);
drop policy if exists "anon mini app can insert referrals" on public.referrals;
create policy "anon mini app can insert referrals" on public.referrals for insert with check (true);

create index if not exists players_total_tokens_idx on public.players(total_tokens desc);
create index if not exists players_referral_code_idx on public.players(referral_code);
create index if not exists game_sessions_telegram_idx on public.game_sessions(telegram_id, started_at desc);
create index if not exists withdrawals_status_idx on public.withdrawals(status, created_at desc);
create index if not exists ad_events_telegram_idx on public.ad_events(telegram_id, created_at desc);
