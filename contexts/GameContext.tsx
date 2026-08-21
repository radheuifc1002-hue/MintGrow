import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initGame, moveBoard, spawnTile, checkGameOver, checkWin,
  calculateTokensEarned, getLevelFromScore, destroyTile, clearAllBlockers,
} from '@/services/gameEngine';
import {
  getProfile, saveProfile, updateProfileTokens, initOrLoadProfile,
  usePowerUp as consumePowerUp,
  saveBoardState, getSavedBoard, clearSavedBoard,
} from '@/services/storage';
import { Tile, PlayerProfile, LEVEL_REWARDS, PowerUpType } from '@/types/game';

const SEEN_TILES_KEY = 'mintgrow_seen_tiles_v1';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: { user?: TelegramUser };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

interface GameContextType {
  board: (Tile | null)[][];
  score: number;
  bestScore: number;
  level: number;
  tokens: number;
  sessionTokens: number;
  moves: number;
  isGameOver: boolean;
  isWon: boolean;
  profile: PlayerProfile | null;
  levelUpReward: number | null;
  newTierValue: number | null;
  isSelectingDestroy: boolean;
  canContinue: boolean;
  move: (dir: 'up' | 'down' | 'left' | 'right') => void;
  newGame: () => void;
  continueGame: () => void;
  continueFromSaved: () => void;
  dismissLevelUp: () => void;
  dismissNewTier: () => void;
  setProfile: (p: PlayerProfile) => void;
  refreshProfile: () => void;
  activatePowerUp: (type: PowerUpType) => Promise<boolean>;
  selectTileToDestroy: (row: number, col: number) => void;
  cancelDestroy: () => void;
}

