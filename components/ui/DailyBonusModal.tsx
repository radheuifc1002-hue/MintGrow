import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  tokens: number;
  streak: number;
  onClaim: () => void;
}

export function DailyBonusModal({ visible, tokens, streak, onClaim }: Props) {
  const coinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  const streakDays = [50, 100, 150, 200, 250, 350, 500];

  useEffect(() => {
    if (visible) {
      coinAnim.setValue(0);
      scaleAnim.setValue(0.5);
      opacAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(300),
          Animated.spring(coinAnim, { toValue: -80, friction: 4, tension: 100, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* Animated coin drop */}
          <Animated.Text style={[styles.coinEmoji, { transform: [{ translateY: coinAnim }] }]}>
            🌿
          </Animated.Text>

          <Text style={styles.title}>Daily Bonus!</Text>
          <Text style={styles.subtitle}>Day {streak} streak</Text>

          <View style={styles.streakRow}>
            {streakDays.map((d, i) => (
              <View key={i} style={[styles.streakDot, i < streak && styles.streakDotActive, i === streak - 1 && styles.streakDotCurrent]}>
                <Text style={[styles.streakDotText, i < streak && styles.streakDotTextActive]}>
                  {i + 1}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.rewardBox}>
            <Text style={styles.rewardEmoji}>💰</Text>
            <Text style={styles.rewardAmount}>+{tokens} MG</Text>
            <Text style={styles.rewardLabel}>MintGrow Tokens</Text>
          </View>

          {streak >= 7 && (
            <Text style={styles.maxStreak}>🔥 MAX STREAK BONUS!</Text>
          )}

          <Pressable style={styles.claimBtn} onPress={onClaim}>
            <Text style={styles.claimBtnText}>Claim & Play!</Text>
          </Pressable>

          <Text style={styles.note}>Come back tomorrow to keep your streak</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,20,10,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '90%',
    maxWidth: 340,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'visible',
  },
  coinEmoji: { fontSize: 52, marginBottom: Spacing.sm },
  title: { ...Typography.h1, color: Colors.primary, marginBottom: 4, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.md, textAlign: 'center' },

  streakRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  streakDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgSurface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDotActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  streakDotCurrent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
    transform: [{ scale: 1.15 }],
  },
  streakDotText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700' },
  streakDotTextActive: { color: Colors.primary },

  rewardBox: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  rewardEmoji: { fontSize: 32, marginBottom: 4 },
  rewardAmount: { fontSize: 36, fontWeight: '900', color: Colors.primary },
  rewardLabel: { ...Typography.small, color: Colors.textMuted },

  maxStreak: { ...Typography.bodyBold, color: Colors.warning, marginBottom: Spacing.sm },

  claimBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  claimBtnText: { ...Typography.bodyBold, color: '#fff', letterSpacing: 0.5 },

  note: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
});
