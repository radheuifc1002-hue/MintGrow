import { verifiedApi } from '@/services/verifiedApi';

export interface GameSession {
  id: string;
  clientSessionId: string;
  startedAt: string;
}

export interface GameSettlement {
  ok: boolean;
  reward: number;
  gameplayReward: number;
  levelReward: number;
  level: number;
}

const createClientSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `game_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

export const startGameSession = async (): Promise<GameSession> => {
  const clientSessionId = createClientSessionId();
  const row = await verifiedApi<any>('start_game_session', { clientSessionId });
  return {
    id: String(row.id),
    clientSessionId: String(row.client_session_id),
    startedAt: String(row.started_at),
  };
};

export const settleGameSession = async (
  clientSessionId: string,
  score: number,
  moves: number,
  level: number,
  maxTile: number,
  board: unknown,
): Promise<GameSettlement | null> => {
  try {
    const result = await verifiedApi<any>('settle_game_session', {
      clientSessionId,
      score,
      moves,
      level,
      maxTile,
      board,
    });
    if (!result?.ok) return null;
    return {
      ok: true,
      reward: Number(result.reward ?? 0),
      gameplayReward: Number(result.gameplay_reward ?? 0),
      levelReward: Number(result.level_reward ?? 0),
      level: Number(result.level ?? level),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.warn('Game settlement failed:', error);
    return null;
  }
};
