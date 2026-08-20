import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { getWithdrawals, updateWithdrawal } from '@/services/storage';
import { TOKEN_NETWORK, WithdrawalRequest } from '@/types/game';

type AdminTab = 'overview' | 'users' | 'withdrawals' | 'games';
type WithdrawalStep = 'review' | 'wallet' | 'signature' | 'txn' | 'complete';

type AdminPlayer = {
  telegramId: string;
  username: string;
  walletAddress: string;
  totalTokens: number;
  pendingTokens: number;
  withdrawnTokens: number;
  adsWatched: number;
  gamesPlayed: number;
  bestScore: number;
  level: number;
  referralCount: number;
  createdAt?: string;
};

type AdminStats = {
  totalUsers: number;
  totalTokens: number;
  pendingTokens: number;
  withdrawnTokens: number;
  totalAds: number;
  totalGames: number;
  pendingWithdrawals: number;
};

type EthersLike = {
  BrowserProvider: new (ethereum: unknown) => {
    getSigner: () => Promise<{
      getAddress: () => Promise<string>;
      signMessage: (message: string) => Promise<string>;
    }>;
    getTransactionReceipt: (hash: string) => Promise<unknown | null>;
  };
};

declare global {
  interface Window {
    ethereum?: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    ethers?: EthersLike;
  }
}

const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || 'radheuifc100.3@gmail.com';
const ADMIN_PASSWORD = process.env.EXPO_PUBLIC_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
const ETHERS_SCRIPT_ID = 'mintgrow-admin-ethers';

const loadEthers = (): Promise<EthersLike> => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Wallet workflow is available in the web admin panel only.'));
  }

  if (window.ethers) return Promise.resolve(window.ethers);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(ETHERS_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    script.id = ETHERS_SCRIPT_ID;
    script.src = 'https://cdn.jsdelivr.net/npm/ethers@6.13.5/dist/ethers.umd.min.js';
    script.async = true;
    script.addEventListener('load', () => {
      if (window.ethers) resolve(window.ethers);
      else reject(new Error('Ethers SDK loaded but did not expose window.ethers.'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('Unable to load ethers SDK.')), { once: true });
    if (!existing) document.head.appendChild(script);
  });
};

const toNumber = (value: unknown) => Number.parseFloat(String(value ?? '0')) || 0;

