# MintGrow Deployment Guide

## 1. Telegram Bot Setup (via @BotFather)

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` → choose name `MintGrow` → username e.g. `MINTGROW_BOT`
3. Copy the **Bot Token**
4. Send `/newapp` → attach your Mini App URL (after Railway deploy)
5. Set bot commands:
   ```
   /setcommands → select your bot → paste:
   start - Launch MintGrow game
   balance - Check MG token balance
   referral - Your referral code & stats
   help - Show all commands
   ```

## 2. Railway Deployment

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repository
4. Add environment variables in Railway dashboard:
   ```
   TELEGRAM_BOT_TOKEN=<from BotFather>
   SUPABASE_URL=<your Supabase URL>
   SUPABASE_SERVICE_ROLE_KEY=<your service role key>
   MINI_APP_URL=https://your-expo-web-domain.example.co
   ```
5. Railway auto-deploys and gives you a public URL like `https://mintgrow-bot.up.railway.app`

## 3. Register Telegram Webhook

After Railway deploy, open in browser:
```
https://your-railway-url.up.railway.app/setup-webhook
```

This registers your Railway server as the Telegram webhook. You should see:
```json
{ "ok": true, "description": "Webhook was set" }
```

## 4. Supabase Edge Functions (Monetag Ads)

The `supabase/functions/monetag-ad` function is auto-deployed via Supabase.
Make sure these secrets are set in Supabase Dashboard → Edge Functions → Secrets:
- `MONETAG_PUBLISHER_ID`
- `MONETAG_ZONE_ID`

## 5. Telegram Mini App (Web, native to Telegram)

Telegram bots do not run Android/iOS binaries inside chat. A Telegram Mini App is a HTTPS web app opened by Telegram. Deploy the Expo web build and use that URL in @BotFather and Railway.

```bash
pnpm expo export --platform web
```

Deploy the generated web output to a static host (Railway static service, Vercel, Netlify, etc.). The game and Monetag SDK run inside Telegram's in-app browser, not as a React Native Android/iOS package.

## 6. Link Mini App to Bot

In @BotFather:
```


Users can then open via: `https://t.me/MINTGROW_BOT/app`

## Architecture

```
Telegram User
     │
     ▼
Telegram Bot API
     │
     ├──▶ Bot Commands ──▶ Railway Node.js Server
     │                           │
     │                           ▼
     │                      Supabase DB
     │
     └──▶ Mini App ──▶ Expo React Native App
                              │
                              ├──▶ Supabase DB (player data)
                              ├──▶ Supabase Edge Functions (Monetag ads)
                              └──▶ Admin Panel (withdrawal approval)
```


## 7. Troubleshooting the Railway bot

- Open `/health` on the Railway domain. It should always return `{ "status": "healthy" }` so Railway keeps the container alive.
- Open `/ready` to verify required environment variables; it lists any missing config.
- Open `/debug` to call Telegram `getMe` and `getWebhookInfo` from the deployed service.
- Open `/setup-webhook` after every Railway domain or bot token change; it also registers bot commands.
- In Railway logs, check that `MintGrow Bot server running` appears and that incoming Telegram updates log `TELEGRAM WEBHOOK RECEIVED`.
- `MINI_APP_URL` must be the HTTPS web app URL, not `https://t.me/...`; Telegram needs the bot button to contain the actual Mini App web URL.

## 8. Monetag Telegram ads

Set Supabase Edge Function secrets:

```bash
MONETAG_PUBLISHER_ID=<from Monetag>
MONETAG_ZONE_ID=<Telegram Mini App zone id>
```

The app loads `https://niphausten.com/1/tag.min.js` with `data-zone` and calls `window.show_<ZONE_ID>()` from the Telegram Mini App web runtime.

Production note: Monetag failures do not grant ad rewards in production. The local countdown reward is only for non-production preview/testing when the ad network cannot be reached.
