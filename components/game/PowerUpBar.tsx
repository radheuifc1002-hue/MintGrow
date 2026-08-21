import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { POWER_UPS, PowerUpType } from '@/types/game';
import { useGame } from '@/hooks/useGame';

interface Props { onWatchAd: (type: PowerUpType) => void; onSpendTokens: (type: PowerUpType, cost: number) => void; loading?: PowerUpType | null; }

export function PowerUpBar({ onWatchAd, onSpendTokens, loading }: Props) {
  const { height } = useWindowDimensions();
  const compact = height < 780;
  const ultraCompact = height < 680;
  const scale = ultraCompact ? 0.72 : compact ? 0.82 : 1;
  const { profile, isSelectingDestroy, cancelDestroy } = useGame();
  if (isSelectingDestroy) return (
    <View style={styles.destroyBanner}>
      <MaterialIcons name="ads-click" size={Math.max(16, Math.round(20 * scale))} color={Colors.error} />
      <Text style={styles.destroyText}>Select a tile on the board to destroy it</Text>
      <Pressable onPress={cancelDestroy} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></Pressable>
    </View>
  );
  return <View style={[styles.container, { paddingHorizontal: compact ? 8 : 16, paddingTop: Math.round(7 * scale), paddingBottom: Math.round(7 * scale) }]}><View style={[styles.row, { gap: Math.max(5, Math.round(8 * scale)) }]}>
    {POWER_UPS.map(pu => {
      const owned = profile?.powerUps?.[pu.type] || 0;
      const isLoading = loading === pu.type;
      const iconName = pu.icon as keyof typeof MaterialIcons.glyphMap;
      return <Pressable key={pu.type} style={({ pressed }) => [styles.powerUpBtn, { minHeight: Math.round(82 * scale), paddingVertical: Math.max(3, Math.round(5 * scale)), borderRadius: Math.round(16 * scale) }, owned > 0 && styles.powerUpBtnOwned, pressed && styles.pressed]} onPress={() => onWatchAd(pu.type)} disabled={isLoading} accessibilityRole="button" accessibilityLabel={pu.label}>
        {isLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : <View style={[styles.iconBox, { width: Math.round(38 * scale), height: Math.round(38 * scale), borderRadius: Math.round(12 * scale) }]}><MaterialIcons name={iconName} size={Math.max(18, Math.round(24 * scale))} color={owned > 0 ? Colors.primary : '#123B2D'} /></View>}
        {owned > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{owned}</Text></View>}
        <Text style={[styles.label, { fontSize: Math.max(8, Math.round(9 * scale)), lineHeight: Math.max(9, Math.round(11 * scale)) }]} numberOfLines={1}>{pu.label}</Text>
        <Text style={[owned === 0 ? styles.adHint : styles.useHint, { fontSize: Math.max(7, Math.round(8 * scale)) }]}>{owned === 0 ? 'Watch Ad' : 'Tap to use'}</Text>
      </Pressable>;
    })}
  </View></View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#D4E9DC' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  powerUpBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6FAF7', borderWidth: 2, borderColor: '#D1E8D8', paddingHorizontal: 2, position: 'relative', gap: 3 },
  powerUpBtnOwned: { borderColor: Colors.primary, backgroundColor: '#E8FFF1' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  iconBox: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D7E9DD' },
  badge: { position: 'absolute', top: 5, right: 5, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  label: { color: '#153B2E', fontWeight: '800', textAlign: 'center' },
  adHint: { color: '#E28A31', textAlign: 'center', fontWeight: '900' },
  useHint: { color: Colors.primary, textAlign: 'center', fontWeight: '900' },
  destroyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6F6', paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1.5, borderTopColor: Colors.error, minHeight: 50 },
  destroyText: { color: Colors.error, flex: 1, fontSize: 11, fontWeight: '700' },
  cancelBtn: { backgroundColor: Colors.error, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  cancelText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
