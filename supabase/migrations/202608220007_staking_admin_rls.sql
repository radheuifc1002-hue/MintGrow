-- Admin panel needs read-only visibility into the staking queue. Users never get table access.
grant select on public.staking_requests to authenticated;
create policy staking_requests_admin_read on public.staking_requests for select to authenticated using (public.is_admin());