export const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<(Tile | null)[][]>(initGame());
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [sessionTokens, setSessionTokens] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [profile, setProfileState] = useState<PlayerProfile | null>(null);
  const [levelUpReward, setLevelUpReward] = useState<number | null>(null);
  const [newTierValue, setNewTierValue] = useState<number | null>(null);
  const [isSelectingDestroy, setIsSelectingDestroy] = useState(false);
  const [canContinue, setCanContinue] = useState(false);

  const scoreRef = useRef(0);
  const movesRef = useRef(0);
  const boardRef = useRef(board);
  // undoStack stores pre-move state (board before spawn)
  const undoStack = useRef<Array<{ board: (Tile | null)[][]; score: number; moves: number }>>([]);
  // Track seen tile values to only congratulate once ever
  const seenTileValues = useRef<Set<number>>(new Set());

  const pushUndo = (b: (Tile | null)[][], s: number, m: number) => {
    undoStack.current = [
      ...undoStack.current.slice(-2),
      { board: b.map(r => [...r]), score: s, moves: m },
    ];
  };

  useEffect(() => {
    loadProfile();
    checkSavedBoard();
    loadSeenTiles();
  }, []);

  const loadSeenTiles = async () => {
    try {
      const raw = await AsyncStorage.getItem(SEEN_TILES_KEY);
      if (raw) {
        const arr: number[] = JSON.parse(raw);
        seenTileValues.current = new Set(arr);
      }
    } catch {}
  };

  const markTileSeen = async (value: number) => {
    seenTileValues.current.add(value);
    try {
      await AsyncStorage.setItem(
        SEEN_TILES_KEY,
        JSON.stringify(Array.from(seenTileValues.current))
      );
    } catch {}
  };

  const detectTelegramUser = (): { id: string; username: string; avatar?: string } | null => {
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready?.();
        tg.expand?.();
        const user = tg.initDataUnsafe?.user;
        if (user) {
          return {
            id: String(user.id),
            username: user.username || user.first_name || `User${user.id}`,
            avatar: user.photo_url,
          };
        }
      }
    } catch {}
    return null;
  };

  const loadProfile = async () => {
    const tgUser = detectTelegramUser();
    let p: PlayerProfile | null = null;

    if (tgUser) {
      p = await initOrLoadProfile(tgUser.id, tgUser.username, tgUser.avatar);
      if (tgUser.avatar && p.avatarUrl !== tgUser.avatar) {
        p.avatarUrl = tgUser.avatar;
        await saveProfile(p);
      }
    } else {
      p = await getProfile();
      if (!p) {
        const tgId = `tg_${Math.floor(Math.random() * 9000000 + 1000000)}`;
        const { createDefaultProfile } = await import('@/services/storage');
        p = createDefaultProfile(tgId, 'CryptoPlayer');
        await saveProfile(p);
      }
    }

    setProfileState(p);
    setBestScore(p.bestScore);
  };

  const checkSavedBoard = async () => {
    const saved = await getSavedBoard();
    setCanContinue(!!saved);
  };

  const refreshProfile = useCallback(async () => {
    const p = await getProfile();
    if (p) setProfileState(p);
  }, []);

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (isGameOver || isSelectingDestroy) return;

    setBoard(prev => {
      const { board: moved, score: gained, moved: didMove, newTierValue: ntv } = moveBoard(prev, dir);
      if (!didMove) return prev;

      // Save pre-move state for undo (before spawning new tile)
      pushUndo(prev, scoreRef.current, movesRef.current);

      // Check if this tile value is new (never seen before) — only for meaningful merges
      if (ntv && ntv >= 4 && !seenTileValues.current.has(ntv)) {
        setNewTierValue(ntv);
        markTileSeen(ntv);
      }

      setScore(s => {
        const newScore = s + gained;
        scoreRef.current = newScore;
        const newLevel = getLevelFromScore(newScore);

        setLevel(prevLevel => {
          if (newLevel > prevLevel) {
            const reward = LEVEL_REWARDS.find(r => r.level === newLevel);
            if (reward) {
              setLevelUpReward(reward.tokenReward);
              updateProfileTokens(reward.tokenReward, newScore).then(p => {
                if (p) setProfileState(p);
              });
            }
          }
          return newLevel;
        });

        if (newScore > bestScore) setBestScore(newScore);

        const earned = calculateTokensEarned(newScore, s, movesRef.current + 1);
        if (earned > 0) {
          setSessionTokens(st => Math.round((st + earned) * 100) / 100);
          updateProfileTokens(earned, newScore).then(p => {
            if (p) setProfileState(p);
          });
        }
        return newScore;
      });

      movesRef.current += 1;
      setMoves(m => m + 1);

      const { board: withSpawn } = spawnTile(moved, scoreRef.current, movesRef.current);

      if (checkWin(withSpawn) && !isWon) setIsWon(true);

      if (checkGameOver(withSpawn)) {
        setIsGameOver(true);
        // IMPORTANT: Save the PRE-game-over state (last undo entry), not the dead board
        // This way, when user continues, they get a playable board back
        const preGameOverState = undoStack.current[undoStack.current.length - 1];
        if (preGameOverState) {
          saveBoardState(preGameOverState);
        } else {
          saveBoardState({ board: withSpawn, score: scoreRef.current, moves: movesRef.current });
        }
        setCanContinue(true);
      }

      boardRef.current = withSpawn;
      return withSpawn;
    });
  }, [isGameOver, isWon, isSelectingDestroy, bestScore]);

  const newGame = useCallback(() => {
    const fresh = initGame();
    setBoard(fresh);
    boardRef.current = fresh;
    setScore(0);
    scoreRef.current = 0;
    setSessionTokens(0);
    setMoves(0);
    movesRef.current = 0;
    setIsGameOver(false);
    setIsWon(false);
    setLevel(1);
    undoStack.current = [];
    clearSavedBoard();
    setCanContinue(false);

    getProfile().then(p => {
      if (p) {
        p.gamesPlayed += 1;
        saveProfile(p);
        setProfileState(p);
      }
    });
  }, []);

  const continueGame = useCallback(() => setIsWon(false), []);

  const continueFromSaved = useCallback(async () => {
    try {
      const saved = await getSavedBoard();

      if (!saved) {
        newGame();
        return;
      }

      const restoredBoard = saved.board as (Tile | null)[][];
      const restoredScore = saved.score || 0;
      const restoredMoves = saved.moves || 0;

      // Step 1: clear saved state
      await clearSavedBoard();

      // Step 2: restore all game state values FIRST
      boardRef.current = restoredBoard;
      scoreRef.current = restoredScore;
      movesRef.current = restoredMoves;
      undoStack.current = [];

      // Step 3: batch all state updates together, clear isGameOver LAST
      setBoard(restoredBoard);
      setScore(restoredScore);
      setMoves(restoredMoves);
      setLevel(getLevelFromScore(restoredScore));
      setSessionTokens(0);
      setCanContinue(false);
      setIsWon(false);

      // Step 4: clear game over state last with a small delay to let board render first
      setTimeout(() => {
        setIsGameOver(false);
      }, 50);
    } catch {
      newGame();
    }
  }, [newGame]);

  const dismissLevelUp = useCallback(() => setLevelUpReward(null), []);
  const dismissNewTier = useCallback(() => setNewTierValue(null), []);

  const setProfile = useCallback((p: PlayerProfile) => {
    setProfileState(p);
    saveProfile(p);
  }, []);

  const activatePowerUp = useCallback(async (type: PowerUpType): Promise<boolean> => {
    const p = await getProfile();
    if (!p) return false;
    const owned = p.powerUps?.[type] || 0;
    if (owned <= 0) return false;

    if (type === 'undo') {
      const prev = undoStack.current.pop();
      if (!prev) return false;
      const updated = await consumePowerUp('undo');
      if (!updated) return false;
      setProfileState(updated);
      setBoard(prev.board);
      boardRef.current = prev.board;
      setScore(prev.score);
      scoreRef.current = prev.score;
      setMoves(prev.moves);
      movesRef.current = prev.moves;
      setIsGameOver(false);
      setLevel(getLevelFromScore(prev.score));
      return true;
    }

    if (type === 'destroy') {
      setIsSelectingDestroy(true);
      return true;
    }

    if (type === 'clear_blockers') {
      const updated = await consumePowerUp('clear_blockers');
      if (!updated) return false;
      setProfileState(updated);
      setBoard(prev => {
        const cleared = clearAllBlockers(prev);
        boardRef.current = cleared;
        return cleared;
      });
      return true;
    }

    if (type === 'shuffle') {
      const updated = await consumePowerUp('shuffle');
      if (!updated) return false;
      setProfileState(updated);
      setBoard(prev => {
        const tiles: Tile[] = [];
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 4; c++)
            if (prev[r][c]) tiles.push(prev[r][c]!);
        for (let i = tiles.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }
        const nb: (Tile | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));
        let ti = 0;
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 4; c++)
            if (ti < tiles.length) {
              nb[r][c] = { ...tiles[ti++], row: r, col: c, isNew: true, isMerged: false };
            }
        boardRef.current = nb;
        return nb;
      });
      return true;
    }

    return false;
  }, []);

  const selectTileToDestroy = useCallback(async (row: number, col: number) => {
    if (!isSelectingDestroy) return;
    const updated = await consumePowerUp('destroy');
    if (updated) setProfileState(updated);
    setBoard(prev => {
      const nb = destroyTile(prev, row, col);
      boardRef.current = nb;
      return nb;
    });
    setIsSelectingDestroy(false);
  }, [isSelectingDestroy]);

  const cancelDestroy = useCallback(() => setIsSelectingDestroy(false), []);

  const tokens = profile?.totalTokens ?? 0;

  return (
    <GameContext.Provider value={{
      board, score, bestScore, level, tokens, sessionTokens, moves,
      isGameOver, isWon, profile, levelUpReward, newTierValue,
      isSelectingDestroy, canContinue,
      move, newGame, continueGame, continueFromSaved, dismissLevelUp, dismissNewTier,
      setProfile, refreshProfile, activatePowerUp, selectTileToDestroy, cancelDestroy,
    }}>
      {children}
    </GameContext.Provider>
  );
}
