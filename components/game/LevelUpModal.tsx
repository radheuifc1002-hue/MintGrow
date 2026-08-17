import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import { LEVEL_REWARDS } from '@/types/game';

export function LevelUpModal() {
  const { levelUpReward, level, dismissLevelUp } = useGame();
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (levelUpReward !== null) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);
    }
  }, [levelUpReward]);

  if (levelUpReward === null) return null;

  const reward = LEVEL_REWARDS.find(r => r.level === level);

  return (
    <Modal transparent animationType="none" visible={levelUpReward !== null}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.title}>LEVEL UP!</Text>
          <Text style={styles.levelText}>Level {level} — {reward?.title}</Text>
          <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>REWARD</Text>
            <Text style={styles.rewardAmount}>+{levelUpReward} MG</Text>
          </View>
          <Text style={styles.unlockText}>🔓 Unlocked: {reward?.unlocks}</Text>
          <Pressable style={styles.btn} onPress={dismissLevelUp}>
            <Text style={styles.btnText}>Continue Playing</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
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
    borderWidth: 2,
    borderColor: Colors.primary,
    width: '90%',
    maxWidth: 340,
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  emoji: { fontSize: 48, marginBottom: Spacing.sm },
  title: { ...Typography.h1, color: Colors.primary, letterSpacing: 3, marginBottom: 4 },
  levelText: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.md },
  rewardBox: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  rewardLabel: { ...Typography.caption, color: Colors.primary, textTransform: 'uppercase' },
  rewardAmount: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  unlockText: { ...Typography.small, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.xl,
  },
  btnText: { ...Typography.bodyBold, color: Colors.bg },
});
