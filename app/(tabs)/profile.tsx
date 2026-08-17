import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { ADMIN_TELEGRAM_ID, LEVEL_REWARDS } from '@/types/game';
import { GlowButton } from '@/components/ui/GlowButton';
import { TokenBadge } from '@/components/ui/TokenBadge';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, level, score, bestScore, newGame } = useGame();
  const router = useRouter();
  const [adminInput, setAdminInput] = useState('');

  const currentReward = LEVEL_REWARDS.find(r => r.level === level);

  const handleAdminAccess = () => {
    Alert.prompt(
      '🔐 Admin Access',
      'Enter admin Telegram ID:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Access',
          onPress: (val?: string) => {
            if (val?.trim() === ADMIN_TELEGRAM_ID || val?.trim() === `@${ADMIN_TELEGRAM_ID}`) {
              router.push('/admin');
            } else {
              Alert.alert('❌ Access Denied', 'Invalid admin credentials');
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  const stats = [
    { label: 'Games Played', value: profile?.gamesPlayed ?? 0, icon: 'games' },
    { label: 'Best Score', value: (profile?.bestScore ?? 0).toLocaleString(), icon: 'emoji-events' },
    { label: 'Total Tokens', value: `${(profile?.totalTokens ?? 0).toFixed(1)} MG`, icon: 'account-balance-wallet' },
    { label: 'Ads Watched', value: profile?.adsWatched ?? 0, icon: 'live-tv' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar & ID */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>✦</Text>
          </View>
          <Text style={styles.username}>{profile?.username ?? 'CryptoPlayer'}</Text>
          <Text style={styles.telegramId}>ID: {profile?.telegramId ?? '...'}</Text>
          <TokenBadge amount={profile?.totalTokens ?? 0} size="md" />
        </View>

        {/* Level Card */}
        <View style={styles.levelCard}>
          <View style={styles.levelLeft}>
            <View style={styles.levelCircle}>
              <Text style={styles.levelNum}>{level}</Text>
            </View>
            <View>
              <Text style={styles.levelTitle}>{currentReward?.title ?? 'Legend'}</Text>
              <Text style={styles.levelSub}>Level {level} Achievement</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map(s => (
            <View key={s.label} style={styles.statCard}>
              <MaterialIcons name={s.icon as any} size={20} color={Colors.primary} style={styles.statIcon} />
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Wallet */}
        <View style={styles.walletCard}>
          <View style={styles.walletRow}>
            <MaterialIcons name="account-balance-wallet" size={18} color={Colors.primary} />
            <Text style={styles.walletTitle}>Connected Wallet</Text>
          </View>
          {profile?.walletAddress ? (
            <Text style={styles.walletAddr}>
              {profile.walletAddress.slice(0, 12)}...{profile.walletAddress.slice(-8)}
            </Text>
          ) : (
            <Text style={styles.walletEmpty}>No wallet set — go to Rewards tab to add one</Text>
          )}
        </View>

        {/* About Token */}
        <View style={styles.tokenCard}>
          <Text style={styles.tokenTitle}>✦ About MintGrow (MG)</Text>
          <Text style={styles.tokenBody}>
            MintGrow is a utility token earned through gameplay. Every merge earns MG tokens. 
            Reach higher levels for bonus airdrops. Withdraw to your wallet anytime (min {50} MG).
            MG powers governance, NFTs, and DeFi integrations in the MintGrow ecosystem.
          </Text>
        </View>

        {/* Admin Panel Access */}
        <Pressable style={styles.adminBtn} onPress={handleAdminAccess}>
          <MaterialIcons name="admin-panel-settings" size={16} color={Colors.textMuted} />
          <Text style={styles.adminBtnText}>Admin Panel</Text>
        </Pressable>

        <Text style={styles.footer}>MintGrow © 2025 · Powered by OnSpace</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, paddingBottom: 40, alignItems: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, color: Colors.primary },
  username: { ...Typography.h2, color: Colors.textPrimary },
  telegramId: { ...Typography.small, color: Colors.textMuted },

  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  levelLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  levelCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { fontSize: 22, fontWeight: '800', color: Colors.bg },
  levelTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  levelSub: { ...Typography.caption, color: Colors.textMuted },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    width: '100%',
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: { marginBottom: 4 },
  statVal: { ...Typography.h3, color: Colors.textPrimary },
  statLbl: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },

  walletCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  walletAddr: { ...Typography.small, color: Colors.primary, fontFamily: 'monospace' },
  walletEmpty: { ...Typography.small, color: Colors.textMuted },

  tokenCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  tokenTitle: { ...Typography.bodyBold, color: Colors.primary },
  tokenBody: { ...Typography.small, color: Colors.textSecondary, lineHeight: 20 },

  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  adminBtnText: { ...Typography.small, color: Colors.textMuted },
  footer: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
});
