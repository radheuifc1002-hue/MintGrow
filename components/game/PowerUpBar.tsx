import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { POWER_UPS, PowerUpType } from '@/types/game';
import { useGame } from '@/hooks/useGame';

interface Props { onWatchAd: (type: PowerUpType) => void; onSpendTokens: (type: PowerUpType, cost: number) => void; loading?: PowerUpType | null; }

export function PowerUpBar({ onWatchAd, onSpendTokens, loading }: Props) {
  const { profile, isSelectingDestroy, cancelDestroy } = useGame();
  if (isSelectingDestroy) return (
    <View style={styles.destroyBanner}>
      <MaterialIcons name="ads-click" size={18} color={Colors.error} />
      <Text style={styles.destroyText}>Select a tile on the board to destroy it</Text>
      <Pressable onPress={cancelDestroy} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></Pressable>
    </View>
  );
  return <View style={styles.container}><View style={styles.row}>
    {POWER_UPS.map(pu => {
      const owned = profile?.powerUps?.[pu.type] || 0;
      const isLoading = loading === pu.type;
      const iconName = pu.icon as keyof typeof MaterialIcons.glyphMap;
      return <Pressable key={pu.type} style={({ pressed }) => [styles.powerUpBtn, owned > 0 && styles.powerUpBtnOwned, pressed && styles.pressed]} onPress={() => onWatchAd(pu.type)} disabled={isLoading} accessibilityRole="button" accessibilityLabel={pu.label}>
        {isLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : <View style={styles.iconBox}><MaterialIcons name={iconName} size={20} color={owned > 0 ? Colors.primary : Colors.textPrimary} /></View>}
        {owned > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{owned}</Text></View>}
        <Text style={styles.label} numberOfLines={1}>{pu.label}</Text>
        <Text style={owned === 0 ? styles.adHint : styles.useHint}>{owned === 0 ? 'Watch Ad' : 'Tap to use'}</Text>
      </Pressable>;
    })}
  </View></View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'space-between' },
  powerUpBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSurface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: 8, paddingHorizontal: 4, minHeight: 72, position: 'relative', gap: 2 },
  powerUpBtnOwned: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  iconBox: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  label: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center', fontSize: 9 },
  adHint: { fontSize: 8, color: Colors.warning, textAlign: 'center', fontWeight: '600' },
  useHint: { fontSize: 8, color: Colors.primary, textAlign: 'center', fontWeight: '600' },
  destroyBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(211,47,47,0.08)', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: 1.5, borderTopColor: Colors.error, minHeight: 52 },
  destroyText: { ...Typography.small, color: Colors.error, flex: 1 },
  cancelBtn: { backgroundColor: Colors.error, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { ...Typography.caption, color: '#fff', fontWeight: '700' },
});
