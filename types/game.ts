export type TileType = 'normal' | 'bomb' | 'blocker' | 'multiplier';

export type PowerUpType = 'undo' | 'destroy' | 'clear_blockers' | 'shuffle';

export interface Tile {
  id: string;
  value: number;
  type: TileType;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

export interface PowerUp {
  type: PowerUpType;
  label: string;
  icon: string;
  description: string;
  adRequired: boolean;
  tokenCost: number;
}

export interface GameState {
  board: (Tile | null)[][];
  score: number;
  bestScore: number;
  level: number;
  tokens: number;
  moves: number;
  isGameOver: boolean;
  isWon: boolean;
}

export interface PlayerProfile {
  telegramId: string;
  username: string;
  avatarUrl?: string;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  referralTokensEarned: number;
  totalTokens: number;
  pendingTokens: number;
  withdrawnTokens: number;
  walletAddress: string;
  level: number;
  gamesPlayed: number;
  bestScore: number;
  adsWatched: number;
  lastLoginDate?: string;
  loginStreak: number;
  powerUps: Record<PowerUpType, number>;
  isRegistered?: boolean;
}

export interface WithdrawalRequest {
  id: string;
  telegramId: string;
  username: string;
  amount: number;
  walletAddress: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  txHash?: string;
}

export interface ReferralEntry {
  code: string;
  username: string;
  joinedAt: string;
  tokensEarned: number;
  level?: number;
  refereeBalance?: number;
}

export interface LevelReward {
  level: number;
  tokenReward: number;
  title: string;
  unlocks: string;
}

export const REFERRAL_LEVELS: { level: number; pct: number; directRequired: number }[] = [
  { level: 1, pct: 0.20, directRequired: 2 },
  { level: 2, pct: 0.15, directRequired: 2 },
  { level: 3, pct: 0.10, directRequired: 3 },
  { level: 4, pct: 0.05, directRequired: 4 },
  { level: 5, pct: 0.05, directRequired: 5 },
  ...Array.from({ length: 20 }, (_, i) => ({ level: i + 6, pct: 0.03, directRequired: 6 })),
];

export const getEligibleReferralPct = (level: number, directRefs: number): number => {
  const rule = REFERRAL_LEVELS.find(r => r.level === level);
  if (!rule) return 0;
  if (directRefs < rule.directRequired) return 0;
  return rule.pct;
};

export const POWER_UPS: PowerUp[] = [
  { type: 'undo',           label: 'Undo Move',      icon: 'undo',       description: 'Reverse your last move',        adRequired: true, tokenCost: 500 },
  { type: 'destroy',        label: 'Destroy Tile',   icon: 'delete',     description: 'Remove any one tile from board', adRequired: true, tokenCost: 1000 },
  { type: 'clear_blockers', label: 'Clear Blockers', icon: 'cleaning-services', description: 'Remove all blocker tiles', adRequired: true, tokenCost: 2000 },
  { type: 'shuffle',        label: 'Shuffle Board',  icon: 'shuffle',    description: 'Randomly shuffle all tiles',    adRequired: true, tokenCost: 1500 },
];

export const LEVEL_REWARDS: LevelReward[] = [
  { level: 1, tokenReward: 50, title: 'Crypto Rookie', unlocks: 'Basic merging' },
  { level: 2, tokenReward: 100, title: 'Token Seeker', unlocks: 'Daily bonus' },
  { level: 3, tokenReward: 250, title: 'DeFi Degen', unlocks: 'Multiplier tiles' },
  { level: 4, tokenReward: 500, title: 'Whale Hunter', unlocks: 'Power-ups shop' },
  { level: 5, tokenReward: 1000, title: 'MintGrow OG', unlocks: 'VIP airdrop' },
  { level: 6, tokenReward: 2000, title: 'DAO Member', unlocks: 'Governance vote' },
  { level: 7, tokenReward: 4000, title: 'Core Contributor', unlocks: 'NFT badge' },
  { level: 8, tokenReward: 8000, title: 'Legend', unlocks: 'Ecosystem partner' },
];

export const SCORE_PER_LEVEL = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000];
export const TOKENS_PER_MERGE_BASE = 0.5;
export const WITHDRAWAL_MIN = 250000;
export const REFERRAL_BONUS_TOKENS = 500;
export const REFERRAL_INCOME_PCT = 0.20;
export const ADMIN_TELEGRAM_ID = 'PETER44441111';
export const TOKEN_NETWORK = 'BNB Chain (BEP-20)';

export const DEFAULT_POWER_UPS: Record<PowerUpType, number> = {
  undo: 0,
  destroy: 0,
  clear_blockers: 0,
  shuffle: 0,
};
