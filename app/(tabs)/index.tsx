import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { GameBoard } from '@/components/game/GameBoard';
import { ScoreCard } from '@/components/game/ScoreCard';
import { GameOverModal } from '@/components/game/GameOverModal';
import { LevelUpModal } from '@/components/game/LevelUpModal';
import { PowerUpBar } from '@/components/game/PowerUpBar';
import { DailyBonusModal } from '@/components/ui/DailyBonusModal';
import { NewTileModal } from '@/components/ui/NewTileModal';
import { AdLoadingOverlay } from '@/components/ui/AdLoadingOverlay';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { PowerUpType } from '@/types/game';
import { claimDailyBonus, getDailyBonusState, addPowerUp, spendTokensForPowerUp } from '@/services/storage';
import { showRewardedAd } from '@/services/monetag';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const {
    score, bestScore, level, sessionTokens, newGame, profile, refreshProfile,
    newTierValue, dismissNewTier, activatePowerUp,
  } = useGame();

  const [dailyBonus, setDailyBonus] = useState<{ visible: boolean; tokens: number; streak: number }>({
    visible: false, tokens: 0, streak: 1,
  });
  const [adLoading, setAdLoading] = useState(false);
  const [loadingPowerUp, setLoadingPowerUp] = useState<PowerUpType | null>(null);

  useEffect(() => { checkDailyBonus(); }, []);

  const checkDailyBonus = async () => {
    const state = await getDailyBonusState();
    const today = new Date().toDateString();
    if (state.lastClaimDate !== today) {
      const streakRewards = [50, 100, 150, 200, 250, 350, 500];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isConsecutive = state.lastClaimDate === yesterday.toDateString();
      const newStreak = isConsecutive ? Math.min(state.streak + 1, 7) : 1;
      const tokens = streakRewards[Math.min(newStreak - 1, 6)];
      setDailyBonus({ visible: true, tokens, streak: newStreak });
    }
  };

  const handleClaimBonus = async () => {
    await claimDailyBonus();
    setDailyBonus(d => ({ ...d, visible: false }));
    refreshProfile();
  };

  const handlePowerUpPress = useCallback(async (type: PowerUpType) => {
    const owned = profile?.powerUps?.[type] || 0;
    if (owned > 0) {
      const ok = await activatePowerUp(type);
      if (!ok) Alert.alert('Could not activate', 'This power-up could not be used right now.');
      return;
    }
    // Watch ad to earn one and immediately use it
    setLoadingPowerUp(type);
    setAdLoading(true);
    try {
      const result = await showRewardedAd();
      if (result.watched) {
        const updated = await addPowerUp(type);
        if (updated) refreshProfile();
        const ok = await activatePowerUp(type);
        if (!ok) Alert.alert('Error', 'Power-up could not be activated.');
      } else {
        Alert.alert('Ad Required', 'Watch the full ad to earn this power-up.');
      }
    } finally {
      setAdLoading(false);
      setLoadingPowerUp(null);
    }
  }, [profile, activatePowerUp, refreshProfile]);

  const handlePowerUpTokens = useCallback(async (type: PowerUpType, cost: number) => {
    const updated = await spendTokensForPowerUp(type, cost);
    if (updated) {
      refreshProfile();
      await activatePowerUp(type);
    } else {
      Alert.alert('Insufficient Tokens', `You need ${cost} MG to buy this power-up.`);
    }
  }, [activatePowerUp, refreshProfile]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logoImg} contentFit="contain" />
          <View>
            <Text style={styles.logo}>MintGrow</Text>
            <Text style={styles.tagline}>Merge · Earn · Withdraw</Text>
          </View>
        </View>
        <Pressable style={styles.newGameBtn} onPress={newGame} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="refresh" size={15} color={Colors.primary} />
          <Text style={styles.newGameText}>New</Text>
        </Pressable>
      </View>

      {/* Score Row */}
      <View style={styles.scoreRow}>
        <ScoreCard label="Score" value={score.toLocaleString()} />
        <ScoreCard label="Best" value={bestScore.toLocaleString()} />
        <ScoreCard label="Level" value={`L${level}`} accent />
        <ScoreCard label="Session" value={`+${sessionTokens.toFixed(0)} MG`} accent />
      </View>

      {/* Level Progress */}
      <LevelProgressBar score={score} level={level} />

      {/* Game Board — fills remaining space */}
      <View style={styles.boardWrapper}>
        <GameBoard />
      </View>

      {/* Power-Up Bar — pinned to bottom above tab bar */}
      <PowerUpBar onWatchAd={handlePowerUpPress} onSpendTokens={handlePowerUpTokens} loading={loadingPowerUp} />

      {/* Modals */}
      <GameOverModal />
      <LevelUpModal />
      <NewTileModal visible={newTierValue !== null} tileValue={newTierValue ?? 4} onDismiss={dismissNewTier} />
      <DailyBonusModal
        visible={dailyBonus.visible}
        tokens={dailyBonus.tokens}
        streak={dailyBonus.streak}
        onClaim={handleClaimBonus}
      />
      <AdLoadingOverlay visible={adLoading} message="Earning your power-up..." />
    </View>
  );
}

function LevelProgressBar({ score, level }: { score: number; level: number }) {
  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000];
  const curr = thresholds[level - 1] || 0;
  const next = thresholds[level] || curr + 1;
  const pct = Math.max(Math.min(((score - curr) / (next - curr)) * 100, 100), 2);

  return (
    <View style={lStyles.container}>
      <View style={lStyles.bar}>
        <View style={[lStyles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={lStyles.text}>Lv {level} → {level + 1}  ·  {score.toLocaleString()} / {next.toLocaleString()}</Text>
    </View>
  );
}

const lStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, marginBottom: 6 },
  bar: { height: 5, backgroundColor: Colors.bgSurface, borderRadius: 4, overflow: 'hidden', marginBottom: 3, borderWidth: 1, borderColor: Colors.border },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  text: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoImg: { width: 36, height: 36, borderRadius: 8 },
  logo: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  tagline: { ...Typography.caption, color: Colors.textMuted },
  newGameBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: Colors.primary, gap: 4,
  },
  newGameText: { ...Typography.smallBold, color: Colors.primary },
  scoreRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  boardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
  },
});
