-- MintGrow admin foundation.
-- Create the admin identity table now; existing application policies are intentionally
-- left untouched in this migration so the Mini App continues to function while the
-- admin panel is migrated to Supabase Auth.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists admin_users_email_idx on public.admin_users(lower(email));

alter table public.admin_users enable row level security;

drop policy if exists "admins can read own admin record" on public.admin_users;
create policy "admins can read own admin record"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- These policies are additive. They give an authenticated admin access to the
-- operational data needed by the command center without changing existing Mini App
-- access until Telegram identity/RLS hardening is completed.
drop policy if exists "admins can read players" on public.players;
create policy "admins can read players"
on public.players for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read game sessions" on public.game_sessions;
create policy "admins can read game sessions"
on public.game_sessions for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read ad events" on public.ad_events;
create policy "admins can read ad events"
on public.ad_events for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read withdrawals" on public.withdrawals;
create policy "admins can read withdrawals"
on public.withdrawals for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read referrals" on public.referrals;
create policy "admins can read referrals"
on public.referrals for select
to authenticated
using (public.is_admin());

-- Admin mutations will be moved to protected RPCs in the next hardening migration.
-- Do not grant authenticated UPDATE/DELETE access to operational tables here.
