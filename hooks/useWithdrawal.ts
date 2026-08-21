import { useState, useCallback } from 'react';
import { getWithdrawals, getProfile, saveWithdrawal, saveProfile } from '@/services/storage';
import { showRewardedAd } from '@/services/monetag';
import { recordAdEvent } from '@/services/secureAdEvents';
import { WithdrawalRequest, WITHDRAWAL_MIN, TOKEN_NETWORK } from '@/types/game';

const BEP20_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
export const normalizeWalletAddress = (address: string) => address.trim();
export const isValidBep20Address = (address: string) => BEP20_ADDRESS_PATTERN.test(normalizeWalletAddress(address));

export function useWithdrawal() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false); const [isWatchingAd, setIsWatchingAd] = useState(false); const [error, setError] = useState<string | null>(null);
  const loadWithdrawals = useCallback(async () => { const profile = await getProfile(); if (!profile) return; setWithdrawals(await getWithdrawals(profile.telegramId)); }, []);

  const requestWithdrawal = useCallback(async (amount: number): Promise<boolean> => {
    setError(null); const profile = await getProfile();
    if (!profile) { setError('Profile not found'); return false; }
    if (!profile.walletAddress) { setError('Please set your BEP-20 wallet address first'); return false; }
    if (profile.totalTokens < WITHDRAWAL_MIN || amount < WITHDRAWAL_MIN) { setError(`Minimum withdrawal is ${WITHDRAWAL_MIN.toLocaleString()} MG`); return false; }
    if (amount > profile.totalTokens) { setError('Insufficient token balance'); return false; }

    setIsWatchingAd(true);
    try { const adResult = await showRewardedAd(); await recordAdEvent('withdrawal', adResult, 0); if (!adResult.watched) { setError('Please watch the full ad to unlock withdrawal'); return false; } }
    finally { setIsWatchingAd(false); }

    setIsLoading(true);
    try {
      const req: WithdrawalRequest = { id: `wd_${Date.now()}`, telegramId: profile.telegramId, username: profile.username, amount, walletAddress: profile.walletAddress, network: TOKEN_NETWORK, status: 'pending', createdAt: new Date().toISOString() };
      await saveWithdrawal(req); await loadWithdrawals(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to submit. Please try again.'); return false; }
    finally { setIsLoading(false); }
  }, [loadWithdrawals]);

  const updateWallet = useCallback(async (address: string): Promise<boolean> => {
    const profile = await getProfile(); if (!profile) { setError('Profile not found'); return false; }
    const normalized = normalizeWalletAddress(address);
    if (!isValidBep20Address(normalized)) { setError('Please enter a valid BEP-20 wallet address'); return false; }
    setIsLoading(true); setError(null);
    try { profile.walletAddress = normalized; await saveProfile(profile); return true; }
    catch { setError('Failed to save wallet address. Please try again.'); return false; }
    finally { setIsLoading(false); }
  }, []);

  return { withdrawals, isLoading, isWatchingAd, error, loadWithdrawals, requestWithdrawal, updateWallet, setError };
}
