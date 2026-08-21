import { supabase } from '@/services/supabase';

export type VerifiedApiAction =
  | 'get_player'
  | 'ensure_player'
  | 'ensure_referral_code'
  | 'complete_registration'
  | 'credit_player_tokens'
  | 'record_ad_event'
  | 'record_game_session'
  | 'apply_referral_code'
  | 'submit_withdrawal_request';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export const getTelegramInitData = (): string | null => {
  if (typeof window === 'undefined') return null;
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
  const initData = webApp?.initData;
  return initData && initData.length > 0 ? initData : null;
};

export const verifiedApi = async <T = unknown>(action: VerifiedApiAction, params: Record<string, unknown> = {}): Promise<T> => {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('Telegram Mini App identity is unavailable. Open MintGrow inside Telegram.');

  const { data, error } = await supabase.functions.invoke('mintgrow-api', {
    body: { action, initData, params },
  });

  if (error) throw new Error(error.message || 'MintGrow API request failed');
  if (!data || data.error) throw new Error(data?.error || 'MintGrow API request failed');
  return data.data as T;
};
