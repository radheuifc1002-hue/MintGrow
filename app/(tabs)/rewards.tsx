import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { isValidBep20Address, normalizeWalletAddress, useWithdrawal } from '@/hooks/useWithdrawal';
import { GlowButton } from '@/components/ui/GlowButton';
import { AdLoadingOverlay } from '@/components/ui/AdLoadingOverlay';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { WITHDRAWAL_MIN, TOKEN_NETWORK, WithdrawalRequest } from '@/types/game';
import { subscribeWithdrawalUpdates } from '@/services/storage';

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile, setProfile } = useGame();
  const { withdrawals, isLoading, isWatchingAd, error, loadWithdrawals, requestWithdrawal, updateWallet, setError } = useWithdrawal();
  const [walletInput, setWalletInput] = useState(profile?.walletAddress || '');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [savedWallet, setSavedWallet] = useState(false);

  useEffect(() => { loadWithdrawals(); }, []);
  useEffect(() => {
    if (!profile?.telegramId) return;
    const unsubscribe = subscribeWithdrawalUpdates(profile.telegramId, (updated: WithdrawalRequest) => {
      loadWithdrawals();
      if (updated.status === 'approved') {
        refreshProfile();
        Alert.alert('Withdrawal Approved', `${updated.amount.toLocaleString()} MG has been sent to your BNB Chain wallet.`);
      } else if (updated.status === 'rejected') {
        refreshProfile();
        Alert.alert('Withdrawal Rejected', 'Your tokens have been refunded to your balance.');
      }
    });
    return () => { unsubscribe(); };
  }, [profile?.telegramId]);
  useEffect(() => { if (profile?.walletAddress) setWalletInput(profile.walletAddress); }, [profile?.walletAddress]);

  const handleSaveWallet = async () => {
    const normalized = normalizeWalletAddress(walletInput);
    if (!isValidBep20Address(normalized)) {
      Alert.alert('Invalid Address', 'Please enter a valid BEP-20 wallet address that starts with 0x and contains 40 hexadecimal characters.');
      return;
    }
    const ok = await updateWallet(normalized);
    if (ok) {
      setWalletInput(normalized);
      if (profile) setProfile({ ...profile, walletAddress: normalized });
      setSavedWallet(true);
      await refreshProfile();
      Alert.alert('Wallet Saved', 'Your BEP-20 wallet address has been updated.');
      setTimeout(() => setSavedWallet(false), 3000);
    }
  };

  const handleWithdraw = async () => {
    setError(null);
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    const ok = await requestWithdrawal(amt);
    if (ok) {
      setWithdrawAmount(''); refreshProfile(); loadWithdrawals();
      Alert.alert('Withdrawal Submitted', 'Withdrawal request submitted. Admin will approve within 24–48h on BNB Chain.');
    }
  };

  const statusColor = (s: string) => ({ pending: Colors.warning, approved: Colors.success, rejected: Colors.error }[s] || Colors.textMuted);
  const totalTokens = profile?.totalTokens ?? 0;
  const meetsMin = totalTokens >= WITHDRAWAL_MIN;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.titleRow}><View style={styles.titleIcon}><MaterialIcons name="redeem" size={22} color={Colors.primary} /></View><View><Text style={styles.pageTitle}>Rewards & Withdraw</Text><Text style={styles.pageSubtitle}>Earn MG · Withdraw on BNB Chain</Text></View></View>
          <View style={styles.balanceCard}>
            <View style={styles.balanceTop}><Text style={styles.balanceLabel}>TOTAL MG BALANCE</Text><Text style={styles.balanceNetwork}>{TOKEN_NETWORK}</Text></View>
            <Text style={styles.balanceAmount}>{totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(2)}K` : totalTokens.toFixed(2)}</Text>
            <Text style={styles.balanceSub}>MintGrow Tokens</Text>
            <View style={styles.statsGrid}><View style={styles.statBox}><Text style={styles.statVal}>{(profile?.pendingTokens ?? 0).toFixed(0)}</Text><Text style={styles.statLbl}>Pending</Text></View><View style={styles.statDivider} /><View style={styles.statBox}><Text style={styles.statVal}>{(profile?.withdrawnTokens ?? 0).toFixed(0)}</Text><Text style={styles.statLbl}>Withdrawn</Text></View><View style={styles.statDivider} /><View style={styles.statBox}><Text style={styles.statVal}>{profile?.adsWatched ?? 0}</Text><Text style={styles.statLbl}>Ads Watched</Text></View></View>
          </View>
          {!meetsMin && <View style={styles.progressCard}><View style={styles.progressHeader}><Text style={styles.progressTitle}>Progress to Withdrawal</Text><Text style={styles.progressPct}>{Math.round((totalTokens / WITHDRAWAL_MIN) * 100)}%</Text></View><View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min((totalTokens / WITHDRAWAL_MIN) * 100, 100)}%` }]} /></View><Text style={styles.progressNote}>{(WITHDRAWAL_MIN - totalTokens).toLocaleString(undefined, { maximumFractionDigits: 0 })} MG more to unlock withdrawal</Text></View>}
          <View style={styles.minNotice}><MaterialIcons name="info-outline" size={14} color={Colors.primary} /><Text style={styles.minText}>Minimum withdrawal: {WITHDRAWAL_MIN.toLocaleString()} MG · Sent on {TOKEN_NETWORK}</Text></View>
          <View style={styles.section}><View style={styles.sectionTitleRow}><MaterialIcons name="account-balance-wallet" size={19} color={Colors.primary} /><Text style={styles.sectionTitle}>BNB Chain Wallet (BEP-20)</Text></View><Text style={styles.sectionSub}>Enter your BEP-20 compatible wallet address</Text><View style={styles.inputRow}><TextInput style={styles.input} value={walletInput} onChangeText={(text) => { setWalletInput(text); setError(null); }} placeholder="0x... BEP-20 address" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} inputMode="text" /><GlowButton label={savedWallet ? 'Saved' : 'Save'} onPress={handleSaveWallet} loading={isLoading} disabled={isLoading} variant={savedWallet ? 'primary' : 'secondary'} style={styles.saveBtn} /></View>{profile?.walletAddress ? <Text style={styles.walletSet}>Saved: {profile.walletAddress.slice(0, 8)}...{profile.walletAddress.slice(-6)}</Text> : null}</View>
          <View style={styles.section}><View style={styles.sectionTitleRow}><MaterialIcons name="payments" size={19} color={Colors.primary} /><Text style={styles.sectionTitle}>Request Withdrawal</Text></View><Text style={styles.sectionSub}>Watch a short ad to unlock each withdrawal request</Text><View style={styles.inputRow}><TextInput style={styles.input} value={withdrawAmount} onChangeText={setWithdrawAmount} placeholder={`Min ${WITHDRAWAL_MIN.toLocaleString()} MG`} placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" /><Pressable style={styles.maxBtn} onPress={() => setWithdrawAmount(String(Math.floor(totalTokens)))}><Text style={styles.maxBtnText}>MAX</Text></Pressable></View>{error ? <View style={styles.errorBox}><MaterialIcons name="error-outline" size={14} color={Colors.error} /><Text style={styles.errorText}>{error}</Text></View> : null}<GlowButton label="Watch Ad & Withdraw" onPress={handleWithdraw} loading={isLoading} disabled={!profile?.walletAddress || !meetsMin} fullWidth style={{ marginBottom: Spacing.sm }} /><Text style={styles.withdrawNote}>Approved within 24–48 hours · BNB Chain (BEP-20) · Status updates in real-time</Text></View>
          <View style={styles.section}><View style={styles.sectionTitleRow}><MaterialIcons name="receipt-long" size={19} color={Colors.primary} /><Text style={styles.sectionTitle}>Withdrawal History</Text></View>{withdrawals.length === 0 ? <View style={styles.emptyHistory}><MaterialIcons name="history" size={34} color={Colors.textMuted} /><Text style={styles.emptyText}>No withdrawals yet</Text></View> : withdrawals.map(w => <View key={w.id} style={styles.wItem}><View style={styles.wLeft}><Text style={styles.wAmount}>{w.amount.toLocaleString()} MG</Text><Text style={styles.wDate}>{new Date(w.createdAt).toLocaleDateString()}</Text><Text style={styles.wWallet}>{w.walletAddress.slice(0, 8)}...{w.walletAddress.slice(-5)}</Text>{w.txHash ? <Text style={styles.wTx}>TX: {w.txHash.slice(0, 16)}...</Text> : null}</View><View style={[styles.statusBadge, { borderColor: statusColor(w.status) }]}><Text style={[styles.statusText, { color: statusColor(w.status) }]}>{w.status.toUpperCase()}</Text></View></View>)}</View>
        </ScrollView>
      </View><AdLoadingOverlay visible={isWatchingAd} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
 container:{flex:1,backgroundColor:Colors.bg},scroll:{padding:Spacing.md,paddingBottom:40},titleRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:Spacing.md},titleIcon:{width:44,height:44,borderRadius:14,backgroundColor:Colors.primaryGlow,alignItems:'center',justifyContent:'center'},pageTitle:{...Typography.h2,color:Colors.textPrimary,marginBottom:2},pageSubtitle:{...Typography.small,color:Colors.textMuted},balanceCard:{backgroundColor:Colors.bgCard,borderRadius:Radius.xl,padding:Spacing.lg,alignItems:'center',borderWidth:2,borderColor:Colors.primary,marginBottom:Spacing.sm,shadowColor:Colors.primary,shadowOpacity:.12,shadowRadius:12,elevation:4},balanceTop:{flexDirection:'row',justifyContent:'space-between',width:'100%',marginBottom:4},balanceLabel:{...Typography.caption,color:Colors.primary,letterSpacing:1.5},balanceNetwork:{...Typography.caption,color:Colors.textMuted},balanceAmount:{fontSize:44,fontWeight:'900',color:Colors.primary,letterSpacing:1},balanceSub:{...Typography.small,color:Colors.textMuted,marginBottom:Spacing.md},statsGrid:{flexDirection:'row',width:'100%',backgroundColor:Colors.bgSurface,borderRadius:Radius.md,padding:Spacing.sm,borderWidth:1,borderColor:Colors.border},statBox:{flex:1,alignItems:'center'},statDivider:{width:1,backgroundColor:Colors.border},statVal:{...Typography.bodyBold,color:Colors.textPrimary,fontSize:15},statLbl:{...Typography.caption,color:Colors.textMuted},progressCard:{backgroundColor:Colors.bgCard,borderRadius:Radius.md,padding:Spacing.md,marginBottom:Spacing.sm,borderWidth:1,borderColor:Colors.border},progressHeader:{flexDirection:'row',justifyContent:'space-between',marginBottom:6},progressTitle:{...Typography.smallBold,color:Colors.textPrimary},progressPct:{...Typography.smallBold,color:Colors.primary},progressBar:{height:8,backgroundColor:Colors.bgSurface,borderRadius:4,overflow:'hidden',marginBottom:6,borderWidth:1,borderColor:Colors.border},progressFill:{height:'100%',backgroundColor:Colors.primary,borderRadius:4},progressNote:{...Typography.caption,color:Colors.textMuted},minNotice:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:Spacing.md,backgroundColor:Colors.primaryGlow,borderRadius:Radius.sm,padding:Spacing.sm,borderWidth:1,borderColor:Colors.borderStrong},minText:{...Typography.small,color:Colors.primary,flex:1},section:{backgroundColor:Colors.bgCard,borderRadius:Radius.lg,padding:Spacing.md,marginBottom:Spacing.md,borderWidth:1,borderColor:Colors.border},sectionTitleRow:{flexDirection:'row',alignItems:'center',gap:7},sectionTitle:{...Typography.bodyBold,color:Colors.textPrimary},sectionSub:{...Typography.small,color:Colors.textMuted,marginBottom:Spacing.md,marginTop:3},inputRow:{flexDirection:'row',gap:Spacing.sm,alignItems:'center',marginBottom:Spacing.sm},input:{flex:1,backgroundColor:Colors.bgSurface,borderRadius:Radius.md,borderWidth:1,borderColor:Colors.border,paddingHorizontal:Spacing.md,paddingVertical:12,color:Colors.textPrimary,fontSize:14,minHeight:48},saveBtn:{paddingHorizontal:Spacing.md,minHeight:48},walletSet:{...Typography.small,color:Colors.success,fontWeight:'600'},maxBtn:{backgroundColor:Colors.bgSurface,borderRadius:Radius.md,borderWidth:1,borderColor:Colors.primary,paddingHorizontal:Spacing.sm,paddingVertical:12,minHeight:48,justifyContent:'center'},maxBtnText:{...Typography.smallBold,color:Colors.primary},errorBox:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(211,47,47,0.08)',borderRadius:Radius.sm,padding:Spacing.sm,marginBottom:Spacing.sm},errorText:{...Typography.small,color:Colors.error,flex:1},withdrawNote:{...Typography.caption,color:Colors.textMuted,textAlign:'center'},emptyHistory:{alignItems:'center',paddingVertical:Spacing.lg,gap:Spacing.sm},emptyText:{...Typography.body,color:Colors.textMuted},wItem:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:Colors.bgSurface,borderRadius:Radius.md,padding:Spacing.sm+2,marginBottom:Spacing.sm,borderWidth:1,borderColor:Colors.border},wLeft:{gap:2},wAmount:{...Typography.bodyBold,color:Colors.textPrimary},wDate:{...Typography.caption,color:Colors.textMuted},wWallet:{...Typography.caption,color:Colors.textMuted},wTx:{...Typography.caption,color:Colors.success},statusBadge:{borderRadius:Radius.full,borderWidth:1,paddingVertical:4,paddingHorizontal:10},statusText:{...Typography.caption,fontWeight:'700'}
});
