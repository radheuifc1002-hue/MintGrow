import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { PlayerProfile, ReferralEntry } from '@/types/game';

const PROFILE_TTL_MS = 5000;
const REFERRAL_TTL_MS = 10000;

const profileCache = new Map<string, { expiresAt: number; profile: PlayerProfile }>();
const referralCache = new Map<string, { expiresAt: number; referrals: ReferralEntry[] }>();

const now = () => Date.now();

const invalidateProfile = (telegramId: string) => {
  profileCache.delete(telegramId);
};

export const getCachedPlayer = async (
  telegramId: string,
  forceRefresh = false,
): Promise<PlayerProfile | null> => {
  const cached = profileCache.get(telegramId);
  if (!forceRefresh && cached && cached.expiresAt > now()) return cached.profile;

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error || !data) return null;

  const profile: PlayerProfile = {
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
  };

  profileCache.set(telegramId, { expiresAt: now() + PROFILE_TTL_MS, profile });
  await AsyncStorage.setItem('mintgrow_profile_v3', JSON.stringify(profile));
  return profile;
};

export const ensureReferralCodeInDatabase = async (telegramId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('ensure_referral_code', {
    p_telegram_id: telegramId,
  });
  if (error || typeof data !== 'string') return null;
  invalidateProfile(telegramId);
  return data;
};

export const creditPlayerTokens = async (
  telegramId: string,
  amount: number,
  bestScore: number,
  level: number,
): Promise<PlayerProfile | null> => {
  if (amount <= 0) return getCachedPlayer(telegramId);

  const { data, error } = await supabase.rpc('credit_player_tokens', {
    p_telegram_id: telegramId,
    p_amount: amount,
    p_best_score: bestScore,
    p_level: level,
  });

  if (error || !data) return null;

  invalidateProfile(telegramId);
  return getCachedPlayer(telegramId, true);
};

export const recordAdEventInDatabase = async ({
  telegramId,
  clientEventId,
  placement,
  watched,
  rewardTokens = 0,
  error = null,
}: {
  telegramId: string;
  clientEventId: string;
  placement: string;
  watched: boolean;
  rewardTokens?: number;
  error?: string | null;
}): Promise<boolean> => {
  const { error: rpcError } = await supabase.rpc('record_ad_event', {
    p_telegram_id: telegramId,
    p_client_event_id: clientEventId,
    p_placement: placement,
    p_watched: watched,
    p_reward_tokens: rewardTokens,
    p_error: error,
  });

  if (rpcError) return false;
  invalidateProfile(telegramId);
  return true;
};

export const recordGameSessionInDatabase = async ({
  telegramId,
  clientSessionId,
  score,
  moves,
  level,
  tokensEarned,
  maxTile = 2,
  board = null,
  startedAt,
}: {
  telegramId: string;
  clientSessionId: string;
  score: number;
  moves: number;
  level: number;
  tokensEarned: number;
  maxTile?: number;
  board?: unknown;
  startedAt?: string;
}): Promise<boolean> => {
  const { error } = await supabase.rpc('record_game_session', {
    p_telegram_id: telegramId,
    p_client_session_id: clientSessionId,
    p_score: score,
    p_moves: moves,
    p_level: level,
    p_tokens_earned: tokensEarned,
    p_max_tile: maxTile,
    p_board: board,
    p_started_at: startedAt ?? new Date().toISOString(),
    p_ended_at: new Date().toISOString(),
  });

  if (error) return false;
  invalidateProfile(telegramId);
  return true;
};

export const applyReferralCodeInDatabase = async (
  refereeTelegramId: string,
  code: string,
): Promise<{ ok: boolean; reason?: string; welcome_bonus?: number; referrer_bonus?: number }> => {
  const { data, error } = await supabase.rpc('apply_referral_code', {
    p_referee_telegram_id: refereeTelegramId,
    p_code: code.trim().toUpperCase(),
  });

  if (error || !data) return { ok: false, reason: error?.message || 'database_error' };

  if (data.ok) {
    invalidateProfile(refereeTelegramId);
    referralCache.delete(refereeTelegramId);
    await getCachedPlayer(refereeTelegramId, true);
  }

  return data;
};

export const getReferralsCached = async (
  referrerTelegramId: string,
  forceRefresh = false,
): Promise<ReferralEntry[]> => {
  const cached = referralCache.get(referrerTelegramId);
  if (!forceRefresh && cached && cached.expiresAt > now()) return cached.referrals;

  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_telegram_id, referee_telegram_id, level, tokens_earned, created_at, players!referrals_referee_telegram_id_fkey(username, total_tokens)')
    .eq('referrer_telegram_id', referrerTelegramId)
    .order('created_at', { ascending: false });

  if (error || !data) return cached?.referrals ?? [];

  const referrals: ReferralEntry[] = (data as any[]).map((row) => ({
    code: row.referrer_telegram_id,
    username: row.players?.username ?? 'Unknown',
    joinedAt: String(row.created_at),
    tokensEarned: Number(row.tokens_earned ?? 0),
    level: Number(row.level ?? 1),
    refereeBalance: Number(row.players?.total_tokens ?? 0),
  }));

  referralCache.set(referrerTelegramId, { expiresAt: now() + REFERRAL_TTL_MS, referrals });
  return referrals;
};