export default function AdminPanelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [workflowStep, setWorkflowStep] = useState<WithdrawalStep>('review');
  const [walletAddress, setWalletAddress] = useState('');
  const [signature, setSignature] = useState('');
  const [txHash, setTxHash] = useState('');
  const [txnVerified, setTxnVerified] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(player => [player.username, player.telegramId, player.walletAddress].some(value => value.toLowerCase().includes(q)));
  }, [players, search]);

  const filteredWithdrawals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withdrawals;
    return withdrawals.filter(item => [item.username, item.telegramId, item.walletAddress, item.status, item.txHash ?? ''].some(value => value.toLowerCase().includes(q)));
  }, [withdrawals, search]);

  const stats = useMemo<AdminStats>(() => ({
    totalUsers: players.length,
    totalTokens: players.reduce((sum, player) => sum + player.totalTokens, 0),
    pendingTokens: players.reduce((sum, player) => sum + player.pendingTokens, 0),
    withdrawnTokens: players.reduce((sum, player) => sum + player.withdrawnTokens, 0),
    totalAds: players.reduce((sum, player) => sum + player.adsWatched, 0),
    totalGames: players.reduce((sum, player) => sum + player.gamesPlayed, 0),
    pendingWithdrawals: withdrawals.filter(item => item.status === 'pending').length,
  }), [players, withdrawals]);

  const loadPlayers = useCallback(async () => {
    const { data, error } = await supabase
      .from('players')
      .select('telegram_id, username, wallet_address, total_tokens, pending_tokens, withdrawn_tokens, ads_watched, games_played, best_score, level, direct_referral_count, created_at')
      .order('total_tokens', { ascending: false })
      .limit(500);

    if (error) throw error;

    setPlayers(((data || []) as any[]).map(row => ({
      telegramId: String(row.telegram_id ?? ''),
      username: String(row.username ?? 'Unknown'),
      walletAddress: String(row.wallet_address ?? ''),
      totalTokens: toNumber(row.total_tokens),
      pendingTokens: toNumber(row.pending_tokens),
      withdrawnTokens: toNumber(row.withdrawn_tokens),
      adsWatched: Number(row.ads_watched ?? 0),
      gamesPlayed: Number(row.games_played ?? 0),
      bestScore: Number(row.best_score ?? 0),
      level: Number(row.level ?? 1),
      referralCount: Number(row.direct_referral_count ?? 0),
      createdAt: row.created_at ? String(row.created_at) : undefined,
    })));
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const withdrawalList = await getWithdrawals();
      setWithdrawals(withdrawalList);
      await loadPlayers();
    } catch (error) {
      console.error('Admin panel load failed:', error);
      Alert.alert('Database error', 'Unable to load Supabase admin data. Check environment variables and RLS policies.');
    } finally {
      setLoading(false);
    }
  }, [loadPlayers]);

  useEffect(() => {
    if (authed) loadDashboard();
  }, [authed, loadDashboard]);

  const handleLogin = () => {
    if (!ADMIN_PASSWORD) {
      Alert.alert('Missing env variable', 'Set EXPO_PUBLIC_ADMIN_PASSWORD in the deployment environment. Do not hardcode the password in code.');
      return;
    }
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      setAuthed(true);
      setPassword('');
      return;
    }
    Alert.alert('Access denied', 'Invalid admin email or password.');
  };

  const resetWorkflow = () => {
    setWorkflowStep('review');
    setWalletAddress('');
    setSignature('');
    setTxHash('');
    setTxnVerified(false);
  };

  const openWithdrawal = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    resetWorkflow();
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum?.request) throw new Error('No injected wallet found. Install MetaMask or open in a wallet browser.');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const ethers = await loadEthers();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setWorkflowStep('signature');
    } catch (error: any) {
      Alert.alert('Wallet connection failed', error?.message || 'Unable to connect wallet.');
    }
  };

  const requestSignature = async () => {
    if (!selectedWithdrawal) return;
    try {
      const ethers = await loadEthers();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const message = [
        'MintGrow withdrawal approval',
        `Withdrawal ID: ${selectedWithdrawal.id}`,
        `User: ${selectedWithdrawal.telegramId}`,
        `Amount: ${selectedWithdrawal.amount} MG`,
        `Recipient: ${selectedWithdrawal.walletAddress}`,
        `Admin wallet: ${walletAddress}`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join('\n');
      const signed = await signer.signMessage(message);
      setSignature(signed);
      setWorkflowStep('txn');
    } catch (error: any) {
      Alert.alert('Signature rejected', error?.message || 'Signature is required before approval.');
    }
  };

  const verifyTxn = async () => {
    if (!txHash.trim()) {
      Alert.alert('Transaction required', 'Paste the BNB Chain transaction hash after sending funds.');
      return;
    }
    try {
      const ethers = await loadEthers();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const receipt = await provider.getTransactionReceipt(txHash.trim());
      if (!receipt) {
        Alert.alert('Not detected yet', 'The transaction is not visible from the connected wallet RPC yet. Try again after confirmation.');
        return;
      }
      setTxnVerified(true);
      setWorkflowStep('complete');
    } catch (error: any) {
      Alert.alert('Transaction check failed', error?.message || 'Unable to verify transaction.');
    }
  };

  const approveWithdrawal = async () => {
    if (!selectedWithdrawal || !signature || !txnVerified || !txHash.trim()) return;
    setLoading(true);
    try {
      await updateWithdrawal(selectedWithdrawal.id, {
        status: 'approved',
        txHash: txHash.trim(),
        processedAt: new Date().toISOString(),
      });

      const { data: player } = await supabase
        .from('players')
        .select('pending_tokens, withdrawn_tokens')
        .eq('telegram_id', selectedWithdrawal.telegramId)
        .single();

      if (player) {
        await supabase.from('players').update({
          pending_tokens: Math.max(0, toNumber((player as any).pending_tokens) - selectedWithdrawal.amount),
          withdrawn_tokens: toNumber((player as any).withdrawn_tokens) + selectedWithdrawal.amount,
        }).eq('telegram_id', selectedWithdrawal.telegramId);
      }

      Alert.alert('Withdrawal approved', 'Database updated with transaction hash and approval status.');
      setSelectedWithdrawal(null);
      resetWorkflow();
      await loadDashboard();
    } catch (error) {
      console.error('Withdrawal approval failed:', error);
      Alert.alert('Approval failed', 'Unable to approve withdrawal in Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const rejectWithdrawal = async () => {
    if (!selectedWithdrawal) return;
    setLoading(true);
    try {
      await updateWithdrawal(selectedWithdrawal.id, {
        status: 'rejected',
        processedAt: new Date().toISOString(),
      });
      const { data: player } = await supabase
        .from('players')
        .select('total_tokens, pending_tokens')
        .eq('telegram_id', selectedWithdrawal.telegramId)
        .single();
      if (player) {
        await supabase.from('players').update({
          total_tokens: toNumber((player as any).total_tokens) + selectedWithdrawal.amount,
          pending_tokens: Math.max(0, toNumber((player as any).pending_tokens) - selectedWithdrawal.amount),
        }).eq('telegram_id', selectedWithdrawal.telegramId);
      }
      setSelectedWithdrawal(null);
      resetWorkflow();
      await loadDashboard();
    } catch (error) {
      console.error('Withdrawal rejection failed:', error);
      Alert.alert('Reject failed', 'Unable to reject withdrawal in Supabase.');
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <View style={[styles.loginContainer, { paddingTop: insets.top + Spacing.xl }]}> 
        <View style={styles.loginCard}>
          <MaterialIcons name="admin-panel-settings" size={42} color={Colors.primary} />
          <Text style={styles.title}>MintGrow Admin Panel</Text>
          <Text style={styles.muted}>Secure admin access for {ADMIN_EMAIL}. Password must come from the environment.</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Admin email" placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Admin password env value" placeholderTextColor={Colors.textMuted} />
          <Pressable style={styles.primaryBtn} onPress={handleLogin}>
            <Text style={styles.primaryBtnText}>Login</Text>
          </Pressable>
          <Pressable onPress={() => router.back()}><Text style={styles.linkText}>Back to app</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>MintGrow Command Center</Text>
          <Text style={styles.muted}>Users · wallets · withdrawals · game activity</Text>
        </View>
        <View style={styles.adminMark}><Text style={styles.adminMarkText}>MG</Text></View>
        <Pressable style={styles.refreshBtn} onPress={loadDashboard} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <MaterialIcons name="refresh" size={20} color={Colors.primary} />}
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={18} color={Colors.textMuted} />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search users, wallets, withdrawals, tx hash" placeholderTextColor={Colors.textMuted} />
      </View>

      <View style={styles.tabs}>
        {(['overview', 'users', 'withdrawals', 'games'] as AdminTab[]).map(item => (
          <Pressable key={item} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'overview' && <Overview stats={stats} />}
        {tab === 'users' && <Users players={filteredPlayers} />}
        {tab === 'games' && <Games players={filteredPlayers} />}
        {tab === 'withdrawals' && <Withdrawals withdrawals={filteredWithdrawals} onOpen={openWithdrawal} />}
      </ScrollView>

      <Modal visible={!!selectedWithdrawal} transparent animationType="slide" onRequestClose={() => setSelectedWithdrawal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Withdrawal workflow</Text>
            <Text style={styles.muted}>{TOKEN_NETWORK} · {selectedWithdrawal?.amount.toLocaleString()} MG</Text>
            <Info label="User" value={`@${selectedWithdrawal?.username} (${selectedWithdrawal?.telegramId})`} />
            <Info label="Recipient" value={selectedWithdrawal?.walletAddress || ''} mono />
            <Info label="Step" value={workflowStep} />
            {walletAddress ? <Info label="Admin wallet" value={walletAddress} mono /> : null}
            {signature ? <Info label="Signature" value={`${signature.slice(0, 28)}...`} mono /> : null}

            {workflowStep === 'review' && <Action label="1. Connect treasury wallet" onPress={connectWallet} icon="account-balance-wallet" />}
            {workflowStep === 'signature' && <Action label="2. Request admin signature" onPress={requestSignature} icon="draw" />}
            {(workflowStep === 'txn' || workflowStep === 'complete') && (
              <>
                <TextInput style={styles.input} value={txHash} onChangeText={setTxHash} placeholder="BNB Chain transaction hash" placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
                <Action label="3. Detect transaction receipt" onPress={verifyTxn} icon="search" />
              </>
            )}
            {workflowStep === 'complete' && <Action label="4. Approve withdrawal in backend" onPress={approveWithdrawal} icon="verified" />}
            {selectedWithdrawal?.status === 'pending' ? <Action label="Reject and refund pending tokens" onPress={rejectWithdrawal} icon="cancel" danger /> : null}
            <Pressable style={styles.secondaryBtn} onPress={() => setSelectedWithdrawal(null)}><Text style={styles.secondaryBtnText}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Overview({ stats }: { stats: AdminStats }) {
  return (
    <View>
      <View style={styles.grid}>
        <Metric label="Users" value={stats.totalUsers} icon="groups" />
        <Metric label="Total MG" value={Math.round(stats.totalTokens).toLocaleString()} icon="paid" />
        <Metric label="Pending MG" value={Math.round(stats.pendingTokens).toLocaleString()} icon="hourglass-top" />
        <Metric label="Withdrawn MG" value={Math.round(stats.withdrawnTokens).toLocaleString()} icon="outbound" />
        <Metric label="Ads watched" value={stats.totalAds} icon="live-tv" />
        <Metric label="Games played" value={stats.totalGames} icon="sports-esports" />
      </View>
      <View style={styles.opsBanner}>
        <Text style={styles.opsTitle}>Operations cockpit</Text>
        <Text style={styles.opsText}>Track wallets, ad gates, pending payouts, gameplay value, and approval signatures from one Vercel-friendly dashboard.</Text>
      </View>
      <View style={styles.workflowCard}>
        <Text style={styles.sectionTitle}>Withdrawal backend workflow</Text>
        <Text style={styles.bodyText}>1. Review wallet and user balance.\n2. Connect treasury wallet with ethers.js.\n3. Sign an approval message for auditability.\n4. Send MG/BNB Chain payout externally and paste the transaction hash.\n5. Detect the transaction receipt from the connected wallet RPC.\n6. Approve in Supabase backend and update pending/withdrawn balances.</Text>
      </View>
    </View>
  );
}

function Users({ players }: { players: AdminPlayer[] }) {
  return <>{players.map(player => <UserCard key={player.telegramId} player={player} />)}</>;
}

function Games({ players }: { players: AdminPlayer[] }) {
  return <>{players.sort((a, b) => b.bestScore - a.bestScore).map(player => <UserCard key={player.telegramId} player={player} compact />)}</>;
}

function Withdrawals({ withdrawals, onOpen }: { withdrawals: WithdrawalRequest[]; onOpen: (item: WithdrawalRequest) => void }) {
  return <>{withdrawals.map(item => (
    <Pressable key={item.id} style={styles.card} onPress={() => onOpen(item)}>
      <View style={styles.rowBetween}><Text style={styles.cardTitle}>@{item.username}</Text><Text style={styles.badge}>{item.status}</Text></View>
      <Text style={styles.amount}>{item.amount.toLocaleString()} MG</Text>
      <Text style={styles.mono}>{item.walletAddress}</Text>
      <Text style={styles.muted}>{new Date(item.createdAt).toLocaleString()}</Text>
      {item.txHash ? <Text style={styles.mono}>TX: {item.txHash}</Text> : null}
    </Pressable>
  ))}</>;
}

function UserCard({ player, compact }: { player: AdminPlayer; compact?: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}><Text style={styles.cardTitle}>@{player.username}</Text><Text style={styles.badge}>Lv {player.level}</Text></View>
      <Text style={styles.muted}>Telegram ID: {player.telegramId}</Text>
      {!compact ? <Text style={styles.mono}>{player.walletAddress || 'No wallet saved'}</Text> : null}
      <View style={styles.inlineStats}>
        <Text style={styles.statText}>{player.totalTokens.toLocaleString()} MG</Text>
        <Text style={styles.statText}>{player.gamesPlayed} games</Text>
        <Text style={styles.statText}>{player.adsWatched} ads</Text>
        <Text style={styles.statText}>Best {player.bestScore.toLocaleString()}</Text>
      </View>
    </View>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof MaterialIcons.glyphMap }) {
  return <View style={styles.metric}><MaterialIcons name={icon} size={20} color={Colors.primary} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, mono && styles.mono]}>{value}</Text></View>;
}

function Action({ label, onPress, icon, danger }: { label: string; onPress: () => void; icon: keyof typeof MaterialIcons.glyphMap; danger?: boolean }) {
  return <Pressable style={[styles.primaryBtn, danger && styles.dangerBtn]} onPress={onPress}><MaterialIcons name={icon} size={18} color="#fff" /><Text style={styles.primaryBtnText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071A13' },
  loginContainer: { flex: 1, backgroundColor: '#071A13', padding: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
  loginCard: { width: '100%', maxWidth: 420, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(184,255,217,0.18)' },
  headerTitle: { ...Typography.h3, color: '#FFFFFF' },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  muted: { ...Typography.small, color: '#8BCFAE' },
  bodyText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  input: { width: '100%', backgroundColor: Colors.bgSurface, color: Colors.textPrimary, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, width: '100%' },
  dangerBtn: { backgroundColor: Colors.error },
  primaryBtnText: { ...Typography.bodyBold, color: '#fff' },
  secondaryBtn: { alignItems: 'center', padding: Spacing.md },
  secondaryBtnText: { ...Typography.bodyBold, color: Colors.primary },
  linkText: { ...Typography.smallBold, color: Colors.primary },
  adminMark: { width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  adminMarkText: { color: '#fff', fontWeight: '900' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(184,255,217,0.22)' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.md, marginTop: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(184,255,217,0.18)' },
  searchInput: { flex: 1, minHeight: 44, color: '#FFFFFF' },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 6 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(184,255,217,0.12)' },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { ...Typography.caption, color: '#8BCFAE', fontWeight: '700' },
  activeTabText: { color: '#fff' },
  scroll: { padding: Spacing.md, paddingBottom: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metric: { flexGrow: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(184,255,217,0.35)', gap: 4 },
  metricValue: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  opsBanner: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg, gap: 6 },
  opsTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  opsText: { ...Typography.small, color: '#E8FFF3', lineHeight: 20 },
  workflowCard: { marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(184,255,217,0.35)' },
  sectionTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 8 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  badge: { ...Typography.caption, color: Colors.primary, textTransform: 'uppercase', fontWeight: '800' },
  amount: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  mono: { ...Typography.caption, color: Colors.textSecondary, fontFamily: 'monospace' },
  inlineStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statText: { ...Typography.caption, color: Colors.textSecondary, backgroundColor: Colors.bgSurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, maxHeight: '88%' },
  modalTitle: { ...Typography.h3, color: Colors.textPrimary },
  infoRow: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8, gap: 4 },
  infoLabel: { ...Typography.caption, color: Colors.textMuted, textTransform: 'uppercase' },
  infoValue: { ...Typography.smallBold, color: Colors.textPrimary },
});
