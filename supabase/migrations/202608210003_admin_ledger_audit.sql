-- MintGrow admin foundation: immutable token ledger + admin audit trail
create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null,
  amount numeric not null,
  balance_before numeric,
  balance_after numeric,
  reason text not null,
  reference_type text,
  reference_id text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists token_ledger_telegram_id_idx on public.token_ledger(telegram_id);
create index if not exists token_ledger_created_at_idx on public.token_ledger(created_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log(target_type, target_id);

alter table public.token_ledger enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "Admins can read token ledger" on public.token_ledger
  for select using (public.is_admin());

create policy "Admins can read audit log" on public.admin_audit_log
  for select using (public.is_admin());

-- No client-side inserts/updates/deletes. Ledger and audit writes should be
-- performed by protected server-side functions only.
