import { useState, useCallback } from 'react';
import { getWithdrawals, getProfile, syncProfileFromSupabase } from '@/services/storage';
import { showRewardedAd } from '@/services/monetag';
import { recordAdEventInDatabase } from '@/services/database';
import { submitWithdrawalToDatabase } from '@/services/withdrawalDatabase';
import { WithdrawalRequest, WITHDRAWAL_MIN, TOKEN_NETWORK } from '@/types/game';

const BEP20_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export const normalizeWalletAddress = (address: string) => address.trim();
export const isValidBep20Address = (address: string) => BEP20_ADDRESS_PATTERN.test(normalizeWalletAddress(address));

export function useWithdrawal() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWithdrawals = useCallback(async () => {
    const profile = await getProfile();
    if (!profile) return;
    const list = await getWithdrawals(profile.telegramId);
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

    setIsWatchingAd(true);
    try {
      const adResult = await showRewardedAd();
      const clientEventId = `ad_${profile.telegramId}_withdraw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const recorded = await recordAdEventInDatabase({
        telegramId: profile.telegramId,
        clientEventId,
        placement: 'withdrawal',
        watched: adResult.watched,
        error: adResult.error || adResult.reason || null,
      });
      if (!recorded) {
        setError('The ad result could not be saved. Please try again.');
        return false;
      }
      if (!adResult.watched) {
        setError('Please watch the full ad to unlock withdrawal');
        return false;
      }
    } finally {
      setIsWatchingAd(false);
    }

    setIsLoading(true);
    try {
      const req: WithdrawalRequest = {
        id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        telegramId: profile.telegramId,
        username: profile.username,
        amount,
        walletAddress: profile.walletAddress,
        network: TOKEN_NETWORK,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await submitWithdrawalToDatabase({
        id: req.id,
        telegramId: req.telegramId,
        username: req.username,
        amount: req.amount,
        walletAddress: req.walletAddress,
        network: req.network,
      });

      await syncProfileFromSupabase(profile.telegramId);
      const list = await getWithdrawals(profile.telegramId);
      setWithdrawals(list);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateWallet = useCallback(async (address: string): Promise<boolean> => {
    const profile = await getProfile();
    if (!profile) { setError('Profile not found'); return false; }

    const normalized = normalizeWalletAddress(address);
    if (!isValidBep20Address(normalized)) {
      setError('Please enter a valid BEP-20 wallet address');
      return false;
    }

    setIsLoading(true);
    setError(null);
    try {
      profile.walletAddress = normalized;
      const { supabase } = await import('@/services/supabase');
      const { error: saveError } = await supabase
        .from('players')
        .update({ wallet_address: normalized })
        .eq('telegram_id', profile.telegramId);
      if (saveError) throw saveError;
      await syncProfileFromSupabase(profile.telegramId);
      return true;
    } catch {
      setError('Failed to save wallet address. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    withdrawals, isLoading, isWatchingAd, error,
    loadWithdrawals, requestWithdrawal, updateWallet, setError,
  };
}
