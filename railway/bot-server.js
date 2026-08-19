/**
 * MintGrow Telegram Bot Webhook Server
 * Deploy this on Railway.app to handle Telegram bot webhooks
 *
 * Environment variables needed in Railway:
 *   TELEGRAM_BOT_TOKEN   — from @BotFather
 *   SUPABASE_URL         — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — your Supabase service role key
 *   MINI_APP_URL         — your Telegram Mini App URL (e.g. https://t.me/YourBot/app)
 *   PORT                 — set by Railway automatically
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/MintGrowBot/app';
const PORT = process.env.PORT || 3000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Telegram API helpers ────────────────────────────────────────────────────

async function sendMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
  return res.json();
}

async function answerCallbackQuery(id) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id }),
  });
}

function generateReferralCode(telegramId) {
  const base = String(telegramId).replace(/\D/g, '').slice(-4) || '0000';
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MG${base}${suffix}`;
}

async function getPlayer(telegramId) {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', String(telegramId))
    .single();
  return data;
}

// ─── Register webhook setup endpoint ────────────────────────────────────────

app.get('/setup-webhook', async (req, res) => {
  const webhookUrl = `https://${req.get('host')}/webhook`;
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    }
  );
  const data = await response.json();
  res.json({ webhookUrl, telegramResponse: data });
});

// ─── Health check ───────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'MintGrow Telegram Bot', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// ─── Main webhook handler ────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  
console.log('🔥 TELEGRAM WEBHOOK RECEIVED');
  console.log('Update:', JSON.stringify(req.body));

  res.status(200).json({ ok: true });
  try {
    const update = req.body;
    const message = update.message || update.edited_message;
    const callbackQuery = update.callback_query;

    // Handle callback queries (inline button presses)
    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat?.id;
      const userId = String(callbackQuery.from?.id);

      if (callbackQuery.data === 'balance') {
        const player = await getPlayer(userId);
        if (player) {
          const total = parseFloat(player.total_tokens ?? '0');
          await sendMessage(chatId,
            `💰 Balance: <b>${total.toLocaleString()} MG</b> | Level: <b>${player.level}</b>`
          );
        }
        await answerCallbackQuery(callbackQuery.id);
      } else if (callbackQuery.data === 'referrals') {
        const player = await getPlayer(userId);
        if (player) {
          const code = player.referral_code;
          const directRefs = player.direct_referral_count ?? 0;
          const refEarnings = parseFloat(player.referral_tokens_earned ?? '0');
          await sendMessage(chatId,
            `👥 <b>Referral Stats</b>\n\nDirect refs: <b>${directRefs}</b>\nEarnings: <b>${refEarnings.toLocaleString()} MG</b>\n\nYour code: <code>${code}</code>\n\nShare: https://t.me/MintGrowBot?start=${code}`
          );
        }
        await answerCallbackQuery(callbackQuery.id);
      }
      return;
    }

    if (!message) return;

    const chatId = message.chat.id;
    const fromId = message.from?.id;
    const telegramId = String(fromId);
    const username = message.from?.username || message.from?.first_name || `User${fromId}`;
    const text = message.text || '';

    // /start [referralCode]
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const referralCode = parts[1] || null;

      let player = await getPlayer(telegramId);

      if (!player) {
        const newCode = generateReferralCode(telegramId);
        const insertData = {
          telegram_id: telegramId,
          username,
          referral_code: newCode,
          total_tokens: 100,
          is_registered: false,
        };

        if (referralCode) {
          const { data: referrer } = await supabase
            .from('players')
            .select('telegram_id, direct_referral_count, total_tokens')
            .eq('referral_code', referralCode.toUpperCase())
            .single();

          if (referrer && referrer.telegram_id !== telegramId) {
            insertData.referred_by = referralCode.toUpperCase();
            await supabase.from('players').update({
              direct_referral_count: (referrer.direct_referral_count ?? 0) + 1,
              total_tokens: parseFloat(referrer.total_tokens ?? '0') + 500,
            }).eq('telegram_id', referrer.telegram_id);

            await supabase.from('referrals').upsert({
              referrer_telegram_id: referrer.telegram_id,
              referee_telegram_id: telegramId,
              level: 1,
              tokens_earned: 0,
            }, { onConflict: 'referrer_telegram_id,referee_telegram_id' });
          }
        }

        await supabase.from('players').insert(insertData);
        player = insertData;
      }

      const playerCode = player.referral_code || generateReferralCode(telegramId);
      const welcomeMsg = player.referred_by
        ? `🎉 <b>Welcome to MintGrow, @${username}!</b>\n\nYou joined via referral and got <b>100 MG bonus!</b>\n\n💎 Merge crypto coins, earn MG tokens on BNB Chain!`
        : `👋 <b>Welcome to MintGrow!</b>\n\nMerge crypto coins → earn real <b>MG tokens</b> on BNB Chain!\n\n🔑 Your code: <code>${playerCode}</code>\nShare for 500 MG per friend!`;

      await sendMessage(chatId, welcomeMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Play MintGrow', web_app: { url: MINI_APP_URL } }],
            [
              { text: '📊 Balance', callback_data: 'balance' },
              { text: '👥 Referrals', callback_data: 'referrals' },
            ],
          ],
        },
      });
    }

    // /balance
    else if (text === '/balance' || text === '/wallet') {
      const player = await getPlayer(telegramId);
      if (!player) {
        await sendMessage(chatId, '❌ Not found. Send /start to register.');
      } else {
        const total = parseFloat(player.total_tokens ?? '0');
        const pending = parseFloat(player.pending_tokens ?? '0');
        const withdrawn = parseFloat(player.withdrawn_tokens ?? '0');
        await sendMessage(chatId,
          `💰 <b>Balance — @${username}</b>\n\n🟢 Total: <b>${total.toLocaleString()} MG</b>\n⏳ Pending: <b>${pending.toLocaleString()}</b>\n✅ Withdrawn: <b>${withdrawn.toLocaleString()}</b>\n\nMin withdrawal: <b>250,000 MG</b>`,
          { reply_markup: { inline_keyboard: [[{ text: '🎮 Open Game', web_app: { url: MINI_APP_URL } }]] } }
        );
      }
    }

    // /referral
    else if (text === '/referral' || text === '/invite') {
      const player = await getPlayer(telegramId);
      if (!player) {
        await sendMessage(chatId, '❌ Not found. Send /start to register.');
      } else {
        const code = player.referral_code;
        await sendMessage(chatId,
          `👥 <b>Referrals</b>\n\nCode: <code>${code}</code>\nDirect: <b>${player.direct_referral_count ?? 0}</b>\nEarnings: <b>${parseFloat(player.referral_tokens_earned ?? '0').toLocaleString()} MG</b>\n\nLink: https://t.me/MintGrowBot?start=${code}`
        );
      }
    }

    // /help
    else if (text === '/help') {
      await sendMessage(chatId,
        `🤖 <b>MintGrow Commands</b>\n\n/start — Register & launch\n/balance — Check MG balance\n/referral — Your referral code\n/help — This menu`,
        { reply_markup: { inline_keyboard: [[{ text: '🎮 Play Now', web_app: { url: MINI_APP_URL } }]] } }
      );
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

app.listen(PORT, () => {
  console.log(`MintGrow Bot server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/`);
  console.log(`Setup webhook: GET http://localhost:${PORT}/setup-webhook`);
});
