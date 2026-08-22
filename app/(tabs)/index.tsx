import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, useWindowDimensions, ScrollView } from 'react-native';
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
import { claimDailyBonus, getDailyBonusState, addPowerUp, spendTokensForPowerUp, creditMiningTokens } from '@/services/storage';
import { showRewardedAd } from '@/services/monetag';

type GameMode = 'select' | 'merge' | 'mine';

export default function GameScreen() {
  const [mode, setMode] = useState<GameMode>('select');
  if (mode === 'select') return <GameSelection onSelect={setMode} />;
  if (mode === 'mine') return <TapToMine onBack={() => setMode('select')} />;
  return <MergeGame onBack={() => setMode('select')} />;
}

function AppHeader({ mode, onBack, onRestart, multiplier, timer, onMultiplier }: { mode: string; onBack?: () => void; onRestart?: () => void; multiplier?: number; timer?: string; onMultiplier?: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  return <View style={[styles.appHeader, compact && styles.appHeaderCompact]}>
    <View style={styles.headerBrand}>
      {onBack ? <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}><MaterialIcons name="arrow-back" size={22} color="#FFFFFF" /></Pressable> : null}
      <BrandMark size={compact ? 38 : 44} />
      <View><Text style={styles.brand}>MintGrow</Text><Text style={styles.tagline}>{mode === 'mine' ? 'TAP TO MINE' : 'PLAY • EARN • GROW'}</Text></View>
    </View>
    <View style={styles.headerActions}>
      {onMultiplier && <Pressable onPress={onMultiplier} style={[styles.multiplierChip, multiplier && multiplier > 1 ? styles.multiplierActive : null]}><MaterialIcons name="bolt" size={14} color={multiplier && multiplier > 1 ? '#FFFFFF' : '#0A6B4A'} /><Text style={[styles.multiplierText, multiplier && multiplier > 1 ? styles.multiplierTextActive : null]}>{multiplier || 1}×{timer ? ` ${timer}` : ''}</Text></Pressable>}
      {onRestart && <Pressable onPress={onRestart} style={styles.restartButton}><MaterialIcons name="refresh" size={19} color="#063A2A" /><Text style={styles.restartText}>Restart</Text></Pressable>}
    </View>
  </View>;
}

function GameSelection({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  const { width } = useWindowDimensions(); const compact = width < 390; const { profile } = useGame(); const balance = profile?.totalTokens ?? 0;
  return <LinearGradient colors={['#062A1D', '#0A3B29', '#EFFFF6']} style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.selectionContent, compact && { paddingHorizontal: 12 }]}>
      <AppHeader mode="select" />
      <View style={styles.selectionCard}>
        <View style={styles.welcomeCard}><View style={styles.welcomeIcon}><MaterialIcons name="account-balance-wallet" size={30} color="#FFFFFF" /></View><View style={{ flex: 1 }}><Text style={styles.welcomeTitle}>Welcome to MintGrow</Text><Text style={styles.welcomeSub}>Choose a game and start earning MG points.</Text></View></View>
        <Text style={styles.sectionHeading}>Select Game</Text>
        <GameChoice icon="view-module" title="Crypto Merge Run" subtitle="Merge coins, build bigger rewards!" onPress={() => onSelect('merge')} />
        <GameChoice icon="touch-app" title="Tap to Mine" subtitle="Tap, earn and upgrade your mine!" onPress={() => onSelect('mine')} />
        <View style={styles.statsCard}><Text style={styles.statsTitle}>Your Stats</Text><View style={styles.statsRow}><Stat icon="monetization-on" label="MG" value={balance.toLocaleString()} /><Stat icon="group" label="Referrals" value={String(profile?.referralCount ?? 0)} /><Stat icon="military-tech" label="Level" value={String(profile?.level ?? 1)} /></View></View>
      </View>
    </ScrollView>
  </LinearGradient>;
}

function GameChoice({ icon, title, subtitle, onPress }: { icon: any; title: string; subtitle: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.gameChoice, pressed && { transform: [{ scale: 0.985 }] }]}><View style={styles.gameChoiceIcon}><MaterialIcons name={icon} size={30} color="#08A96C" /></View><View style={{ flex: 1 }}><Text style={styles.gameChoiceTitle}>{title}</Text><Text style={styles.gameChoiceSub}>{subtitle}</Text></View><View style={styles.playPill}><Text style={styles.playPillText}>Play</Text><MaterialIcons name="arrow-forward" size={17} color="#FFFFFF" /></View></Pressable>;
}

function Stat({ icon, label, value }: { icon: any; label: string; value: string }) { return <View style={styles.stat}><MaterialIcons name={icon} size={19} color="#0A9F68" /><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }

