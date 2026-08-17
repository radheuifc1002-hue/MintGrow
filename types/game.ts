export type TileType = 'normal' | 'bomb' | 'blocker' | 'multiplier';

export type PowerUpType = 'undo' | 'destroy' | 'clear_blockers' | 'extra_row';

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
  emoji: string;
  description: string;
  adRequired: boolean;   // earn via ad
  tokenCost: number;     // or spend tokens
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
  powerUps: Record<PowerUpType, number>; // count of each owned power-up
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
}

export interface LevelReward {
  level: number;
  tokenReward: number;
  title: string;
  unlocks: string;
}

export const POWER_UPS: PowerUp[] = [
  { type: 'undo',           label: 'Undo Move',       emoji: '↩️',  description: 'Reverse your last move',          adRequired: true,  tokenCost: 500 },
  { type: 'destroy',        label: 'Destroy Tile',    emoji: '💥',  description: 'Remove any one tile from board',   adRequired: true,  tokenCost: 1000 },
  { type: 'clear_blockers', label: 'Clear Blockers',  emoji: '🧹',  description: 'Remove all 🔒 blocker tiles',      adRequired: true,  tokenCost: 2000 },
  { type: 'extra_row',      label: 'Continue Game',   emoji: '▶️',  description: 'Continue where you left off',     adRequired: true,  tokenCost: 0 },
];

export const LEVEL_REWARDS: LevelReward[] = [
  { level: 1,  tokenReward: 50,    title: 'Crypto Rookie',     unlocks: 'Basic merging' },
  { level: 2,  tokenReward: 100,   title: 'Token Seeker',      unlocks: 'Daily bonus' },
  { level: 3,  tokenReward: 250,   title: 'DeFi Degen',        unlocks: 'Multiplier tiles' },
  { level: 4,  tokenReward: 500,   title: 'Whale Hunter',      unlocks: 'Power-ups shop' },
  { level: 5,  tokenReward: 1000,  title: 'MintGrow OG',       unlocks: 'VIP airdrop' },
  { level: 6,  tokenReward: 2000,  title: 'DAO Member',        unlocks: 'Governance vote' },
  { level: 7,  tokenReward: 4000,  title: 'Core Contributor',  unlocks: 'NFT badge' },
  { level: 8,  tokenReward: 8000,  title: 'Legend',            unlocks: 'Ecosystem partner' },
];

export const SCORE_PER_LEVEL = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000];
export const TOKENS_PER_MERGE_BASE = 0.5;
export const WITHDRAWAL_MIN = 10000;           // 10k MG minimum
export const REFERRAL_BONUS_TOKENS = 500;      // per referral sign-up
export const REFERRAL_INCOME_PCT = 0.20;       // 20% of referral's earnings (first level)
export const ADMIN_TELEGRAM_ID = 'PETER44441111';
export const TOKEN_NETWORK = 'BNB Chain (BEP-20)';

export const DEFAULT_POWER_UPS: Record<PowerUpType, number> = {
  undo: 0,
  destroy: 0,
  clear_blockers: 0,
  extra_row: 0,
};
