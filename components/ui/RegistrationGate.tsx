import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import { recordAdEvent, showRewardedAd } from '@/services/monetag';
import { supabase } from '@/services/supabase';
import { AdLoadingOverlay } from './AdLoadingOverlay';

export function RegistrationGate() {
  const { profile, refreshProfile, setProfile } = useGame();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Admin routes have their own authentication/authorization flow. The player
  // registration ad must never cover the admin panel, even if the current
  // Telegram player has not completed registration.
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin-panel');

  useEffect(() => {
    if (isAdminRoute) {
      setVisible(false);
      return;
    }

    if (profile && profile.isRegistered !== true) {
      setUsername(profile.username || '');
      setVisible(true);
    } else if (profile?.isRegistered === true) {
      setVisible(false);
    }
  }, [profile, isAdminRoute]);

  const handleWatchAd = async () => {
    if (loading || !profile) return;
    const cleanUsername = username.trim().replace(/^@+/, '');
    if (cleanUsername.length < 3) {
      setError('Please enter a username with at least 3 characters.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await showRewardedAd('rewarded');
      await recordAdEvent('registration', result, result.watched ? 100 : 0, profile.telegramId);

      if (!result.watched) {
        setError(result.error || 'The ad was not completed. Please try again.');
        return;
      }

      const { data, error: saveError } = await supabase
        .from('players')
        .update({
          username: cleanUsername,
          is_registered: true,
          total_tokens: Math.max(profile.totalTokens, 100),
          ads_watched: (profile.adsWatched || 0) + 1,
        })
        .eq('telegram_id', profile.telegramId)
        .select('*')
        .single();

      if (saveError || !data) {
        console.error('Registration Supabase update failed:', saveError?.message);
        throw new Error(saveError?.message || 'Your profile could not be saved. Please try again.');
      }

      const updatedProfile = {
        ...profile,
        username: cleanUsername,
        isRegistered: true,
        totalTokens: Number(data.total_tokens ?? Math.max(profile.totalTokens, 100)),
        adsWatched: Number(data.ads_watched ?? ((profile.adsWatched || 0) + 1)),
      };

      setProfile(updatedProfile);
      setDone(true);
      setTimeout(() => {
        setVisible(false);
        refreshProfile();
      }, 1200);
    } catch (e) {
      console.error('Registration failed:', e);
      setError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isAdminRoute || !visible) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
            <Text style={styles.title}>Welcome to MintGrow!</Text>
            <Text style={styles.subtitle}>
              Watch a short ad to activate your account and get started with your 100 MG welcome bonus.
            </Text>

            <View style={styles.usernameBox}>
              <Text style={styles.usernameLabel}>Choose your MintGrow username</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={(text) => { setUsername(text); setError(null); }}
                placeholder="Telegram username or player name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={32}
              />
              <Text style={styles.usernameHint}>
                This is linked to your Telegram user ID and shown on the leaderboard.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.benefitsList}>
              {[
                { icon: 'games', text: 'Play the crypto merge game' },
                { icon: 'monetization-on', text: 'Earn MG tokens on BNB Chain' },
                { icon: 'card-giftcard', text: '+100 MG welcome bonus' },
                { icon: 'group-add', text: 'Invite friends & earn referral income' },
              ].map((item, i) => (
                <View key={i} style={styles.benefitItem}>
                  <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
                  <Text style={styles.benefitText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {done ? (
              <View style={styles.successBanner}>
                <MaterialIcons name="check-circle" size={24} color={Colors.success} />
                <Text style={styles.successText}>Account activated!</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.watchBtn, loading && styles.watchBtnDisabled]}
                onPress={handleWatchAd}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="live-tv" size={20} color="#fff" />
                    <Text style={styles.watchBtnText}>Watch Ad to Activate</Text>
                  </>
                )}
              </Pressable>
            )}

            <Text style={styles.note}>One-time activation · No payment required · BNB Chain ecosystem</Text>
          </View>
        </View>
      </Modal>
      <AdLoadingOverlay visible={loading} message="Activating your account..." />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', width: '100%', maxWidth: 360, borderWidth: 2, borderColor: Colors.primary, gap: Spacing.md },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 4 },
  usernameBox: { width: '100%', gap: 6 },
  usernameLabel: { ...Typography.smallBold, color: Colors.textPrimary },
  usernameInput: { backgroundColor: Colors.bgSurface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.textPrimary, fontSize: 15, width: '100%' },
  usernameHint: { ...Typography.caption, color: Colors.textMuted, lineHeight: 16 },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  benefitsList: { width: '100%', gap: Spacing.sm, backgroundColor: Colors.bgSurface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  watchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: Spacing.xl, width: '100%', gap: 8, shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  watchBtnDisabled: { opacity: 0.6 },
  watchBtnText: { ...Typography.bodyBold, color: '#fff', fontSize: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(211,47,47,0.10)', borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.error, width: '100%' },
  errorText: { ...Typography.small, color: Colors.error, flex: 1 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(46,160,67,0.12)', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.success, width: '100%' },
  successText: { ...Typography.smallBold, color: Colors.success, flex: 1 },
  note: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
