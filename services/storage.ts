import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile, WithdrawalRequest, PowerUpType, DEFAULT_POWER_UPS, ReferralEntry } from '@/types/game';
import { verifiedApi } from '@/services/verifiedApi';

const KEYS = { PROFILE:'mintgrow_profile_v3', DAILY_BONUS:'mintgrow_daily_bonus', SAVED_BOARD:'mintgrow_saved_board' };

export const generateReferralCode = (telegramId: string): string => {
  const base = telegramId.replace(/\D/g,'').slice(-4) || '0000';
  return `MG${base}${Math.random().toString(36).slice(2,5).toUpperCase()}`;
};

export const createDefaultProfile = (telegramId:string, username:string):PlayerProfile => ({
  telegramId, username, referralCode: generateReferralCode(telegramId), referredBy:undefined,
  referralCount:0, referralTokensEarned:0, totalTokens:0, pendingTokens:0, withdrawnTokens:0,
  walletAddress:'', level:1, gamesPlayed:0, bestScore:0, adsWatched:0, lastLoginDate:undefined,
  loginStreak:0, powerUps:{...DEFAULT_POWER_UPS}, isRegistered:false,
});

const mapRowToProfile = (row:any):PlayerProfile => ({
  telegramId:String(row.telegram_id), username:String(row.username ?? 'CryptoPlayer'), referralCode:String(row.referral_code ?? ''),
  referredBy:row.referred_by ?? undefined, referralCount:Number(row.direct_referral_count ?? 0),
  referralTokensEarned:Number(row.referral_tokens_earned ?? 0), totalTokens:Number(row.total_tokens ?? 0),
  pendingTokens:Number(row.pending_tokens ?? 0), withdrawnTokens:Number(row.withdrawn_tokens ?? 0),
  walletAddress:String(row.wallet_address ?? ''), level:Number(row.level ?? 1), gamesPlayed:Number(row.games_played ?? 0),
  bestScore:Number(row.best_score ?? 0), adsWatched:Number(row.ads_watched ?? 0), lastLoginDate:row.last_login_date ?? undefined,
  loginStreak:Number(row.login_streak ?? 0), powerUps:row.power_ups ?? {...DEFAULT_POWER_UPS}, isRegistered:Boolean(row.is_registered),
});

const cacheProfile = async (p:PlayerProfile) => AsyncStorage.setItem(KEYS.PROFILE,JSON.stringify(p));

