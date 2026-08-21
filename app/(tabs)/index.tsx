import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
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
    score, bestScore, level, sessionTokens, newGame, profile, refreshProfile, newTierValue,
    dismissNewTier, activatePowerUp, earningMultiplier, multiplierSecondsLeft,
    multiplierAdsWatched, recordMultiplierAd,
  } = useGame();
  const [dailyBonus, setDailyBonus] = useState<{ visible: boolean; tokens: number; streak: number }>({ visible: false, tokens: 0, streak: 1 });
  const [adLoading, setAdLoading] = useState(false);
  const [loadingPowerUp, setLoadingPowerUp] = useState<PowerUpType | null>(null);
  const [multiplierLoading, setMultiplierLoading] = useState(false);

  useEffect(() => { checkDailyBonus(); }, []);

  const checkDailyBonus = async () => {
    const state = await getDailyBonusState();
    const today = new Date().toDateString();
    if (state.lastClaimDate !== today) {
      const streakRewards = [50, 100, 150, 200, 250, 350, 500];
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const isConsecutive = state.lastClaimDate === yesterday.toDateString();
      const newStreak = isConsecutive ? Math.min(state.streak + 1, 7) : 1;
      setDailyBonus({ visible: true, tokens: streakRewards[Math.min(newStreak - 1, 6)], streak: newStreak });
    }
  };

  const handleClaimBonus = async () => { await claimDailyBonus(); setDailyBonus(d => ({ ...d, visible: false })); refreshProfile(); };

  const handlePowerUpPress = useCallback(async (type: PowerUpType) => {
    const owned = profile?.powerUps?.[type] || 0;
    if (owned > 0) {
      const ok = await activatePowerUp(type);
      if (!ok) Alert.alert('Could not activate', 'This power-up could not be used right now.');
      return;
    }
    setLoadingPowerUp(type); setAdLoading(true);
    try {
      const result = await showRewardedAd();
      if (result.watched) {
        const updated = await addPowerUp(type); if (updated) refreshProfile();
        const ok = await activatePowerUp(type); if (!ok) Alert.alert('Error', 'Power-up could not be activated.');
      } else Alert.alert('Ad Required', 'Watch the full ad to earn this power-up.');
    } finally { setAdLoading(false); setLoadingPowerUp(null); }
  }, [profile, activatePowerUp, refreshProfile]);

  const handlePowerUpTokens = useCallback(async (type: PowerUpType, cost: number) => {
    const updated = await spendTokensForPowerUp(type, cost);
    if (updated) { refreshProfile(); await activatePowerUp(type); }
    else Alert.alert('Insufficient Tokens', `You need ${cost} MG to buy this power-up.`);
  }, [activatePowerUp, refreshProfile]);

  const handleMultiplier = useCallback(async () => {
    if (earningMultiplier >= 3 || multiplierLoading) return;
    setMultiplierLoading(true); setAdLoading(true);
    try {
      const result = await showRewardedAd();
      if (result.watched) recordMultiplierAd();
      else Alert.alert('Ad Required', 'Watch the full ad to activate the next MG multiplier tier.');
    } finally { setAdLoading(false); setMultiplierLoading(false); }
  }, [earningMultiplier, multiplierLoading, recordMultiplierAd]);

  const formatTimer = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const multiplierStep = earningMultiplier >= 3 ? '3×' : earningMultiplier === 2 ? '2×' : '1×';
  const nextAdLabel = earningMultiplier === 1 ? 'Watch 1 Ad' : 'Watch 2nd Ad';
  const multiplierDescription = earningMultiplier >= 3
    ? 'Maximum multiplier active'
    : earningMultiplier === 2
      ? 'One more rewarded ad upgrades to 3×'
      : 'Watch a rewarded ad to reach 2×';

  return (
    <LinearGradient colors={['#062A1D', '#0A3B29', '#F4FFF8']} style={[styles.container, { paddingTop: Math.max(insets.top, 4) }]}>
      <View style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.logoRow}>
            <BrandMark size={42} />
            <View style={styles.brandText}>
              <Text style={styles.logo}>MintGrow</Text>
              <Text style={styles.tagline}>BLOCK PUZZLE ARENA</Text>
            </View>
          </View>
          <View style={styles.walletChip}>
            <View style={styles.walletIcon}><MaterialIcons name="eco" size={15} color="#0A7F55" /></View>
            <Text style={styles.walletValue}>{(profile?.totalTokens ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} MG</Text>
            <View style={styles.walletPlus}><MaterialIcons name="add" size={16} color="#FFFFFF" /></View>
          </View>
        </View>

        <View style={styles.multiplierCard}>
          <View style={styles.boltCircle}><MaterialIcons name="bolt" size={21} color="#FFFFFF" /></View>
          <View style={styles.multiplierCopy}>
            <Text style={styles.multiplierTitle}>MG Earning Multiplier</Text>
            <Text style={styles.multiplierSub}>{earningMultiplier > 1 ? `${formatTimer(multiplierSecondsLeft)} remaining` : multiplierDescription}</Text>
          </View>
          <View style={styles.multiplierSteps}>
            <View style={[styles.step, earningMultiplier >= 2 && styles.stepActive]}>
              <Text style={[styles.stepLabel, earningMultiplier >= 2 && styles.stepLabelActive]}>Watch 1 Ad</Text>
              <Text style={[styles.stepValue, earningMultiplier >= 2 && styles.stepValueActive]}>2×</Text>
            </View>
            <MaterialIcons name="chevron_right" size={18} color={Colors.primary} />
            <View style={[styles.step, earningMultiplier >= 3 && styles.stepActive]}>
              <Text style={[styles.stepLabel, earningMultiplier >= 3 && styles.stepLabelActive]}>Watch 2 Ads</Text>
              <Text style={[styles.stepValue, earningMultiplier >= 3 && styles.stepValueActive]}>3×</Text>
            </View>
          </View>
          <Pressable style={[styles.multiplierAction, earningMultiplier >= 3 && styles.multiplierActionDisabled]} onPress={handleMultiplier} disabled={earningMultiplier >= 3 || multiplierLoading}>
            <MaterialIcons name={earningMultiplier >= 3 ? 'timer' : 'play-arrow'} size={16} color={earningMultiplier >= 3 ? Colors.textMuted : '#FFFFFF'} />
            <Text style={[styles.multiplierActionText, earningMultiplier >= 3 && styles.multiplierActionTextDisabled]}>{earningMultiplier >= 3 ? formatTimer(multiplierSecondsLeft) : multiplierLoading ? '...' : nextAdLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.scoreStrip}>
          <ScoreCard label="Score" value={score.toLocaleString()} />
          <ScoreCard label="Best" value={bestScore.toLocaleString()} />
          <ScoreCard label="MG Earned" value={`+${sessionTokens.toFixed(0)}`} accent />
        </View>

        <View style={styles.gameHeader}>
          <View>
            <Text style={styles.season}>SEASON 01</Text>
            <Text style={styles.gameTitle}>Crypto Merge Run</Text>
          </View>
          <View style={styles.levelPill}><Text style={styles.levelText}>LV {level}</Text></View>
        </View>
        <LevelProgressBar score={score} level={level} />

        <View style={styles.boardArea}><GameBoard /></View>
      </View>

      <PowerUpBar onWatchAd={handlePowerUpPress} onSpendTokens={handlePowerUpTokens} loading={loadingPowerUp} />
      <GameOverModal />
      <LevelUpModal />
      <NewTileModal visible={newTierValue !== null} tileValue={newTierValue ?? 4} onDismiss={dismissNewTier} />
      <DailyBonusModal visible={dailyBonus.visible} tokens={dailyBonus.tokens} streak={dailyBonus.streak} onClaim={handleClaimBonus} />
      <AdLoadingOverlay visible={adLoading} message="Loading rewarded ad..." />
    </LinearGradient>
  );
}

