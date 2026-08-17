import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';

export function GameOverModal() {
  const { isGameOver, isWon, score, sessionTokens, newGame, continueGame, continueFromSaved, canContinue } = useGame();
  const visible = isGameOver || isWon;

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: opacAnim }]}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.emoji}>{isWon ? '🏆' : '💀'}</Text>
        <Text style={[styles.title, isWon && styles.winTitle]}>
          {isWon ? 'YOU HIT 1 BILLION!' : 'GAME OVER'}
        </Text>
        <Text style={styles.subtitle}>
          {isWon ? 'MintGrow Billionaire! Keep going?' : 'Tap below to continue or start fresh'}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Score</Text>
            <Text style={styles.statValue}>{score.toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tokens Earned</Text>
            <Text style={[styles.statValue, styles.tokenValue]}>+{sessionTokens.toFixed(2)} MG</Text>
          </View>
        </View>

        {isWon && (
          <Pressable style={[styles.btn, styles.continueBtn]} onPress={continueGame}>
            <Text style={styles.btnTextDark}>Continue →</Text>
          </Pressable>
        )}

        {!isWon && canContinue && (
          <Pressable style={[styles.btn, styles.resumeBtn]} onPress={continueFromSaved}>
            <Text style={styles.btnTextDark}>▶️ Resume (Watch Ad)</Text>
          </Pressable>
        )}

        <Pressable style={[styles.btn, styles.newGameBtn]} onPress={newGame}>
          <Text style={styles.btnTextLight}>New Game</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,251,247,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '90%',
    maxWidth: 340,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  emoji: { fontSize: 52, marginBottom: Spacing.sm },
  title: { ...Typography.h1, color: Colors.error, letterSpacing: 2, marginBottom: 4, textAlign: 'center' },
  winTitle: { color: Colors.primary },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.sm },
  statLabel: { ...Typography.caption, color: Colors.textMuted, textTransform: 'uppercase' },
  statValue: { ...Typography.h3, color: Colors.textPrimary, marginTop: 2 },
  tokenValue: { color: Colors.primary },
  btn: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  continueBtn: { backgroundColor: Colors.accent },
  resumeBtn: { backgroundColor: Colors.primary },
  newGameBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border },
  btnTextDark: { ...Typography.bodyBold, color: '#fff' },
  btnTextLight: { ...Typography.bodyBold, color: Colors.textSecondary },
});
