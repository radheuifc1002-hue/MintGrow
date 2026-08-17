import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks/useGame';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { getLeaderboard, getPlayerRank, LeaderboardEntry } from '@/services/storage';

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useGame();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, rank] = await Promise.all([
        getLeaderboard(50),
        profile?.telegramId ? getPlayerRank(profile.telegramId) : Promise.resolve(null),
      ]);
      setEntries(list);
      setMyRank(rank);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.telegramId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const rankBadge = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', color: '#FFD700' };
    if (rank === 2) return { emoji: '🥈', color: '#C0C0C0' };
    if (rank === 3) return { emoji: '🥉', color: '#CD7F32' };
    return { emoji: `#${rank}`, color: Colors.textMuted };
  };

  const myEntry = profile ? entries.find(e => e.telegramId === profile.telegramId) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>🏆 Leaderboard</Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="refresh" size={20} color={Colors.primary} />
        </Pressable>
      </View>
      <Text style={styles.pageSubtitle}>Top 50 players by MG earned</Text>

      {/* My Rank Banner */}
      {myRank !== null && (
        <View style={styles.myRankBanner}>
          <MaterialIcons name="person" size={16} color={Colors.primary} />
          <Text style={styles.myRankText}>
            Your rank: <Text style={styles.myRankNum}>#{myRank}</Text>
            {myEntry ? `  ·  ${myEntry.totalTokens.toLocaleString()} MG` : ''}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>No players yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to earn MG tokens!</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* Top 3 podium */}
          {entries.length >= 3 && (
            <View style={styles.podium}>
              {/* 2nd */}
              <PodiumCard entry={entries[1]} rank={2} />
              {/* 1st */}
              <PodiumCard entry={entries[0]} rank={1} large />
              {/* 3rd */}
              <PodiumCard entry={entries[2]} rank={3} />
            </View>
          )}

          {/* Rest of list */}
          {entries.slice(entries.length >= 3 ? 3 : 0).map((entry) => {
            const isMe = entry.telegramId === profile?.telegramId;
            const badge = rankBadge(entry.rank);
            return (
              <View
                key={entry.telegramId}
                style={[styles.row, isMe && styles.myRow]}
              >
                <View style={[styles.rankCell, { minWidth: 40 }]}>
                  {entry.rank <= 3 ? (
                    <Text style={styles.rankEmoji}>{badge.emoji}</Text>
                  ) : (
                    <Text style={[styles.rankNum, { color: badge.color }]}>#{entry.rank}</Text>
                  )}
                </View>
                <View style={[styles.avatarCircle, isMe && { borderColor: Colors.primary }]}>
                  <Text style={styles.avatarText}>
                    {(entry.username[0] || '?').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, isMe && { color: Colors.primary }]} numberOfLines={1}>
                    {isMe ? '★ ' : ''}{entry.username}
                  </Text>
                  <Text style={styles.rowSub}>Lv {entry.level}  ·  Score {entry.bestScore.toLocaleString()}</Text>
                </View>
                <View style={styles.tokenBox}>
                  <Text style={[styles.tokenAmt, isMe && { color: Colors.primary }]}>
                    {entry.totalTokens >= 1000
                      ? `${(entry.totalTokens / 1000).toFixed(1)}K`
                      : entry.totalTokens.toLocaleString()}
                  </Text>
                  <Text style={styles.tokenUnit}>MG</Text>
                </View>
              </View>
            );
          })}

          <View style={styles.footer}>
            <MaterialIcons name="info-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.footerText}>Updated in real-time · BNB Chain</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function PodiumCard({ entry, rank, large }: { entry: LeaderboardEntry; rank: number; large?: boolean }) {
  const medals = ['🥇', '🥈', '🥉'];
  const borderColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  return (
    <View style={[podiumStyles.card, large && podiumStyles.largeCard, { borderColor: borderColors[rank - 1] }]}>
      <Text style={podiumStyles.medal}>{medals[rank - 1]}</Text>
      <View style={[podiumStyles.avatar, { borderColor: borderColors[rank - 1] }]}>
        <Text style={podiumStyles.avatarText}>{(entry.username[0] || '?').toUpperCase()}</Text>
      </View>
      <Text style={podiumStyles.name} numberOfLines={1}>{entry.username}</Text>
      <Text style={podiumStyles.tokens}>
        {entry.totalTokens >= 1000 ? `${(entry.totalTokens / 1000).toFixed(1)}K` : entry.totalTokens.toLocaleString()} MG
      </Text>
    </View>
  );
}

const podiumStyles = StyleSheet.create({
  card: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.sm, borderWidth: 1.5, marginHorizontal: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  largeCard: { paddingTop: Spacing.md, transform: [{ scale: 1.05 }], zIndex: 1 },
  medal: { fontSize: 24, marginBottom: 4 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginBottom: 6,
  },
  avatarText: { ...Typography.bodyBold, color: Colors.primary },
  name: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  tokens: { ...Typography.caption, color: Colors.primary, fontWeight: '700', marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
  },
  pageTitle: { ...Typography.h2, color: Colors.textPrimary },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  pageSubtitle: { ...Typography.small, color: Colors.textMuted, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  myRankBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryGlow,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: Radius.md,
    padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.primary,
  },
  myRankText: { ...Typography.small, color: Colors.textSecondary },
  myRankNum: { ...Typography.smallBold, color: Colors.primary },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { ...Typography.body, color: Colors.textMuted },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary },
  emptySubtitle: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing.lg, paddingTop: Spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.sm,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  myRow: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  rankCell: { alignItems: 'center' },
  rankEmoji: { fontSize: 20 },
  rankNum: { ...Typography.smallBold },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border,
  },
  avatarText: { ...Typography.smallBold, color: Colors.primary },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { ...Typography.smallBold, color: Colors.textPrimary },
  rowSub: { ...Typography.caption, color: Colors.textMuted },
  tokenBox: { alignItems: 'flex-end' },
  tokenAmt: { ...Typography.smallBold, color: Colors.textPrimary },
  tokenUnit: { ...Typography.caption, color: Colors.textMuted },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  footerText: { ...Typography.caption, color: Colors.textMuted },
});
