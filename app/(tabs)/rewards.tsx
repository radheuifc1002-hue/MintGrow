import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Alert, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { useWithdrawal } from '@/hooks/useWithdrawal';
import { GlowButton } from '@/components/ui/GlowButton';
import { AdLoadingOverlay } from '@/components/ui/AdLoadingOverlay';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { WITHDRAWAL_MIN } from '@/types/game';
import { getProfile, saveProfile } from '@/services/storage';

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile, tokens } = useGame();
  const {
    withdrawals, isLoading, isWatchingAd, error,
    loadWithdrawals, requestWithdrawal, updateWallet, setError,
  } = useWithdrawal();

  const [walletInput, setWalletInput] = useState(profile?.walletAddress || '');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [savedWallet, setSavedWallet] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  useEffect(() => {
    if (profile?.walletAddress) setWalletInput(profile.walletAddress);
  }, [profile?.walletAddress]);

  const handleSaveWallet = async () => {
    if (!walletInput.trim() || walletInput.length < 26) {
      Alert.alert('Invalid Address', 'Please enter a valid wallet address (26+ characters)');
      return;
    }
    const ok = await updateWallet(walletInput.trim());
    if (ok) {
      setSavedWallet(true);
      refreshProfile();
      setTimeout(() => setSavedWallet(false), 3000);
    }
  };

  const handleWithdraw = async () => {
    setError(null);
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const ok = await requestWithdrawal(amt);
    if (ok) {
      setWithdrawAmount('');
      refreshProfile();
      loadWithdrawals();
      Alert.alert('✅ Submitted!', 'Your withdrawal request is pending admin approval. You will be notified once processed.');
    }
  };

  const statusColor = (s: string) => ({
    pending: Colors.warning,
    approved: Colors.success,
    rejected: Colors.error,
  }[s] || Colors.textMuted);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <Text style={styles.pageTitle}>💰 Rewards & Withdraw</Text>
          <Text style={styles.pageSubtitle}>Earn MG tokens by playing · Withdraw anytime</Text>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceGlow} />
            <Text style={styles.balanceLabel}>TOTAL MG BALANCE</Text>
            <Text style={styles.balanceAmount}>{(profile?.totalTokens ?? 0).toFixed(2)}</Text>
            <Text style={styles.balanceSub}>MintGrow Tokens</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{(profile?.pendingTokens ?? 0).toFixed(2)}</Text>
                <Text style={styles.statLbl}>Pending</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{(profile?.withdrawnTokens ?? 0).toFixed(2)}</Text>
                <Text style={styles.statLbl}>Withdrawn</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{profile?.adsWatched ?? 0}</Text>
                <Text style={styles.statLbl}>Ads Watched</Text>
              </View>
            </View>
          </View>

          {/* Minimum notice */}
          <View style={styles.minNotice}>
            <MaterialIcons name="info-outline" size={14} color={Colors.primary} />
            <Text style={styles.minText}>Minimum withdrawal: {WITHDRAWAL_MIN} MG tokens</Text>
          </View>

          {/* Wallet Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔗 Wallet Address</Text>
            <Text style={styles.sectionSub}>Enter your EVM/TON wallet address to receive MG tokens</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={walletInput}
                onChangeText={setWalletInput}
                placeholder="0x... or EQ..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <GlowButton
                label={savedWallet ? '✓' : 'Save'}
                onPress={handleSaveWallet}
                variant={savedWallet ? 'primary' : 'secondary'}
                style={styles.saveBtn}
              />
            </View>
            {profile?.walletAddress ? (
              <Text style={styles.walletSet}>
                ✅ {profile.walletAddress.slice(0, 8)}...{profile.walletAddress.slice(-6)}
              </Text>
            ) : null}
          </View>

          {/* Withdraw Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📤 Request Withdrawal</Text>
            <Text style={styles.sectionSub}>
              🎯 You must watch an ad to unlock each withdrawal
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder={`Min ${WITHDRAWAL_MIN} MG`}
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={styles.maxBtn}
                onPress={() => setWithdrawAmount(String(Math.floor(profile?.totalTokens ?? 0)))}
              >
                <Text style={styles.maxBtnText}>MAX</Text>
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={14} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <GlowButton
              label="📺 Watch Ad & Withdraw"
              onPress={handleWithdraw}
              loading={isLoading}
              disabled={!profile?.walletAddress || (profile?.totalTokens ?? 0) < WITHDRAWAL_MIN}
              fullWidth
              style={styles.withdrawBtn}
            />

            <Text style={styles.withdrawNote}>
              Admin reviews and approves all withdrawals within 24–48 hours
            </Text>
          </View>

          {/* Withdrawal History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Withdrawal History</Text>
            {withdrawals.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyIcon}>🕵️</Text>
                <Text style={styles.emptyText}>No withdrawals yet</Text>
              </View>
            ) : (
              withdrawals.map(w => (
                <View key={w.id} style={styles.withdrawalItem}>
                  <View style={styles.withdrawalLeft}>
                    <Text style={styles.withdrawalAmount}>{w.amount.toFixed(2)} MG</Text>
                    <Text style={styles.withdrawalDate}>
                      {new Date(w.createdAt).toLocaleDateString()}
                    </Text>
                    <Text style={styles.withdrawalWallet}>
                      {w.walletAddress.slice(0, 8)}...{w.walletAddress.slice(-5)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { borderColor: statusColor(w.status) }]}>
                    <Text style={[styles.statusText, { color: statusColor(w.status) }]}>
                      {w.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      </View>
      <AdLoadingOverlay visible={isWatchingAd} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, paddingBottom: 40 },
  pageTitle: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 4 },
  pageSubtitle: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.lg },

  balanceCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  balanceGlow: {
    position: 'absolute',
    top: -40,
    width: 200,
    height: 120,
    backgroundColor: Colors.primaryGlow,
    borderRadius: 100,
  },
  balanceLabel: { ...Typography.caption, color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  balanceAmount: { fontSize: 48, fontWeight: '900', color: Colors.primary, letterSpacing: 1 },
  balanceSub: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.md },

  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statVal: { ...Typography.bodyBold, color: Colors.textPrimary, fontSize: 16 },
  statLbl: { ...Typography.caption, color: Colors.textMuted },

  minNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  minText: { ...Typography.small, color: Colors.primary },

  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { ...Typography.h3, color: Colors.textPrimary, marginBottom: 4 },
  sectionSub: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 18 },

  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm },
  input: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 48,
  },
  saveBtn: { paddingHorizontal: Spacing.md, minHeight: 48 },
  walletSet: { ...Typography.small, color: Colors.success, marginBottom: 4 },

  maxBtn: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  maxBtnText: { ...Typography.smallBold, color: Colors.primary },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  errorText: { ...Typography.small, color: Colors.error, flex: 1 },

  withdrawBtn: { marginBottom: Spacing.sm },
  withdrawNote: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },

  emptyHistory: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyIcon: { fontSize: 32, marginBottom: Spacing.sm },
  emptyText: { ...Typography.body, color: Colors.textMuted },

  withdrawalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.sm + 4,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  withdrawalLeft: { gap: 2 },
  withdrawalAmount: { ...Typography.bodyBold, color: Colors.textPrimary },
  withdrawalDate: { ...Typography.caption, color: Colors.textMuted },
  withdrawalWallet: { ...Typography.caption, color: Colors.textMuted },
  statusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: { ...Typography.caption, fontWeight: '700' },
});