export const getProfile = async ():Promise<PlayerProfile|null> => {
  try { const raw=await AsyncStorage.getItem(KEYS.PROFILE); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

export const syncProfileFromSupabase = async (telegramId:string):Promise<PlayerProfile|null> => {
  try {
    const row=await verifiedApi<any>('get_player',{telegramId});
    if(!row) return null;
    const p=mapRowToProfile(row); await cacheProfile(p); return p;
  } catch { return null; }
};

export const saveProfile = async (profile:PlayerProfile):Promise<void> => {
  await cacheProfile(profile);
  try {
    const row=await verifiedApi<any>('update_profile_metadata',{
      telegramId:profile.telegramId, username:profile.username, avatarUrl:(profile as any).avatarUrl ?? null,
      walletAddress:profile.walletAddress, bestScore:profile.bestScore, level:profile.level,
      lastLoginDate:profile.lastLoginDate ?? null, loginStreak:profile.loginStreak,
      powerUps:profile.powerUps,
    });
    if(row) await cacheProfile(mapRowToProfile(row));
  } catch { /* local cache remains usable while offline; financial mutations never rely on it */ }
};

export const initOrLoadProfile = async (telegramId:string, username:string, avatarUrl?:string):Promise<PlayerProfile> => {
  try {
    const existing=await verifiedApi<any>('get_player',{telegramId});
    if(existing) { const p=mapRowToProfile(existing); await cacheProfile(p); return p; }
    const created=await verifiedApi<any>('ensure_player',{telegramId,username,avatarUrl});
    if(!created) throw new Error('Unable to create player');
    const p=mapRowToProfile(created); await cacheProfile(p); return p;
  } catch {
    const cached=await getProfile();
    if(cached && cached.telegramId===telegramId) return cached;
    throw new Error('MintGrow must be opened inside Telegram.');
  }
};

export const updateProfileTokens = async (tokens:number, score:number):Promise<PlayerProfile|null> => {
  if(tokens<=0) return getProfile();
  const p=await getProfile(); if(!p) return null;
  try {
    await verifiedApi('credit_player_tokens',{telegramId:p.telegramId,amount:tokens,bestScore:score,level:(await import('@/services/gameEngine')).getLevelFromScore(score)});
    return syncProfileFromSupabase(p.telegramId);
  } catch { return null; }
};

export const incrementAdsWatched = async ():Promise<void> => { /* Ad rewards are recorded by record_ad_event with an idempotency key. */ };

export const addPowerUp = async (type:PowerUpType):Promise<PlayerProfile|null> => {
  const p=await getProfile(); if(!p) return null;
  p.powerUps={...DEFAULT_POWER_UPS,...p.powerUps,[type]:(p.powerUps?.[type] ?? 0)+1};
  await saveProfile(p); return p;
};

export const usePowerUp = async (type:PowerUpType):Promise<PlayerProfile|null> => {
  const p=await getProfile(); if(!p || (p.powerUps?.[type] ?? 0)<=0) return null;
  p.powerUps={...DEFAULT_POWER_UPS,...p.powerUps,[type]:Math.max(0,(p.powerUps?.[type] ?? 0)-1)};
  await saveProfile(p); return p;
};

export const spendTokensForPowerUp = async (type:PowerUpType,cost:number):Promise<PlayerProfile|null> => {
  const p=await getProfile(); if(!p) return null;
  try {
    const row=await verifiedApi<any>('spend_tokens_for_powerup',{telegramId:p.telegramId,type,cost});
    return row ? mapRowToProfile(row) : null;
  } catch { return null; }
};

export interface DailyBonusState { lastClaimDate:string|null; streak:number; }
export const getDailyBonusState = async ():Promise<DailyBonusState> => {
  try { const raw=await AsyncStorage.getItem(KEYS.DAILY_BONUS); return raw?JSON.parse(raw):{lastClaimDate:null,streak:0}; } catch { return {lastClaimDate:null,streak:0}; }
};
export const claimDailyBonus = async ():Promise<{tokens:number;streak:number}|null> => {
  try {
    const p=await getProfile(); if(!p) return null;
    const result=await verifiedApi<any>('claim_daily_bonus',{telegramId:p.telegramId});
    if(!result?.ok) return null;
    await AsyncStorage.setItem(KEYS.DAILY_BONUS,JSON.stringify({lastClaimDate:new Date().toISOString().slice(0,10),streak:result.streak}));
    await syncProfileFromSupabase(p.telegramId); return {tokens:Number(result.tokens),streak:Number(result.streak)};
  } catch { return null; }
};

export const getSavedBoard=async():Promise<any|null>=>{try{const raw=await AsyncStorage.getItem(KEYS.SAVED_BOARD);return raw?JSON.parse(raw):null;}catch{return null;}};
export const saveBoardState=async(state:any):Promise<void=>{try{await AsyncStorage.setItem(KEYS.SAVED_BOARD,JSON.stringify(state));}catch{}};
export const clearSavedBoard=async():Promise<void=>{try{await AsyncStorage.removeItem(KEYS.SAVED_BOARD);}catch{}};

const mapWithdrawal=(r:any):WithdrawalRequest=>({id:String(r.id),telegramId:String(r.telegram_id),username:String(r.username),amount:Number(r.amount??0),walletAddress:String(r.wallet_address??''),network:String(r.network??''),status:r.status,createdAt:String(r.created_at),processedAt:r.processed_at?String(r.processed_at):undefined,txHash:r.tx_hash?String(r.tx_hash):undefined});

export const getWithdrawals=async(telegramId?:string):Promise<WithdrawalRequest[]>=>{try{const id=telegramId??(await getProfile())?.telegramId;if(!id)return[];const rows=await verifiedApi<any[]>('get_withdrawals',{telegramId:id});return(rows??[]).map(mapWithdrawal);}catch{return[];}};

export const saveWithdrawal=async(req:WithdrawalRequest):Promise<void=>{
  await verifiedApi('submit_withdrawal_request',{telegramId:req.telegramId,id:req.id,username:req.username,amount:req.amount,walletAddress:req.walletAddress,network:req.network});
};

export const updateWithdrawal=async(id:string,updates:Partial<WithdrawalRequest>):Promise<void=>{
  throw new Error('Client withdrawal status updates are not permitted. Admin processing is server-side only.');
};

export const getReferrals=async(referrerTelegramId?:string):Promise<ReferralEntry[]>=>{
  const id=referrerTelegramId??(await getProfile())?.telegramId;if(!id)return[];
  try { const rows=await verifiedApi<any[]>('get_referrals',{telegramId:id}); return(rows??[]).map((r:any)=>({code:id,username:r.players?.username??'Unknown',joinedAt:String(r.created_at),tokensEarned:Number(r.tokens_earned??0),level:Number(r.level??1),refereeBalance:Number(r.players?.total_tokens??0)})); } catch{return[];}
};
export const addReferral=async(_entry:ReferralEntry):Promise<void=>{};
export const applyReferralCode=async(code:string):Promise<boolean=>{
  const p=await getProfile();if(!p||p.referredBy)return false;
  try{const result=await verifiedApi<any>('apply_referral_code',{telegramId:p.telegramId,code:code.trim().toUpperCase()});if(result?.ok)await syncProfileFromSupabase(p.telegramId);return Boolean(result?.ok);}catch{return false;}
};

export interface LeaderboardEntry {rank:number;telegramId:string;username:string;totalTokens:number;level:number;bestScore:number;}
export const getLeaderboard=async(limit=50):Promise<LeaderboardEntry[]>=>{try{const rows=await verifiedApi<any[]>('get_leaderboard',{limit});return(rows??[]).map((r:any,i)=>({rank:i+1,telegramId:r.telegram_id,username:r.username,totalTokens:Number(r.total_tokens??0),level:Number(r.level??1),bestScore:Number(r.best_score??0)}));}catch{return[];}};
export const getPlayerRank=async(telegramId:string):Promise<number|null=>{try{const r=await verifiedApi<number|null>('get_player_rank',{telegramId});return r==null?null:Number(r);}catch{return null;}};

export const subscribeWithdrawalUpdates=(telegramId:string,onUpdate:(withdrawal:WithdrawalRequest)=>void)=>{
  // Realtime remains optional; authoritative reads go through the verified API.
  return ()=>{};
};
