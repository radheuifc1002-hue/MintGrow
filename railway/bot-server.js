/**
 * MintGrow Telegram Bot Webhook Server
 * Deploy this on Railway.app to handle Telegram bot webhooks.
 *
 * Required Railway env vars:
 *   TELEGRAM_BOT_TOKEN
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MINI_APP_URL - the HTTPS URL of the deployed Expo web Mini App
 * Optional:


const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MINI_APP_URL = process.env.MINI_APP_URL || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function requireConfig({ includeMiniApp = true } = {}) {
  const missing = [];
  if (!BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (includeMiniApp && !MINI_APP_URL) missing.push('MINI_APP_URL');
  return missing;
}

function getMiniAppUrl(req) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  return url.searchParams.get('miniAppUrl') || MINI_APP_URL;
}

async function telegram(method, payload) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log(`Telegram ${method}:`, JSON.stringify(data));
  return data;
}

async function sendMessage(chatId, text, extra = {}) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

async function answerCallbackQuery(id) {
  return telegram('answerCallbackQuery', { callback_query_id: id });
}

function generateReferralCode(telegramId) {
  const base = String(telegramId).replace(/\D/g, '').slice(-4) || '0000';
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MG${base}${suffix}`;
}

async function getPlayer(telegramId) {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', String(telegramId))
    .maybeSingle();

  if (error) console.error('Supabase getPlayer error:', error);
  return data;
}

function miniAppKeyboard(label = '🎮 Play MintGrow') {
  if (!MINI_APP_URL) {
    return {
      inline_keyboard: [[{ text: 'ℹ️ Configure Mini App URL', callback_data: 'missing_mini_app_url' }]],
    };
  }

  return {
    inline_keyboard: [[{ text: label, web_app: { url: MINI_APP_URL } }]],
  };
}

async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const userId = String(callbackQuery.from?.id || '');

  if (callbackQuery.data === 'balance') {
    const player = await getPlayer(userId);
    if (player) {
      const total = Number.parseFloat(player.total_tokens ?? '0');
      await sendMessage(chatId, `💰 Balance: <b>${total.toLocaleString()} MG</b> | Level: <b>${player.level}</b>`);
    }
  }

  if (callbackQuery.data === 'missing_mini_app_url') {
    await sendMessage(chatId, '⚠️ MINI_APP_URL is not configured on Railway. Set it to your HTTPS Expo web app URL, redeploy, then run /setup-webhook again.');
  }

  if (callbackQuery.data === 'referrals') {
    const player = await getPlayer(userId);
    if (player) {
      const code = player.referral_code;
      const directRefs = player.direct_referral_count ?? 0;
      const refEarnings = Number.parseFloat(player.referral_tokens_earned ?? '0');
      await sendMessage(
        chatId,
        `👥 <b>Referral Stats</b>\n\nDirect refs: <b>${directRefs}</b>\nEarnings: <b>${refEarnings.toLocaleString()} MG</b>\n\nYour code: <code>${code}</code>\n\nShare: https://t.me/${BOT_USERNAME}?start=${code}`
      );
    }
  }

  await answerCallbackQuery(callbackQuery.id);
}

async function registerNewPlayer(telegramId, username, referralCode) {
  const newCode = generateReferralCode(telegramId);
  const insertData = {
    telegram_id: telegramId,
    username,
    referral_code: newCode,
    total_tokens: 100,
    is_registered: false,
  };

  if (referralCode) {
    const normalizedCode = referralCode.toUpperCase();
    const { data: referrer } = await supabase
      .from('players')
      .select('telegram_id, direct_referral_count, total_tokens')
      .eq('referral_code', normalizedCode)
      .maybeSingle();

    if (referrer && referrer.telegram_id !== telegramId) {
      insertData.referred_by = normalizedCode;
      await supabase.from('players').update({
        direct_referral_count: (referrer.direct_referral_count ?? 0) + 1,
        total_tokens: Number.parseFloat(referrer.total_tokens ?? '0') + 500,
      }).eq('telegram_id', referrer.telegram_id);

      await supabase.from('referrals').upsert({
        referrer_telegram_id: referrer.telegram_id,
        referee_telegram_id: telegramId,
        level: 1,
        tokens_earned: 0,
      }, { onConflict: 'referrer_telegram_id,referee_telegram_id' });
    }
  }

  const { error } = await supabase.from('players').insert(insertData);
  if (error) console.error('Supabase insert player error:', error);
  return insertData;
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const telegramId = String(fromId);
  const username = message.from?.username || message.from?.first_name || `User${fromId}`;
  const text = message.text || '';

  if (text.startsWith('/start')) {
    const referralCode = text.split(' ')[1] || null;
    let player = await getPlayer(telegramId);
    if (!player) player = await registerNewPlayer(telegramId, username, referralCode);

    const playerCode = player.referral_code || generateReferralCode(telegramId);
    const welcomeMsg = player.referred_by
      ? `🎉 <b>Welcome to MintGrow, @${username}!</b>\n\nYou joined via referral and got <b>100 MG bonus!</b>\n\n💎 Merge crypto coins, earn MG tokens on BNB Chain!`
      : `👋 <b>Welcome to MintGrow!</b>\n\nMerge crypto coins → earn real <b>MG tokens</b> on BNB Chain!\n\n🔑 Your code: <code>${playerCode}</code>\nShare for 500 MG per friend!`;

    await sendMessage(chatId, welcomeMsg, {
      reply_markup: {
        inline_keyboard: [
          MINI_APP_URL
            ? [{ text: '🎮 Play MintGrow', web_app: { url: MINI_APP_URL } }]
            : [{ text: '⚠️ Mini App URL missing', callback_data: 'missing_mini_app_url' }],
          [
            { text: '📊 Balance', callback_data: 'balance' },
            { text: '👥 Referrals', callback_data: 'referrals' },
          ],
        ],
      },
    });
    return;
  }

  if (text === '/balance' || text === '/wallet') {
    const player = await getPlayer(telegramId);
    if (!player) {
      await sendMessage(chatId, '❌ Not found. Send /start to register.');
      return;
    }
    const total = Number.parseFloat(player.total_tokens ?? '0');
    const pending = Number.parseFloat(player.pending_tokens ?? '0');
    const withdrawn = Number.parseFloat(player.withdrawn_tokens ?? '0');
    await sendMessage(
      chatId,
      `💰 <b>Balance — @${username}</b>\n\n🟢 Total: <b>${total.toLocaleString()} MG</b>\n⏳ Pending: <b>${pending.toLocaleString()}</b>\n✅ Withdrawn: <b>${withdrawn.toLocaleString()}</b>\n\nMin withdrawal: <b>250,000 MG</b>`,
      { reply_markup: miniAppKeyboard('🎮 Open Game') }
    );
    return;
  }

  if (text === '/referral' || text === '/invite') {
    const player = await getPlayer(telegramId);
    if (!player) {
      await sendMessage(chatId, '❌ Not found. Send /start to register.');
      return;
    }
    const code = player.referral_code;
    await sendMessage(
      chatId,
      `👥 <b>Referrals</b>\n\nCode: <code>${code}</code>\nDirect: <b>${player.direct_referral_count ?? 0}</b>\nEarnings: <b>${Number.parseFloat(player.referral_tokens_earned ?? '0').toLocaleString()} MG</b>\n\nLink: https://t.me/${BOT_USERNAME}?start=${code}`
    );
    return;
  }

  if (text === '/help') {
    await sendMessage(
      chatId,
      '🤖 <b>MintGrow Commands</b>\n\n/start — Register & launch\n/balance — Check MG balance\n/referral — Your referral code\n/help — This menu',
      { reply_markup: miniAppKeyboard('🎮 Play Now') }
    );
  }
}

async function handleWebhook(req, res) {
  let update = {};

  try {
    update = await readJson(req);
  } catch (err) {
    console.error('Invalid webhook JSON:', err);
    return json(res, 400, { ok: false, error: 'Invalid JSON' });
  }

  json(res, 200, { ok: true });

  try {
    console.log('TELEGRAM WEBHOOK RECEIVED:', JSON.stringify(update));

    const callbackQuery = update.callback_query;
    if (callbackQuery) {
      await handleCallback(callbackQuery);
      return;
    }

    const message = update.message || update.edited_message;
    if (message) await handleMessage(message);
  } catch (err) {
    console.error('Webhook error:', err);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });

  if (req.method === 'GET' && url.pathname === '/') {
    return json(res, 200, {
      status: 'ok',
      service: 'MintGrow Telegram Bot',
      timestamp: new Date().toISOString(),
      missingEnv: requireConfig(),
    });
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { status: 'healthy' });
  }

  if (req.method === 'GET' && url.pathname === '/ready') {
    const missingEnv = requireConfig();
    return json(res, missingEnv.length ? 500 : 200, {
      status: missingEnv.length ? 'misconfigured' : 'ready',
      missingEnv,
    });
  }

  if (req.method === 'GET' && url.pathname === '/debug') {
    const missingEnv = requireConfig();
    let bot = null;
    let webhook = null;

    if (BOT_TOKEN) {
      bot = await telegram('getMe', {});
      webhook = await telegram('getWebhookInfo', {});
    }

    return json(res, missingEnv.length ? 500 : 200, {
      status: missingEnv.length ? 'misconfigured' : 'ok',
      missingEnv,
      miniAppUrlConfigured: Boolean(getMiniAppUrl(req)),
      bot,
      webhook,
    });
  }

  if (req.method === 'GET' && url.pathname === '/setup-webhook') {
    const missingEnv = requireConfig({ includeMiniApp: false });
    if (missingEnv.length) return json(res, 500, { ok: false, missingEnv });

    const webhookUrl = `https://${req.headers.host}/webhook`;
    const telegramResponse = await telegram('setWebhook', {
      url: webhookUrl,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
      drop_pending_updates: true,
    });

    await telegram('setMyCommands', {
      commands: [
        { command: 'start', description: 'Launch MintGrow game' },
        { command: 'balance', description: 'Check MG token balance' },
        { command: 'referral', description: 'Your referral code and stats' },
        { command: 'help', description: 'Show all commands' },
      ],
    });

    return json(res, 200, { webhookUrl, telegramResponse });
  }

  if (req.method === 'POST' && url.pathname === '/webhook') {
    return handleWebhook(req, res);
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`MintGrow Bot server running on port ${PORT}`);
  console.log(`Mini App URL: ${MINI_APP_URL || '(missing)'}`);
});