function MergeGame({ onBack }: { onBack: () => void }) {
  const { height } = useWindowDimensions(); const compact = height < 780; const ultraCompact = height < 680; const ui = ultraCompact ? 0.78 : compact ? 0.87 : Math.min(1, Math.max(0.92, height / 900));
  const { score, bestScore, level, sessionTokens, newGame, profile, refreshProfile, newTierValue, dismissNewTier, activatePowerUp, earningMultiplier, multiplierSecondsLeft, recordMultiplierAd } = useGame();
  const [dailyBonus, setDailyBonus] = useState({ visible: false, tokens: 0, streak: 1 }); const [adLoading, setAdLoading] = useState(false); const [loadingPowerUp, setLoadingPowerUp] = useState<PowerUpType | null>(null); const [multiplierLoading, setMultiplierLoading] = useState(false);
  useEffect(() => { void checkDailyBonus(); }, []);
  const checkDailyBonus = async () => { const state = await getDailyBonusState(); const today = new Date().toDateString(); if (state.lastClaimDate !== today) { const rewards = [50, 100, 150, 200, 250, 350, 500]; const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); const streak = state.lastClaimDate === yesterday.toDateString() ? Math.min(state.streak + 1, 7) : 1; setDailyBonus({ visible: true, tokens: rewards[Math.min(streak - 1, 6)], streak }); } };
  const handleClaimBonus = async () => { await claimDailyBonus(); setDailyBonus(d => ({ ...d, visible: false })); refreshProfile(); };
  const handlePowerUpPress = useCallback(async (type: PowerUpType) => { const owned = profile?.powerUps?.[type] || 0; if (owned > 0) { const ok = await activatePowerUp(type); if (!ok) Alert.alert('Could not activate', 'This power-up could not be used right now.'); return; } setLoadingPowerUp(type); setAdLoading(true); try { const result = await showRewardedAd(); if (result.watched) { const updated = await addPowerUp(type); if (updated) refreshProfile(); const ok = await activatePowerUp(type); if (!ok) Alert.alert('Error', 'Power-up could not be activated.'); } else Alert.alert('Ad Required', 'Watch the full ad to earn this power-up.'); } finally { setAdLoading(false); setLoadingPowerUp(null); } }, [profile, activatePowerUp, refreshProfile]);
  const handlePowerUpTokens = useCallback(async (type: PowerUpType, cost: number) => { const updated = await spendTokensForPowerUp(type, cost); if (updated) { refreshProfile(); await activatePowerUp(type); } else Alert.alert('Insufficient Tokens', `You need ${cost} MG to buy this power-up.`); }, [activatePowerUp, refreshProfile]);
  const handleMultiplier = useCallback(async () => { if (earningMultiplier >= 3 || multiplierLoading) return; setMultiplierLoading(true); setAdLoading(true); try { const result = await showRewardedAd(); if (result.watched) recordMultiplierAd(); else Alert.alert('Ad Required', 'Watch the full ad to activate the next multiplier tier.'); } finally { setAdLoading(false); setMultiplierLoading(false); } }, [earningMultiplier, multiplierLoading, recordMultiplierAd]);
  const timer = `${Math.floor(multiplierSecondsLeft / 60)}:${String(multiplierSecondsLeft % 60).padStart(2, '0')}`;
  return <LinearGradient colors={['#062A1D', '#0A3B29', '#F4FFF8']} style={styles.container}><View style={[styles.content, { paddingHorizontal: compact ? 10 : 16, paddingTop: compact ? 1 : 4 }]}>
    <AppHeader mode="merge" onBack={onBack} onRestart={newGame} multiplier={earningMultiplier} timer={earningMultiplier > 1 ? timer : undefined} onMultiplier={handleMultiplier} />
    <View style={[styles.arenaCard, { borderRadius: Math.round(38 * ui), paddingHorizontal: compact ? 11 : 17, paddingTop: Math.round(10 * ui), paddingBottom: 3 }]}>
      <View style={[styles.arenaHeader, { height: Math.round(56 * ui) }]}><View><Text style={[styles.season, { fontSize: Math.max(11, Math.round(13 * ui)) }]}>SEASON 01</Text><Text style={[styles.title, { fontSize: Math.max(20, Math.round(25 * ui)), lineHeight: Math.max(23, Math.round(28 * ui)) }]}>Crypto Merge Run</Text></View><View style={[styles.levelPill, { minWidth: Math.round(82 * ui), height: Math.round(54 * ui), borderRadius: Math.round(28 * ui) }]}><Text style={[styles.levelText, { fontSize: Math.max(16, Math.round(19 * ui)) }]}>LV {level}</Text></View></View>
      <View style={[styles.scoreStrip, { height: Math.round(82 * ui), gap: Math.max(6, Math.round(9 * ui)), marginBottom: Math.max(2, Math.round(5 * ui)) }]}><ScoreCard label="Score" value={score.toLocaleString()} /><ScoreCard label="Best" value={bestScore.toLocaleString()} /><ScoreCard label="Earned" value={`+${sessionTokens.toFixed(0)}`} accent /></View>
      <LevelProgressBar score={score} level={level} compact={compact} /><View style={styles.boardSection}><GameBoard /></View>
    </View>
  </View><PowerUpBar onWatchAd={handlePowerUpPress} onSpendTokens={handlePowerUpTokens} loading={loadingPowerUp} /><GameOverModal /><LevelUpModal /><NewTileModal visible={newTierValue !== null} tileValue={newTierValue ?? 4} onDismiss={dismissNewTier} /><DailyBonusModal visible={dailyBonus.visible} tokens={dailyBonus.tokens} streak={dailyBonus.streak} onClaim={handleClaimBonus} /><AdLoadingOverlay visible={adLoading} message="Loading rewarded ad..." /></LinearGradient>;
}

