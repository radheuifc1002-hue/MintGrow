import { Tile, TileType, GameState } from '@/types/game';

const BOARD_SIZE = 4;
let tileIdCounter = 0;

const generateId = () => `tile_${++tileIdCounter}_${Date.now()}`;

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

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const spawnTile = (
  board: (Tile | null)[][],
  score: number,
  moves: number
): (Tile | null)[][] => {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return board;

  const newBoard = board.map(row => [...row]);
  const cell = pickRandom(empty);

  // Tricky algorithm: introduce special tiles based on thresholds
  let type: TileType = 'normal';
  let value = Math.random() < 0.8 ? 2 : 4;

  const trickyChance = Math.min(0.35, score / 20000);

  if (moves > 20 && Math.random() < trickyChance) {
    const roll = Math.random();
    if (score > 500 && roll < 0.15) {
      type = 'bomb'; // Destroys adjacent tiles
      value = 0;
    } else if (score > 1000 && roll < 0.30) {
      type = 'blocker'; // Cannot be merged, must be worked around
      value = -1;
    } else if (score > 2000 && roll < 0.40) {
      type = 'multiplier'; // 2x tokens on next merge
      value = 2;
    }
  }

  newBoard[cell.row][cell.col] = {
    id: generateId(),
    value,
    type,
    row: cell.row,
    col: cell.col,
    isNew: true,
  };

  return newBoard;
};

export const initGame = (): (Tile | null)[][] => {
  let board = createEmptyBoard();
  board = spawnTile(board, 0, 0);
  board = spawnTile(board, 0, 0);
  return board;
};

type Direction = 'up' | 'down' | 'left' | 'right';

const slideRow = (row: (Tile | null)[]): { row: (Tile | null)[]; score: number; merged: boolean } => {
  const filtered = row.filter(t => t !== null && t.type !== 'blocker') as Tile[];
  const blockers = row.map((t, i) => t?.type === 'blocker' ? i : -1).filter(i => i >= 0);

  let score = 0;
  let merged = false;
  const result: (Tile | null)[] = Array(BOARD_SIZE).fill(null);

  let i = 0;
  let resultIdx = 0;

  while (i < filtered.length) {
    const curr = filtered[i];
    const next = filtered[i + 1];

    if (curr.type === 'bomb') {
      // Bomb destroys itself and adjacent - skip it
      i++;
      continue;
    }

    if (
      next &&
      curr.value === next.value &&
      curr.type === 'normal' &&
      next.type === 'normal'
    ) {
      const mergedValue = curr.value * 2;
      score += mergedValue;
      merged = true;
      result[resultIdx++] = {
        ...curr,
        id: generateId(),
        value: mergedValue,
        isMerged: true,
      };
      i += 2;
    } else if (curr.type === 'multiplier') {
      // multiplier tile acts as 2 but doubles score
      if (next && next.value === curr.value && next.type === 'normal') {
        const mergedValue = curr.value * 2;
        score += mergedValue * 2; // double score
        merged = true;
        result[resultIdx++] = {
          ...next,
          id: generateId(),
          value: mergedValue,
          isMerged: true,
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

  // Re-place blockers at original positions
  blockers.forEach(pos => {
    if (pos < BOARD_SIZE) {
      result[pos] = row[pos];
    }
  });

  return { row: result, score, merged };
};

export const moveBoard = (
  board: (Tile | null)[][],
  direction: Direction
): { board: (Tile | null)[][]; score: number; moved: boolean } => {
  let totalScore = 0;
  let moved = false;
  let newBoard = board.map(row => [...row]);

  const transpose = (b: (Tile | null)[][]) => b[0].map((_, i) => b.map(row => row[i]));
  const reverseRows = (b: (Tile | null)[][]) => b.map(row => [...row].reverse());

  let working = newBoard;

  if (direction === 'up') {
    working = transpose(working);
  } else if (direction === 'down') {
    working = transpose(reverseRows(transpose(working)));
  } else if (direction === 'right') {
    working = reverseRows(working);
  }

  const result = working.map(row => {
    const { row: slid, score, merged } = slideRow(row);
    totalScore += score;
    if (merged) moved = true;
    return slid;
  });

  // Check if anything moved
  if (!moved) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (working[r][c]?.id !== result[r][c]?.id) { moved = true; break; }
        if (working[r][c]?.value !== result[r][c]?.value) { moved = true; break; }
      }
      if (moved) break;
    }
  }

  let finalBoard = result;

  if (direction === 'up') {
    finalBoard = transpose(result);
  } else if (direction === 'down') {
    finalBoard = transpose(reverseRows(result)).map(r => r.reverse());
  } else if (direction === 'right') {
    finalBoard = reverseRows(result);
  }

  // Update row/col positions
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (finalBoard[r][c]) {
        finalBoard[r][c] = { ...finalBoard[r][c]!, row: r, col: c };
      }
    }
  }

  return { board: finalBoard, score: totalScore, moved };
};

export const checkGameOver = (board: (Tile | null)[][]): boolean => {
  // Check for empty cells
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) return false;
    }
  }

  // Check for possible merges
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
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]?.value === 2048) return true;
    }
  }
  return false;
};

export const calculateTokensEarned = (score: number, prevScore: number): number => {
  const diff = score - prevScore;
  return Math.floor(diff * 0.05 * 100) / 100;
};

export const getLevelFromScore = (score: number): number => {
  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (score >= thresholds[i]) { level = i + 1; break; }
  }
  return Math.min(level, 8);
};
