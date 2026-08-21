import { verifiedApi } from '@/services/verifiedApi';
import { AdResult } from '@/services/monetag';

export const recordAdEvent = async (placement: string, result: AdResult, rewardTokens = 0): Promise<string | null> => {
  try {
    const clientEventId = `ad_${placement}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const row = await verifiedApi<any>('record_ad_event', {
      placement,
      watched: result.watched,
      rewardTokens: Math.max(0, rewardTokens),
      error: result.error || result.reason || null,
      clientEventId,
    });
    return row?.id ? String(row.id) : null;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.warn('Failed to record ad event:', error);
    return null;
  }
};
