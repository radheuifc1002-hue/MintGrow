import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile, ReferralEntry } from '@/types/game';
import { verifiedApi } from '@/services/verifiedApi';

const PROFILE_TTL_MS = 5000;
const REFERRAL_TTL_MS = 10000;
const profileCache = new Map<string, { expiresAt: number; profile: PlayerProfile }>();
const referralCache = new Map<string, { expiresAt: number; referrals: ReferralEntry[] }>();
const now = () => Date.now();
const invalidateProfile = (telegramId: string) => profileCache.delete(telegramId);

const mapPlayer = (data: any): PlayerProfile => ({
  telegramId: data.telegram_id,
  username: data.username,
  referralCode: data.referral_code,
  referredBy: data.referred_by ?? undefined,
  referralCount: Number(data.direct_referral_count ?? 0),
  referralTokensEarned: Number(data.referral_tokens_earned ?? 0),
  totalTokens: Number(data.total_tokens ?? 0),
  pendingTokens: Number(data.pending_tokens ?? 0),
  withdrawnTokens: Number(data.withdrawn_tokens ?? 0),
  walletAddress: data.wallet_address ?? '',
  level: Number(data.level ?? 1),
  gamesPlayed: Number(data.games_played ?? 0),
  bestScore: Number(data.best_score ?? 0),
  adsWatched: Number(data.ads_watched ?? 0),
  lastLoginDate: data.last_login_date ?? undefined,
  loginStreak: Number(data.login_streak ?? 0),
  powerUps: data.power_ups ?? { undo: 0, destroy: 0, clear_blockers: 0, shuffle: 0 },
  isRegistered: Boolean(data.is_registered),
});

export const getCachedPlayer = async (telegramId: string, forceRefresh = false): Promise<PlayerProfile | null> => {
  const cached = profileCache.get(telegramId);
  if (!forceRefresh && cached && cached.expiresAt > now()) return cached.profile;
  try {
    const data = await verifiedApi<any>('get_player', { telegramId });
    if (!data) return null;
    const profile = mapPlayer(data);
    profileCache.set(telegramId, { expiresAt: now() + PROFILE_TTL_MS, profile });
    await AsyncStorage.setItem('mintgrow_profile_v3', JSON.stringify(profile));
    return profile;
  } catch {
    return cached?.profile ?? null;
  }
};

export const ensurePlayerInDatabase = async (telegramId: string, username: string, avatarUrl?: string): Promise<PlayerProfile | null> => {
  try {
    const data = await verifiedApi<any>('ensure_player', { telegramId, username, avatarUrl });
    const profile = data ? mapPlayer(data) : null;
    if (profile) {
      invalidateProfile(telegramId);
      profileCache.set(telegramId, { expiresAt: now() + PROFILE_TTL_MS, profile });
      await AsyncStorage.setItem('mintgrow_profile_v3', JSON.stringify(profile));
    }
    return profile;
  } catch {
    return getCachedPlayer(telegramId, true);
  }
};

export const completeRegistrationInDatabase = async (telegramId: string, username: string): Promise<PlayerProfile | null> => {
  try {
    const data = await verifiedApi<any>('complete_registration', { telegramId, username });
    if (!data) return null;
    const profile = mapPlayer(data);
    invalidateProfile(telegramId);
    profileCache.set(telegramId, { expiresAt: now() + PROFILE_TTL_MS, profile });
    await AsyncStorage.setItem('mintgrow_profile_v3', JSON.stringify(profile));
    return profile;
  } catch { return null; }
};

export const ensureReferralCodeInDatabase = async (telegramId: string): Promise<string | null> => {
  try {
    const data = await verifiedApi<string>('ensure_referral_code', { telegramId });
    invalidateProfile(telegramId);
    return typeof data === 'string' ? data : null;
  } catch { return null; }
};

export const creditPlayerTokens = async (telegramId: string, amount: number, bestScore: number, level: number): Promise<PlayerProfile | null> => {
  if (amount <= 0) return getCachedPlayer(telegramId);
  try {
    await verifiedApi('credit_player_tokens', { telegramId, amount, bestScore, level });
    invalidateProfile(telegramId);
    return getCachedPlayer(telegramId, true);
  } catch { return null; }
};

export const recordAdEventInDatabase = async ({ telegramId, clientEventId, placement, watched, rewardTokens = 0, error = null }: {
  telegramId: string; clientEventId: string; placement: string; watched: boolean; rewardTokens?: number; error?: string | null;
}): Promise<boolean> => {
  try {
    await verifiedApi('record_ad_event', { telegramId, clientEventId, placement, watched, rewardTokens, error });
    invalidateProfile(telegramId);
    return true;
  } catch { return false; }
};

export const recordGameSessionInDatabase = async ({ telegramId, clientSessionId, score, moves, level, tokensEarned, maxTile = 2, board = null, startedAt }: {
  telegramId: string; clientSessionId: string; score: number; moves: number; level: number; tokensEarned: number; maxTile?: number; board?: unknown; startedAt?: string;
}): Promise<boolean> => {
  try {
    await verifiedApi('record_game_session', { telegramId, clientSessionId, score, moves, level, tokensEarned, maxTile, board, startedAt });
    invalidateProfile(telegramId);
    return true;
  } catch { return false; }
};

export const applyReferralCodeInDatabase = async (refereeTelegramId: string, code: string): Promise<{ ok: boolean; reason?: string; welcome_bonus?: number; referrer_bonus?: number }> => {
  try {
    const data = await verifiedApi<any>('apply_referral_code', { telegramId: refereeTelegramId, code: code.trim().toUpperCase() });
    if (data?.ok) {
      invalidateProfile(refereeTelegramId);
      referralCache.delete(refereeTelegramId);
      await getCachedPlayer(refereeTelegramId, true);
    }
    return data ?? { ok: false, reason: 'database_error' };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'database_error' }; }
};

export const getReferralsCached = async (referrerTelegramId: string, forceRefresh = false): Promise<ReferralEntry[]> => {
  const cached = referralCache.get(referrerTelegramId);
  if (!forceRefresh && cached && cached.expiresAt > now()) return cached.referrals;
  try {
    const data = await verifiedApi<any[]>('get_referrals', { telegramId: referrerTelegramId });
    const referrals: ReferralEntry[] = (data ?? []).map((row: any) => ({
      code: row.referrer_telegram_id,
      username: row.players?.username ?? 'Unknown',
      joinedAt: String(row.created_at),
      tokensEarned: Number(row.tokens_earned ?? 0),
      level: Number(row.level ?? 1),
      refereeBalance: Number(row.players?.total_tokens ?? 0),
    }));
    referralCache.set(referrerTelegramId, { expiresAt: now() + REFERRAL_TTL_MS, referrals });
    return referrals;
  } catch { return cached?.referrals ?? []; }
};
