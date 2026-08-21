import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, useWindowDimensions } from 'react-native';
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
import { Colors } from '@/constants/theme';
import { BrandMark } from '@/components/ui/BrandMark';
import { PowerUpType } from '@/types/game';
import { claimDailyBonus, getDailyBonusState, addPowerUp, spendTokensForPowerUp } from '@/services/storage';
import { showRewardedAd } from '@/services/monetag';

export default function GameScreen() {
  const { width, height } = useWindowDimensions();
  const compact = height < 780;
  const ultraCompact = height < 680;
  const ui = ultraCompact ? 0.78 : compact ? 0.87 : Math.min(1, Math.max(0.92, height / 900));
  const { score, bestScore, level, sessionTokens, newGame, profile, refreshProfile, newTierValue, dismissNewTier, activatePowerUp, earningMultiplier, multiplierSecondsLeft, recordMultiplierAd } = useGame();
  const [dailyBonus, setDailyBonus] = useState({ visible: false, tokens: 0, streak: 1 });
  const [adLoading, setAdLoading] = useState(false);
  const [loadingPowerUp, setLoadingPowerUp] = useState<PowerUpType | null>(null);
  const [multiplierLoading, setMultiplierLoading] = useState(false);

  useEffect(() => { checkDailyBonus(); }, []);
  const checkDailyBonus = async () => {
    const state = await getDailyBonusState(); const today = new Date().toDateString();
    if (state.lastClaimDate !== today) {
      const rewards = [50, 100, 150, 200, 250, 350, 500]; const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const streak = state.lastClaimDate === yesterday.toDateString() ? Math.min(state.streak + 1, 7) : 1;
      setDailyBonus({ visible: true, tokens: rewards[Math.min(streak - 1, 6)], streak });
    }
  };
  const handleClaimBonus = async () => { await claimDailyBonus(); setDailyBonus(d => ({ ...d, visible: false })); refreshProfile(); };
  const handlePowerUpPress = useCallback(async (type: PowerUpType) => {
    const owned = profile?.powerUps?.[type] || 0;
    if (owned > 0) { const ok = await activatePowerUp(type); if (!ok) Alert.alert('Could not activate', 'This power-up could not be used right now.'); return; }
    setLoadingPowerUp(type); setAdLoading(true);
    try { const result = await showRewardedAd(); if (result.watched) { const updated = await addPowerUp(type); if (updated) refreshProfile(); const ok = await activatePowerUp(type); if (!ok) Alert.alert('Error', 'Power-up could not be activated.'); } else Alert.alert('Ad Required', 'Watch the full ad to earn this power-up.'); }
    finally { setAdLoading(false); setLoadingPowerUp(null); }
  }, [profile, activatePowerUp, refreshProfile]);
  const handlePowerUpTokens = useCallback(async (type: PowerUpType, cost: number) => {
    const updated = await spendTokensForPowerUp(type, cost); if (updated) { refreshProfile(); await activatePowerUp(type); } else Alert.alert('Insufficient Tokens', `You need ${cost} MG to buy this power-up.`);
  }, [activatePowerUp, refreshProfile]);
  const handleMultiplier = useCallback(async () => {
    if (earningMultiplier >= 3 || multiplierLoading) return; setMultiplierLoading(true); setAdLoading(true);
    try { const result = await showRewardedAd(); if (result.watched) recordMultiplierAd(); else Alert.alert('Ad Required', 'Watch the full ad to activate the next multiplier tier.'); }
    finally { setAdLoading(false); setMultiplierLoading(false); }
  }, [earningMultiplier, multiplierLoading, recordMultiplierAd]);

  const timer = `${Math.floor(multiplierSecondsLeft / 60)}:${String(multiplierSecondsLeft % 60).padStart(2, '0')}`;
  const multiplierText = earningMultiplier > 1 ? `${earningMultiplier}×  ${timer}` : '1×';

  return (
    <LinearGradient colors={['#062A1D', '#0A3B29', '#F4FFF8']} style={styles.container}>
      <View style={[styles.content, { paddingHorizontal: compact ? 10 : 16, paddingTop: compact ? 1 : 4 }]}>
        <View style={[styles.topHeader, { height: 70 * ui }]}>
          <View style={[styles.brandRow, { gap: 8 * ui }]}><BrandMark size={Math.round(44 * ui)} /><View><Text style={[styles.brand, { fontSize: Math.round(27 * ui) }]}>MintGrow</Text><Text style={[styles.tagline, { fontSize: Math.max(8, Math.round(10 * ui)) }]}>BLOCK PUZZLE ARENA</Text></View></View>
          <View style={[styles.headerActions, { gap: 3 * ui }]}>
            <Pressable onPress={handleMultiplier} disabled={earningMultiplier >= 3 || multiplierLoading} style={[styles.multiplierChip, { height: Math.max(22, Math.round(25 * ui)), minWidth: Math.round(58 * ui) }, earningMultiplier > 1 && styles.multiplierChipActive]}>
              <MaterialIcons name="bolt" size={Math.max(12, Math.round(14 * ui))} color={earningMultiplier > 1 ? '#FFFFFF' : '#0A6B4A'} /><Text style={[styles.multiplierChipText, { fontSize: Math.max(9, Math.round(10 * ui)) }, earningMultiplier > 1 && styles.multiplierChipTextActive]}>{multiplierLoading ? '...' : multiplierText}</Text>
            </Pressable>
            <Pressable onPress={newGame} style={[styles.restartButton, { height: Math.max(36, Math.round(42 * ui)), minWidth: Math.round(138 * ui), borderRadius: Math.round(23 * ui), paddingHorizontal: Math.round(15 * ui) }]}><MaterialIcons name="refresh" size={Math.max(17, Math.round(20 * ui))} color="#063A2A" /><Text style={[styles.restartText, { fontSize: Math.max(14, Math.round(16 * ui)) }]}>Restart</Text></Pressable>
          </View>
        </View>

        <View style={[styles.arenaCard, { borderRadius: Math.round(38 * ui), paddingHorizontal: compact ? 11 : 17, paddingTop: Math.round(10 * ui), paddingBottom: 3 }]}>
          <View style={[styles.arenaHeader, { height: Math.round(56 * ui) }]}><View><Text style={[styles.season, { fontSize: Math.max(11, Math.round(13 * ui)) }]}>SEASON 01</Text><Text style={[styles.title, { fontSize: Math.max(20, Math.round(25 * ui)), lineHeight: Math.max(23, Math.round(28 * ui)) }]}>Crypto Merge Run</Text></View><View style={[styles.levelPill, { minWidth: Math.round(82 * ui), height: Math.round(54 * ui), borderRadius: Math.round(28 * ui) }]}><Text style={[styles.levelText, { fontSize: Math.max(16, Math.round(19 * ui)) }]}>LV {level}</Text></View></View>
          <View style={[styles.scoreStrip, { height: Math.round(82 * ui), gap: Math.max(6, Math.round(9 * ui)), marginBottom: Math.max(2, Math.round(5 * ui)) }]}><ScoreCard label="Score" value={score.toLocaleString()} /><ScoreCard label="Best" value={bestScore.toLocaleString()} /><ScoreCard label="Earned" value={`+${sessionTokens.toFixed(0)}`} accent /></View>
          <LevelProgressBar score={score} level={level} compact={compact} />
          <View style={styles.boardSection}><GameBoard /></View>
        </View>
      </View>
      <PowerUpBar onWatchAd={handlePowerUpPress} onSpendTokens={handlePowerUpTokens} loading={loadingPowerUp} />
      <GameOverModal /><LevelUpModal />
      <NewTileModal visible={newTierValue !== null} tileValue={newTierValue ?? 4} onDismiss={dismissNewTier} />
      <DailyBonusModal visible={dailyBonus.visible} tokens={dailyBonus.tokens} streak={dailyBonus.streak} onClaim={handleClaimBonus} />
      <AdLoadingOverlay visible={adLoading} message="Loading rewarded ad..." />
    </LinearGradient>
  );
}

