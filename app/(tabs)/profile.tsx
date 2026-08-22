import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { LEVEL_REWARDS, TOKEN_NETWORK } from '@/types/game';
import { TokenBadge } from '@/components/ui/TokenBadge';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, level } = useGame();
  const router = useRouter();
  const currentReward = LEVEL_REWARDS.find(r => r.level === level);

  const handleAdminAccess = () => router.push('/admin-panel' as any);

  const stats = [
    { label: 'Games Played', value: profile?.gamesPlayed ?? 0, icon: 'games' },
    { label: 'Best Score', value: (profile?.bestScore ?? 0).toLocaleString(), icon: 'emoji-events' },
    { label: 'Login Streak', value: `${profile?.loginStreak ?? 0} days`, icon: 'local-fire-department' },
    { label: 'Ads Watched', value: profile?.adsWatched ?? 0, icon: 'live-tv' },
    { label: 'Referrals', value: profile?.referralCount ?? 0, icon: 'group-add' },
    { label: 'Ref Earnings', value: `${(profile?.referralTokensEarned ?? 0).toFixed(0)} MG`, icon: 'trending-up' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.avatarSection}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logoImg} contentFit="contain" transition={200} />
          <Text style={styles.username}>{profile?.username ?? 'CryptoPlayer'}</Text>
          <Text style={styles.telegramId}>ID: {profile?.telegramId ?? '...'}</Text>
          <TokenBadge amount={profile?.totalTokens ?? 0} size="md" />
        </View>

        <View style={styles.levelCard}>
          <View style={styles.levelLeft}>
            <View style={styles.levelCircle}><Text style={styles.levelNum}>{level}</Text></View>
            <View>
              <Text style={styles.levelTitle}>{currentReward?.title ?? 'Legend'}</Text>
              <Text style={styles.levelSub}>Level {level} Achievement</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
        </View>

        <View style={styles.referralCard}>
          <Text style={styles.referralLabel}>Your Referral Code</Text>
          <Text style={styles.referralCode}>{profile?.referralCode || '...'}</Text>
          <Text style={styles.referralSub}>Share to earn +500 MG per friend!</Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map(s => (
            <View key={s.label} style={styles.statCard}>
              <MaterialIcons name={s.icon as any} size={20} color={Colors.primary} style={styles.statIcon} />
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.stakingCard}>
          <View style={styles.stakingCopy}>
            <Text style={styles.stakingKicker}>ON-CHAIN</Text>
            <Text style={styles.stakingTitle}>MGS Staking</Text>
            <Text style={styles.stakingBody}>Stake from 250,000 MGS with constrained delegation and sponsored transactions.</Text>
          </View>
          <Pressable style={styles.stakingBtn} onPress={() => router.push('/staking')}>
            <Text style={styles.stakingBtnText}>Open Staking</Text>
            <MaterialIcons name="arrow-forward" size={18} color={Colors.textOnGreen} />
          </Pressable>
        </View>

        <View style={styles.walletCard}>
          <View style={styles.walletRow}>
            <MaterialIcons name="account-balance-wallet" size={18} color={Colors.primary} />
            <Text style={styles.walletTitle}>BNB Chain Wallet (BEP-20)</Text>
          </View>
          {profile?.walletAddress ? (
            <Text style={styles.walletAddr}>{profile.walletAddress.slice(0, 12)}...{profile.walletAddress.slice(-8)}</Text>
          ) : (
            <Text style={styles.walletEmpty}>No wallet set — go to Rewards tab to add one</Text>
          )}
        </View>

        <View style={styles.tokenCard}>
          <Text style={styles.tokenTitle}>About MintGrow (MG)</Text>
          <Text style={styles.tokenBody}>
            MG is a utility token on BNB Chain (BEP-20). Earn by merging coins, completing daily streaks, and referring friends.
            Accumulated MG rewards are claimable through the staking contract after a successful stake. MGS principal is never withdrawn through this frontend.
          </Text>
          <View style={styles.networkTag}><Text style={styles.networkTagText}>{TOKEN_NETWORK}</Text></View>
        </View>

        <Pressable style={styles.adminBtn} onPress={handleAdminAccess}>
          <MaterialIcons name="admin-panel-settings" size={16} color={Colors.textMuted} />
          <Text style={styles.adminBtnText}>Admin Panel</Text>
        </Pressable>

        <Text style={styles.footer}>MintGrow © 2025 · Built on BNB Chain</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg }, scroll: { padding: Spacing.md, paddingBottom: 40, alignItems: 'center' },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.sm }, logoImg: { width: 72, height: 72, borderRadius: 16 },
  username: { ...Typography.h2, color: Colors.textPrimary }, telegramId: { ...Typography.small, color: Colors.textMuted },
  levelCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, width: '100%', borderWidth: 2, borderColor: Colors.primary, marginBottom: Spacing.md },
  levelLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, levelCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  levelNum: { fontSize: 22, fontWeight: '800', color: '#fff' }, levelTitle: { ...Typography.bodyBold, color: Colors.textPrimary }, levelSub: { ...Typography.caption, color: Colors.textMuted },
  referralCard: { backgroundColor: Colors.primaryGlow, borderRadius: Radius.lg, padding: Spacing.md, width: '100%', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', gap: 4 },
  referralLabel: { ...Typography.caption, color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase' }, referralCode: { fontSize: 22, fontWeight: '900', color: Colors.primary, letterSpacing: 3 }, referralSub: { ...Typography.small, color: Colors.primaryDark },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, width: '100%', marginBottom: Spacing.md }, statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statIcon: { marginBottom: 4 }, statVal: { ...Typography.h3, color: Colors.textPrimary }, statLbl: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
  stakingCard: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, width: '100%', marginBottom: Spacing.md }, stakingCopy: { marginBottom: Spacing.md },
  stakingKicker: { ...Typography.caption, color: Colors.textOnGreen, letterSpacing: 1.5 }, stakingTitle: { ...Typography.h3, color: Colors.textOnGreen, marginTop: 2 }, stakingBody: { ...Typography.small, color: 'rgba(255,255,255,0.84)', lineHeight: 19, marginTop: 4 },
  stakingBtn: { minHeight: 46, backgroundColor: '#FFFFFF', borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, stakingBtnText: { ...Typography.bodyBold, color: Colors.primary },
  walletCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md, width: '100%', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs }, walletRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, walletTitle: { ...Typography.bodyBold, color: Colors.textPrimary }, walletAddr: { ...Typography.small, color: Colors.primary, fontFamily: 'monospace' }, walletEmpty: { ...Typography.small, color: Colors.textMuted },
  tokenCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md, width: '100%', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 }, tokenTitle: { ...Typography.bodyBold, color: Colors.primary }, tokenBody: { ...Typography.small, color: Colors.textSecondary, lineHeight: 20 },
  networkTag: { backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingVertical: 4, paddingHorizontal: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.primary }, networkTagText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm }, adminBtnText: { ...Typography.small, color: Colors.textMuted }, footer: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
});
