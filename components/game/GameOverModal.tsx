import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';

export function GameOverModal() {
  const { isGameOver, isWon, score, sessionTokens, newGame, continueGame } = useGame();
  const visible = isGameOver || isWon;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{isWon ? '🏆' : '💀'}</Text>
          <Text style={[styles.title, isWon && styles.winTitle]}>
            {isWon ? 'YOU HIT 2048!' : 'GAME OVER'}
          </Text>
          <Text style={styles.subtitle}>
            {isWon ? 'MintGrow master! Keep going?' : 'Better luck next time'}
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
              <Text style={styles.btnText}>Continue →</Text>
            </Pressable>
          )}
          <Pressable style={[styles.btn, isWon && styles.secondaryBtn]} onPress={newGame}>
            <Text style={[styles.btnText, isWon && styles.secondaryBtnText]}>New Game</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
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
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emoji: { fontSize: 52, marginBottom: Spacing.sm },
  title: { ...Typography.h1, color: Colors.error, letterSpacing: 2, marginBottom: 4 },
  winTitle: { color: Colors.accent },
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
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  continueBtn: { backgroundColor: Colors.accent, marginBottom: Spacing.sm },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  btnText: { ...Typography.bodyBold, color: Colors.bg },
  secondaryBtnText: { color: Colors.textSecondary },
});
