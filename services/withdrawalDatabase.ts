import { supabase } from '@/services/supabase';

export const submitWithdrawalToDatabase = async (params: {
  id: string;
  telegramId: string;
  username: string;
  amount: number;
  walletAddress: string;
  network: string;
}) => {
  const { data, error } = await supabase.rpc('submit_withdrawal_request', {
    p_id: params.id,
    p_telegram_id: params.telegramId,
    p_username: params.username,
    p_amount: params.amount,
    p_wallet_address: params.walletAddress,
    p_network: params.network,
  });
  if (error || !data) throw new Error(error?.message || 'Withdrawal could not be submitted.');
  return data as any;
};
