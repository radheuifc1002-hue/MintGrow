export type TileType = 'normal' | 'bomb' | 'blocker' | 'multiplier';

export interface Tile {
  id: string;
  value: number;
  type: TileType;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
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
  totalTokens: number;
  pendingTokens: number;
  withdrawnTokens: number;
  walletAddress: string;
  level: number;
  gamesPlayed: number;
  bestScore: number;
  adsWatched: number;
}

export interface WithdrawalRequest {
  id: string;
  telegramId: string;
  username: string;
  amount: number;
  walletAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  txHash?: string;
}

export interface LevelReward {
  level: number;
  tokenReward: number;
  title: string;
  unlocks: string;
}

export const LEVEL_REWARDS: LevelReward[] = [
  { level: 1, tokenReward: 10, title: 'Crypto Rookie', unlocks: 'Basic merging' },
  { level: 2, tokenReward: 25, title: 'Token Seeker', unlocks: '4x4 board' },
  { level: 3, tokenReward: 50, title: 'DeFi Degen', unlocks: 'Multiplier tiles' },
  { level: 4, tokenReward: 100, title: 'Whale Hunter', unlocks: 'Daily bonus' },
  { level: 5, tokenReward: 200, title: 'MintGrow OG', unlocks: 'VIP airdrop eligibility' },
  { level: 6, tokenReward: 400, title: 'DAO Member', unlocks: 'Governance vote' },
  { level: 7, tokenReward: 800, title: 'Core Contributor', unlocks: 'NFT badge' },
  { level: 8, tokenReward: 1600, title: 'Legend', unlocks: 'Ecosystem partner' },
];

export const SCORE_PER_LEVEL = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000];
export const TOKENS_PER_MERGE_BASE = 0.1;
export const WITHDRAWAL_MIN = 50;
export const ADMIN_TELEGRAM_ID = 'PETER44441111';
