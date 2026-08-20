import { Tile, TileType, SCORE_PER_LEVEL } from '@/types/game';

const BOARD_SIZE = 4;
let tileIdCounter = 0;
const generateId = () => `tile_${++tileIdCounter}_${Date.now()}`;

type Direction = 'up' | 'down' | 'left' | 'right';

type SpawnRarity = { value: number; weight: number };

export type TokenRewardBreakdown = {
  base: number;
  streakBonus: number;
  jackpot: number;
  total: number;
};

export const createEmptyBoard = (): (Tile | null)[][] =>
  Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

export const getEmptyCells = (board: (Tile | null)[][]): { row: number; col: number }[] => {
  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
};

const cloneBoard = (board: (Tile | null)[][]) => board.map(row => row.map(tile => (tile ? { ...tile } : null)));
const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const weightedPick = (items: SpawnRarity[]): number => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[0].value;
};

const getMaxTileValue = (board: (Tile | null)[][]) => Math.max(
  2,
  ...board.flat().map(tile => (tile?.type === 'normal' ? tile.value : 0))
);

const getSpawnValue = (board: (Tile | null)[][], score: number, moves: number) => {
  const maxTile = getMaxTileValue(board);
  const unlockEight = score >= 1800 || maxTile >= 128 || moves >= 35;
  const unlockSixteen = score >= 9000 || maxTile >= 512 || moves >= 80;
  const table: SpawnRarity[] = [
    { value: 2, weight: 68 },
    { value: 4, weight: 27 },
    ...(unlockEight ? [{ value: 8, weight: 4 }] : []),
    ...(unlockSixteen ? [{ value: 16, weight: 1 }] : []),
  ];
  return weightedPick(table);
};

export const spawnTile = (
  board: (Tile | null)[][],
  score: number,
  moves: number
): { board: (Tile | null)[][]; isNewTier: boolean } => {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return { board, isNewTier: false };

  const newBoard = cloneBoard(board);
  const cell = pickRandom(empty);
  const value = getSpawnValue(board, score, moves);
  const type: TileType = 'normal';
  const isNewTier = !board.flat().some(tile => tile?.value === value);

  newBoard[cell.row][cell.col] = {
    id: generateId(), value, type, row: cell.row, col: cell.col, isNew: true,
  };

  return { board: newBoard, isNewTier };
};

export const initGame = (): (Tile | null)[][] => {
  let board = createEmptyBoard();
  board = spawnTile(board, 0, 0).board;
  board = spawnTile(board, 0, 0).board;
  return board;
};

const compactAndMerge = (line: (Tile | null)[]) => {
  const tiles = line.filter(Boolean).map(tile => ({ ...tile!, isNew: false, isMerged: false }));
  const result: (Tile | null)[] = [];
  let score = 0;
  let newTierValue: number | undefined;

  for (let i = 0; i < tiles.length; i++) {
    const curr = tiles[i];
    const next = tiles[i + 1];
    if (next && curr.value === next.value) {
      const mergedValue = curr.value * 2;
      score += mergedValue;
      newTierValue = Math.max(newTierValue ?? 0, mergedValue);
      result.push({ ...curr, id: generateId(), value: mergedValue, type: 'normal', isMerged: true });
      i += 1;
    } else {
      result.push(curr);
    }
  }

  while (result.length < BOARD_SIZE) result.push(null);
  return { line: result, score, newTierValue };
};

const transpose = (board: (Tile | null)[][]) => board[0].map((_, i) => board.map(row => row[i]));
const reverseRows = (board: (Tile | null)[][]) => board.map(row => [...row].reverse());

export const moveBoard = (
  board: (Tile | null)[][],
  direction: Direction
): { board: (Tile | null)[][]; score: number; moved: boolean; newTierValue?: number } => {
  const original = cloneBoard(board);
  let working = cloneBoard(board);

  if (direction === 'up') working = transpose(working);
  if (direction === 'down') working = reverseRows(transpose(working));
  if (direction === 'right') working = reverseRows(working);

  let score = 0;
  let newTierValue: number | undefined;
  let result = working.map(line => {
    const merged = compactAndMerge(line);
    score += merged.score;
    if (merged.newTierValue) newTierValue = Math.max(newTierValue ?? 0, merged.newTierValue);
    return merged.line;
  });

  if (direction === 'up') result = transpose(result);
  if (direction === 'down') result = transpose(reverseRows(result));
  if (direction === 'right') result = reverseRows(result);

  const finalBoard = result.map((row, r) => row.map((tile, c) => (tile ? { ...tile, row: r, col: c } : null)));
  const moved = original.some((row, r) => row.some((tile, c) => tile?.id !== finalBoard[r][c]?.id || tile?.value !== finalBoard[r][c]?.value));

  return { board: finalBoard, score, moved, newTierValue };
};

export const checkGameOver = (board: (Tile | null)[][]): boolean => {
  if (getEmptyCells(board).length > 0) return false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const curr = board[r][c];
      if (!curr) continue;
      if (c < BOARD_SIZE - 1 && board[r][c + 1]?.value === curr.value) return false;
      if (r < BOARD_SIZE - 1 && board[r + 1][c]?.value === curr.value) return false;
    }
  }
  return true;
};

export const checkWin = (board: (Tile | null)[][]): boolean =>
  board.flat().some(tile => tile?.value === 1073741824);

export const calculateTokenReward = (score: number, prevScore: number, moves: number): TokenRewardBreakdown => {
  const diff = Math.max(0, score - prevScore);
  if (diff === 0) return { base: 0, streakBonus: 0, jackpot: 0, total: 0 };

  const baseRate = 0.08 + Math.random() * 0.14;
  const streakBonus = moves > 0 && moves % 12 === 0 ? 2 + Math.random() * 8 : 0;
  const jackpot = Math.random() < 0.035 ? 10 + Math.random() * 40 : 0;
  const base = diff * baseRate;
  const total = Math.round((base + streakBonus + jackpot) * 100) / 100;
  return { base: Math.round(base * 100) / 100, streakBonus: Math.round(streakBonus * 100) / 100, jackpot: Math.round(jackpot * 100) / 100, total };
};

export const calculateTokensEarned = (score: number, prevScore: number, moves = 0): number =>
  calculateTokenReward(score, prevScore, moves).total;

export const getLevelFromScore = (score: number): number => {
  let level = 1;
  for (let i = SCORE_PER_LEVEL.length - 1; i >= 0; i--) {
    if (score >= SCORE_PER_LEVEL[i]) { level = i + 1; break; }
  }
  return Math.min(level, SCORE_PER_LEVEL.length);
};

export const destroyTile = (board: (Tile | null)[][], row: number, col: number): (Tile | null)[][] => {
  const nb = cloneBoard(board);
  nb[row][col] = null;
  return nb;
};

export const clearAllBlockers = (board: (Tile | null)[][]): (Tile | null)[][] => cloneBoard(board);
