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
   MINI_APP_URL=https://your-expo-web-domain.example.com
   BOT_USERNAME=MintGrowBot
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
This compatibility function returns the public TMA config. It does not require `MONETAG_PUBLISHER_ID`. Optionally set `MONETAG_ZONE_ID=11613357`; otherwise the function defaults to the publisher-supplied TMA zone.

## 5. Telegram Mini App (Web, native to Telegram)

Telegram bots do not run Android/iOS binaries inside chat. A Telegram Mini App is a HTTPS web app opened by Telegram. Deploy the Expo web build and use that URL in @BotFather and Railway.

```bash
pnpm expo export --platform web
```

Deploy the generated web output to a static host (Railway static service, Vercel, Netlify, etc.). The game and Monetag SDK run inside Telegram's in-app browser, not as a React Native Android/iOS package.

## 6. Link Mini App to Bot

In @BotFather:
```
/newapp → select MintGrowBot → set title "MintGrow"
→ App URL: your deployed Expo web URL (the same URL as MINI_APP_URL)
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
                              ├──▶ Monetag TMA SDK (ads)
                              └──▶ Admin Panel (withdrawal approval)
```


## 7. Troubleshooting the Railway bot

- Open `/health` on the Railway domain. It should return `{ "status": "healthy" }`.
- Open `/setup-webhook` after every Railway domain or bot token change.
- In Railway logs, check that `MintGrow Bot server running` appears and that incoming Telegram updates log `TELEGRAM WEBHOOK RECEIVED`.
- `MINI_APP_URL` must be the HTTPS web app URL, not `https://t.me/...`; Telegram needs the bot button to contain the actual Mini App web URL.

## 8. Monetag Telegram ads

The publisher-supplied Telegram Mini App snippet is:

```html
<script src='//libtl.com/sdk.js' data-zone='11613357' data-sdk='show_11613357'></script>
```

The app loads `https://libtl.com/sdk.js` with `data-zone="11613357"` and `data-sdk="show_11613357"`, then calls `window.show_11613357()` from the Telegram Mini App web runtime. `MONETAG_PUBLISHER_ID` is not required for this TMA SDK integration. Optionally set `EXPO_PUBLIC_MONETAG_ZONE_ID=11613357` for frontend configuration or `MONETAG_ZONE_ID=11613357` for the compatibility Edge Function.

Production note: Monetag failures do not grant ad rewards in production. The local countdown reward is only for non-production preview/testing when the ad network cannot be reached.
