# MintGrow website/backend flow security

This branch finalizes the first backend-flow hardening pass. Smart-contract, ERC-4337, EIP-7702 and Paymaster work is intentionally out of scope.

## Authoritative rules

- Telegram Mini App `initData` is the authentication boundary.
- `total_tokens`, `pending_tokens`, `withdrawn_tokens`, progression, reward amounts and power-up costs are server-owned.
- Gameplay reward amounts are calculated by `settle_game_session()`; the browser's reward calculation is not accepted.
- A game session is created server-side and can settle only once.
- Gameplay rewards are capped at 5,000 MG per UTC day.
- Rewarded-ad rewards are fixed by the backend at 100 MG and capped at 20 rewarded events / 2,000 MG per UTC day until an authoritative provider callback is integrated.
- Power-up purchase costs are fixed server-side: undo 500, destroy 1,000, clear_blockers 2,000, shuffle 1,500.
- Power-up grants are capped at 20 per UTC day and are idempotent by event ID.
- Withdrawal requests require a valid BEP-20 address, a minimum of 250,000 MG, and move funds to `pending_tokens` atomically.
- Public/anonymous database access to economic tables is revoked; player mutations go through the verified Edge Function and service-role RPCs.

## Required Telegram webhook secret

Set a Supabase Edge Function secret:

`TELEGRAM_WEBHOOK_SECRET=<random high-entropy secret>`

Configure the Telegram bot webhook with the same secret token. The `telegram-bot` Edge Function rejects every request without the matching `X-Telegram-Bot-Api-Secret-Token` header.

## Game flow

```text
Telegram initData
    -> mintgrow-api
    -> start_game_session()
    -> local gameplay
    -> settle_game_session()
    -> server reward calculation
    -> token_ledger
    -> player.total_tokens
```

The browser can show an optimistic reward for UI responsiveness, but only the server settlement changes the authoritative balance.

## Withdrawal flow

```text
website
  -> submit_withdrawal_request()
  -> lock player
  -> move MG total -> pending
  -> ledger entry
  -> pending withdrawal
  -> admin processing
       approved -> pending -> withdrawn
       rejected -> pending -> total
```

The BNB-funded transaction wallet will be implemented separately after the website/backend flows are frozen.
