import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import { showRewardedAd } from '@/services/monetag';
import { getProfile, saveProfile } from '@/services/storage';
import { AdLoadingOverlay } from './AdLoadingOverlay';

export function RegistrationGate() {
  const { profile, refreshProfile } = useGame();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Show gate if profile loaded and not yet registered
    if (profile && profile.isRegistered === false) {
      setVisible(true);
    } else if (profile && profile.isRegistered !== false) {
      setVisible(false);
    }
  }, [profile]);

  const handleWatchAd = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await showRewardedAd();
      if (result.watched) {
        // Mark as registered
        const p = await getProfile();
        if (p) {
          p.isRegistered = true;
          // Give welcome bonus
          p.totalTokens = Math.round((p.totalTokens + 100) * 100) / 100;
          await saveProfile(p);
        }
        setDone(true);
        setTimeout(() => {
          setVisible(false);
          refreshProfile();
        }, 1200);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
            />

            <Text style={styles.title}>Welcome to MintGrow!</Text>
            <Text style={styles.subtitle}>
              Watch a short ad to activate your account and get started with 100 MG welcome bonus
            </Text>

            <View style={styles.benefitsList}>
              {[
                { icon: 'games', text: 'Play the crypto merge game' },
                { icon: 'monetization-on', text: 'Earn real MG tokens on BNB Chain' },
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
                <Text style={styles.successText}>Account activated! +100 MG added 🎉</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.watchBtn, loading && styles.watchBtnDisabled]}
                onPress={handleWatchAd}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="live-tv" size={20} color="#fff" />
                    <Text style={styles.watchBtnText}>Watch Ad to Activate (Free)</Text>
                  </>
                )}
              </Pressable>
            )}

            <Text style={styles.note}>
              One-time activation · No payment required · BNB Chain ecosystem
            </Text>
          </View>
        </View>
      </Modal>

      <AdLoadingOverlay visible={loading} message="Activating your account..." />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 2,
    borderColor: Colors.primary,
    gap: Spacing.md,
  },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 4 },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsList: {
    width: '100%',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    ...Typography.small,
    color: Colors.textSecondary,
    flex: 1,
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  watchBtnDisabled: { opacity: 0.6 },
  watchBtnText: {
    ...Typography.bodyBold,
    color: '#fff',
    fontSize: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(46,160,67,0.12)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
    width: '100%',
  },
  successText: {
    ...Typography.smallBold,
    color: Colors.success,
    flex: 1,
  },
  note: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
