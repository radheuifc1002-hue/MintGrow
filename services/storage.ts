import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile, WithdrawalRequest, PowerUpType, DEFAULT_POWER_UPS, ReferralEntry } from '@/types/game';

const KEYS = {
  PROFILE: 'mintgrow_profile_v2',
  WITHDRAWALS: 'mintgrow_withdrawals_v2',
  DAILY_BONUS: 'mintgrow_daily_bonus',
  SAVED_BOARD: 'mintgrow_saved_board',
  REFERRALS: 'mintgrow_referrals',
};

// ─── Profile ────────────────────────────────────────────────────
export const getProfile = async (): Promise<PlayerProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PROFILE);
    if (!raw) return null;
    const p: PlayerProfile = JSON.parse(raw);
    // Migrate old profiles to new fields
    if (!p.powerUps) p.powerUps = { ...DEFAULT_POWER_UPS };
    if (!p.referralCode) p.referralCode = generateReferralCode(p.telegramId);
    if (p.loginStreak === undefined) p.loginStreak = 0;
    if (p.referralCount === undefined) p.referralCount = 0;
    if (p.referralTokensEarned === undefined) p.referralTokensEarned = 0;
    return p;
  } catch { return null; }
};

export const saveProfile = async (profile: PlayerProfile): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  } catch {}
};

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

// ─── Power-Ups ──────────────────────────────────────────────────
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

// ─── Daily Bonus ────────────────────────────────────────────────
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

  if (state.lastClaimDate === today) return null; // Already claimed

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isConsecutive = state.lastClaimDate === yesterday.toDateString();
  const newStreak = isConsecutive ? Math.min(state.streak + 1, 7) : 1;

  // Token reward: day1=50, day2=100, day3=150, day4=200, day5=250, day6=350, day7=500
  const streakRewards = [50, 100, 150, 200, 250, 350, 500];
  const tokens = streakRewards[Math.min(newStreak - 1, 6)];

  const newState: DailyBonusState = { lastClaimDate: today, streak: newStreak };
  await AsyncStorage.setItem(KEYS.DAILY_BONUS, JSON.stringify(newState));

  // Credit tokens
  const profile = await getProfile();
  if (profile) {
    profile.totalTokens = Math.round((profile.totalTokens + tokens) * 100) / 100;
    profile.loginStreak = newStreak;
    profile.lastLoginDate = today;
    await saveProfile(profile);
  }

  return { tokens, streak: newStreak };
};

// ─── Saved Board (Continue after Game Over) ─────────────────────
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

// ─── Withdrawals ────────────────────────────────────────────────
export const getWithdrawals = async (): Promise<WithdrawalRequest[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WITHDRAWALS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveWithdrawal = async (req: WithdrawalRequest): Promise<void> => {
  try {
    const list = await getWithdrawals();
    list.unshift(req);
    await AsyncStorage.setItem(KEYS.WITHDRAWALS, JSON.stringify(list));
  } catch {}
};

export const updateWithdrawal = async (id: string, updates: Partial<WithdrawalRequest>): Promise<void> => {
  try {
    const list = await getWithdrawals();
    const idx = list.findIndex(w => w.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates };
      await AsyncStorage.setItem(KEYS.WITHDRAWALS, JSON.stringify(list));
    }
  } catch {}
};

// ─── Referrals ──────────────────────────────────────────────────
export const getReferrals = async (): Promise<ReferralEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.REFERRALS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const addReferral = async (entry: ReferralEntry): Promise<void> => {
  try {
    const list = await getReferrals();
    list.unshift(entry);
    await AsyncStorage.setItem(KEYS.REFERRALS, JSON.stringify(list));
  } catch {}
};

export const applyReferralCode = async (code: string): Promise<boolean> => {
  const profile = await getProfile();
  if (!profile || profile.referredBy) return false; // already referred
  if (code.trim().toUpperCase() === profile.referralCode.toUpperCase()) return false; // can't refer self

  profile.referredBy = code.trim().toUpperCase();
  profile.totalTokens = Math.round((profile.totalTokens + 100) * 100) / 100; // 100 MG welcome bonus for new user
  await saveProfile(profile);
  return true;
};

export const creditReferralEarning = async (earnedTokens: number): Promise<void> => {
  // This would credit the referrer via Supabase in production
  // Locally, we track for display
};
