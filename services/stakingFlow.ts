// Staking reward claim flow service.
// Manages staking configuration and MG reward claim requests that are
// processed through the on-chain staking contract settlement path.

import { getSupabaseClient } from '@/services/supabase';
import { getProfile } from '@/services/storage';

export interface StakingConfig {
  minimum_stake_mgs: number;
  minimum_mg_claim: number;
  staking_delegate_address: string;
}

export interface StakingClaim {
  id: string;
  telegram_id: string;
  wallet_address: string;
  amount: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  tx_hash?: string | null;
  created_at: string;
}

const DEFAULT_CONFIG: StakingConfig = {
  minimum_stake_mgs: 250000,
  minimum_mg_claim: 25000,
  staking_delegate_address: '',
};

export async function getStakingConfig(): Promise<StakingConfig> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('staking_config')
      .select('*')
      .single();
    if (error || !data) return DEFAULT_CONFIG;
    return {
      minimum_stake_mgs: Number(data.minimum_stake_mgs ?? DEFAULT_CONFIG.minimum_stake_mgs),
      minimum_mg_claim: Number(data.minimum_mg_claim ?? DEFAULT_CONFIG.minimum_mg_claim),
      staking_delegate_address: data.staking_delegate_address ?? '',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function getStakingClaims(): Promise<StakingClaim[]> {
  try {
    const profile = await getProfile();
    if (!profile?.telegramId) return [];
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('staking_claims')
      .select('*')
      .eq('telegram_id', profile.telegramId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data as StakingClaim[];
  } catch {
    return [];
  }
}

export async function createStakingClaim(
  walletAddress: string,
  amount: number,
): Promise<StakingClaim> {
  const profile = await getProfile();
  if (!profile?.telegramId) throw new Error('Player profile not found.');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('staking_claims')
    .insert({
      telegram_id: profile.telegramId,
      wallet_address: walletAddress.trim().toLowerCase(),
      amount,
      status: 'queued',
    })
    .select()
    .single();

  if (error) throw new Error(error.message || 'Failed to create staking claim.');
  return data as StakingClaim;
}
