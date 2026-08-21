import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(key: ArrayBuffer | CryptoKey, data: string): Promise<ArrayBuffer> { const cryptoKey = key instanceof CryptoKey ? key : await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)); }
async function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData); const suppliedHash = params.get('hash');
  if (!initData || !botToken || !suppliedHash) throw new Error('telegram_identity_unavailable'); params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData').buffer, botToken); if (hex(await hmac(secret, check)) !== suppliedHash) throw new Error('telegram_signature_invalid');
  const authDate = Number(params.get('auth_date') ?? 0); if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > 86400) throw new Error('telegram_init_data_expired');
  const raw = params.get('user'); if (!raw) throw new Error('telegram_user_missing'); const user = JSON.parse(raw) as { id?: number; username?: string; first_name?: string; photo_url?: string }; if (!user.id) throw new Error('telegram_user_missing'); return user;
}
const ACTIONS = new Set(['get_player','ensure_player','ensure_referral_code','complete_registration','update_profile_metadata','credit_player_tokens','record_ad_event','record_game_session','apply_referral_code','submit_withdrawal_request','get_referrals','get_withdrawals','get_leaderboard','get_player_rank','claim_daily_bonus','spend_tokens_for_powerup','grant_powerup','consume_powerup']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders }); if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const body = await req.json(); const action = String(body?.action ?? ''); if (!ACTIONS.has(action)) return json({ error: 'unsupported_action' }, 400);
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN'); const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const supabaseUrl = Deno.env.get('SUPABASE_URL'); if (!botToken || !serviceRole || !supabaseUrl) return json({ error: 'server_not_configured' }, 500);
    const telegramUser = await verifyTelegramInitData(String(body?.initData ?? ''), botToken); const telegramId = String(telegramUser.id); const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } }); const p = body?.params ?? {};
    if (String(p.telegramId ?? p.p_telegram_id ?? telegramId) !== telegramId) return json({ error: 'telegram_identity_mismatch' }, 403);
    if (action === 'get_player') { const { data, error } = await db.from('players').select('*').eq('telegram_id', telegramId).maybeSingle(); if (error) return json({ error: error.message }, 400); return json({ data, telegramId }); }
    if (action === 'get_referrals') { const { data, error } = await db.from('referrals').select('referrer_telegram_id,referee_telegram_id,level,tokens_earned,created_at,players!referrals_referee_telegram_id_fkey(username,total_tokens)').eq('referrer_telegram_id', telegramId).order('created_at', { ascending: false }).limit(100); if (error) return json({ error: error.message }, 400); return json({ data: data ?? [], telegramId }); }
    if (action === 'get_withdrawals') { const { data, error } = await db.from('withdrawals').select('*').eq('telegram_id', telegramId).order('created_at', { ascending: false }).limit(50); if (error) return json({ error: error.message }, 400); return json({ data: data ?? [], telegramId }); }
    if (action === 'get_leaderboard') { const limit = Math.min(Math.max(Number(p.limit ?? 50), 1), 100); const { data, error } = await db.from('players').select('telegram_id,username,total_tokens,level,best_score').order('total_tokens', { ascending: false }).order('best_score', { ascending: false }).limit(limit); if (error) return json({ error: error.message }, 400); return json({ data: data ?? [], telegramId }); }
    if (action === 'get_player_rank') { const { data: player, error: pe } = await db.from('players').select('total_tokens').eq('telegram_id', telegramId).maybeSingle(); if (pe) return json({ error: pe.message }, 400); if (!player) return json({ data: null, telegramId }); const { count, error } = await db.from('players').select('telegram_id', { count: 'exact', head: true }).gt('total_tokens', player.total_tokens ?? 0); if (error) return json({ error: error.message }, 400); return json({ data: (count ?? 0) + 1, telegramId }); }
    let rpc = action; let args: Record<string, unknown> = {};
    switch (action) {
      case 'ensure_player': rpc='ensure_player'; args={ p_telegram_id:telegramId,p_username:p.username ?? telegramUser.username ?? telegramUser.first_name ?? `User${telegramId}`,p_avatar_url:p.avatarUrl ?? telegramUser.photo_url ?? null }; break;
      case 'ensure_referral_code': args={p_telegram_id:telegramId}; break;
      case 'complete_registration': rpc='complete_player_registration'; args={p_telegram_id:telegramId,p_username:p.username ?? telegramUser.username ?? telegramUser.first_name ?? `User${telegramId}`}; break;
      case 'update_profile_metadata': rpc='update_player_metadata'; args={p_telegram_id:telegramId,p_username:p.username ?? null,p_avatar_url:p.avatarUrl ?? null,p_wallet_address:p.walletAddress ?? null,p_best_score:p.bestScore ?? null,p_level:p.level ?? null,p_last_login_date:p.lastLoginDate ?? null,p_login_streak:p.loginStreak ?? null,p_power_ups:null}; break;
      case 'credit_player_tokens': args={p_telegram_id:telegramId,p_amount:p.amount,p_best_score:p.bestScore ?? null,p_level:p.level ?? null}; break;
      case 'record_ad_event': args={p_telegram_id:telegramId,p_client_event_id:p.clientEventId,p_placement:p.placement,p_watched:p.watched,p_reward_tokens:p.rewardTokens ?? 0,p_error:p.error ?? null}; break;
      case 'record_game_session': args={p_telegram_id:telegramId,p_client_session_id:p.clientSessionId,p_score:p.score,p_moves:p.moves,p_level:p.level,p_tokens_earned:p.tokensEarned,p_max_tile:p.maxTile ?? 2,p_board:p.board ?? null,p_started_at:p.startedAt ?? new Date().toISOString(),p_ended_at:new Date().toISOString()}; break;
      case 'apply_referral_code': args={p_referee_telegram_id:telegramId,p_code:String(p.code ?? '').trim().toUpperCase()}; break;
      case 'submit_withdrawal_request': args={p_id:p.id,p_telegram_id:telegramId,p_username:p.username ?? telegramUser.username ?? telegramUser.first_name ?? `User${telegramId}`,p_amount:p.amount,p_wallet_address:p.walletAddress,p_network:p.network ?? 'BNB Chain (BEP-20)'}; break;
      case 'claim_daily_bonus': args={p_telegram_id:telegramId}; break;
      case 'spend_tokens_for_powerup': args={p_telegram_id:telegramId,p_type:p.type,p_cost:p.cost}; break;
      case 'grant_powerup': args={p_telegram_id:telegramId,p_type:p.type,p_client_event_id:p.clientEventId}; break;
      case 'consume_powerup': args={p_telegram_id:telegramId,p_type:p.type}; break;
    }
    const { data, error } = await db.rpc(rpc,args); if (error) return json({ error:error.message },400); return json({ data, telegramId });
  } catch (error) { return json({ error:error instanceof Error ? error.message : 'request_failed' },400); }
});
