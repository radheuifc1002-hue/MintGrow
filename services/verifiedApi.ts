import { supabase } from '@/services/supabase';

export type VerifiedApiAction =
  | 'get_player' | 'ensure_player' | 'ensure_referral_code' | 'complete_registration'
  | 'update_profile_metadata' | 'credit_player_tokens' | 'record_ad_event'
  | 'record_game_session' | 'apply_referral_code' | 'submit_withdrawal_request'
  | 'get_referrals' | 'get_withdrawals' | 'get_leaderboard' | 'get_player_rank'
  | 'claim_daily_bonus' | 'spend_tokens_for_powerup' | 'grant_powerup' | 'consume_powerup';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
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

const readFunctionError = async (error: any): Promise<string> => {
  try {
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      const clone = response.clone();
      const contentType = clone.headers?.get?.('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await clone.json();
        if (body?.error) return String(body.error);
        if (body?.message) return String(body.message);
      } else {
        const text = (await clone.text()).trim();
        if (text) return text.slice(0, 500);
      }
    }
  } catch {
    // Fall back to the SDK error message below.
  }
  return String(error?.message || 'MintGrow API request failed');
};

export const verifiedApi = async <T = unknown>(action: VerifiedApiAction, params: Record<string, unknown> = {}): Promise<T> => {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('Telegram Mini App identity is unavailable. Open MintGrow inside Telegram.');

  const { data, error } = await supabase.functions.invoke('mintgrow-api', { body: { action, initData, params } });
  if (error) {
    const message = await readFunctionError(error);
    console.error(`[MintGrow API] ${action}: ${message}`);
    throw new Error(message);
  }
  if (!data || data.error) {
    const message = String(data?.error || 'MintGrow API request failed');
    console.error(`[MintGrow API] ${action}: ${message}`);
    throw new Error(message);
  }
  return data.data as T;
};
