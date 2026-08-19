import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { getWithdrawals, updateWithdrawal } from '@/services/storage';
import { supabase } from '@/services/supabase';
import { WithdrawalRequest, TOKEN_NETWORK } from '@/types/game';
import { GlowButton } from '@/components/ui/GlowButton';

type TabType = 'withdrawals' | 'stats';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<TabType>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [statsData, setStatsData] = useState({
    totalPlayers: 0, totalTokens: 0, totalAds: 0, totalGames: 0,
  });
  const [selected, setSelected] = useState<WithdrawalRequest | null>(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const channelRef = useRef<any>(null);

  useEffect(() => {
    loadData();
    setupRealtimeSubscription();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const setupRealtimeSubscription = () => {
    // Real-time subscription to ALL withdrawals (admin sees everything)
    const channel = supabase
      .channel('admin_withdrawals_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawals' },
        (payload) => {
          console.log('Admin realtime withdrawal update:', payload.eventType);
          // Reload withdrawals on any change (insert or update)
          loadWithdrawalsOnly();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players' },
        () => {
          // New player registered — refresh stats
          loadStatsOnly();
        }
      )
      .subscribe((status) => {
        console.log('Admin realtime status:', status);
      });

    channelRef.current = channel;
  };

  const loadWithdrawalsOnly = async () => {
    const list = await getWithdrawals();
    setWithdrawals(list);
  };

  const loadStatsOnly = async () => {
    try {
      const { data } = await supabase
        .from('players')
        .select('total_tokens, ads_watched, games_played');
      if (data) {
        setStatsData({
          totalPlayers: data.length,
          totalTokens: data.reduce((s, r) => s + parseFloat(r.total_tokens ?? '0'), 0),
          totalAds: data.reduce((s, r) => s + (r.ads_watched ?? 0), 0),
          totalGames: data.reduce((s, r) => s + (r.games_played ?? 0), 0),
        });
      }
    } catch {}
  };

  const loadData = async () => {
    await Promise.all([loadWithdrawalsOnly(), loadStatsOnly()]);
  };

  const handleApprove = async () => {
    if (!selected || !txHashInput.trim()) {
      Alert.alert('Required', 'Please enter the transaction hash from BNB Chain');
      return;
    }
    await updateWithdrawal(selected.id, {
      status: 'approved',
      txHash: txHashInput.trim(),
      processedAt: new Date().toISOString(),
    });

    await creditReferralCommissions(selected.telegramId, selected.amount);

    const { data: pRow } = await supabase
      .from('players')
      .select('total_tokens, pending_tokens, withdrawn_tokens')
      .eq('telegram_id', selected.telegramId)
      .single();

    if (pRow) {
      await supabase.from('players').update({
        withdrawn_tokens: parseFloat(pRow.withdrawn_tokens ?? '0') + selected.amount,
        pending_tokens: Math.max(0, parseFloat(pRow.pending_tokens ?? '0') - selected.amount),
      }).eq('telegram_id', selected.telegramId);
    }

    setSelected(null);
    setTxHashInput('');
    // No need to call loadData — realtime subscription will update the list
    Alert.alert('Approved!', 'Withdrawal approved. TX hash recorded. Referral commissions credited.');
  };

  const creditReferralCommissions = async (refereeTgId: string, withdrawnAmount: number) => {
    try {
      const { data: refs } = await supabase
        .from('referrals')
        .select('referrer_telegram_id, level')
        .eq('referee_telegram_id', refereeTgId);

      if (!refs || refs.length === 0) return;

      const { REFERRAL_LEVELS } = await import('@/types/game');

      for (const ref of refs) {
        const { data: referrer } = await supabase
          .from('players')
          .select('direct_referral_count, total_tokens, referral_tokens_earned')
          .eq('telegram_id', ref.referrer_telegram_id)
          .single();
        if (!referrer) continue;

        const rule = REFERRAL_LEVELS.find(r => r.level === ref.level);
        if (!rule) continue;
        if ((referrer.direct_referral_count ?? 0) < rule.directRequired) continue;

        const commission = Math.round(withdrawnAmount * rule.pct * 100) / 100;
        if (commission <= 0) continue;

        await supabase.from('players').update({
          total_tokens: parseFloat(referrer.total_tokens) + commission,
          referral_tokens_earned: parseFloat(referrer.referral_tokens_earned ?? '0') + commission,
        }).eq('telegram_id', ref.referrer_telegram_id);

        await supabase.from('referrals').update({ tokens_earned: commission })
          .eq('referrer_telegram_id', ref.referrer_telegram_id)
          .eq('referee_telegram_id', refereeTgId);
      }
    } catch (e) {
      console.error('Commission credit error:', e);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    Alert.alert('Reject Withdrawal', 'Tokens will be refunded to the user.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive', onPress: async () => {
          await updateWithdrawal(selected.id, {
            status: 'rejected',
            processedAt: new Date().toISOString(),
          });

          const { data: pRow } = await supabase
            .from('players')
            .select('total_tokens, pending_tokens')
            .eq('telegram_id', selected.telegramId)
            .single();

          if (pRow) {
            await supabase.from('players').update({
              total_tokens: parseFloat(pRow.total_tokens ?? '0') + selected.amount,
              pending_tokens: Math.max(0, parseFloat(pRow.pending_tokens ?? '0') - selected.amount),
            }).eq('telegram_id', selected.telegramId);
          }

          setSelected(null);
          setTxHashInput('');
        },
      },
    ]);
  };

  const filtered = filter === 'all'
    ? withdrawals
    : withdrawals.filter(w => w.status === filter);

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
  const totalPending = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);
  const totalApproved = withdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + w.amount, 0);

  const statusColor = (s: string) => ({
    pending: Colors.warning,
    approved: Colors.success,
    rejected: Colors.error,
  }[s] || Colors.textMuted);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <View>
            <Text style={styles.headerTitle}>Admin Panel</Text>
            <Text style={styles.headerSub}>MintGrow Management</Text>
          </View>
        </View>
        <View style={styles.realtimeDot}>
          <View style={styles.realtimeDotInner} />
          <Text style={styles.realtimeLabel}>Live</Text>
        </View>
      </View>

      {pendingCount > 0 && (
        <View style={styles.alertBar}>
          <MaterialIcons name="notifications-active" size={14} color={Colors.warning} />
          <Text style={styles.alertText}>
            {pendingCount} pending withdrawal{pendingCount > 1 ? 's' : ''} · {totalPending.toLocaleString()} MG total
          </Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {(['withdrawals', 'stats'] as TabType[]).map(t => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'withdrawals' ? '📤 Withdrawals' : '📊 Platform Stats'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'stats' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.statsGrid}>
            <StatBox label="Total Players" value={statsData.totalPlayers} color={Colors.primary} />
            <StatBox label="Total MG Issued" value={`${(statsData.totalTokens / 1000).toFixed(0)}K`} color={Colors.success} />
            <StatBox label="Pending MG" value={totalPending.toLocaleString()} color={Colors.warning} />
            <StatBox label="Approved MG" value={totalApproved.toLocaleString()} color={Colors.accent} />
            <StatBox label="Total Ads" value={statsData.totalAds} color={Colors.info} />
            <StatBox label="Total Games" value={statsData.totalGames} color={Colors.primaryDark} />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>🔄 Real-time Updates</Text>
            <Text style={styles.infoBody}>
              Admin panel is subscribed to live Supabase updates. New withdrawal requests and player registrations appear instantly without refreshing.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Admin Workflow</Text>
            <Text style={styles.infoBody}>
              1. Review pending withdrawals{'\n'}
              2. Send MG from treasury wallet to user's BNB Chain address{'\n'}
              3. Copy the BNB Chain TX hash{'\n'}
              4. Enter TX hash and tap Approve{'\n'}
              5. Approving auto-credits referral commissions across 25 levels{'\n'}
              6. Rejected requests auto-refund tokens to user
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Network</Text>
            <Text style={[styles.infoBody, { color: Colors.primary }]}>{TOKEN_NETWORK}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Admin ID</Text>
            <Text style={[styles.infoBody, { color: Colors.primary }]}>@PETER44441111</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 2 }}
          >
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <Pressable
                key={f}
                style={[styles.filterChip, filter === f && styles.activeChip]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.activeChipText]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)} (
                  {f === 'all' ? withdrawals.length : withdrawals.filter(w => w.status === f).length}
                  )
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>No {filter} requests</Text>
            </View>
          ) : (
            filtered.map(w => (
              <Pressable
                key={w.id}
                style={styles.requestCard}
                onPress={() => setSelected(w)}
              >
                <View style={styles.requestHeader}>
                  <Text style={styles.requestUser}>@{w.username}</Text>
                  <View style={[styles.statusPill, { borderColor: statusColor(w.status) }]}>
                    <Text style={[styles.statusText, { color: statusColor(w.status) }]}>
                      {w.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestAmount}>{w.amount.toLocaleString()} MG</Text>
                <Text style={styles.requestWallet} numberOfLines={1}>→ {w.walletAddress}</Text>
                <Text style={styles.requestDate}>{new Date(w.createdAt).toLocaleString()}</Text>
                {w.txHash ? (
                  <Text style={styles.txHash}>TX: {w.txHash.slice(0, 20)}...</Text>
                ) : null}
                {w.status === 'pending' ? (
                  <Text style={styles.tapHint}>Tap to review →</Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* Approval Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review Withdrawal</Text>
            <View style={styles.modalInfo}>
              <InfoRow label="User" value={`@${selected?.username}`} />
              <InfoRow label="Telegram ID" value={selected?.telegramId ?? ''} />
              <InfoRow label="Amount" value={`${selected?.amount.toLocaleString()} MG`} />
              <InfoRow label="Wallet" value={selected?.walletAddress ?? ''} mono />
              <InfoRow label="Network" value={TOKEN_NETWORK} />
              <InfoRow label="Date" value={new Date(selected?.createdAt ?? '').toLocaleString()} />
            </View>

            {selected?.status === 'pending' ? (
              <>
                <Text style={styles.txLabel}>BNB Chain Transaction Hash:</Text>
                <TextInput
                  style={styles.txInput}
                  value={txHashInput}
                  onChangeText={setTxHashInput}
                  placeholder="0x..."
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                />
                <GlowButton
                  label="✓ Approve & Confirm"
                  onPress={handleApprove}
                  variant="primary"
                  fullWidth
                  style={{ marginBottom: Spacing.sm }}
                />
                <GlowButton
                  label="✗ Reject & Refund"
                  onPress={handleReject}
                  variant="danger"
                  fullWidth
                  style={{ marginBottom: Spacing.sm }}
                />
              </>
            ) : (
              <View style={[styles.processedBanner, { borderColor: statusColor(selected?.status ?? '') }]}>
                <Text style={[styles.processedText, { color: statusColor(selected?.status ?? '') }]}>
                  {selected?.status?.toUpperCase()} · {new Date(selected?.processedAt ?? '').toLocaleString()}
                </Text>
                {selected?.txHash ? (
                  <Text style={styles.txHashFull}>TX: {selected.txHash}</Text>
                ) : null}
              </View>
            )}

            <Pressable
              style={styles.closeBtn}
              onPress={() => { setSelected(null); setTxHashInput(''); }}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <View style={[sb.box, { borderColor: color }]}>
      <Text style={[sb.val, { color }]}>{value}</Text>
      <Text style={sb.lbl}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={[ir.value, mono && ir.mono]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  box: {
    flex: 1, minWidth: '44%', backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', borderWidth: 1.5, margin: 4,
  },
  val: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  lbl: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
});

const ir = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm, flexWrap: 'wrap',
  },
  label: { ...Typography.smallBold, color: Colors.textMuted, flex: 0.4 },
  value: { ...Typography.small, color: Colors.textPrimary, flex: 0.6, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 10 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 32, height: 32, borderRadius: 8 },
  headerTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  headerSub: { ...Typography.caption, color: Colors.textMuted },
  realtimeDot: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(46,160,67,0.12)', borderRadius: Radius.full,
    paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.success,
  },
  realtimeDotInner: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success,
  },
  realtimeLabel: { ...Typography.caption, color: Colors.success, fontWeight: '700' },
  alertBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,127,23,0.1)', padding: Spacing.sm + 2,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,127,23,0.3)',
  },
  alertText: { ...Typography.small, color: Colors.warning },
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.bgCard, padding: 4,
    margin: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { ...Typography.smallBold, color: Colors.textMuted },
  activeTabText: { color: '#fff' },
  scroll: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', margin: -4, marginBottom: Spacing.md },
  infoCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  infoTitle: { ...Typography.bodyBold, color: Colors.primary },
  infoBody: { ...Typography.small, color: Colors.textSecondary, lineHeight: 22 },
  filterRow: { marginBottom: Spacing.md },
  filterChip: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.full,
    paddingVertical: 6, paddingHorizontal: 14, marginRight: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { ...Typography.small, color: Colors.textMuted },
  activeChipText: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyText: { ...Typography.body, color: Colors.textMuted },
  requestCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: 4,
  },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestUser: { ...Typography.bodyBold, color: Colors.textPrimary },
  requestAmount: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  requestWallet: { ...Typography.small, color: Colors.textMuted, fontFamily: 'monospace' },
  requestDate: { ...Typography.caption, color: Colors.textMuted },
  txHash: { ...Typography.caption, color: Colors.success },
  tapHint: { ...Typography.caption, color: Colors.primary, textAlign: 'right' },
  statusPill: {
    borderRadius: Radius.full, borderWidth: 1, paddingVertical: 3, paddingHorizontal: 8,
  },
  statusText: { ...Typography.caption, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 40,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  modalInfo: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md, padding: Spacing.sm,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  txLabel: { ...Typography.smallBold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  txInput: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 13, marginBottom: Spacing.md, minHeight: 48,
  },
  processedBanner: {
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md, gap: 4,
  },
  processedText: { ...Typography.bodyBold },
  txHashFull: { ...Typography.small, color: Colors.textMuted, fontFamily: 'monospace' },
  closeBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  closeBtnText: { ...Typography.bodyBold, color: Colors.textSecondary },
});
