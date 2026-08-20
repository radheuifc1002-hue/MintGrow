# MintGrow Production Deployment Guide

This guide takes MintGrow from a local repository to a production Telegram Mini App with:

- Supabase database, migrations, Edge Functions, auth/session storage, ad telemetry, and withdrawal tables.
- Vercel hosting for the Expo web Mini App.
- Railway hosting for the Telegram bot webhook service.
- Telegram BotFather Mini App wiring.
- Monetag Telegram Mini App ad integration.

> Primary references used for this guide: [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations), [Supabase Edge Functions](https://supabase.com/docs/guides/functions), [Expo environment variables](https://docs.expo.dev/guides/environment-variables/), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Railway variables](https://docs.railway.com/variables), [Telegram Mini Apps](https://core.telegram.org/bots/webapps), and [Monetag TMA SDK requirements](https://docs.monetag.com/docs/introduction/technical-requirements/).

---

## 1. Production architecture

```text
Telegram user
  ↓ opens Mini App from bot button
Telegram Mini App WebView
  ↓ HTTPS
Vercel static Expo web app
  ↓ Supabase anon key
Supabase Postgres + Realtime + Edge Functions
  ↑ service role key only on server-side surfaces
Railway Telegram bot webhook
  ↕ Telegram Bot API
Telegram BotFather / Bot API
```

### Runtime responsibilities

| Runtime | What it does | Do not store here |
| --- | --- | --- |
| Vercel | Hosts the game UI/admin UI as Expo web static output. | Supabase service role key, Telegram bot token, payout private keys. |
| Supabase | Stores players, wallets, sessions, ad events, withdrawals, referrals; serves Edge Functions. | Frontend-only secrets. |
| Railway | Runs `railway/bot-server.js` for Telegram webhooks and bot commands. | User wallet private keys. |
| Telegram | Launches the Mini App and sends bot webhook updates. | Backend secrets. |
| Monetag | Serves rewarded/interstitial ad inventory inside Telegram WebView. | Game token accounting authority. |

---

## 2. Required accounts and production URLs

Create or prepare:

1. Supabase project.
2. Vercel project connected to this GitHub repository.
3. Railway project connected to this GitHub repository.
4. Telegram bot from `@BotFather`.
5. Monetag publisher account and Telegram Mini App ad zone.
6. A production domain, recommended:
   - Mini App: `https://mintgrow.yourdomain.com` or Vercel domain.
   - Bot webhook: `https://mintgrow-bot-production.up.railway.app` or custom Railway domain.

Keep these URLs available:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
VERCEL_MINI_APP_URL=https://<your-vercel-domain>
RAILWAY_BOT_URL=https://<your-railway-domain>
TELEGRAM_BOT_TOKEN=<botfather-token>
MONETAG_ZONE_ID=11613357
```

---

## 3. Supabase setup

### 3.1 Create project and collect keys

In Supabase Dashboard:

1. Create a new project.
2. Go to **Project Settings → API**.
3. Copy:
   - Project URL → `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`.
   - anon public key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - service role key → only for Railway/Supabase server-side jobs.

### 3.2 Link local CLI to the project

Install/login/link:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
```

### 3.3 Apply database migrations

This repository includes the core schema migration:

```text
supabase/migrations/202608200001_mintgrow_core.sql
```

Deploy it:

```bash
supabase db push
```

Verify these tables exist in **Table Editor**:

- `players`
- `game_sessions`
- `ad_events`
- `withdrawals`
- `referrals`

Verify these RPC functions exist in **Database → Functions**:

- `credit_player_tokens`
- `submit_withdrawal_request`

### 3.4 Enable Realtime for withdrawals

The app subscribes to withdrawal updates from `subscribeWithdrawalUpdates` in `services/storage.ts`.

In Supabase Dashboard:

1. Go to **Database → Replication**.
2. Enable Realtime on `public.withdrawals`.
3. Confirm updates are visible when admin approves/rejects a withdrawal.

### 3.5 Deploy Supabase Edge Functions

This repo contains:

```text
supabase/functions/monetag-ad/index.ts
supabase/functions/telegram-bot/index.ts
```

Deploy the Monetag config function:

```bash
supabase functions deploy monetag-ad
```

Optional: deploy the Supabase-hosted Telegram bot function if you choose Supabase Edge Functions instead of Railway for bot webhooks:

```bash
supabase functions deploy telegram-bot
```

Set Supabase function secrets:

```bash
supabase secrets set MONETAG_ZONE_ID=11613357
supabase secrets set TELEGRAM_BOT_TOKEN=<telegram-bot-token>
supabase secrets set MINI_APP_URL=<vercel-mini-app-url>
```

### 3.6 Supabase auth and RLS hardening checklist

The current migration uses permissive Mini App policies to keep the app functional during development. Before handling real payouts:

1. Add Telegram `initData` verification server-side.
2. Bind verified Telegram users to `players.auth_user_id` or a signed session.
3. Restrict `players`, `withdrawals`, and `ad_events` policies to the current verified user.
4. Move token credits, withdrawal approvals, and referral rewards fully into RPCs.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` only in Railway/Supabase server environments, never Vercel client env.

---

## 4. Vercel Mini App deployment

### 4.1 Import project

1. Open Vercel Dashboard.
2. Import the GitHub repository.
3. Framework preset can remain generic/static if Vercel detects Expo output correctly.
4. Use this build command:

```bash
npx expo export --platform web
```

5. Use this output directory:

```text
dist
```

If Vercel needs explicit install/build settings:

```text
Install Command: npm install
Build Command: npx expo export --platform web
Output Directory: dist
```

### 4.2 Vercel environment variables

Set these for **Production**, **Preview**, and **Development** as appropriate:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
EXPO_PUBLIC_MONETAG_ZONE_ID=11613357
EXPO_PUBLIC_ADMIN_EMAIL=<admin-email>
EXPO_PUBLIC_ADMIN_PASSWORD=<strong-admin-password>
```

Important Expo rule: variables used in the browser bundle must be prefixed with `EXPO_PUBLIC_`.

### 4.3 Vercel deployment checks

After deploy:

1. Open the Vercel URL in a normal browser.
2. Confirm the app loads without a blank page.
3. Confirm Supabase profile creation works.
4. Confirm wallet save writes to `players.wallet_address`.
5. Confirm the admin route opens:

```text
https://<vercel-domain>/admin-panel
```

6. Confirm game route opens from default route:

```text
https://<vercel-domain>/
```

### 4.4 Common Vercel issues

| Issue | Cause | Fix |
| --- | --- | --- |
| `process.env` value undefined | Missing `EXPO_PUBLIC_` prefix or env added after build | Add env variable and redeploy. |
| Monetag ads do not load in preview | Ad networks often require approved production HTTPS domains and Telegram WebView context | Test in Telegram using production Vercel domain approved in Monetag. |
| Admin password not accepted | Env mismatch | Confirm `EXPO_PUBLIC_ADMIN_EMAIL` and `EXPO_PUBLIC_ADMIN_PASSWORD`, then redeploy. |
| Blank page after deploy | Static export/build issue | Check Vercel build logs and confirm output directory is `dist`. |

---

## 5. Railway Telegram bot deployment

This repository has a Railway-ready bot server:

```text
railway/bot-server.js
```

It serves:

- `GET /` health/config overview.
- `GET /health` deployment health check.
- `GET /setup-webhook` helper that calls Telegram `setWebhook`.
- `POST /webhook` Telegram Bot API webhook receiver.

### 5.1 Create Railway service

1. Open Railway.
2. Create a new project.
3. Deploy from GitHub repository.
4. Select this repository.
5. Configure the service start command if Railway does not infer it:

```bash
node railway/bot-server.js
```

### 5.2 Railway environment variables

Set service variables in Railway:

```bash
TELEGRAM_BOT_TOKEN=<botfather-token>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
MINI_APP_URL=https://<vercel-mini-app-url>
BOT_USERNAME=MintGrowBot
PORT=3000
```

Notes:

- Railway normally injects `PORT`; keep `PORT=3000` only if needed locally or if Railway does not auto-inject.
- `SUPABASE_SERVICE_ROLE_KEY` belongs on Railway only, not in Vercel public variables.
- `MINI_APP_URL` must be HTTPS and must match the URL configured in BotFather/Telegram.

### 5.3 Generate Railway domain

1. Open Railway service settings.
2. Generate a public domain.
3. Copy it as:

```bash
RAILWAY_BOT_URL=https://<your-service>.up.railway.app
```

### 5.4 Register Telegram webhook

After Railway deploys, open:

```text
https://<railway-domain>/health
```

It should return healthy status and no missing env vars.

Then open:

```text
https://<railway-domain>/setup-webhook
```

Expected response includes:

```json
{
  "webhookUrl": "https://<railway-domain>/webhook",
  "telegramResponse": { "ok": true }
}
```

Alternatively call Telegram directly:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<railway-domain>/webhook","allowed_updates":["message","edited_message","callback_query"],"drop_pending_updates":true}'
```

Verify webhook status:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

### 5.5 Railway bot smoke test

In Telegram:

1. Open your bot.
2. Send `/start`.
3. Confirm the bot replies with a Play MintGrow web app button.
4. Tap the button.
5. Confirm Telegram opens the Vercel Mini App.
6. Send `/balance` and `/referral`.
7. Confirm Supabase `players` row exists/updates.

---

## 6. Telegram BotFather and Mini App setup

### 6.1 Create bot

In Telegram:

1. Open `@BotFather`.
2. Run `/newbot`.
3. Save the token as `TELEGRAM_BOT_TOKEN`.
4. Save the bot username as `BOT_USERNAME`.

### 6.2 Configure Mini App URL

In `@BotFather`:

1. Select your bot.
2. Open **Bot Settings**.
3. Use **Menu Button** or **Configure Mini App** depending on the BotFather UI available to your account.
4. Set the Mini App URL:

```text
https://<vercel-mini-app-url>
```

### 6.3 Configure domain expectations

Telegram Mini Apps must be hosted over HTTPS. Use your production Vercel HTTPS domain for:

- Bot menu button.
- Inline keyboard `web_app.url` generated by Railway bot.
- Monetag approved domain/app configuration.

### 6.4 Telegram Mini App validation checklist

Inside Telegram mobile app:

1. `/start` returns the inline Mini App button.
2. Mini App opens without browser redirect.
3. `window.Telegram.WebApp` is available.
4. User profile uses Telegram ID/username.
5. Registration gate completes after ad completion/fallback rules.
6. Referral links look like:

```text
https://t.me/<BOT_USERNAME>?start=<REFERRAL_CODE>
```

---

## 7. Monetag ad integration

### 7.1 Monetag dashboard setup

1. Create or log into Monetag.
2. Add a Telegram Mini App/site placement.
3. Use the production Vercel Mini App URL, not localhost and not an unapproved preview URL.
4. Create/copy:
   - Publisher ID.
   - Zone ID.
5. Add both to Supabase secrets and Vercel env variables.

### 7.2 Repo integration points

Client-side ad display logic lives in:

```text
services/monetag.ts
```

Registration gate logging lives in:

```text
components/ui/RegistrationGate.tsx
```

Supabase config function lives in:

```text
supabase/functions/monetag-ad/index.ts
```

The app tries to load the Monetag SDK script and call the zone-specific show function in Telegram-compatible browser runtime.

### 7.3 Required Monetag environment variables

Set in Supabase Edge Function secrets:

```bash
MONETAG_ZONE_ID=11613357
```

Set in Vercel as public fallback values:

```bash
EXPO_PUBLIC_MONETAG_ZONE_ID=11613357
```

### 7.4 Why ads often fail in Vercel preview

Monetag’s Telegram Mini App SDK requires a web-based HTTPS app with JavaScript/DOM support running inside Telegram’s Mini App WebView. Vercel preview URLs and desktop browser previews may not have approved ad inventory, may not match the production domain in Monetag, or may not run inside Telegram WebView.

Production test sequence:

1. Deploy Vercel production build.
2. Configure BotFather to open that exact production URL.
3. Configure Monetag with that exact production URL/domain.
4. Open the Mini App from Telegram mobile.
5. Trigger registration ad.
6. Check Supabase `ad_events` for `placement = registration` rows.

### 7.5 Ad telemetry checks

In Supabase SQL editor:

```sql
select placement, watched, error, reward_tokens, created_at
from public.ad_events
order by created_at desc
limit 50;
```

Expected:

- Successful registration ad: `placement = 'registration'`, `watched = true`, `reward_tokens = 100`.
- Failed preview ad: `watched = false`, `error` explains SDK/zone issue.

---

## 8. Withdrawal and admin backend verification

### 8.1 Wallet write verification

From the app Rewards tab:

1. Enter a BEP-20 address like `0x` + 40 hex characters.
2. Tap Save.
3. Verify Supabase:

```sql
select telegram_id, username, wallet_address, updated_at
from public.players
where wallet_address <> ''
order by updated_at desc
limit 20;
```

### 8.2 Withdrawal request verification

After user reaches minimum balance and watches required ad:

```sql
select id, telegram_id, username, amount, wallet_address, network, status, created_at
from public.withdrawals
order by created_at desc
limit 20;
```

Expected:

- `status = 'pending'`.
- `wallet_address` matches the player wallet.
- `players.total_tokens` decreased.
- `players.pending_tokens` increased.

### 8.3 Admin panel verification

Open:

```text
https://<vercel-domain>/admin-panel
```

Login with:

```bash
EXPO_PUBLIC_ADMIN_EMAIL=<admin-email>
EXPO_PUBLIC_ADMIN_PASSWORD=<admin-password>
```

Check:

1. Overview metrics load.
2. Users list shows wallet addresses.
3. Withdrawals tab shows pending requests.
4. Search finds usernames, Telegram IDs, wallet addresses, and transaction hashes.
5. Approval workflow records `tx_hash`, sets status to `approved`, decrements `pending_tokens`, and increments `withdrawn_tokens`.
6. Rejection workflow sets status to `rejected`, refunds `total_tokens`, and decrements `pending_tokens`.

---

## 9. Environment variable matrix

| Variable | Vercel | Railway | Supabase secrets | Notes |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | No | No | Browser-safe project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | No | No | Browser-safe anon key; enforce RLS before production funds. |
| `SUPABASE_URL` | No | Yes | Usually auto | Railway server Supabase URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Never | Yes | Usually auto | Server only. Never expose to browser. |
| `TELEGRAM_BOT_TOKEN` | Never | Yes | Optional if using Supabase bot function | Server only. |
| `MINI_APP_URL` | No | Yes | Optional | Must equal Vercel production URL. |
| `BOT_USERNAME` | No | Yes | No | Used for referral links. |
| `EXPO_PUBLIC_MONETAG_ZONE_ID` | Optional | No | No | Browser-safe TMA zone override; defaults to `11613357`. |
| `MONETAG_ZONE_ID` | No | No | Optional | Edge Function compatibility config; defaults to `11613357`. |
| `EXPO_PUBLIC_ADMIN_EMAIL` | Yes | No | No | Current client-side admin login. Harden later. |
| `EXPO_PUBLIC_ADMIN_PASSWORD` | Yes | No | No | Temporary only; replace with server-side auth/admin roles. |

---

## 10. Local pre-deployment checklist

Run before production deployment:

```bash
npm install
npx eslint 'app/(tabs)/index.tsx' app/admin-panel/index.tsx components/game/GameBoard.tsx components/game/GameTile.tsx components/ui/BrandMark.tsx hooks/useWithdrawal.ts services/storage.ts services/gameEngine.ts services/monetag.ts components/ui/RegistrationGate.tsx
npx expo export --platform web
```

Known current repository checks to fix before an enterprise launch:

- `npm run lint` has existing lint errors in unrelated files.
- `npx tsc --noEmit` has existing issues in `app/admin.tsx` and Supabase Deno Edge Function typings.
- RLS is development-permissive and must be hardened before production payouts.

---

## 11. Production launch checklist

### Supabase

- [ ] `supabase db push` completed.
- [ ] `monetag-ad` Edge Function deployed.
- [ ] Monetag secrets set.
- [ ] Realtime enabled on `withdrawals`.
- [ ] Tables visible in Table Editor.
- [ ] `ad_events` logging works.
- [ ] `withdrawals` rows appear after user requests.

### Vercel

- [ ] Production deployment succeeds.
- [ ] Env variables present in Production environment.
- [ ] App opens on HTTPS URL.
- [ ] `/admin-panel` opens.
- [ ] Wallet save updates Supabase.
- [ ] Mini App URL copied for Telegram/Railway/Monetag.

### Railway

- [ ] `node railway/bot-server.js` deployed.
- [ ] Service domain generated.
- [ ] Required Railway env vars configured.
- [ ] `/health` returns healthy.
- [ ] `/setup-webhook` returns Telegram `ok: true`.
- [ ] `/start`, `/balance`, `/referral` commands work.

### Telegram

- [ ] BotFather bot created.
- [ ] Menu button or Mini App URL points to Vercel production URL.
- [ ] Inline Play button opens Mini App inside Telegram.
- [ ] Referral links preserve `/start <code>`.

### Monetag

- [ ] Production Vercel domain approved/configured.
- [ ] Zone ID configured in Vercel and Supabase secrets.
- [ ] Ads tested from Telegram mobile, not only browser preview.
- [ ] Failures visible in `ad_events`.

---

## 12. Recommended hardening before real-money operations

1. Replace `EXPO_PUBLIC_ADMIN_PASSWORD` with Supabase Auth plus admin role claims.
2. Verify Telegram `initData` on the backend for every privileged write.
3. Restrict RLS so players can only read/write their own rows.
4. Move admin approval/rejection into service-role-only RPCs.
5. Store every token mutation in a ledger table.
6. Add idempotency keys for ad rewards and withdrawal submissions.
7. Add monitoring/alerts for failed ad events and failed webhook calls.
8. Run a payout dry-run environment before mainnet payouts.
9. Add automated E2E tests for registration, ad fallback, wallet save, withdrawal request, admin approval, and bot launch.
