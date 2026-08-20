import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
import { BrandMark } from '@/components/ui/BrandMark';
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
    <LinearGradient colors={['#06251A', '#0B3D2B', '#F4FFF8']} style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.playfield} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoRow}>
            <BrandMark size={52} />
            <View>
              <Text style={styles.logo}>MintGrow</Text>
              <Text style={styles.tagline}>Block Puzzle Arena</Text>
            </View>
          </View>
          <Pressable style={styles.newGameBtn} onPress={newGame} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="refresh" size={16} color="#06251A" />
            <Text style={styles.newGameText}>Restart</Text>
          </Pressable>
        </View>

        <View style={styles.arenaCard}>
          <View style={styles.stageHeader}>
            <View>
              <Text style={styles.stageLabel}>Season 01</Text>
              <Text style={styles.stageTitle}>Crypto Merge Run</Text>
            </View>
            <View style={styles.levelPill}>
              <Text style={styles.levelPillText}>LV {level}</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <ScoreCard label="Score" value={score.toLocaleString()} />
            <ScoreCard label="Best" value={bestScore.toLocaleString()} />
            <ScoreCard label="Earned" value={`+${sessionTokens.toFixed(0)}`} accent />
          </View>

          <LevelProgressBar score={score} level={level} />

          <View style={styles.boardWrapper}>
            <GameBoard />
          </View>
        </View>

        <View style={styles.missionStrip}>
          <View style={styles.missionItem}><Text style={styles.missionIcon}>🎯</Text><Text style={styles.missionText}>Merge higher coins</Text></View>
          <View style={styles.missionItem}><Text style={styles.missionIcon}>🎲</Text><Text style={styles.missionText}>Random MG rewards</Text></View>
          <View style={styles.missionItem}><Text style={styles.missionIcon}>🏦</Text><Text style={styles.missionText}>Withdraw BEP-20</Text></View>
        </View>
      </ScrollView>

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
    </LinearGradient>
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
  container: { flex: 1 },
  playfield: { padding: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.md },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.sm },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.4 },
  tagline: { ...Typography.caption, color: '#B7F7D7', textTransform: 'uppercase', letterSpacing: 1.4 },
  newGameBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#B8FFD9',
    borderRadius: Radius.full, paddingVertical: 10, paddingHorizontal: 14, gap: 5,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, elevation: 6,
  },
  newGameText: { ...Typography.smallBold, color: '#06251A' },
  arenaCard: {
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 28, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', shadowColor: '#00180F',
    shadowOpacity: 0.24, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 10,
  },
  stageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  stageLabel: { ...Typography.caption, color: Colors.primary, letterSpacing: 1.6, textTransform: 'uppercase' },
  stageTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  levelPill: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full },
  levelPillText: { ...Typography.smallBold, color: '#fff' },
  scoreRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm },
  boardWrapper: { justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.md },
  missionStrip: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: 'rgba(6,37,26,0.9)',
    borderRadius: Radius.xl, padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(184,255,217,0.25)',
  },
  missionItem: { flex: 1, alignItems: 'center', gap: 3 },
  missionIcon: { fontSize: 18 },
  missionText: { ...Typography.caption, color: '#DFFFF0', textAlign: 'center' },
});
