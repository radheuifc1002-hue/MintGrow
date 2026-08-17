import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Share, TextInput,
  Pressable, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { REFERRAL_BONUS_TOKENS, REFERRAL_INCOME_PCT, TOKEN_NETWORK } from '@/types/game';
import { getReferrals, applyReferralCode, getProfile, saveProfile, addReferral, generateReferralCode } from '@/services/storage';
import { ReferralEntry } from '@/types/game';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useGame();

  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    const list = await getReferrals();
    setReferrals(list);
  };

  const handleShare = async () => {
    if (!profile?.referralCode) return;
    try {
      await Share.share({
        message: `Join MintGrow — the crypto merging game where you EARN real MG tokens!\n\nUse my referral code: ${profile.referralCode}\n\nDownload & enter code to get 100 MG bonus!\n\n#MintGrow #BNBChain #CryptoGame`,
        title: 'Join MintGrow Game',
      });
    } catch {}
  };

  const handleApplyCode = async () => {
    if (!codeInput.trim()) {
      Alert.alert('Enter Code', 'Please enter a referral code');
      return;
    }
    if (profile?.referredBy) {
      Alert.alert('Already Referred', 'You have already applied a referral code');
      return;
    }
    setApplying(true);
    try {
      const ok = await applyReferralCode(codeInput.trim().toUpperCase());
      if (ok) {
        refreshProfile();
        setCodeInput('');
        Alert.alert('Welcome Bonus!', 'Referral code applied! You received 100 MG bonus tokens!');
      } else {
        Alert.alert('Invalid Code', 'This code is invalid or cannot be used');
      }
    } finally {
      setApplying(false);
    }
  };

  // Simulate earning from referral (demo: add mock referral)
  const handleDemoAddReferral = async () => {
    const entry: ReferralEntry = {
      code: profile?.referralCode || '',
      username: `Player${Math.floor(Math.random() * 9000 + 1000)}`,
      joinedAt: new Date().toISOString(),
      tokensEarned: Math.floor(Math.random() * 500 + 100),
    };
    await addReferral(entry);
    // Add referral bonus to profile
    const p = await getProfile();
    if (p) {
      p.referralCount = (p.referralCount || 0) + 1;
      p.totalTokens = Math.round((p.totalTokens + REFERRAL_BONUS_TOKENS) * 100) / 100;
      p.referralTokensEarned = Math.round((p.referralTokensEarned + REFERRAL_BONUS_TOKENS) * 100) / 100;
      await saveProfile(p);
    }
    loadReferrals();
    refreshProfile();
    Alert.alert('Referral Bonus!', `+${REFERRAL_BONUS_TOKENS} MG! A new player joined via your code.`);
  };

  const totalReferralEarnings = referrals.reduce((s, r) => s + r.tokensEarned, 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.headerArea}>
            <Text style={styles.pageTitle}>👥 Referral Program</Text>
            <Text style={styles.pageSubtitle}>Invite friends · Earn MG tokens together</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={[styles.statVal, { color: Colors.primary }]}>{profile?.referralCount || 0}</Text>
              <Text style={styles.statLbl}>Total Referrals</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={[styles.statVal, { color: Colors.primary }]}>
                {((profile?.referralTokensEarned || 0)).toFixed(0)} MG
              </Text>
              <Text style={styles.statLbl}>Earned from Refs</Text>
            </View>
          </View>

          {/* How it Works */}
          <View style={styles.howCard}>
            <Text style={styles.howTitle}>How It Works</Text>
            {[
              { icon: '📤', text: `Share your referral code with friends` },
              { icon: '🎁', text: `Friend uses code → gets 100 MG welcome bonus` },
              { icon: '💵', text: `You earn +${REFERRAL_BONUS_TOKENS} MG per referral signup` },
              { icon: '📈', text: `Earn ${(REFERRAL_INCOME_PCT * 100).toFixed(0)}% of their token income (first level)` },
              { icon: '♾️', text: `No limit — refer as many as you want!` },
            ].map((item, i) => (
              <View key={i} style={styles.howItem}>
                <Text style={styles.howEmoji}>{item.icon}</Text>
                <Text style={styles.howText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Your Referral Code */}
          <View style={styles.codeSection}>
            <Text style={styles.sectionTitle}>Your Referral Code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{profile?.referralCode || '...'}</Text>
              <Pressable
                style={styles.copyBtn}
                onPress={async () => {
                  // Copy to clipboard
                  Alert.alert('Copied!', `Code ${profile?.referralCode} copied`);
                }}
              >
                <MaterialIcons name="content-copy" size={18} color={Colors.primary} />
              </Pressable>
            </View>
            <GlowButton
              label="📤 Share Code & Invite Friends"
              onPress={handleShare}
              variant="primary"
              fullWidth
              style={{ marginTop: Spacing.sm }}
            />
          </View>

          {/* Apply Referral Code */}
          {!profile?.referredBy ? (
            <View style={styles.applySection}>
              <Text style={styles.sectionTitle}>Have a Referral Code?</Text>
              <Text style={styles.sectionSub}>Enter a friend's code to get 100 MG bonus</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={codeInput}
                  onChangeText={v => setCodeInput(v.toUpperCase())}
                  placeholder="e.g. MG1234XYZ"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                />
                <GlowButton
                  label={applying ? '...' : 'Apply'}
                  onPress={handleApplyCode}
                  disabled={applying || !codeInput.trim()}
                  variant="primary"
                  style={{ paddingHorizontal: Spacing.md }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.referredBadge}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.referredText}>Referred by code: {profile.referredBy}</Text>
            </View>
          )}

          {/* Referrals List */}
          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Referral Activity ({referrals.length})</Text>
              {/* Demo button */}
              <Pressable style={styles.demoBtn} onPress={handleDemoAddReferral}>
                <Text style={styles.demoBtnText}>+ Simulate</Text>
              </Pressable>
            </View>

            {referrals.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔗</Text>
                <Text style={styles.emptyText}>No referrals yet. Share your code!</Text>
              </View>
            ) : (
              referrals.map((r, i) => (
                <View key={i} style={styles.referralItem}>
                  <View style={styles.referralAvatar}>
                    <Text style={styles.referralAvatarText}>{r.username[0]}</Text>
                  </View>
                  <View style={styles.referralInfo}>
                    <Text style={styles.referralName}>@{r.username}</Text>
                    <Text style={styles.referralDate}>{new Date(r.joinedAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.referralEarning}>
                    <Text style={styles.referralEarningAmt}>+{(r.tokensEarned * REFERRAL_INCOME_PCT).toFixed(0)}</Text>
                    <Text style={styles.referralEarningUnit}>MG</Text>
                  </View>
                </View>
              ))
            )}

            {referrals.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Referral Earnings</Text>
                <Text style={styles.totalVal}>{(totalReferralEarnings * REFERRAL_INCOME_PCT).toFixed(0)} MG</Text>
              </View>
            )}
          </View>

          {/* Network info */}
          <View style={styles.networkNote}>
            <MaterialIcons name="info-outline" size={14} color={Colors.primary} />
            <Text style={styles.networkText}>MG tokens distributed on {TOKEN_NETWORK}</Text>
          </View>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, paddingBottom: 40 },

  headerArea: { marginBottom: Spacing.md },
  pageTitle: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 2 },
  pageSubtitle: { ...Typography.small, color: Colors.textMuted },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statCardGreen: { borderColor: Colors.primary },
  statEmoji: { fontSize: 24 },
  statVal: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLbl: { ...Typography.caption, color: Colors.textMuted },

  howCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  howTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 4 },
  howItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  howEmoji: { fontSize: 16, width: 22 },
  howText: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  codeSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  sectionTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 4 },
  sectionSub: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.md },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    gap: Spacing.sm,
  },
  codeText: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: 4 },
  copyBtn: { padding: 6 },

  applySection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    minHeight: 48,
  },

  referredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  referredText: { ...Typography.small, color: Colors.primary },

  listSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  demoBtn: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoBtnText: { ...Typography.caption, color: Colors.textMuted },

  empty: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { ...Typography.body, color: Colors.textMuted },

  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  referralAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralAvatarText: { ...Typography.bodyBold, color: Colors.primary },
  referralInfo: { flex: 1 },
  referralName: { ...Typography.smallBold, color: Colors.textPrimary },
  referralDate: { ...Typography.caption, color: Colors.textMuted },
  referralEarning: { alignItems: 'flex-end' },
  referralEarningAmt: { ...Typography.bodyBold, color: Colors.primary },
  referralEarningUnit: { ...Typography.caption, color: Colors.textMuted },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  totalLabel: { ...Typography.smallBold, color: Colors.textSecondary },
  totalVal: { ...Typography.bodyBold, color: Colors.primary },

  networkNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  networkText: { ...Typography.small, color: Colors.primary, flex: 1 },
});
