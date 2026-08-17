import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/hooks/useGame';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { LEVEL_REWARDS, SCORE_PER_LEVEL } from '@/types/game';

export default function LevelsScreen() {
  const insets = useSafeAreaInsets();
  const { level, score, profile } = useGame();

  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Text style={styles.pageTitle}>🏆 Level Rewards</Text>
        <Text style={styles.pageSubtitle}>Reach each level to earn MintGrow token airdrops</Text>

        {/* Current level badge */}
        <View style={styles.currentBadge}>
          <Text style={styles.currentLabelText}>YOUR CURRENT LEVEL</Text>
          <Text style={styles.currentLevel}>{level}</Text>
          <Text style={styles.currentTitle}>{LEVEL_REWARDS[level - 1]?.title ?? 'Legend'}</Text>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreInfoText}>Score: {score.toLocaleString()}</Text>
            <Text style={styles.scoreInfoText}>
              Next Level: {(thresholds[level] || 'MAX').toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Levels list */}
        {LEVEL_REWARDS.map((reward, i) => {
          const isCompleted = level > reward.level;
          const isCurrent = level === reward.level;
          const reqScore = thresholds[reward.level - 1] || 0;

          return (
            <View
              key={reward.level}
              style={[
                styles.levelCard,
                isCurrent && styles.currentCard,
                isCompleted && styles.completedCard,
              ]}
            >
              <View style={styles.levelLeft}>
                <View style={[styles.levelBadge, isCurrent && styles.activeBadge, isCompleted && styles.doneBadge]}>
                  <Text style={styles.levelNum}>
                    {isCompleted ? '✓' : reward.level}
                  </Text>
                </View>
                <View style={styles.levelInfo}>
                  <Text style={[styles.levelTitle, isCurrent && styles.activeLevelTitle]}>
                    {reward.title}
                  </Text>
                  <Text style={styles.levelRequire}>
                    Score: {reqScore.toLocaleString()}+
                  </Text>
                  <Text style={styles.levelUnlocks}>🔓 {reward.unlocks}</Text>
                </View>
              </View>

              <View style={[styles.rewardChip, isCompleted && styles.rewardChipDone]}>
                <Text style={styles.rewardEmoji}>✦</Text>
                <Text style={styles.rewardAmount}>+{reward.tokenReward}</Text>
                <Text style={styles.rewardUnit}>MG</Text>
              </View>
            </View>
          );
        })}

        {/* Ecosystem Info */}
        <View style={styles.ecoCard}>
          <Text style={styles.ecoTitle}>🌍 MintGrow Ecosystem</Text>
          <Text style={styles.ecoBody}>
            MG tokens unlock real ecosystem value:
          </Text>
          {[
            '🗳️  Governance voting on protocol decisions',
            '🎁  Exclusive NFT badge mints',
            '📦  Airdrop eligibility for partner projects',
            '💎  DAO membership and royalties',
            '🤝  DeFi integration & yield farming',
          ].map((item, i) => (
            <Text key={i} style={styles.ecoItem}>{item}</Text>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, paddingBottom: 40 },

  pageTitle: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 4 },
  pageSubtitle: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.lg },

  currentBadge: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  currentLabelText: { ...Typography.caption, color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  currentLevel: { fontSize: 56, fontWeight: '900', color: Colors.primary, lineHeight: 64 },
  currentTitle: { ...Typography.h3, color: Colors.textPrimary, marginBottom: Spacing.sm },
  scoreInfo: { flexDirection: 'row', gap: Spacing.lg },
  scoreInfoText: { ...Typography.small, color: Colors.textMuted },

  levelCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currentCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.bgElevated,
  },
  completedCard: {
    borderColor: Colors.success,
    opacity: 0.7,
  },

  levelLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeBadge: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  doneBadge: { backgroundColor: Colors.success, borderColor: Colors.success },
  levelNum: { ...Typography.bodyBold, color: Colors.textPrimary },

  levelInfo: { flex: 1, gap: 2 },
  levelTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  activeLevelTitle: { color: Colors.primary },
  levelRequire: { ...Typography.caption, color: Colors.textMuted },
  levelUnlocks: { ...Typography.caption, color: Colors.info },

  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 3,
  },
  rewardChipDone: { opacity: 0.6 },
  rewardEmoji: { color: Colors.primary, fontSize: 10 },
  rewardAmount: { ...Typography.smallBold, color: Colors.primary },
  rewardUnit: { ...Typography.caption, color: Colors.primary },

  ecoCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  ecoTitle: { ...Typography.h3, color: Colors.textPrimary, marginBottom: Spacing.sm },
  ecoBody: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
  ecoItem: { ...Typography.body, color: Colors.textMuted, paddingVertical: 3, lineHeight: 22 },
});
