import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  initGame, moveBoard, spawnTile, checkGameOver, checkWin,
  calculateTokensEarned, getLevelFromScore,
} from '@/services/gameEngine';
import { getProfile, saveProfile, updateProfileTokens, createDefaultProfile } from '@/services/storage';
import { Tile, PlayerProfile, LEVEL_REWARDS, SCORE_PER_LEVEL } from '@/types/game';

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
  move: (dir: 'up' | 'down' | 'left' | 'right') => void;
  newGame: () => void;
  continueGame: () => void;
  dismissLevelUp: () => void;
  setProfile: (p: PlayerProfile) => void;
  refreshProfile: () => void;
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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    let p = await getProfile();
    if (!p) {
      // Create mock Telegram profile
      const tgId = `tg_${Math.floor(Math.random() * 9000000 + 1000000)}`;
      p = createDefaultProfile(tgId, 'CryptoPlayer');
      await saveProfile(p);
    }
    setProfileState(p);
    setBestScore(p.bestScore);
  };

  const refreshProfile = useCallback(async () => {
    const p = await getProfile();
    if (p) setProfileState(p);
  }, []);

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (isGameOver) return;

    setBoard(prev => {
      const { board: moved, score: gained, moved: didMove } = moveBoard(prev, dir);
      if (!didMove) return prev;

      setScore(s => {
        const newScore = s + gained;
        const newLevel = getLevelFromScore(newScore);

        setLevel(prevLevel => {
          if (newLevel > prevLevel) {
            const reward = LEVEL_REWARDS.find(r => r.level === newLevel);
            if (reward) {
              setLevelUpReward(reward.tokenReward);
              // Add level up tokens to profile
              updateProfileTokens(reward.tokenReward, newScore).then(p => {
                if (p) setProfileState(p);
              });
            }
          }
          return newLevel;
        });

        if (newScore > bestScore) setBestScore(newScore);

        const earned = calculateTokensEarned(newScore, s);
        if (earned > 0) {
          setSessionTokens(st => Math.round((st + earned) * 100) / 100);
          updateProfileTokens(earned, newScore).then(p => {
            if (p) setProfileState(p);
          });
        }
        return newScore;
      });

      setMoves(m => m + 1);

      const withSpawn = spawnTile(moved, score, moves);

      if (checkWin(withSpawn) && !isWon) setIsWon(true);
      if (checkGameOver(withSpawn)) setIsGameOver(true);

      return withSpawn;
    });
  }, [isGameOver, isWon, bestScore, score, moves]);

  const newGame = useCallback(() => {
    const fresh = initGame();
    setBoard(fresh);
    setScore(0);
    setSessionTokens(0);
    setMoves(0);
    setIsGameOver(false);
    setIsWon(false);
    setLevel(1);

    // Increment games played
    getProfile().then(p => {
      if (p) {
        p.gamesPlayed += 1;
        saveProfile(p);
        setProfileState(p);
      }
    });
  }, []);

  const continueGame = useCallback(() => {
    setIsWon(false);
  }, []);

  const dismissLevelUp = useCallback(() => {
    setLevelUpReward(null);
  }, []);

  const setProfile = useCallback((p: PlayerProfile) => {
    setProfileState(p);
    saveProfile(p);
  }, []);

  const tokens = profile?.totalTokens ?? 0;

  return (
    <GameContext.Provider value={{
      board, score, bestScore, level, tokens, sessionTokens, moves,
      isGameOver, isWon, profile, levelUpReward,
      move, newGame, continueGame, dismissLevelUp, setProfile, refreshProfile,
    }}>
      {children}
    </GameContext.Provider>
  );
}
