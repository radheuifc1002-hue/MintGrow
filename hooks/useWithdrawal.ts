import { useState, useCallback } from 'react';
import {
  getWithdrawals, saveWithdrawal, updateWithdrawal,
  getProfile, saveProfile, incrementAdsWatched,
} from '@/services/storage';
import { showRewardedAd } from '@/services/monetag';
import { WithdrawalRequest, WITHDRAWAL_MIN, TOKEN_NETWORK } from '@/types/game';

export function useWithdrawal() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWithdrawals = useCallback(async () => {
    const list = await getWithdrawals();
    setWithdrawals(list);
  }, []);

  const requestWithdrawal = useCallback(async (amount: number): Promise<boolean> => {
    setError(null);
    const profile = await getProfile();
    if (!profile) { setError('Profile not found'); return false; }
    if (!profile.walletAddress) { setError('Please set your BEP-20 wallet address first'); return false; }
    if (profile.totalTokens < WITHDRAWAL_MIN) {
      setError(`Minimum withdrawal is ${WITHDRAWAL_MIN.toLocaleString()} MG tokens`);
      return false;
    }
    if (amount > profile.totalTokens) { setError('Insufficient token balance'); return false; }
    if (amount < WITHDRAWAL_MIN) {
      setError(`Minimum withdrawal is ${WITHDRAWAL_MIN.toLocaleString()} MG`);
      return false;
    }

    // Ad gate
    setIsWatchingAd(true);
    try {
      const adResult = await showRewardedAd();
      if (!adResult.watched) {
        setError('Please watch the full ad to unlock withdrawal');
        return false;
      }
      await incrementAdsWatched();
    } finally {
      setIsWatchingAd(false);
    }

    setIsLoading(true);
    try {
      const req: WithdrawalRequest = {
        id: `wd_${Date.now()}`,
        telegramId: profile.telegramId,
        username: profile.username,
        amount,
        walletAddress: profile.walletAddress,
        network: TOKEN_NETWORK,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      profile.totalTokens = Math.round((profile.totalTokens - amount) * 100) / 100;
      profile.pendingTokens = Math.round((profile.pendingTokens + amount) * 100) / 100;
      await saveProfile(profile);
      await saveWithdrawal(req);

      const list = await getWithdrawals();
      setWithdrawals(list);
      return true;
    } catch {
      setError('Failed to submit. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateWallet = useCallback(async (address: string): Promise<boolean> => {
    const profile = await getProfile();
    if (!profile) return false;
    profile.walletAddress = address;
    await saveProfile(profile);
    return true;
  }, []);

  return {
    withdrawals, isLoading, isWatchingAd, error,
    loadWithdrawals, requestWithdrawal, updateWallet, setError,
  };
}
