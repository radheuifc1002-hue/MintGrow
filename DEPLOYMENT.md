# MintGrow Deployment Guide

## 1. Telegram Bot Setup (via @BotFather)

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` → choose name `MintGrow` → username e.g. `MintGrowBot`
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
   MINI_APP_URL=https://t.me/MintGrowBot/app
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

## 5. Telegram Mini App (Expo/EAS)

Option A — EAS Build (recommended):
```bash
npm install -g eas-cli
eas build --platform android --profile production
eas build --platform ios --profile production
```

Option B — Expo Go (testing):
- Scan QR from OnSpace preview panel

## 6. Link Mini App to Bot

In @BotFather:
```
/newapp → select MintGrowBot → set title "MintGrow"
→ App URL: your deployed Expo web URL
→ Short name: app
```

Users can then open via: `https://t.me/MintGrowBot/app`

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
