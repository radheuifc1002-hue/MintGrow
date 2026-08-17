import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { GameBoard } from '@/components/game/GameBoard';
import { ScoreCard } from '@/components/game/ScoreCard';
import { GameOverModal } from '@/components/game/GameOverModal';
import { LevelUpModal } from '@/components/game/LevelUpModal';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { COIN_TILES } from '@/constants/theme';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { score, bestScore, level, sessionTokens, newGame, profile } = useGame();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>✦ MintGrow</Text>
          <Text style={styles.tagline}>Merge · Earn · Withdraw</Text>
        </View>
        <Pressable style={styles.newGameBtn} onPress={newGame} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="refresh" size={16} color={Colors.primary} />
          <Text style={styles.newGameText}>New</Text>
        </Pressable>
      </View>

      {/* Score Row */}
      <View style={styles.scoreRow}>
        <ScoreCard label="Score" value={score.toLocaleString()} />
        <ScoreCard label="Best" value={bestScore.toLocaleString()} />
        <ScoreCard label="Level" value={`L${level}`} accent />
        <ScoreCard label="Session +" value={`${sessionTokens.toFixed(1)}`} accent />
      </View>

      {/* Level Progress Bar */}
      <LevelProgressBar score={score} level={level} />

      {/* Game Board */}
      <GameBoard />

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>↑↓←→ Swipe to merge matching coins</Text>
        <Text style={styles.instructionNote}>
          🎯 Reach 2048 (MG) to unlock MintGrow airdrop
        </Text>
      </View>

      {/* Coin Legend (mini) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.legend}
      >
        {COIN_TILES.slice(0, 8).map(coin => (
          <View key={coin.symbol} style={styles.legendItem}>
            <Text style={[styles.legendEmoji]}>{coin.emoji}</Text>
            <Text style={[styles.legendSymbol, { color: coin.color }]}>{coin.symbol}</Text>
          </View>
        ))}
      </ScrollView>

      <GameOverModal />
      <LevelUpModal />
    </View>
  );
}

function LevelProgressBar({ score, level }: { score: number; level: number }) {
  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000];
  const curr = thresholds[level - 1] || 0;
  const next = thresholds[level] || curr;
  const progress = next > curr ? Math.min((score - curr) / (next - curr), 1) : 1;

  return (
    <View style={lStyles.container}>
      <View style={lStyles.bar}>
        <View style={[lStyles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={lStyles.text}>
        Level {level} → {level + 1} | {score.toLocaleString()} / {next.toLocaleString()}
      </Text>
    </View>
  );
}

const lStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  bar: {
    height: 4,
    backgroundColor: Colors.bgSurface,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  text: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  tagline: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  newGameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 4,
  },
  newGameText: {
    ...Typography.smallBold,
    color: Colors.primary,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    justifyContent: 'space-between',
  },
  instructions: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  instructionText: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  instructionNote: {
    ...Typography.caption,
    color: Colors.primary,
    opacity: 0.8,
  },
  legend: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.md,
  },
  legendItem: {
    alignItems: 'center',
    gap: 2,
  },
  legendEmoji: {
    fontSize: 18,
  },
  legendSymbol: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
