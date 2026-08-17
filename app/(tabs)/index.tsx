import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert
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
import { Colors, Spacing, Typography, Radius, COIN_TILES } from '@/constants/theme';
import { PowerUpType, POWER_UPS } from '@/types/game';
import { claimDailyBonus, getDailyBonusState, addPowerUp, spendTokensForPowerUp } from '@/services/storage';
import { showRewardedAd, showInterstitialAd } from '@/services/monetag';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { score, bestScore, level, sessionTokens, newGame, profile, refreshProfile, newTierValue, dismissNewTier, activatePowerUp, continueFromSaved, canContinue } = useGame();

  const [dailyBonus, setDailyBonus] = useState<{ visible: boolean; tokens: number; streak: number }>({
    visible: false, tokens: 0, streak: 1,
  });
  const [adLoading, setAdLoading] = useState(false);
  const [loadingPowerUp, setLoadingPowerUp] = useState<PowerUpType | null>(null);

  useEffect(() => {
    checkDailyBonus();
  }, []);

  const checkDailyBonus = async () => {
    const state = await getDailyBonusState();
    const today = new Date().toDateString();
    if (state.lastClaimDate !== today) {
      // Show bonus modal — calculate what they'll get
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

  const handlePowerUpAdWatch = useCallback(async (type: PowerUpType) => {
    const owned = profile?.powerUps?.[type] || 0;
    if (owned > 0) {
      // Use owned power-up
      const ok = await activatePowerUp(type);
      if (!ok) Alert.alert('Error', 'Could not activate power-up');
      return;
    }

    // Earn new one via ad
    setLoadingPowerUp(type);
    setAdLoading(true);
    try {
      const result = await showRewardedAd();
      if (result.watched) {
        const updated = await addPowerUp(type);
        if (updated) refreshProfile();
        // Immediately activate
        await activatePowerUp(type);
      } else {
        Alert.alert('Ad Required', 'Please watch the full ad to earn this power-up');
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
      Alert.alert('Insufficient Tokens', `You need ${cost} MG to buy this power-up`);
    }
  }, [activatePowerUp, refreshProfile]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logoImg}
            contentFit="contain"
          />
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

      {/* Game Board */}
      <GameBoard />

      {/* Swipe hint */}
      <Text style={styles.hint}>↑↓←→ Swipe to merge coins · Reach 1 Billion MG!</Text>

      {/* Coin Legend */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legendScroll}
        contentContainerStyle={styles.legend}
      >
        {COIN_TILES.slice(0, 10).map(coin => (
          <View key={coin.symbol} style={styles.legendItem}>
            <Text style={styles.legendEmoji}>{coin.emoji}</Text>
            <Text style={[styles.legendSymbol, { color: coin.color }]}>{coin.symbol}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Power-Up Bar */}
      <PowerUpBar
        onWatchAd={handlePowerUpAdWatch}
        onSpendTokens={handlePowerUpTokens}
        loading={loadingPowerUp}
      />

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
  const progress = Math.min((score - curr) / (next - curr), 1);

  return (
    <View style={lStyles.container}>
      <View style={lStyles.bar}>
        <View style={[lStyles.fill, { width: `${Math.max(progress * 100, 2)}%` }]} />
      </View>
      <Text style={lStyles.text}>
        Lv {level} → {level + 1} · {score.toLocaleString()} / {next.toLocaleString()}
      </Text>
    </View>
  );
}

const lStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  bar: { height: 5, backgroundColor: Colors.bgSurface, borderRadius: 4, overflow: 'hidden', marginBottom: 3, borderWidth: 1, borderColor: Colors.border },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  text: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoImg: { width: 36, height: 36, borderRadius: 8 },
  logo: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  tagline: { ...Typography.caption, color: Colors.textMuted },
  newGameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: 4,
  },
  newGameText: { ...Typography.smallBold, color: Colors.primary },
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  hint: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  legendScroll: { flexGrow: 0 },
  legend: { paddingHorizontal: Spacing.md, paddingVertical: 4, gap: Spacing.md },
  legendItem: { alignItems: 'center', gap: 1 },
  legendEmoji: { fontSize: 16 },
  legendSymbol: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
});