function LevelProgressBar({ score, level, compact }: { score: number; level: number; compact?: boolean }) {
  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000]; const curr = thresholds[level - 1] || 0; const next = thresholds[level] || curr + 1;
  const pct = Math.max(Math.min(((score - curr) / (next - curr)) * 100, 100), 2);
  return <View style={[progress.container, compact && { marginBottom: 1 }]}><View style={[progress.bar, compact && { height: 4 }]}><View style={[progress.fill, { width: `${pct}%` }]} /></View><Text style={[progress.text, compact && { fontSize: 7, marginTop: 1 }]}>LV {level}  ·  {score.toLocaleString()} / {next.toLocaleString()}</Text></View>;
}
const progress = StyleSheet.create({ container: { marginHorizontal: 1, marginBottom: 3 }, bar: { height: 5, backgroundColor: '#DCEDE4', borderRadius: 5, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 }, text: { fontSize: 8, color: '#7C9F90', textAlign: 'center', marginTop: 2, fontWeight: '700' } });
const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: 27, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.8 },
  tagline: { fontSize: 10, fontWeight: '800', color: '#B7F7D7', letterSpacing: 1.3, marginTop: 1 },
  headerActions: { alignItems: 'flex-end' },
  restartButton: { backgroundColor: '#BFF9D9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  restartText: { fontSize: 16, fontWeight: '900', color: '#063A2A' },
  multiplierChip: { borderRadius: 13, backgroundColor: '#E5FFF0', borderWidth: 1, borderColor: '#B7F1D2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 7 },
  multiplierChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  multiplierChipText: { fontSize: 10, fontWeight: '900', color: '#0A6B4A' }, multiplierChipTextActive: { color: '#FFFFFF' },
  arenaCard: { flex: 1, minHeight: 0, backgroundColor: '#F5F8F6', borderWidth: 1, borderColor: '#E5F0EA', overflow: 'hidden' },
  arenaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  season: { fontSize: 13, fontWeight: '900', color: Colors.primary, letterSpacing: 1.7 }, title: { fontSize: 25, lineHeight: 28, fontWeight: '900', color: '#073B2B', letterSpacing: -0.6 },
  levelPill: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }, levelText: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  scoreStrip: { flexDirection: 'row', marginTop: 2 }, boardSection: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' },
});
