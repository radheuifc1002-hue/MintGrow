import { supabase } from '@/services/supabase';

export const completeRegistrationInDatabase = async (
  telegramId: string,
  username: string,
) => {
  const { data, error } = await supabase.rpc('complete_player_registration', {
    p_telegram_id: telegramId,
    p_username: username,
  });
  if (error || !data) throw new Error(error?.message || 'Registration could not be saved.');
  return data as any;
};
