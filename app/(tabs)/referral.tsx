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
import {
  REFERRAL_BONUS_TOKENS, TOKEN_NETWORK, WITHDRAWAL_MIN,
  REFERRAL_LEVELS, getEligibleReferralPct,
} from '@/types/game';
import { getReferrals, applyReferralCode } from '@/services/storage';
import { ReferralEntry } from '@/types/game';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useGame();

  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [showLevels, setShowLevels] = useState(false);

  useEffect(() => { loadReferrals(); }, [profile?.telegramId]);

  const loadReferrals = async () => {
    if (!profile?.telegramId) return;
    const list = await getReferrals(profile.telegramId);
    setReferrals(list);
  };

  const handleShare = async () => {
    if (!profile?.referralCode) return;
    try {
      await Share.share({
        message: `Join MintGrow — merge crypto coins and EARN real MG tokens on BNB Chain!\n\nUse my referral code: ${profile.referralCode}\n\nGet 100 MG welcome bonus + earn together!\n\n#MintGrow #BNBChain #CryptoGame`,
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
        Alert.alert('Welcome Bonus! 🎉', 'Referral code applied! You received 100 MG bonus tokens!');
      } else {
        Alert.alert('Invalid Code', 'This code is invalid, already used, or is your own code.');
      }
    } finally {
      setApplying(false);
    }
  };

  const directRefs = profile?.referralCount ?? 0;
  const totalReferralEarnings = profile?.referralTokensEarned ?? 0;

  // Which income levels the user is currently eligible for
  const eligibleLevels = REFERRAL_LEVELS.filter(
    l => directRefs >= l.directRequired
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <Text style={styles.pageTitle}>👥 Referral Program</Text>
          <Text style={styles.pageSubtitle}>Invite friends · Earn MG tokens at 25 levels</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={[styles.statVal, { color: Colors.primary }]}>{directRefs}</Text>
              <Text style={styles.statLbl}>Direct Refs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={[styles.statVal, { color: Colors.primary }]}>
                {totalReferralEarnings.toFixed(0)} MG
              </Text>
              <Text style={styles.statLbl}>Ref Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={[styles.statVal, { color: Colors.primary }]}>
                {eligibleLevels.length}/25
              </Text>
              <Text style={styles.statLbl}>Active Levels</Text>
            </View>
          </View>

          {/* Income Rules Note */}
          <View style={styles.ruleNote}>
            <MaterialIcons name="info-outline" size={14} color={Colors.info} />
            <Text style={styles.ruleText}>
              Referral income is credited when your referral reaches the {WITHDRAWAL_MIN.toLocaleString()} MG withdrawal threshold and calls withdraw.
            </Text>
          </View>

          {/* 25-Level Income Table */}
          <View style={styles.levelsCard}>
            <Pressable style={styles.levelsHeader} onPress={() => setShowLevels(v => !v)}>
              <Text style={styles.levelsTitle}>25-Level Income Structure</Text>
              <MaterialIcons
                name={showLevels ? 'expand-less' : 'expand-more'}
                size={22}
                color={Colors.primary}
              />
            </Pressable>
            {showLevels && (
              <View style={styles.levelsBody}>
                <View style={styles.levelHeaderRow}>
                  <Text style={[styles.levelCell, { flex: 0.6 }]}>Level</Text>
                  <Text style={[styles.levelCell, { flex: 0.8 }]}>Income</Text>
                  <Text style={[styles.levelCell, { flex: 1.2 }]}>Need Direct</Text>
                  <Text style={[styles.levelCell, { flex: 0.8, textAlign: 'right' }]}>Status</Text>
                </View>
                {REFERRAL_LEVELS.map(rl => {
                  const eligible = directRefs >= rl.directRequired;
                  return (
                    <View
                      key={rl.level}
                      style={[styles.levelRow, eligible && styles.eligibleRow]}
                    >
                      <Text style={[styles.levelCell, styles.levelCellNum, { flex: 0.6 }]}>
                        L{rl.level}
                      </Text>
                      <Text style={[styles.levelCell, { flex: 0.8, color: Colors.primary, fontWeight: '700' }]}>
                        {(rl.pct * 100).toFixed(0)}%
                      </Text>
                      <Text style={[styles.levelCell, { flex: 1.2 }]}>
                        {rl.directRequired} refs
                      </Text>
                      <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                        {eligible ? (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>✓</Text>
                          </View>
                        ) : (
                          <Text style={styles.lockText}>🔒 {rl.directRequired - directRefs} more</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Your Code */}
          <View style={styles.codeSection}>
            <Text style={styles.sectionTitle}>Your Referral Code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{profile?.referralCode || '...'}</Text>
              <Pressable
                style={styles.copyBtn}
                onPress={() => Alert.alert('Copied!', `Code ${profile?.referralCode} copied`)}
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

          {/* Apply Code */}
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

          {/* How It Works */}
          <View style={styles.howCard}>
            <Text style={styles.howTitle}>How Earnings Work</Text>
            {[
              { icon: '📤', text: 'Share your referral code with friends' },
              { icon: '🎁', text: `Friend uses code → gets 100 MG welcome bonus + you get ${REFERRAL_BONUS_TOKENS} MG` },
              { icon: '📈', text: 'You earn % of their tokens when they withdraw (if you have enough direct refs)' },
              { icon: '🔓', text: 'L1 income: need 2 direct refs (20%). L2: 2 refs (15%). L3: 3 refs (10%). L4+: see table' },
              { icon: '💎', text: `Affiliate income released when your referral hits ${WITHDRAWAL_MIN.toLocaleString()} MG & withdraws` },
            ].map((item, i) => (
              <View key={i} style={styles.howItem}>
                <Text style={styles.howEmoji}>{item.icon}</Text>
                <Text style={styles.howText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Referrals List */}
          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Referral Activity ({referrals.length})</Text>
              <Pressable
                style={styles.refreshBtn}
                onPress={loadReferrals}
              >
                <MaterialIcons name="refresh" size={16} color={Colors.primary} />
              </Pressable>
            </View>

            {referrals.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔗</Text>
                <Text style={styles.emptyText}>No referrals yet. Share your code!</Text>
              </View>
            ) : (
              referrals.map((r, i) => {
                const hasReached = (r.refereeBalance ?? 0) >= WITHDRAWAL_MIN;
                return (
                  <View key={i} style={styles.referralItem}>
                    <View style={styles.referralAvatar}>
                      <Text style={styles.referralAvatarText}>{r.username[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.referralInfo}>
                      <Text style={styles.referralName}>@{r.username}</Text>
                      <Text style={styles.referralDate}>{new Date(r.joinedAt).toLocaleDateString()}</Text>
                      {hasReached && (
                        <Text style={styles.referralReached}>Reached withdrawal threshold ✓</Text>
                      )}
                    </View>
                    <View style={styles.referralEarning}>
                      <Text style={styles.referralEarningAmt}>+{r.tokensEarned.toFixed(0)}</Text>
                      <Text style={styles.referralEarningUnit}>MG</Text>
                    </View>
                  </View>
                );
              })
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
  pageTitle: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 2 },
  pageSubtitle: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.sm,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 2,
  },
  statCardGreen: { borderColor: Colors.primary },
  statEmoji: { fontSize: 20 },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLbl: { ...Typography.caption, color: Colors.textMuted },

  ruleNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#E3F2FD', borderRadius: Radius.sm, padding: Spacing.sm,
    borderWidth: 1, borderColor: '#0277BD', marginBottom: Spacing.md,
  },
  ruleText: { ...Typography.small, color: '#0277BD', flex: 1, lineHeight: 18 },

  levelsCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, overflow: 'hidden',
  },
  levelsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md,
  },
  levelsTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  levelsBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  levelHeaderRow: {
    flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1,
    borderBottomColor: Colors.border, marginBottom: 4,
  },
  levelRow: {
    flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1,
    borderBottomColor: Colors.bgSurface, alignItems: 'center',
  },
  eligibleRow: { backgroundColor: Colors.primaryGlow, borderRadius: 4, paddingHorizontal: 4 },
  levelCell: { ...Typography.small, color: Colors.textSecondary },
  levelCellNum: { color: Colors.textPrimary, fontWeight: '700' },
  activePill: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 2, paddingHorizontal: 8,
  },
  activePillText: { ...Typography.caption, color: '#fff', fontWeight: '700' },
  lockText: { ...Typography.caption, color: Colors.textMuted },

  codeSection: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary,
  },
  sectionTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 4 },
  sectionSub: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.md },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong, gap: Spacing.sm,
  },
  codeText: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: 4 },
  copyBtn: { padding: 6 },

  applySection: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: Colors.bgSurface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md,
    paddingVertical: 12, color: Colors.textPrimary, fontSize: 15, fontWeight: '700',
    letterSpacing: 2, minHeight: 48,
  },

  referredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary,
  },
  referredText: { ...Typography.small, color: Colors.primary },

  howCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  howTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 4 },
  howItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  howEmoji: { fontSize: 16, width: 22 },
  howText: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  listSection: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  refreshBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  empty: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { ...Typography.body, color: Colors.textMuted },

  referralItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  referralAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryGlow,
    borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  referralAvatarText: { ...Typography.bodyBold, color: Colors.primary },
  referralInfo: { flex: 1, gap: 2 },
  referralName: { ...Typography.smallBold, color: Colors.textPrimary },
  referralDate: { ...Typography.caption, color: Colors.textMuted },
  referralReached: { ...Typography.caption, color: Colors.success, fontWeight: '600' },
  referralEarning: { alignItems: 'flex-end' },
  referralEarningAmt: { ...Typography.bodyBold, color: Colors.primary },
  referralEarningUnit: { ...Typography.caption, color: Colors.textMuted },

  networkNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.sm, padding: Spacing.sm,
  },
  networkText: { ...Typography.small, color: Colors.primary, flex: 1 },
});
