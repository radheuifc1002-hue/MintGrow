import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import { LEVEL_REWARDS } from '@/types/game';

export function LevelUpModal() {
  const { levelUpReward, level, dismissLevelUp } = useGame();
  const visible = levelUpReward !== null;

  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  const reward = LEVEL_REWARDS.find(r => r.level === level);

  return (
    <Animated.View style={[styles.overlay, { opacity: opacAnim }]}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.levelBadge}>LEVEL {level}</Text>
        <Text style={styles.title}>{reward?.title ?? 'Legend'}</Text>
        <Text style={styles.subtitle}>{reward?.unlocks}</Text>

        <View style={styles.rewardBox}>
          <Text style={styles.rewardEmoji}>🌿</Text>
          <Text style={styles.rewardAmt}>+{levelUpReward} MG</Text>
          <Text style={styles.rewardLbl}>Airdrop Reward</Text>
        </View>

        <Pressable style={styles.btn} onPress={dismissLevelUp}>
          <Text style={styles.btnText}>Continue Playing!</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,30,15,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 99,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '85%',
    maxWidth: 320,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  emoji: { fontSize: 48, marginBottom: Spacing.sm },
  levelBadge: {
    backgroundColor: Colors.primary,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 3,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  subtitle: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.md },
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
  rewardEmoji: { fontSize: 28 },
  rewardAmt: { fontSize: 32, fontWeight: '900', color: Colors.primary },
  rewardLbl: { ...Typography.caption, color: Colors.textMuted },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { ...Typography.bodyBold, color: '#fff' },
});
