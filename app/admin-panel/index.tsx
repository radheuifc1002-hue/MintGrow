import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { TOKEN_NETWORK, WithdrawalRequest } from '@/types/game';

type Tab = 'overview' | 'users' | 'withdrawals' | 'ledger' | 'audit';
type Player = { telegram_id: string; username: string; total_tokens: number; pending_tokens: number; withdrawn_tokens: number; ads_watched: number; games_played: number; level: number; direct_referral_count: number; wallet_address: string; created_at: string };
type LogRow = { id: string; created_at: string; [key: string]: any };
const num = (v: any) => Number.parseFloat(String(v ?? 0)) || 0;

export default function AdminPanelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [ready, setReady] = useState(false), [isAdmin, setIsAdmin] = useState(false), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('overview'), [busy, setBusy] = useState(false), [players, setPlayers] = useState<Player[]>([]), [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [ledger, setLedger] = useState<LogRow[]>([]), [audit, setAudit] = useState<LogRow[]>([]), [search, setSearch] = useState('');
  const [selected, setSelected] = useState<WithdrawalRequest | null>(null), [txHash, setTxHash] = useState(''), [rejectReason, setRejectReason] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null), [adjustAmount, setAdjustAmount] = useState(''), [adjustReason, setAdjustReason] = useState('');
  const [counts, setCounts] = useState({ ads: 0, games: 0, referrals: 0 });

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const [p, w, l, a, ads, games, refs] = await Promise.all([
        supabase.from('players').select('telegram_id,username,total_tokens,pending_tokens,withdrawn_tokens,ads_watched,games_played,level,direct_referral_count,wallet_address,created_at').order('total_tokens', { ascending: false }).limit(1000),
        supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('token_ledger').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('ad_events').select('*', { count: 'exact', head: true }),
        supabase.from('game_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('referrals').select('*', { count: 'exact', head: true }),
      ]);
      if (p.error) throw p.error; if (w.error) throw w.error; if (l.error) throw l.error; if (a.error) throw a.error;
      setPlayers((p.data ?? []) as Player[]);
      setWithdrawals((w.data ?? []).map((r: any) => ({ id: String(r.id), telegramId: String(r.telegram_id), username: String(r.username), amount: num(r.amount), walletAddress: String(r.wallet_address ?? ''), network: String(r.network ?? ''), status: r.status, createdAt: String(r.created_at), processedAt: r.processed_at ? String(r.processed_at) : undefined, txHash: r.tx_hash ? String(r.tx_hash) : undefined })));
      setLedger((l.data ?? []) as LogRow[]); setAudit((a.data ?? []) as LogRow[]);
      setCounts({ ads: ads.count ?? 0, games: games.count ?? 0, referrals: refs.count ?? 0 });
    } catch (e: any) { Alert.alert('Admin data error', e?.message || 'Unable to load protected admin data.'); }
    finally { setBusy(false); }
  }, [isAdmin]);

  const verify = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setReady(true); return; }
    const { data: ok, error } = await supabase.rpc('is_admin');
    if (!error && ok === true) setIsAdmin(true); else await supabase.auth.signOut();
    setReady(true);
  }, []);
  useEffect(() => { verify(); }, [verify]);
  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin, loadData]);

  const login = async () => {
    if (!email.trim() || !password) return Alert.alert('Missing details', 'Enter the admin email and password.');
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) { setBusy(false); return Alert.alert('Login failed', error?.message || 'Unable to sign in.'); }
    const { data: ok, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || ok !== true) { await supabase.auth.signOut(); setBusy(false); return Alert.alert('Access denied', 'This Supabase account is not registered in admin_users.'); }
    setPassword(''); setIsAdmin(true); setBusy(false);
  };
  const logout = async () => { await supabase.auth.signOut(); setIsAdmin(false); setPlayers([]); setWithdrawals([]); };

  const processWithdrawal = async (action: 'approved' | 'rejected') => {
    if (!selected) return;
    if (action === 'approved' && !txHash.trim()) return Alert.alert('Transaction hash required', 'Send the withdrawal on BNB Chain first, then paste its transaction hash.');
    if (action === 'rejected' && !rejectReason.trim()) return Alert.alert('Reason required', 'Enter a rejection reason.');
    setBusy(true);
    try {
      const { error } = await supabase.rpc('admin_process_withdrawal', { p_withdrawal_id: selected.id, p_action: action, p_tx_hash: action === 'approved' ? txHash.trim() : null, p_rejection_reason: action === 'rejected' ? rejectReason.trim() : null });
      if (error) throw error;
      setSelected(null); setTxHash(''); setRejectReason(''); await loadData();
      Alert.alert(action === 'approved' ? 'Withdrawal approved' : 'Withdrawal rejected', 'Balance, withdrawal status, token ledger and audit log were updated atomically.');
    } catch (e: any) { Alert.alert('Withdrawal failed', e?.message || 'Protected withdrawal RPC failed.'); }
    finally { setBusy(false); }
  };

  const adjustBalance = async () => {
    if (!selectedPlayer) return;
    const amount = num(adjustAmount);
    if (!amount || !adjustReason.trim()) return Alert.alert('Required', 'Enter a non-zero amount and a reason.');
    setBusy(true);
    try {
      const { error } = await supabase.rpc('admin_adjust_balance', { p_telegram_id: selectedPlayer.telegram_id, p_amount: amount, p_reason: adjustReason.trim() });
      if (error) throw error;
      setSelectedPlayer(null); setAdjustAmount(''); setAdjustReason(''); await loadData();
    } catch (e: any) { Alert.alert('Adjustment failed', e?.message || 'Protected balance RPC failed.'); }
    finally { setBusy(false); }
  };

  const filteredPlayers = useMemo(() => { const q = search.trim().toLowerCase(); return q ? players.filter(p => p.telegram_id.toLowerCase().includes(q) || p.username.toLowerCase().includes(q) || p.wallet_address.toLowerCase().includes(q)) : players; }, [players, search]);
  const pending = withdrawals.filter(w => w.status === 'pending');
  const totals = useMemo(() => ({ users: players.length, total: players.reduce((s,p)=>s+num(p.total_tokens),0), pending: players.reduce((s,p)=>s+num(p.pending_tokens),0), withdrawn: players.reduce((s,p)=>s+num(p.withdrawn_tokens),0), ads: players.reduce((s,p)=>s+Number(p.ads_watched||0),0), games: players.reduce((s,p)=>s+Number(p.games_played||0),0) }), [players]);

  if (!ready) return <Center><ActivityIndicator color={Colors.primary} /></Center>;
  if (!isAdmin) return <Login email={email} password={password} setEmail={setEmail} setPassword={setPassword} login={login} busy={busy} back={()=>router.back()} />;
  return <View style={[styles.container,{paddingTop:insets.top}]}>
    <View style={styles.header}><Pressable onPress={()=>router.back()}><MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary}/></Pressable><View style={{flex:1,marginLeft:12}}><Text style={styles.headerTitle}>MintGrow Command Center</Text><Text style={styles.sub}>Protected Supabase admin session</Text></View><Pressable onPress={loadData} style={styles.icon}><MaterialIcons name="refresh" size={20} color={Colors.primary}/></Pressable><Pressable onPress={logout} style={styles.icon}><MaterialIcons name="logout" size={20} color={Colors.textSecondary}/></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nav} contentContainerStyle={styles.navContent}>{(['overview','users','withdrawals','ledger','audit'] as Tab[]).map(t=><Pressable key={t} onPress={()=>setTab(t)} style={[styles.navItem,tab===t&&styles.navActive]}><MaterialIcons name={tabIcon(t)} size={18} color={tab===t?Colors.primary:Colors.textMuted}/><Text style={[styles.navText,tab===t&&styles.navTextActive]}>{t[0].toUpperCase()+t.slice(1)}</Text>{t==='withdrawals'&&pending.length>0?<Text style={styles.badge}>{pending.length}</Text>:null}</Pressable>)}</ScrollView>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{tab==='overview'&&<Overview totals={totals} pending={pending.length} counts={counts}/>} {tab==='users'&&<Users players={filteredPlayers} search={search} setSearch={setSearch} onAdjust={setSelectedPlayer}/>} {tab==='withdrawals'&&<Withdrawals rows={withdrawals} onOpen={setSelected}/>} {tab==='ledger'&&<Ledger rows={ledger}/>} {tab==='audit'&&<Audit rows={audit}/>}</ScrollView>
    {busy?<View style={styles.busy}><ActivityIndicator color={Colors.primary}/></View>:null}
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={()=>setSelected(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Withdrawal review</Text><Info label="User" value={`@${selected?.username} · ${selected?.telegramId}`}/><Info label="Amount" value={`${selected?.amount.toLocaleString()} MG`}/><Info label="Wallet" value={selected?.walletAddress||''} mono/><Info label="Network" value={selected?.network||TOKEN_NETWORK}/><Info label="Created" value={selected?new Date(selected.createdAt).toLocaleString():''}/>{selected?.status==='pending'?<><Text style={styles.label}>Transaction hash</Text><TextInput value={txHash} onChangeText={setTxHash} placeholder="0x..." placeholderTextColor={Colors.textMuted} autoCapitalize="none" style={styles.input}/><Pressable style={styles.primary} onPress={()=>processWithdrawal('approved')}><MaterialIcons name="check-circle" size={18} color="#fff"/><Text style={styles.primaryText}>Approve withdrawal</Text></Pressable><Text style={styles.label}>Rejection reason</Text><TextInput value={rejectReason} onChangeText={setRejectReason} placeholder="Reason for rejection" placeholderTextColor={Colors.textMuted} style={[styles.input,{minHeight:70}]} multiline/><Pressable style={styles.danger} onPress={()=>processWithdrawal('rejected')}><MaterialIcons name="cancel" size={18} color="#fff"/><Text style={styles.primaryText}>Reject and refund</Text></Pressable></>:<Info label="Status" value={selected?.status||''}/>}<Pressable onPress={()=>setSelected(null)} style={styles.secondary}><Text style={styles.secondaryText}>Close</Text></Pressable></View></View></Modal>
    <Modal visible={!!selectedPlayer} transparent animationType="slide" onRequestClose={()=>setSelectedPlayer(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Adjust player balance</Text><Info label="Player" value={`@${selectedPlayer?.username}`}/><Info label="Current" value={`${num(selectedPlayer?.total_tokens).toLocaleString()} MG`}/><Text style={styles.label}>Amount (+ credit / - debit)</Text><TextInput value={adjustAmount} onChangeText={setAdjustAmount} keyboardType="decimal-pad" placeholder="500" placeholderTextColor={Colors.textMuted} style={styles.input}/><Text style={styles.label}>Reason</Text><TextInput value={adjustReason} onChangeText={setAdjustReason} placeholder="Support correction" placeholderTextColor={Colors.textMuted} style={[styles.input,{minHeight:70}]} multiline/><Pressable style={styles.primary} onPress={adjustBalance}><MaterialIcons name="edit" size={18} color="#fff"/><Text style={styles.primaryText}>Apply protected adjustment</Text></Pressable><Pressable onPress={()=>setSelectedPlayer(null)} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View></View></Modal>
  </View>;
}
function Login({email,password,setEmail,setPassword,login,busy,back}:any){return <Center><View style={styles.login}><MaterialIcons name="admin-panel-settings" size={48} color={Colors.primary}/><Text style={styles.title}>MintGrow Admin</Text><Text style={styles.sub}>Sign in with the Supabase Auth account registered in admin_users.</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Admin email" placeholderTextColor={Colors.textMuted} style={styles.input}/><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor={Colors.textMuted} style={styles.input}/><Pressable style={styles.primary} onPress={login} disabled={busy}>{busy?<ActivityIndicator color="#fff"/>:<><MaterialIcons name="login" size={18} color="#fff"/><Text style={styles.primaryText}>Sign in</Text></>}</Pressable><Pressable onPress={back} style={styles.secondary}><Text style={styles.secondaryText}>Back to app</Text></Pressable></View></Center>}
function Center({children}:{children:React.ReactNode}){return <View style={styles.center}>{children}</View>}
function tabIcon(t:Tab):any{return ({overview:'dashboard',users:'people',withdrawals:'account-balance-wallet',ledger:'receipt-long',audit:'history'} as any)[t]}
function Info({label,value,mono}:{label:string;value:string;mono?:boolean}){return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue,mono&&styles.mono]} numberOfLines={3}>{value}</Text></View>}
function Card({children}:{children:React.ReactNode}){return <View style={styles.card}>{children}</View>}
function Overview({totals,pending,counts}:any){return <><Text style={styles.pageTitle}>Platform overview</Text><View style={styles.grid}>{[['Users',totals.users],['Total MG',Math.round(totals.total).toLocaleString()],['Pending MG',Math.round(totals.pending).toLocaleString()],['Withdrawn MG',Math.round(totals.withdrawn).toLocaleString()],['Ads',totals.ads],['Games',totals.games],['Ad events',counts.ads],['Game sessions',counts.games],['Referrals',counts.referrals],['Pending requests',pending]].map(([a,b])=><View key={String(a)} style={styles.statCard}><Text style={styles.statLabel}>{a}</Text><Text style={styles.stat}>{String(b)}</Text></View>)}</View><Card><Text style={styles.cardTitle}>Protected operations</Text><Text style={styles.sub}>Withdrawals and balance adjustments use security-definer RPCs that verify admin_users membership and write the audit trail and token ledger.</Text></Card></>}
function Users({players,search,setSearch,onAdjust}:any){return <><Text style={styles.pageTitle}>Players</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search username, Telegram ID or wallet" placeholderTextColor={Colors.textMuted} style={styles.input}/>{players.map((p:Player)=><Pressable key={p.telegram_id} style={styles.row} onPress={()=>onAdjust(p)}><View style={{flex:1}}><Text style={styles.rowTitle}>@{p.username}</Text><Text style={styles.sub}>{p.telegram_id} · Level {p.level} · {p.games_played} games</Text><Text style={styles.sub}>{p.wallet_address||'Wallet not set'}</Text></View><View style={{alignItems:'flex-end'}}><Text style={styles.amount}>{num(p.total_tokens).toLocaleString()} MG</Text><Text style={styles.sub}>Pending {num(p.pending_tokens).toLocaleString()}</Text></View></Pressable>)}</>}
function Withdrawals({rows,onOpen}:any){return <><Text style={styles.pageTitle}>Withdrawals</Text>{rows.length===0?<Card><Text style={styles.sub}>No withdrawal requests.</Text></Card>:rows.map((w:WithdrawalRequest)=><Pressable key={w.id} style={styles.row} onPress={()=>onOpen(w)}><View style={{flex:1}}><Text style={styles.rowTitle}>@{w.username}</Text><Text style={styles.sub}>{w.telegramId} · {new Date(w.createdAt).toLocaleString()}</Text><Text style={styles.sub} numberOfLines={1}>{w.walletAddress}</Text></View><View style={{alignItems:'flex-end'}}><Text style={styles.amount}>{w.amount.toLocaleString()} MG</Text><Text style={[styles.status,{color:w.status==='approved'?Colors.success:w.status==='rejected'?Colors.error:Colors.warning}]}>{w.status.toUpperCase()}</Text></View></Pressable>)}</>}
function Ledger({rows}:{rows:LogRow[]}){return <><Text style={styles.pageTitle}>Token ledger</Text>{rows.length===0?<Card><Text style={styles.sub}>No ledger entries.</Text></Card>:rows.map(r=><Card key={r.id}><Text style={styles.rowTitle}>{r.reason}</Text><Text style={styles.sub}>{r.telegram_id} · {new Date(r.created_at).toLocaleString()}</Text><Text style={styles.amount}>{num(r.amount).toLocaleString()} MG</Text><Text style={styles.sub}>{r.balance_before??'-'} → {r.balance_after??'-'} · {r.reference_type??'system'}</Text></Card>)}</>}
function Audit({rows}:{rows:LogRow[]}){return <><Text style={styles.pageTitle}>Admin audit log</Text>{rows.length===0?<Card><Text style={styles.sub}>No audit entries.</Text></Card>:rows.map(r=><Card key={r.id}><Text style={styles.rowTitle}>{r.action}</Text><Text style={styles.sub}>{r.target_type}:{r.target_id} · {new Date(r.created_at).toLocaleString()}</Text>{r.reason?<Text style={styles.sub}>{r.reason}</Text>:null}</Card>)}</>}

const styles=StyleSheet.create({container:{flex:1,backgroundColor:Colors.background},center:{flex:1,backgroundColor:Colors.background,justifyContent:'center',alignItems:'center',padding:Spacing.lg},login:{width:'100%',maxWidth:430,backgroundColor:Colors.surface,borderRadius:Radius.lg,padding:Spacing.xl,borderWidth:1,borderColor:Colors.border},title:{color:Colors.textPrimary,fontSize:26,fontWeight:'800',marginTop:12,marginBottom:8},header:{minHeight:68,flexDirection:'row',alignItems:'center',paddingHorizontal:Spacing.md,borderBottomWidth:1,borderBottomColor:Colors.border},headerTitle:{color:Colors.textPrimary,fontSize:18,fontWeight:'700'},sub:{color:Colors.textMuted,fontSize:12,lineHeight:18},icon:{padding:8},nav:{maxHeight:58,borderBottomWidth:1,borderBottomColor:Colors.border},navContent:{paddingHorizontal:8,gap:6,alignItems:'center'},navItem:{minWidth:82,paddingHorizontal:10,height:46,borderRadius:12,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:5},navActive:{backgroundColor:Colors.surface},navText:{color:Colors.textMuted,fontSize:12,fontWeight:'600'},navTextActive:{color:Colors.primary},badge:{backgroundColor:Colors.warning,color:'#111',fontSize:10,fontWeight:'800',paddingHorizontal:5,paddingVertical:2,borderRadius:8},content:{padding:Spacing.md,paddingBottom:50},pageTitle:{color:Colors.textPrimary,fontSize:22,fontWeight:'800',marginBottom:8},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},statCard:{width:'48%',minHeight:78,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,padding:14},statLabel:{color:Colors.textMuted,fontSize:11},stat:{color:Colors.textPrimary,fontSize:22,fontWeight:'800',marginTop:4},card:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,padding:14,marginBottom:8},cardTitle:{color:Colors.textPrimary,fontSize:15,fontWeight:'700',marginBottom:5},row:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,padding:14,marginBottom:8,flexDirection:'row',gap:10},rowTitle:{color:Colors.textPrimary,fontSize:14,fontWeight:'700'},amount:{color:Colors.primary,fontSize:14,fontWeight:'800'},status:{fontSize:10,fontWeight:'800',marginTop:5},input:{backgroundColor:Colors.background,borderWidth:1,borderColor:Colors.border,borderRadius:12,color:Colors.textPrimary,paddingHorizontal:13,paddingVertical:12,marginTop:7,marginBottom:10},label:{color:Colors.textMuted,fontSize:11,marginTop:8},primary:{minHeight:46,borderRadius:12,backgroundColor:Colors.primary,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,marginTop:10,paddingHorizontal:14},primaryText:{color:'#fff',fontWeight:'800'},danger:{minHeight:46,borderRadius:12,backgroundColor:Colors.error,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,marginTop:10,paddingHorizontal:14},secondary:{minHeight:42,borderRadius:12,borderWidth:1,borderColor:Colors.border,alignItems:'center',justifyContent:'center',marginTop:10},secondaryText:{color:Colors.textPrimary,fontWeight:'700'},busy:{position:'absolute',right:14,top:80},overlay:{flex:1,backgroundColor:'rgba(0,0,0,.65)',justifyContent:'flex-end'},modal:{backgroundColor:Colors.surface,borderTopLeftRadius:22,borderTopRightRadius:22,padding:Spacing.lg,maxHeight:'92%'},modalTitle:{color:Colors.textPrimary,fontSize:20,fontWeight:'800',marginBottom:12},info:{paddingVertical:7,borderBottomWidth:1,borderBottomColor:Colors.border},infoLabel:{color:Colors.textMuted,fontSize:10,textTransform:'uppercase'},infoValue:{color:Colors.textPrimary,fontSize:13,marginTop:3},mono:{fontFamily:'monospace'} });
