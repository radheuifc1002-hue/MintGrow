import { Tile, TileType, GameState } from '@/types/game';

const BOARD_SIZE = 4;
let tileIdCounter = 0;
const generateId = () => `tile_${++tileIdCounter}_${Date.now()}`;

export const createEmptyBoard = (): (Tile | null)[][] =>
  Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

export const getEmptyCells = (board: (Tile | null)[][]): { row: number; col: number }[] => {
  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (!board[r][c]) cells.push({ row: r, col: c });
  return cells;
};

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const spawnTile = (
  board: (Tile | null)[][],
  score: number,
  moves: number
): { board: (Tile | null)[][]; isNewTier: boolean } => {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return { board, isNewTier: false };

  const newBoard = board.map(row => [...row]);
  const cell = pickRandom(empty);

  let type: TileType = 'normal';
  let value = Math.random() < 0.8 ? 2 : 4;

  const trickyChance = Math.min(0.40, score / 15000);

  if (moves > 15 && Math.random() < trickyChance) {
    const roll = Math.random();
    if (score > 300 && roll < 0.12) {
      type = 'bomb';
      value = 0;
    } else if (score > 800 && roll < 0.25) {
      type = 'blocker';
      value = -1;
    } else if (score > 2000 && roll < 0.38) {
      type = 'multiplier';
      value = 2;
    }
  }

  // Check if this value is new to the board (for congratulation)
  const allValues = new Set<number>();
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c]) allValues.add(board[r][c]!.value);
  const isNewTier = type === 'normal' && !allValues.has(value);

  newBoard[cell.row][cell.col] = {
    id: generateId(),
    value,
    type,
    row: cell.row,
    col: cell.col,
    isNew: true,
  };

  return { board: newBoard, isNewTier: false };
};

export const initGame = (): (Tile | null)[][] => {
  let board = createEmptyBoard();
  board = spawnTile(board, 0, 0).board;
  board = spawnTile(board, 0, 0).board;
  return board;
};

type Direction = 'up' | 'down' | 'left' | 'right';

const slideRow = (row: (Tile | null)[]): { row: (Tile | null)[]; score: number; merged: boolean; newTierValue?: number } => {
  const filtered = row.filter(t => t !== null && t.type !== 'blocker') as Tile[];
  const blockerPositions = row.map((t, i) => t?.type === 'blocker' ? i : -1).filter(i => i >= 0);

  let score = 0;
  let merged = false;
  let newTierValue: number | undefined;
  const result: (Tile | null)[] = Array(BOARD_SIZE).fill(null);

  let i = 0;
  let resultIdx = 0;

  while (i < filtered.length) {
    const curr = filtered[i];
    const next = filtered[i + 1];

    if (curr.type === 'bomb') { i++; continue; }

    if (
      next &&
      curr.value === next.value &&
      curr.type === 'normal' &&
      next.type === 'normal'
    ) {
      const mergedValue = curr.value * 2;
      score += mergedValue;
      merged = true;
      newTierValue = mergedValue;
      result[resultIdx++] = {
        ...curr,
        id: generateId(),
        value: mergedValue,
        isMerged: true,
        isNew: false,
      };
      i += 2;
    } else if (curr.type === 'multiplier') {
      if (next && next.value === curr.value && next.type === 'normal') {
        const mergedValue = curr.value * 2;
        score += mergedValue * 2;
        merged = true;
        result[resultIdx++] = {
          ...next,
          id: generateId(),
          value: mergedValue,
          isMerged: true,
          isNew: false,
        };
        i += 2;
      } else {
        result[resultIdx++] = { ...curr, isNew: false };
        i++;
      }
    } else {
      result[resultIdx++] = { ...curr, isNew: false };
      i++;
    }
  }

  // Re-place blockers
  blockerPositions.forEach(pos => {
    if (pos < BOARD_SIZE) result[pos] = row[pos];
  });

  return { row: result, score, merged, newTierValue };
};

export const moveBoard = (
  board: (Tile | null)[][],
  direction: Direction
): { board: (Tile | null)[][]; score: number; moved: boolean; newTierValue?: number } => {
  let totalScore = 0;
  let moved = false;
  let globalNewTierValue: number | undefined;

  const transpose = (b: (Tile | null)[][]) => b[0].map((_, i) => b.map(row => row[i]));
  const reverseRows = (b: (Tile | null)[][]) => b.map(row => [...row].reverse());

  let working = board.map(row => [...row]);

  if (direction === 'up')    working = transpose(working);
  else if (direction === 'down')  working = transpose(reverseRows(transpose(working)));
  else if (direction === 'right') working = reverseRows(working);

  const result = working.map(row => {
    const { row: slid, score, merged, newTierValue } = slideRow(row);
    totalScore += score;
    if (merged) moved = true;
    if (newTierValue) globalNewTierValue = newTierValue;
    return slid;
  });

  // Position check
  if (!moved) {
    outer: for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (working[r][c]?.id !== result[r][c]?.id ||
            working[r][c]?.value !== result[r][c]?.value) {
          moved = true; break outer;
        }
      }
    }
  }

  let finalBoard = result;

  if (direction === 'up')    finalBoard = transpose(result);
  else if (direction === 'down')  finalBoard = transpose(reverseRows(result)).map(r => r.reverse());
  else if (direction === 'right') finalBoard = reverseRows(result);

  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (finalBoard[r][c]) finalBoard[r][c] = { ...finalBoard[r][c]!, row: r, col: c };

  return { board: finalBoard, score: totalScore, moved, newTierValue: globalNewTierValue };
};

export const checkGameOver = (board: (Tile | null)[][]): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (!board[r][c]) return false;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const curr = board[r][c];
      if (!curr || curr.type !== 'normal') continue;
      if (c < BOARD_SIZE - 1 && board[r][c + 1]?.value === curr.value) return false;
      if (r < BOARD_SIZE - 1 && board[r + 1][c]?.value === curr.value) return false;
    }
  }
  return true;
};

export const checkWin = (board: (Tile | null)[][]): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c]?.value === 1073741824) return true; // 1 Billion = win
  return false;
};

export const calculateTokensEarned = (score: number, prevScore: number): number => {
  const diff = score - prevScore;
  return Math.floor(diff * 0.5 * 100) / 100;
};

export const getLevelFromScore = (score: number): number => {
  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (score >= thresholds[i]) { level = i + 1; break; }
  }
  return Math.min(level, 8);
};

// Destroy a specific tile
export const destroyTile = (board: (Tile | null)[][], row: number, col: number): (Tile | null)[][] => {
  const nb = board.map(r => [...r]);
  nb[row][col] = null;
  return nb;
};

// Clear all blocker tiles
export const clearAllBlockers = (board: (Tile | null)[][]): (Tile | null)[][] => {
  return board.map(row => row.map(t => (t?.type === 'blocker' ? null : t)));
};
