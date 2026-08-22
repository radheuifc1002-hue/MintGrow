import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// The Mini App URL — set this to your deployed app URL
const MINI_APP_URL = Deno.env.get('MINI_APP_URL') ?? 'https://t.me/MintGrowBot/app';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendMessage(chatId: number, text: string, extra?: object) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
}

async function getPlayer(telegramId: string) {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  return data;
}

function generateReferralCode(telegramId: string): string {
  const base = telegramId.replace(/\D/g, '').slice(-4) || '0000';
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MG${base}${suffix}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log('Telegram update:', JSON.stringify(update));

    const message = update.message || update.edited_message;
    if (!message) {
      return new Response('ok', { headers: corsHeaders });
    }

    const chatId: number = message.chat.id;
    const fromId: number = message.from?.id;
    const telegramId = String(fromId);
    const username: string = message.from?.username || message.from?.first_name || `User${fromId}`;
    const text: string = message.text || '';

    // ── /start [referralCode] ─────────────────────────────────────────────────
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const referralCode = parts[1] || null;

      // Check if player exists
      let player = await getPlayer(telegramId);

      if (!player) {
        // Create new player
        const newCode = generateReferralCode(telegramId);
        const insertData: any = {
          telegram_id: telegramId,
          username,
          referral_code: newCode,
          total_tokens: 100, // welcome bonus
          is_registered: false,
        };

        if (referralCode) {
          // Find referrer
          const { data: referrer } = await supabase
            .from('players')
            .select('telegram_id, direct_referral_count, total_tokens')
            .eq('referral_code', referralCode.toUpperCase())
            .single();

          if (referrer && referrer.telegram_id !== telegramId) {
            insertData.referred_by = referralCode.toUpperCase();

            // Award referrer 500 MG signup bonus
            await supabase.from('players').update({
              direct_referral_count: (referrer.direct_referral_count ?? 0) + 1,
              total_tokens: parseFloat(referrer.total_tokens ?? '0') + 500,
            }).eq('telegram_id', referrer.telegram_id);

            // Create referral record
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

      const welcomeMsg = player.referred_by
        ? `🎉 <b>Welcome to MintGrow, @${username}!</b>\n\nYou joined via referral code and got <b>100 MG welcome bonus!</b>\n\n💎 Merge crypto coins, earn MG tokens on BNB Chain!\n\n🎮 Tap below to start playing:`
        : `👋 <b>Welcome to MintGrow, @${username}!</b>\n\n💰 Merge crypto coins to earn real <b>MG tokens</b> on BNB Chain!\n\n🚀 Your referral code: <code>${player.referral_code || generateReferralCode(telegramId)}</code>\nShare it to earn 500 MG per friend!\n\n🎮 Tap to play:`;

      await sendMessage(chatId, welcomeMsg, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🎮 Play MintGrow', web_app: { url: MINI_APP_URL } },
          ], [
            { text: '📊 My Balance', callback_data: 'balance' },
            { text: '👥 Referrals', callback_data: 'referrals' },
          ]],
        },
      });
    }

    // ── /balance ──────────────────────────────────────────────────────────────
    else if (text === '/balance' || text === '/wallet') {
      const player = await getPlayer(telegramId);
      if (!player) {
        await sendMessage(chatId, '❌ Account not found. Send /start to register.');
      } else {
        const total = parseFloat(player.total_tokens ?? '0');
        const pending = parseFloat(player.pending_tokens ?? '0');
        const withdrawn = parseFloat(player.withdrawn_tokens ?? '0');
        const wallet = player.wallet_address || 'Not set';

        await sendMessage(chatId,
          `💰 <b>MintGrow Balance — @${username}</b>\n\n` +
          `🟢 Total MG: <b>${total.toLocaleString()}</b>\n` +
          `⏳ Pending: <b>${pending.toLocaleString()}</b>\n` +
          `✅ Withdrawn: <b>${withdrawn.toLocaleString()}</b>\n\n` +
          `🔗 Wallet: <code>${wallet}</code>\n` +
          `📊 Level: <b>${player.level}</b> | Games: <b>${player.games_played}</b>\n\n` +
          `Min withdrawal: <b>250,000 MG</b> on BNB Chain (BEP-20)`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🎮 Open Game', web_app: { url: MINI_APP_URL } },
              ]],
            },
          }
        );
      }
    }

    // ── /referral ─────────────────────────────────────────────────────────────
    else if (text === '/referral' || text === '/invite') {
      const player = await getPlayer(telegramId);
      if (!player) {
        await sendMessage(chatId, '❌ Account not found. Send /start to register.');
      } else {
        const code = player.referral_code;
        const directRefs = player.direct_referral_count ?? 0;
        const refEarnings = parseFloat(player.referral_tokens_earned ?? '0');

        await sendMessage(chatId,
          `👥 <b>Your Referral Program</b>\n\n` +
          `🔑 Your code: <code>${code}</code>\n` +
          `👤 Direct referrals: <b>${directRefs}</b>\n` +
          `💎 Referral earnings: <b>${refEarnings.toLocaleString()} MG</b>\n\n` +
          `<b>How it works:</b>\n` +
          `• Friend uses your code → you get <b>+500 MG</b>\n` +
          `• You earn % from their token income (up to 25 levels!)\n` +
          `• Income released when they reach 250K MG & withdraw\n\n` +
          `Share your link:\nhttps://t.me/MintGrowBot?start=${code}`,
        );
      }
    }

    // ── /help ─────────────────────────────────────────────────────────────────
    else if (text === '/help' || text === '/commands') {
      await sendMessage(chatId,
        `🤖 <b>MintGrow Bot Commands</b>\n\n` +
        `/start — Launch game & register\n` +
        `/balance — Check your MG balance\n` +
        `/referral — Your referral code & stats\n` +
        `/help — Show this menu\n\n` +
        `<b>Game:</b> Merge crypto coins to earn MG tokens on BNB Chain!\n` +
        `Min withdrawal: 250,000 MG`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🎮 Play Now', web_app: { url: MINI_APP_URL } },
            ]],
          },
        }
      );
    }

    // ── Callback queries (inline button presses) ──────────────────────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      const cqChatId: number = cq.message?.chat?.id;
      const cqUserId = String(cq.from?.id);

      if (cq.data === 'balance') {
        const player = await getPlayer(cqUserId);
        if (player) {
          const total = parseFloat(player.total_tokens ?? '0');
          await sendMessage(cqChatId,
            `💰 Balance: <b>${total.toLocaleString()} MG</b> | Level: <b>${player.level}</b>`
          );
        }
        // Answer callback query to remove loading state
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cq.id }),
        });
      }

      if (cq.data === 'referrals') {
        const player = await getPlayer(cqUserId);
        if (player) {
          await sendMessage(cqChatId,
            `👥 Direct refs: <b>${player.direct_referral_count ?? 0}</b>\n💎 Ref earnings: <b>${parseFloat(player.referral_tokens_earned ?? '0').toLocaleString()} MG</b>\n\nCode: <code>${player.referral_code}</code>`
          );
        }
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cq.id }),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Telegram bot error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