function TapToMine({ onBack }: { onBack: () => void }) {
  const { height } = useWindowDimensions();
  const compact = height < 780;
  const { profile, refreshProfile } = useGame();
  const [taps, setTaps] = useState(0);
  const [mined, setMined] = useState(0);
  const [power, setPower] = useState(1);
  const [level, setLevel] = useState(1);
  const [crediting, setCrediting] = useState(false);

  // Deliberately conservative starting rate. Upgrades improve the rate
  // gradually instead of jumping by whole MG per tap.
  const tapReward = Number((0.05 * Math.pow(1.12, power - 1)).toFixed(4));
  const upgradeCost = Number((25 * Math.pow(2.1, level - 1)).toFixed(2));

  const handleTap = () => {
    setTaps(v => v + 1);
    setMined(v => +(v + tapReward).toFixed(4));

    // The wallet credit is authoritative and serialized in storage so rapid
    // taps cannot overwrite one another. The UI remains responsive while the
    // credit is persisted in the background.
    setCrediting(true);
    void creditMiningTokens(tapReward).then((updated) => {
      if (updated) refreshProfile();
    }).finally(() => setCrediting(false));
  };

  const upgrade = () => {
    if (mined < upgradeCost) return;
    setMined(v => +(v - upgradeCost).toFixed(4));
    setPower(v => v + 1);
    setLevel(v => v + 1);
  };

  return <LinearGradient colors={['#062A1D', '#0A3B29', '#F4FFF8']} style={styles.container}><ScrollView contentContainerStyle={[styles.mineContent, compact && { paddingHorizontal: 12 }]} showsVerticalScrollIndicator={false}><AppHeader mode="mine" onBack={onBack} onRestart={() => { setTaps(0); setMined(0); setPower(1); setLevel(1); }} />
    <View style={styles.mineCard}><View style={styles.mineStats}><View><Text style={styles.mineStatLabel}>MG BALANCE</Text><Text style={styles.mineStatValue}>{Math.floor(profile?.totalTokens ?? 0).toLocaleString()}</Text></View><View><Text style={styles.mineStatLabel}>MINING LEVEL</Text><Text style={styles.mineStatValue}>Lv. {level}</Text></View><View><Text style={styles.mineStatLabel}>TOTAL TAPS</Text><Text style={styles.mineStatValue}>{taps.toLocaleString()}</Text></View></View>
      <Text style={styles.mineTitle}>Tap to Mine</Text><Text style={styles.mineSubtitle}>Tap the mine to earn MG points</Text>
      <Pressable onPress={handleTap} disabled={false} style={({ pressed }) => [styles.mineButton, pressed && styles.mineButtonPressed]}><View style={styles.mineButtonGlow}><MaterialIcons name="touch-app" size={68} color="#FFFFFF" /><Text style={styles.mineTapText}>{mined.toFixed(2)}</Text><Text style={styles.mineTapLabel}>{crediting ? 'SYNCING' : `${tapReward.toFixed(2)} MG / TAP`}</Text></View></Pressable>
      <View style={styles.miningPowerRow}><View style={{ flex: 1 }}><Text style={styles.powerTitle}>Mining Power</Text><View style={styles.powerTrack}><View style={[styles.powerFill, { width: `${Math.min(power, 100)}%` }]} /></View></View><Text style={styles.powerValue}>{tapReward.toFixed(2)} MG/tap</Text></View>
      <Pressable onPress={upgrade} disabled={mined < upgradeCost} style={[styles.upgradeButton, mined < upgradeCost && { opacity: 0.55 }]}><MaterialIcons name="arrow-upward" size={18} color="#FFFFFF" /><Text style={styles.upgradeText}>Upgrade Mine · {upgradeCost.toLocaleString()} MG</Text></Pressable>
    </View><Text style={styles.upgradeHeading}>Upgrade Rewards</Text><View style={styles.upgradeGrid}><UpgradeCard icon="touch-app" title="Tap Power" value={`+${(tapReward * 0.12).toFixed(3)}`} level={`Lv.${level}`} /><UpgradeCard icon="autorenew" title="Auto Miner" value="Locked" level={`Lv.${level + 1}`} /><UpgradeCard icon="monetization-on" title="Coin Boost" value={`${Math.min(level * 2, 20)}%`} level={`Lv.${level + 2}`} /></View>
    <View style={styles.mineNotice}><MaterialIcons name="info-outline" size={18} color="#0A9F68" /><Text style={styles.mineNoticeText}>Your game account, referral code, profile and MG balance are shared across all MintGrow games.</Text></View>
  </ScrollView></LinearGradient>;
}

