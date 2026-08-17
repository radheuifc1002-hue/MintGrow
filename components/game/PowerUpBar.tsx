import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { POWER_UPS, PowerUpType } from '@/types/game';
import { useGame } from '@/hooks/useGame';

interface Props {
  onWatchAd: (type: PowerUpType) => void;
  onSpendTokens: (type: PowerUpType, cost: number) => void;
  loading?: PowerUpType | null;
}

export function PowerUpBar({ onWatchAd, onSpendTokens, loading }: Props) {
  const { profile, isSelectingDestroy, cancelDestroy } = useGame();

  if (isSelectingDestroy) {
    return (
      <View style={styles.destroyBanner}>
        <MaterialIcons name="touch-app" size={18} color={Colors.error} />
        <Text style={styles.destroyText}>Tap any tile to destroy it</Text>
        <Pressable onPress={cancelDestroy} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {POWER_UPS.map(pu => {
          const owned = profile?.powerUps?.[pu.type] || 0;
          const isLoading = loading === pu.type;

          return (
            <View key={pu.type} style={styles.powerUpItem}>
              <Pressable
                style={({ pressed }) => [
                  styles.powerUpBtn,
                  owned > 0 && styles.powerUpBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => owned > 0 ? onWatchAd(pu.type) : onWatchAd(pu.type)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Text style={styles.powerUpEmoji}>{pu.emoji}</Text>
                    {owned > 0 && (
                      <View style={styles.ownedBadge}>
                        <Text style={styles.ownedBadgeText}>{owned}</Text>
                      </View>
                    )}
                  </>
                )}
              </Pressable>
              <Text style={styles.powerUpLabel} numberOfLines={1}>{pu.label}</Text>
              {owned === 0 && (
                <Text style={styles.adLabel}>📺 Ad</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  powerUpItem: {
    alignItems: 'center',
    width: 62,
  },
  powerUpBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    position: 'relative',
  },
  powerUpBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  powerUpEmoji: { fontSize: 22 },
  ownedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownedBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  powerUpLabel: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', fontSize: 9 },
  adLabel: { fontSize: 9, color: Colors.warning, textAlign: 'center' },

  destroyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(211,47,47,0.1)',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.error,
  },
  destroyText: { ...Typography.small, color: Colors.error, flex: 1 },
  cancelBtn: {
    backgroundColor: Colors.error,
    borderRadius: Radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  cancelText: { ...Typography.caption, color: '#fff', fontWeight: '700' },
});
