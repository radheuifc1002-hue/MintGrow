import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGame } from '@/hooks/useGame';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { authorizeAndStake, connectWallet, onchainConfig, prepareStaking } from '@/services/onchainWallet';

const MINIMUM_STAKE = 250000;

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function StakingScreen() {
  const router = useRouter();
  const { profile } = useGame();
  const config = useMemo(() => onchainConfig(), []);
  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState(String(MINIMUM_STAKE));
  const [step, setStep] = useState<'connect' | 'authorize' | 'staking' | 'complete'>('connect');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Connect an external EVM wallet to begin.');
  const [result, setResult] = useState<any>(null);

  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= MINIMUM_STAKE;

  const handleConnect = async () => {
    try {
      setBusy(true);
      const address = await connectWallet();
      setWallet(address);
      setStep('authorize');
      setStatus('Wallet connected. Review the delegation permission before signing.');
    } catch (error: any) {
      Alert.alert('Wallet connection failed', error?.message || 'Unable to connect wallet.');
    } finally {
      setBusy(false);
    }
  };

  const handleStake = async () => {
    if (!wallet || !validAmount) return;
    try {
      setBusy(true);
      setStep('staking');
      setStatus('Preparing the sponsored staking request.');
      const preparation = await prepareStaking(wallet, String(numericAmount), profile?.telegramId);
      setStatus('Sign the constrained MintGrow delegation.');
      const submission = await authorizeAndStake(wallet, profile?.telegramId, String(numericAmount), preparation);
      setResult(submission);
      setStep('complete');
      setStatus('Staking operation submitted through the sponsored account flow.');
    } catch (error: any) {
      setStep('authorize');
      setStatus('The operation was not submitted.');
      Alert.alert('Staking failed', error?.message || 'Unable to submit sponsored staking.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>MINTGROW</Text>
            <Text style={styles.title}>MG Staking</Text>
            <Text style={styles.subtitle}>Sponsored on-chain staking</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>MINIMUM STAKE</Text>
            <View style={styles.chainPill}><Text style={styles.chainPillText}>EVM</Text></View>
          </View>
          <Text style={styles.heroAmount}>250,000 MGS</Text>
          <Text style={styles.heroNote}>The minimum is configurable by MintGrow governance.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wallet</Text>
          {wallet ? (
            <View style={styles.walletRow}>
              <View>
                <Text style={styles.walletLabel}>Connected wallet</Text>
                <Text style={styles.walletAddress}>{formatAddress(wallet)}</Text>
              </View>
              <View style={styles.connectedPill}><Text style={styles.connectedText}>Connected</Text></View>
            </View>
          ) : (
            <Text style={styles.cardBody}>Connect a wallet outside Telegram. MintGrow never receives your private key.</Text>
          )}
          <Pressable disabled={busy} onPress={handleConnect} style={[styles.primaryButton, busy && styles.disabled]}>
            <Text style={styles.primaryText}>{wallet ? 'Wallet Connected' : 'Connect Wallet'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delegation permission</Text>
          <Text style={styles.cardBody}>The signed delegation is constrained to MintGrow staking operations. It does not authorize arbitrary transfers or unrelated contracts.</Text>
          <View style={styles.permissionList}>
            <Permission label="Stake MGS" allowed />
            <Permission label="Claim MG rewards" allowed />
            <Permission label="Unstake / return MGS" allowed />
            <Permission label="Arbitrary wallet transfers" allowed={false} />
          </View>
          <Text style={styles.expiry}>The exact expiry and maximum delegated amount are displayed by the wallet before signing.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stake amount</Text>
          <View style={styles.amountBox}>
            <Text style={styles.amountText}>{Number.isFinite(numericAmount) ? numericAmount.toLocaleString() : '0'}</Text>
            <Text style={styles.amountToken}>MGS</Text>
          </View>
          <Text style={styles.cardBody}>Only allowlisted wallets can stake. The current minimum is 250,000 MGS.</Text>
          <Pressable disabled={busy || !wallet || !validAmount} onPress={handleStake} style={[styles.primaryButton, (busy || !wallet || !validAmount) && styles.disabled]}>
            <Text style={styles.primaryText}>{busy ? 'Processing...' : 'Authorize & Stake'}</Text>
          </Pressable>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Sponsored transaction flow</Text>
          <FlowStep number="1" text="Connect external wallet" active={step !== 'connect'} />
          <FlowStep number="2" text="Sign constrained delegation" active={step === 'staking' || step === 'complete'} />
          <FlowStep number="3" text="Sign MGS permit" active={step === 'staking' || step === 'complete'} />
          <FlowStep number="4" text="ERC-4337 UserOperation" active={step === 'complete'} />
          <FlowStep number="5" text="MintGrow Paymaster sponsors gas" active={step === 'complete'} />
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>STATUS</Text>
          <Text style={styles.statusText}>{status}</Text>
          {result?.userOperationHash ? <Text style={styles.hash}>UserOp: {formatAddress(result.userOperationHash)}</Text> : null}
          {config.chainId ? <Text style={styles.chain}>Network ID: {config.chainId}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Permission({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <View style={styles.permissionRow}>
      <View style={[styles.permissionDot, !allowed && styles.permissionDotOff]} />
      <Text style={styles.permissionText}>{label}</Text>
      <Text style={styles.permissionState}>{allowed ? 'Allowed' : 'Blocked'}</Text>
    </View>
  );
}

function FlowStep({ number, text, active }: { number: string; text: string; active: boolean }) {
  return (
    <View style={styles.flowRow}>
      <View style={[styles.stepNumber, active && styles.stepNumberActive]}><Text style={[styles.stepNumberText, active && styles.stepNumberTextActive]}>{number}</Text></View>
      <Text style={[styles.flowText, active && styles.flowTextActive]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  backButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: Colors.bgCard },
  backText: { ...Typography.smallBold, color: Colors.primary },
  headerCopy: { marginLeft: Spacing.md },
  kicker: { ...Typography.caption, color: Colors.primary, letterSpacing: 2 },
  title: { ...Typography.h1, color: Colors.textPrimary },
  subtitle: { ...Typography.small, color: Colors.textMuted },
  heroCard: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { ...Typography.caption, color: Colors.textOnGreen, letterSpacing: 1.5 },
  chainPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  chainPillText: { ...Typography.caption, color: Colors.textOnGreen },
  heroAmount: { fontSize: 30, fontWeight: '900', color: Colors.textOnGreen, marginTop: 18 },
  heroNote: { ...Typography.small, color: 'rgba(255,255,255,0.82)', marginTop: 5 },
  card: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 7 },
  cardBody: { ...Typography.small, color: Colors.textMuted, lineHeight: 19, marginBottom: Spacing.md },
  walletRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  walletLabel: { ...Typography.caption, color: Colors.textMuted },
  walletAddress: { ...Typography.bodyBold, color: Colors.textPrimary, marginTop: 2 },
  connectedPill: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.secondaryGreen, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5 },
  connectedText: { ...Typography.caption, color: Colors.primary },
  primaryButton: { minHeight: 50, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...Typography.bodyBold, color: Colors.textOnGreen },
  disabled: { opacity: 0.5 },
  permissionList: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 2 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permissionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary, marginRight: 9 },
  permissionDotOff: { backgroundColor: Colors.error },
  permissionText: { ...Typography.small, color: Colors.textPrimary, flex: 1 },
  permissionState: { ...Typography.caption, color: Colors.textMuted },
  expiry: { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing.sm },
  amountBox: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 13, marginBottom: Spacing.sm },
  amountText: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  amountToken: { ...Typography.bodyBold, color: Colors.primary },
  flowCard: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  flowTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  flowRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stepNumberActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNumberText: { ...Typography.caption, color: Colors.textMuted },
  stepNumberTextActive: { color: Colors.textOnGreen },
  flowText: { ...Typography.small, color: Colors.textMuted },
  flowTextActive: { color: Colors.textPrimary, fontWeight: '600' },
  statusCard: { backgroundColor: Colors.bgSurface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  statusLabel: { ...Typography.caption, color: Colors.primary, letterSpacing: 1.5 },
  statusText: { ...Typography.small, color: Colors.textPrimary, marginTop: 5, lineHeight: 19 },
  hash: { ...Typography.caption, color: Colors.primary, marginTop: 8 },
  chain: { ...Typography.caption, color: Colors.textMuted, marginTop: 4 },
});
