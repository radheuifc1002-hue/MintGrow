-- V2 staking-only economics: legacy off-chain withdrawal is disabled.
-- Reward claims must originate from the staking contract; this table may remain
-- read-only for historical audit data, but no new legacy withdrawal can be created.
drop function if exists public.submit_withdrawal_request(text,text,text,numeric,text,text);

insert into public.governance_config(key,value_text,updated_at)
values('legacy_withdrawal_enabled','false',now())
on conflict(key) do update set value_text='false',updated_at=now();

revoke all on public.withdrawals from anon,authenticated;