function UpgradeCard({ icon, title, value, level }: { icon: any; title: string; value: string; level: string }) { return <View style={styles.upgradeCard}><MaterialIcons name={icon} size={22} color="#087A55" /><Text style={styles.upgradeCardTitle}>{title}</Text><Text style={styles.upgradeCardValue}>{value}</Text><Text style={styles.upgradeCardLevel}>{level}</Text></View>; }
function LevelProgressBar({ score, level, compact }: { score: number; level: number; compact?: boolean }) { const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000]; const curr = thresholds[level - 1] || 0; const next = thresholds[level] || curr + 1; const pct = Math.max(Math.min(((score - curr) / (next - curr)) * 100, 100), 2); return <View style={[progress.container, compact && { marginBottom: 1 }]}><View style={[progress.bar, compact && { height: 4 }]}><View style={[progress.fill, { width: `${pct}%` }]} /></View><Text style={[progress.text, compact && { fontSize: 7, marginTop: 1 }]}>LV {level}  ·  {score.toLocaleString()} / {next.toLocaleString()}</Text></View>; }
const progress = StyleSheet.create({ container: { marginHorizontal: 1, marginBottom: 3 }, bar: { height: 5, backgroundColor: '#DCEDE4', borderRadius: 5, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 }, text: { fontSize: 8, color: '#7C9F90', textAlign: 'center', marginTop: 2, fontWeight: '700' } });
const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' }, content: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 }, selectionContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 },
  appHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, appHeaderCompact: { minHeight: 58, marginBottom: 5 }, headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }, backButton: { width: 28, height: 34, alignItems: 'center', justifyContent: 'center' }, brand: { fontSize: 25, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.8 }, tagline: { fontSize: 9, fontWeight: '800', color: '#B7F7D7', letterSpacing: 1.1, marginTop: 1 }, headerActions: { alignItems: 'flex-end', gap: 4 },
  restartButton: { height: 40, minWidth: 126, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#BFF9D9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, restartText: { fontSize: 15, fontWeight: '900', color: '#063A2A' }, multiplierChip: { height: 24, minWidth: 58, paddingHorizontal: 7, borderRadius: 13, backgroundColor: '#E5FFF0', borderWidth: 1, borderColor: '#B7F1D2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }, multiplierActive: { backgroundColor: Colors.primary, borderColor: Colors.primary }, multiplierText: { fontSize: 10, fontWeight: '900', color: '#0A6B4A' }, multiplierTextActive: { color: '#FFFFFF' },
  selectionCard: { backgroundColor: '#F5F8F6', borderRadius: 34, padding: 14, borderWidth: 1, borderColor: '#E1EFE7' }, welcomeCard: { backgroundColor: '#075C3D', borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }, welcomeIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#0A9F68', alignItems: 'center', justifyContent: 'center' }, welcomeTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' }, welcomeSub: { fontSize: 11, color: '#C4F5DD', marginTop: 2, fontWeight: '600' }, sectionHeading: { fontSize: 20, fontWeight: '900', color: '#073B2B', marginBottom: 10 }, gameChoice: { minHeight: 92, backgroundColor: '#F9FFFB', borderWidth: 1.5, borderColor: '#75CFA9', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, gameChoiceIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#E5FFF0', alignItems: 'center', justifyContent: 'center' }, gameChoiceTitle: { fontSize: 15, fontWeight: '900', color: '#073B2B' }, gameChoiceSub: { fontSize: 10, color: '#6C8F81', marginTop: 3, fontWeight: '600' }, playPill: { backgroundColor: '#08A96C', borderRadius: 18, minHeight: 34, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 3 }, playPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, statsCard: { marginTop: 5, backgroundColor: '#ECF9F2', borderRadius: 20, padding: 12, borderWidth: 1, borderColor: '#CDE9DB' }, statsTitle: { fontSize: 14, fontWeight: '900', color: '#073B2B', marginBottom: 9 }, statsRow: { flexDirection: 'row', gap: 7 }, stat: { flex: 1, backgroundColor: '#F8FFFB', borderRadius: 14, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#D4EDE0' }, statLabel: { fontSize: 8, color: '#6C8F81', fontWeight: '800', marginTop: 2 }, statValue: { fontSize: 13, color: '#073B2B', fontWeight: '900', marginTop: 1 },
  arenaCard: { flex: 1, minHeight: 0, backgroundColor: '#F5F8F6', borderWidth: 1, borderColor: '#E5F0EA', overflow: 'hidden' }, arenaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, season: { fontWeight: '900', color: Colors.primary, letterSpacing: 1.7 }, title: { fontWeight: '900', color: '#073B2B', letterSpacing: -0.6 }, levelPill: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }, levelText: { fontWeight: '900', color: '#FFFFFF' }, scoreStrip: { flexDirection: 'row', marginTop: 2 }, boardSection: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' },
  mineContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }, mineCard: { backgroundColor: '#F5F8F6', borderRadius: 30, padding: 14, borderWidth: 1, borderColor: '#DCEDE4' }, mineStats: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 17, padding: 10, borderWidth: 1, borderColor: '#DCEDE4', marginBottom: 14, gap: 5 }, mineStatLabel: { fontSize: 7, color: '#6C8F81', fontWeight: '900', letterSpacing: .5 }, mineStatValue: { fontSize: 14, color: '#073B2B', fontWeight: '900', marginTop: 2 }, mineTitle: { textAlign: 'center', fontSize: 24, fontWeight: '900', color: '#073B2B' }, mineSubtitle: { textAlign: 'center', fontSize: 11, color: '#6C8F81', fontWeight: '600', marginTop: 2, marginBottom: 8 }, mineButton: { alignSelf: 'center', width: 210, height: 210, borderRadius: 105, backgroundColor: '#07895A', borderWidth: 8, borderColor: '#BFF9D9', alignItems: 'center', justifyContent: 'center', elevation: 8 }, mineButtonPressed: { transform: [{ scale: .96 }] }, mineButtonGlow: { width: 178, height: 178, borderRadius: 89, backgroundColor: '#0BA96E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D5FFE9' }, mineTapText: { fontSize: 34, color: '#FFFFFF', fontWeight: '900', marginTop: -3 }, mineTapLabel: { fontSize: 11, color: '#D6FFEA', fontWeight: '900', letterSpacing: 1 }, miningPowerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }, powerTitle: { fontSize: 12, fontWeight: '900', color: '#073B2B', marginBottom: 5 }, powerTrack: { height: 9, backgroundColor: '#DDEEE5', borderRadius: 6, overflow: 'hidden' }, powerFill: { height: '100%', backgroundColor: '#0BA96E', borderRadius: 6 }, powerValue: { fontSize: 10, color: '#0A9F68', fontWeight: '900' }, upgradeButton: { marginTop: 13, height: 43, borderRadius: 21, backgroundColor: '#08A96C', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, upgradeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, upgradeHeading: { fontSize: 16, fontWeight: '900', color: '#073B2B', marginTop: 14, marginBottom: 8 }, upgradeGrid: { flexDirection: 'row', gap: 7 }, upgradeCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 15, padding: 9, borderWidth: 1, borderColor: '#CFE7DC', alignItems: 'center' }, upgradeCardTitle: { fontSize: 9, color: '#073B2B', fontWeight: '900', textAlign: 'center', marginTop: 4 }, upgradeCardValue: { fontSize: 13, color: '#0A9F68', fontWeight: '900', marginTop: 2 }, upgradeCardLevel: { fontSize: 8, color: '#7A9D8E', fontWeight: '800' }, mineNotice: { marginTop: 12, backgroundColor: '#E5FFF0', borderRadius: 14, padding: 10, flexDirection: 'row', gap: 7, alignItems: 'center' }, mineNoticeText: { flex: 1, fontSize: 9, color: '#39735D', fontWeight: '700' },
});