function LevelProgressBar({ score, level }: { score: number; level: number }) {
  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000];
  const curr = thresholds[level - 1] || 0;
  const next = thresholds[level] || curr + 1;
  const pct = Math.max(Math.min(((score - curr) / (next - curr)) * 100, 100), 2);
  return <View style={lStyles.container}><View style={lStyles.bar}><View style={[lStyles.fill, { width: `${pct}%` }]} /></View><Text style={lStyles.text}>LV {level}  ·  {score.toLocaleString()} / {next.toLocaleString()}</Text></View>;
}

const lStyles = StyleSheet.create({
  container: { paddingHorizontal: 4, marginBottom: 2 },
  bar: { height: 4, backgroundColor: '#DCEEE4', borderRadius: 4, overflow: 'hidden', marginBottom: 2 },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  text: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', fontSize: 9 },
});

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, overflow: 'hidden' },
  screen: { flex: 1, minHeight: 0, paddingHorizontal: 9, paddingTop: 4, paddingBottom: 3 },
  hero: { height: 46, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { justifyContent: 'center' },
  logo: { fontSize: 21, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 },
  tagline: { fontSize: 8.5, fontWeight: '800', color: '#B7F7D7', letterSpacing: 1.25, marginTop: 1 },
  walletChip: { height: 34, borderRadius: Radius.full, backgroundColor: '#E9FFF2', flexDirection: 'row', alignItems: 'center', paddingLeft: 5, paddingRight: 5, gap: 5, borderWidth: 1, borderColor: '#B8FFD9' },
  walletIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#C8F7DA', alignItems: 'center', justifyContent: 'center' },
  walletValue: { fontSize: 12, fontWeight: '900', color: '#0A5C40' },
  walletPlus: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  multiplierCard: { minHeight: 58, backgroundColor: '#F0FFF7', borderRadius: 16, borderWidth: 1, borderColor: '#B8FFD9', padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  boltCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  multiplierCopy: { width: 98, minWidth: 88 },
  multiplierTitle: { fontSize: 10.5, fontWeight: '900', color: Colors.textPrimary },
  multiplierSub: { fontSize: 8.5, color: Colors.textMuted, marginTop: 1, lineHeight: 11 },
  multiplierSteps: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  step: { minWidth: 55, height: 39, borderRadius: 11, backgroundColor: '#E5F8ED', borderWidth: 1, borderColor: '#C8E8D6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  stepActive: { backgroundColor: '#CFF8DF', borderColor: Colors.primary },
  stepLabel: { fontSize: 7.5, fontWeight: '700', color: Colors.textMuted },
  stepLabelActive: { color: '#0A7F55' },
  stepValue: { fontSize: 15, lineHeight: 16, fontWeight: '900', color: Colors.textPrimary },
  stepValueActive: { color: Colors.primary },
  multiplierAction: { height: 36, minWidth: 66, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2, paddingHorizontal: 7 },
  multiplierActionDisabled: { backgroundColor: '#E2ECE7' },
  multiplierActionText: { fontSize: 8.5, fontWeight: '900', color: '#FFFFFF' },
  multiplierActionTextDisabled: { color: Colors.textMuted },
  scoreStrip: { height: 55, flexDirection: 'row', gap: 5, marginBottom: 4 },
  gameHeader: { height: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  season: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2, color: Colors.primary },
  gameTitle: { fontSize: 17, lineHeight: 19, fontWeight: '900', color: Colors.textPrimary },
  levelPill: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  levelText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  boardArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
});
