import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile, WithdrawalRequest } from '@/types/game';

const KEYS = {
  PROFILE: 'mintgrow_profile',
  WITHDRAWALS: 'mintgrow_withdrawals',
  BEST_SCORE: 'mintgrow_best_score',
  ADS_WATCHED: 'mintgrow_ads',
};

export const getProfile = async (): Promise<PlayerProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const saveProfile = async (profile: PlayerProfile): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  } catch {}
};

export const createDefaultProfile = (telegramId: string, username: string): PlayerProfile => ({
  telegramId,
  username,
  totalTokens: 0,
  pendingTokens: 0,
  withdrawnTokens: 0,
  walletAddress: '',
  level: 1,
  gamesPlayed: 0,
  bestScore: 0,
  adsWatched: 0,
});

export const updateProfileTokens = async (tokens: number, score: number): Promise<PlayerProfile | null> => {
  const profile = await getProfile();
  if (!profile) return null;
  profile.totalTokens = Math.round((profile.totalTokens + tokens) * 100) / 100;
  if (score > profile.bestScore) profile.bestScore = score;
  await saveProfile(profile);
  return profile;
};

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

export const incrementAdsWatched = async (): Promise<void> => {
  const profile = await getProfile();
  if (!profile) return;
  profile.adsWatched += 1;
  await saveProfile(profile);
};
