import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  initGame, moveBoard, spawnTile, checkGameOver, checkWin,
  calculateTokensEarned, getLevelFromScore, destroyTile, clearAllBlockers,
} from '@/services/gameEngine';
import {
  getProfile, saveProfile, updateProfileTokens, createDefaultProfile,
  addPowerUp, usePowerUp as consumePowerUp, spendTokensForPowerUp,
  saveBoardState, getSavedBoard, clearSavedBoard, creditReferralEarning,
} from '@/services/storage';
import { Tile, PlayerProfile, LEVEL_REWARDS, PowerUpType, POWER_UPS, DEFAULT_POWER_UPS } from '@/types/game';

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
  newTierValue: number | null;          // for congratulation popup
  isSelectingDestroy: boolean;
  canContinue: boolean;                 // has saved board to restore
  move: (dir: 'up' | 'down' | 'left' | 'right') => void;
  newGame: () => void;
  continueGame: () => void;
  continueFromSaved: () => void;
  dismissLevelUp: () => void;
  dismissNewTier: () => void;
  setProfile: (p: PlayerProfile) => void;
  refreshProfile: () => void;
  // Power-ups
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

  useEffect(() => { loadProfile(); checkSavedBoard(); }, []);

  const loadProfile = async () => {
    let p = await getProfile();
    if (!p) {
      const tgId = `tg_${Math.floor(Math.random() * 9000000 + 1000000)}`;
      p = createDefaultProfile(tgId, 'CryptoPlayer');
      await saveProfile(p);
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

      // Congratulate on new tile tier from merge
      if (ntv && ntv > 2) {
        setNewTierValue(ntv);
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
              updateProfileTokens(reward.tokenReward, newScore).then(p => { if (p) setProfileState(p); });
            }
          }
          return newLevel;
        });

        if (newScore > bestScore) setBestScore(newScore);

        const earned = calculateTokensEarned(newScore, s);
        if (earned > 0) {
          setSessionTokens(st => Math.round((st + earned) * 100) / 100);
          updateProfileTokens(earned, newScore).then(p => { if (p) setProfileState(p); });
        }
        return newScore;
      });

      movesRef.current += 1;
      setMoves(m => m + 1);

      const { board: withSpawn } = spawnTile(moved, scoreRef.current, movesRef.current);

      if (checkWin(withSpawn) && !isWon) setIsWon(true);
      if (checkGameOver(withSpawn)) {
        setIsGameOver(true);
        // Auto-save board for "continue" feature
        saveBoardState({ board: withSpawn, score: scoreRef.current, moves: movesRef.current });
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
    const saved = await getSavedBoard();
    if (!saved) { newGame(); return; }
    setBoard(saved.board);
    boardRef.current = saved.board;
    setScore(saved.score || 0);
    scoreRef.current = saved.score || 0;
    setMoves(saved.moves || 0);
    movesRef.current = saved.moves || 0;
    setIsGameOver(false);
    setIsWon(false);
    setLevel(getLevelFromScore(saved.score || 0));
    clearSavedBoard();
    setCanContinue(false);
  }, [newGame]);

  const dismissLevelUp = useCallback(() => setLevelUpReward(null), []);
  const dismissNewTier = useCallback(() => setNewTierValue(null), []);

  const setProfile = useCallback((p: PlayerProfile) => {
    setProfileState(p);
    saveProfile(p);
  }, []);

  // ─── Power-Ups ──────────────────────────────────────────────────
  const activatePowerUp = useCallback(async (type: PowerUpType): Promise<boolean> => {
    const p = await getProfile();
    if (!p) return false;
    const owned = p.powerUps?.[type] || 0;
    if (owned <= 0) return false;

    if (type === 'undo') {
      const updated = await consumePowerUp('undo');
      if (updated) setProfileState(updated);
      // Undo: reinit board from saved (simplified — just respawn)
      const { board: newBoard } = spawnTile(boardRef.current, scoreRef.current, movesRef.current);
      setBoard(newBoard);
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
      setBoard(prev => clearAllBlockers(prev));
      return true;
    }

    return false;
  }, []);

  const selectTileToDestroy = useCallback(async (row: number, col: number) => {
    if (!isSelectingDestroy) return;
    const updated = await consumePowerUp('destroy');
    if (updated) setProfileState(updated);
    setBoard(prev => destroyTile(prev, row, col));
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
