import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile, WithdrawalRequest, PowerUpType, DEFAULT_POWER_UPS, ReferralEntry } from '@/types/game';
import { supabase } from '@/services/supabase';

const KEYS = {
  PROFILE: 'mintgrow_profile_v3',
  DAILY_BONUS: 'mintgrow_daily_bonus',
  SAVED_BOARD: 'mintgrow_saved_board',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export const generateReferralCode = (telegramId: string): string => {
  const base = telegramId.replace(/\D/g, '').slice(-4) || '0000';
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MG${base}${suffix}`;
};

export const createDefaultProfile = (telegramId: string, username: string): PlayerProfile => ({
  telegramId,
  username,
  referralCode: generateReferralCode(telegramId),
  referredBy: undefined,
  referralCount: 0,
  referralTokensEarned: 0,
  totalTokens: 0,
  pendingTokens: 0,
  withdrawnTokens: 0,
  walletAddress: '',
  level: 1,
  gamesPlayed: 0,
  bestScore: 0,
  adsWatched: 0,
  lastLoginDate: undefined,
  loginStreak: 0,
  powerUps: { ...DEFAULT_POWER_UPS },
});

const mapRowToProfile = (row: any): PlayerProfile => ({
  telegramId: row.telegram_id,
  username: row.username,
  referralCode: row.referral_code,
  referredBy: row.referred_by ?? undefined,
  referralCount: row.direct_referral_count ?? 0,
  referralTokensEarned: parseFloat(row.referral_tokens_earned ?? '0'),
  totalTokens: parseFloat(row.total_tokens ?? '0'),
  pendingTokens: parseFloat(row.pending_tokens ?? '0'),
  withdrawnTokens: parseFloat(row.withdrawn_tokens ?? '0'),
  walletAddress: row.wallet_address ?? '',
  level: row.level ?? 1,
  gamesPlayed: row.games_played ?? 0,
  bestScore: row.best_score ?? 0,
  adsWatched: row.ads_watched ?? 0,
  lastLoginDate: row.last_login_date ?? undefined,
  loginStreak: row.login_streak ?? 0,
  powerUps: row.power_ups ?? { ...DEFAULT_POWER_UPS },
});

const profileToRow = (p: PlayerProfile) => ({
  telegram_id: p.telegramId,
  username: p.username,
  referral_code: p.referralCode,
  referred_by: p.referredBy ?? null,
  direct_referral_count: p.referralCount,
  referral_tokens_earned: p.referralTokensEarned,
  total_tokens: p.totalTokens,
  pending_tokens: p.pendingTokens,
  withdrawn_tokens: p.withdrawnTokens,
  wallet_address: p.walletAddress,
  level: p.level,
  games_played: p.gamesPlayed,
  best_score: p.bestScore,
  ads_watched: p.adsWatched,
  last_login_date: p.lastLoginDate ?? null,
  login_streak: p.loginStreak,
  power_ups: p.powerUps,
});

// ─── Profile (Supabase + Local fallback) ────────────────────────────────────

export const getProfile = async (): Promise<PlayerProfile | null> => {
  try {
    // Try local first for speed
    const raw = await AsyncStorage.getItem(KEYS.PROFILE);
    if (raw) {
      const p: PlayerProfile = JSON.parse(raw);
      if (!p.powerUps) p.powerUps = { ...DEFAULT_POWER_UPS };
      if (!p.referralCode) p.referralCode = generateReferralCode(p.telegramId);
      if (p.loginStreak === undefined) p.loginStreak = 0;
      if (p.referralCount === undefined) p.referralCount = 0;
      if (p.referralTokensEarned === undefined) p.referralTokensEarned = 0;
      // Sync from Supabase in background
      syncProfileFromSupabase(p.telegramId).catch(() => {});
      return p;
    }
    return null;
  } catch { return null; }
};

export const syncProfileFromSupabase = async (telegramId: string): Promise<PlayerProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    if (error || !data) return null;
    const p = mapRowToProfile(data);
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(p));
    return p;
  } catch { return null; }
};

export const saveProfile = async (profile: PlayerProfile): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
    // Upsert to Supabase
    const row = profileToRow(profile);
    await supabase.from('players').upsert(row, { onConflict: 'telegram_id' });
  } catch {}
};

export const initOrLoadProfile = async (telegramId: string, username: string, avatarUrl?: string): Promise<PlayerProfile> => {
  // Check Supabase first
  try {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    if (data) {
      const p = mapRowToProfile(data);
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(p));
      return p;
    }
  } catch {}

  // Create new
  const p = createDefaultProfile(telegramId, username);
  await saveProfile(p);
  return p;
};

export const updateProfileTokens = async (tokens: number, score: number): Promise<PlayerProfile | null> => {
  const profile = await getProfile();
  if (!profile) return null;
  profile.totalTokens = Math.round((profile.totalTokens + tokens) * 100) / 100;
  if (score > profile.bestScore) profile.bestScore = score;
  await saveProfile(profile);
  return profile;
};

export const incrementAdsWatched = async (): Promise<void> => {
  const profile = await getProfile();
  if (!profile) return;
  profile.adsWatched += 1;
  await saveProfile(profile);
};

// ─── Power-Ups ──────────────────────────────────────────────────────────────

export const addPowerUp = async (type: PowerUpType): Promise<PlayerProfile | null> => {
  const p = await getProfile();
  if (!p) return null;
  if (!p.powerUps) p.powerUps = { ...DEFAULT_POWER_UPS };
  p.powerUps[type] = (p.powerUps[type] || 0) + 1;
  await saveProfile(p);
  return p;
};

export const usePowerUp = async (type: PowerUpType): Promise<PlayerProfile | null> => {
  const p = await getProfile();
  if (!p || !p.powerUps || (p.powerUps[type] || 0) <= 0) return null;
  p.powerUps[type] = Math.max(0, (p.powerUps[type] || 0) - 1);
  await saveProfile(p);
  return p;
};

export const spendTokensForPowerUp = async (type: PowerUpType, cost: number): Promise<PlayerProfile | null> => {
  const p = await getProfile();
  if (!p || p.totalTokens < cost) return null;
  p.totalTokens = Math.round((p.totalTokens - cost) * 100) / 100;
  if (!p.powerUps) p.powerUps = { ...DEFAULT_POWER_UPS };
  p.powerUps[type] = (p.powerUps[type] || 0) + 1;
  await saveProfile(p);
  return p;
};

// ─── Daily Bonus ─────────────────────────────────────────────────────────────

export interface DailyBonusState {
  lastClaimDate: string | null;
  streak: number;
}

export const getDailyBonusState = async (): Promise<DailyBonusState> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_BONUS);
    if (!raw) return { lastClaimDate: null, streak: 0 };
    return JSON.parse(raw);
  } catch { return { lastClaimDate: null, streak: 0 }; }
};

export const claimDailyBonus = async (): Promise<{ tokens: number; streak: number } | null> => {
  const state = await getDailyBonusState();
  const today = new Date().toDateString();
  if (state.lastClaimDate === today) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isConsecutive = state.lastClaimDate === yesterday.toDateString();
  const newStreak = isConsecutive ? Math.min(state.streak + 1, 7) : 1;
  const streakRewards = [50, 100, 150, 200, 250, 350, 500];
  const tokens = streakRewards[Math.min(newStreak - 1, 6)];

  await AsyncStorage.setItem(KEYS.DAILY_BONUS, JSON.stringify({ lastClaimDate: today, streak: newStreak }));

  const profile = await getProfile();
  if (profile) {
    profile.totalTokens = Math.round((profile.totalTokens + tokens) * 100) / 100;
    profile.loginStreak = newStreak;
    profile.lastLoginDate = today;
    await saveProfile(profile);
  }

  return { tokens, streak: newStreak };
};

// ─── Saved Board ─────────────────────────────────────────────────────────────

export const getSavedBoard = async (): Promise<any | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SAVED_BOARD);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const saveBoardState = async (state: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.SAVED_BOARD, JSON.stringify(state));
  } catch {}
};

export const clearSavedBoard = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEYS.SAVED_BOARD);
  } catch {}
};

// ─── Withdrawals (Supabase) ──────────────────────────────────────────────────

export const getWithdrawals = async (telegramId?: string): Promise<WithdrawalRequest[]> => {
  try {
    let query = supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
    if (telegramId) query = query.eq('telegram_id', telegramId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(r => ({
      id: r.id,
      telegramId: r.telegram_id,
      username: r.username,
      amount: parseFloat(r.amount),
      walletAddress: r.wallet_address,
      network: r.network,
      status: r.status,
      createdAt: r.created_at,
      processedAt: r.processed_at ?? undefined,
      txHash: r.tx_hash ?? undefined,
    }));
  } catch { return []; }
};

export const saveWithdrawal = async (req: WithdrawalRequest): Promise<void> => {
  try {
    await supabase.from('withdrawals').insert({
      id: req.id,
      telegram_id: req.telegramId,
      username: req.username,
      amount: req.amount,
      wallet_address: req.walletAddress,
      network: req.network,
      status: req.status,
      created_at: req.createdAt,
    });
  } catch {}
};

export const updateWithdrawal = async (id: string, updates: Partial<WithdrawalRequest>): Promise<void> => {
  try {
    const row: any = {};
    if (updates.status)      row.status = updates.status;
    if (updates.txHash)      row.tx_hash = updates.txHash;
    if (updates.processedAt) row.processed_at = updates.processedAt;
    await supabase.from('withdrawals').update(row).eq('id', id);
  } catch {}
};

// ─── Referrals (Supabase) ─────────────────────────────────────────────────────

export const getReferrals = async (referrerTelegramId?: string): Promise<ReferralEntry[]> => {
  try {
    const telegramId = referrerTelegramId || (await getProfile())?.telegramId;
    if (!telegramId) return [];
    const { data, error } = await supabase
      .from('referrals')
      .select('*, players!referrals_referee_telegram_id_fkey(username, total_tokens)')
      .eq('referrer_telegram_id', telegramId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(r => ({
      code: referrerTelegramId ?? telegramId,
      username: r.players?.username ?? 'Unknown',
      joinedAt: r.created_at,
      tokensEarned: parseFloat(r.tokens_earned ?? '0'),
      level: r.level,
      refereeBalance: parseFloat(r.players?.total_tokens ?? '0'),
    }));
  } catch { return []; }
};

export const addReferral = async (entry: ReferralEntry): Promise<void> => {
  // Used for demo/simulation only — real referrals go via applyReferralCode
};

export const applyReferralCode = async (code: string): Promise<boolean> => {
  const profile = await getProfile();
  if (!profile || profile.referredBy) return false;
  if (code.trim().toUpperCase() === profile.referralCode.toUpperCase()) return false;

  // Find the referrer
  const { data: referrer, error } = await supabase
    .from('players')
    .select('telegram_id, direct_referral_count')
    .eq('referral_code', code.trim().toUpperCase())
    .single();

  if (error || !referrer) return false;

  // Award welcome bonus to new user
  profile.referredBy = code.trim().toUpperCase();
  profile.totalTokens = Math.round((profile.totalTokens + 100) * 100) / 100;
  await saveProfile(profile);

  // Create referral relationship (level 1)
  await supabase.from('referrals').upsert({
    referrer_telegram_id: referrer.telegram_id,
    referee_telegram_id: profile.telegramId,
    level: 1,
    tokens_earned: 0,
  }, { onConflict: 'referrer_telegram_id,referee_telegram_id' });

  // Increment referrer's direct count + award 500 MG signup bonus
  await supabase.from('players').update({
    direct_referral_count: (referrer.direct_referral_count ?? 0) + 1,
    total_tokens: supabase.rpc as any,  // handled below
  }).eq('telegram_id', referrer.telegram_id);

  // Atomic increment via RPC or just fetch+update
  const { data: rRow } = await supabase
    .from('players')
    .select('total_tokens, direct_referral_count')
    .eq('telegram_id', referrer.telegram_id)
    .single();
  if (rRow) {
    await supabase.from('players').update({
      total_tokens: parseFloat(rRow.total_tokens) + 500,
      direct_referral_count: (rRow.direct_referral_count ?? 0) + 1,
    }).eq('telegram_id', referrer.telegram_id);
  }

  return true;
};

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  telegramId: string;
  username: string;
  totalTokens: number;
  level: number;
  bestScore: number;
}

export const getLeaderboard = async (limit = 50): Promise<LeaderboardEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('telegram_id, username, total_tokens, level, best_score')
      .order('total_tokens', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row, i) => ({
      rank: i + 1,
      telegramId: row.telegram_id,
      username: row.username,
      totalTokens: parseFloat(row.total_tokens ?? '0'),
      level: row.level ?? 1,
      bestScore: row.best_score ?? 0,
    }));
  } catch { return []; }
};

export const getPlayerRank = async (telegramId: string): Promise<number | null> => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('telegram_id, total_tokens')
      .order('total_tokens', { ascending: false });
    if (error || !data) return null;
    const idx = data.findIndex(r => r.telegram_id === telegramId);
    return idx >= 0 ? idx + 1 : null;
  } catch { return null; }
};

// ─── Withdrawal real-time subscription ───────────────────────────────────────

export const subscribeWithdrawalUpdates = (
  telegramId: string,
  onUpdate: (withdrawal: WithdrawalRequest) => void
) => {
  const channel = supabase
    .channel(`withdrawals:${telegramId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'withdrawals',
        filter: `telegram_id=eq.${telegramId}`,
      },
      (payload) => {
        const r = payload.new;
        onUpdate({
          id: r.id,
          telegramId: r.telegram_id,
          username: r.username,
          amount: parseFloat(r.amount),
          walletAddress: r.wallet_address,
          network: r.network,
          status: r.status,
          createdAt: r.created_at,
          processedAt: r.processed_at ?? undefined,
          txHash: r.tx_hash ?? undefined,
        });
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};
