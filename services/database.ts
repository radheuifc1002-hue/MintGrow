/**
 * MintGrow – Supabase database helpers
 * Referral read / write operations used by the Referral screen.
 */

import { supabase } from './supabase';
import { ReferralEntry } from '@/types/game';

// ─── Simple in-memory cache (per session) ───────────────────────────────────
const referralCache: Map<string, { data: ReferralEntry[]; ts: number }> = new Map();
const CACHE_TTL_MS = 60_000; // 60 s

export async function getReferralsCached(
  telegramId: string,
  forceRefresh = false,
): Promise<ReferralEntry[]> {
  const cached = referralCache.get(telegramId);
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const { data, error } = await supabase
    .from('referrals')
    .select(`
      id,
      tokens_earned,
      created_at,
      level,
      referee_telegram_id,
      players!referrals_referee_telegram_id_fkey (
        username,
        total_tokens
      )
    `)
    .eq('referrer_telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('[getReferralsCached] query error:', error.message);
    return cached?.data ?? [];
  }

  const entries: ReferralEntry[] = (data ?? []).map((row: any) => ({
    code: row.referee_telegram_id ?? '',
    username: row.players?.username ?? row.referee_telegram_id ?? 'Unknown',
    joinedAt: row.created_at ?? new Date().toISOString(),
    tokensEarned: Number(row.tokens_earned ?? 0),
    level: Number(row.level ?? 1),
    refereeBalance: Number(row.players?.total_tokens ?? 0),
  }));

  referralCache.set(telegramId, { data: entries, ts: Date.now() });
  return entries;
}

// ─── Apply a referral code ───────────────────────────────────────────────────
export interface ApplyReferralResult {
  ok: boolean;
  reason?: string;
}

export async function applyReferralCodeInDatabase(
  telegramId: string,
  code: string,
): Promise<ApplyReferralResult> {
  // 1. Prevent self-referral
  const { data: self } = await supabase
    .from('players')
    .select('telegram_id, referral_code, referred_by')
    .eq('telegram_id', telegramId)
    .single();

  if (!self) return { ok: false, reason: 'referee_not_found' };
  if (self.referred_by) return { ok: false, reason: 'already_referred' };
  if (self.referral_code === code) return { ok: false, reason: 'self_referral' };

  // 2. Look up the referrer by code
  const { data: referrer } = await supabase
    .from('players')
    .select('telegram_id, referral_code, total_tokens, direct_referral_count, referral_tokens_earned')
    .eq('referral_code', code)
    .single();

  if (!referrer) return { ok: false, reason: 'invalid_code' };

  // 3. Insert the referral row (unique constraint prevents duplicates)
  const { error: insertError } = await supabase.from('referrals').insert({
    referrer_telegram_id: referrer.telegram_id,
    referee_telegram_id: telegramId,
    level: 1,
    tokens_earned: 0,
  });

  if (insertError) {
    if (insertError.code === '23505') return { ok: false, reason: 'already_referred' };
    console.error('[applyReferralCode] insert error:', insertError.message);
    return { ok: false, reason: 'db_error' };
  }

  // 4. Mark the referee as referred
  await supabase
    .from('players')
    .update({ referred_by: code })
    .eq('telegram_id', telegramId);

  // 5. Give both parties the welcome / referral bonus
  await Promise.allSettled([
    supabase
      .from('players')
      .update({
        total_tokens: Number(self.total_tokens ?? 0) + 100,
      })
      .eq('telegram_id', telegramId),

    supabase
      .from('players')
      .update({
        direct_referral_count: Number(referrer.direct_referral_count ?? 0) + 1,
        referral_tokens_earned: Number(referrer.referral_tokens_earned ?? 0) + 500,
        total_tokens: Number(referrer.total_tokens ?? 0) + 500,
      })
      .eq('telegram_id', referrer.telegram_id),
  ]);

  // Invalidate cache so the next fetch is fresh
  referralCache.delete(referrer.telegram_id);

  return { ok: true };
}
