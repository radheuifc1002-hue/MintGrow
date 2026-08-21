/** Secure player/referral database helpers. All mutations go through mintgrow-api. */
import { ReferralEntry } from '@/types/game';
import { verifiedApi } from '@/services/verifiedApi';

const referralCache: Map<string, { data: ReferralEntry[]; ts: number }> = new Map();
const CACHE_TTL_MS = 60_000;

export async function getReferralsCached(telegramId: string, forceRefresh = false): Promise<ReferralEntry[]> {
  const cached = referralCache.get(telegramId);
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  try {
    const data = await verifiedApi<any[]>('get_referrals', { telegramId });
    const entries = (data ?? []).map((row: any) => ({ code: row.referee_telegram_id ?? '', username: row.players?.username ?? row.referee_telegram_id ?? 'Unknown', joinedAt: row.created_at ?? new Date().toISOString(), tokensEarned: Number(row.tokens_earned ?? 0), level: Number(row.level ?? 1), refereeBalance: Number(row.players?.total_tokens ?? 0) }));
    referralCache.set(telegramId, { data: entries, ts: Date.now() }); return entries;
  } catch { return cached?.data ?? []; }
}

export interface ApplyReferralResult { ok: boolean; reason?: string; }
export async function applyReferralCodeInDatabase(_telegramId: string, code: string): Promise<ApplyReferralResult> {
  try { const result = await verifiedApi<any>('apply_referral_code', { code: code.trim().toUpperCase() }); referralCache.clear(); return result ?? { ok: false, reason: 'db_error' }; }
  catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'db_error' }; }
}
