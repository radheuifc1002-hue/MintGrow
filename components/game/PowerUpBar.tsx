import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
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
        <View style={styles.destroyIcon}><MaterialIcons name="touch-app" size={18} color={Colors.error} /></View>
        <Text style={styles.destroyText}>Tap any tile on the board to destroy it</Text>
        <Pressable onPress={cancelDestroy} style={styles.cancelBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {POWER_UPS.map(pu => {
          const owned = profile?.powerUps?.[pu.type] || 0;
          const isLoading = loading === pu.type;
          const iconName = pu.icon as keyof typeof MaterialIcons.glyphMap;

          return (
            <Pressable
              key={pu.type}
              accessibilityRole="button"
              accessibilityLabel={pu.label}
              style={({ pressed }) => [
                styles.powerUpBtn,
                owned > 0 && styles.powerUpBtnOwned,
                pressed && styles.powerUpBtnPressed,
              ]}
              onPress={() => onWatchAd(pu.type)}
              disabled={isLoading}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <View style={[styles.iconButton, owned > 0 && styles.iconButtonOwned]}>
                  <MaterialIcons name={iconName} size={20} color={owned > 0 ? '#FFFFFF' : Colors.primary} />
                </View>
              )}
              {owned > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{owned}</Text></View>}
              <Text style={styles.label} numberOfLines={1}>{pu.label}</Text>
              {owned === 0 ? (
                <View style={styles.adHintRow}>
                  <MaterialIcons name="play-circle-outline" size={11} color={Colors.warning} />
                  <Text style={styles.adHint}>Watch Ad</Text>
                </View>
              ) : (
                <Text style={styles.useHint}>Tap to use</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'space-between' },
  powerUpBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSurface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: 7, paddingHorizontal: 4, minHeight: 68, position: 'relative', gap: 3 },
  powerUpBtnOwned: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  powerUpBtnPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(29,232,155,0.10)', borderWidth: 1, borderColor: 'rgba(29,232,155,0.28)' },
  iconButtonOwned: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  label: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center', fontSize: 9 },
  adHintRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  adHint: { fontSize: 8, color: Colors.warning, textAlign: 'center', fontWeight: '600' },
  useHint: { fontSize: 8, color: Colors.primary, textAlign: 'center', fontWeight: '600' },
  destroyBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(211,47,47,0.08)', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: 1.5, borderTopColor: Colors.error, minHeight: 52 },
  destroyIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(211,47,47,0.10)' },
  destroyText: { ...Typography.small, color: Colors.error, flex: 1 },
  cancelBtn: { backgroundColor: Colors.error, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { ...Typography.caption, color: '#fff', fontWeight: '700' },
});
