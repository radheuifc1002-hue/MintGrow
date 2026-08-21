import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Tile } from '@/types/game';
import { Colors, getCoinForValue, Radius } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';

interface Props { tile: Tile; tileSize: number; gap: number; }

const logoGlyph: Record<string, string> = {
  BTC: 'currency-bitcoin', ETH: 'diamond', BNB: 'grid-view', SOL: 'layers', DOGE: 'pets', PEPE: 'face',
  SHIB: 'pets', AVAX: 'change-history', LINK: 'hub', MATIC: 'hexagon', DOT: 'fiber-manual-record',
  ADA: 'account-balance', TRX: 'change-history', LTC: 'currency-exchange', ATOM: 'hub', NEAR: 'diamond',
  FTM: 'bolt', SAND: 'landscape', MANA: 'language', APE: 'pets', BONK: 'local-fire-department', WIF: 'style',
  FLOKI: 'bolt', BRETT: 'face', MOG: 'face', POPCAT: 'pets', TURBO: 'rocket-launch', NEIRO: 'pets', BOME: 'layers', MG: 'eco',
};

export function GameTile({ tile, tileSize, gap }: Props) {
  const { isSelectingDestroy, selectTileToDestroy } = useGame();
  const scaleAnim = useRef(new Animated.Value(tile.isNew ? 0.1 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(tile.isNew ? 0 : 1)).current;
  const mergeAnim = useRef(new Animated.Value(1)).current;
  const destroyPulse = useRef(new Animated.Value(1)).current;
  const coin = getCoinForValue(tile.value);

  useEffect(() => {
    if (tile.isNew) Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    if (tile.isMerged) Animated.sequence([
      Animated.spring(mergeAnim, { toValue: 1.12, friction: 3, tension: 300, useNativeDriver: true }),
      Animated.spring(mergeAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  }, [tile.isNew, tile.isMerged]);

  useEffect(() => {
    if (isSelectingDestroy && tile.type === 'normal') Animated.loop(Animated.sequence([
      Animated.timing(destroyPulse, { toValue: 0.86, duration: 400, useNativeDriver: true }),
      Animated.timing(destroyPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
    ])).start();
    else { destroyPulse.stopAnimation(); destroyPulse.setValue(1); }
  }, [isSelectingDestroy]);

  const left = gap + tile.col * (tileSize + gap);
  const top = gap + tile.row * (tileSize + gap);
  const getBg = () => tile.type === 'bomb' ? '#FFEBEE' : tile.type === 'blocker' ? '#ECEFF1' : coin.bg;
  const getBorder = () => {
    if (isSelectingDestroy && tile.type === 'normal') return Colors.error;
    if (tile.type === 'bomb') return Colors.error;
    if (tile.type === 'blocker') return Colors.border;
    if (tile.isMerged) return coin.color;
    return Colors.border;
  };
  const getLabel = () => tile.type === 'bomb' ? 'BOMB' : tile.type === 'blocker' ? 'BLOCK' : tile.type === 'multiplier' ? '2X' : coin.symbol;
  const formatValue = (v: number) => v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)}B` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);
  const iconSize = tileSize < 68 ? 15 : 18;
  const badgeSize = tileSize < 68 ? 28 : 34;
  const iconName = (logoGlyph[coin.symbol] || 'circle') as keyof typeof MaterialIcons.glyphMap;

  return <Animated.View style={[styles.tile, { width: tileSize, height: tileSize, left, top, backgroundColor: getBg(), borderColor: getBorder(), borderWidth: tile.isMerged || (isSelectingDestroy && tile.type === 'normal') ? 2.5 : 1.5, transform: [{ scale: Animated.multiply(Animated.multiply(scaleAnim, mergeAnim), destroyPulse) }], opacity: opacityAnim }]}>
    <Pressable style={styles.pressable} onPress={() => { if (isSelectingDestroy && tile.type === 'normal') selectTileToDestroy(tile.row, tile.col); }}>
      {tile.type === 'normal' || tile.type === 'multiplier' ? <View style={[styles.logoBadge, { width: badgeSize, height: badgeSize, borderRadius: Math.round(badgeSize * 0.28), borderColor: coin.color }]}>
        <MaterialIcons name={iconName} size={iconSize} color={coin.color} />
      </View> : <View style={[styles.specialBadge, { width: badgeSize, height: badgeSize }]}><MaterialIcons name={tile.type === 'bomb' ? 'local-fire-department' : 'block'} size={iconSize} color={tile.type === 'bomb' ? Colors.error : Colors.textMuted} /></View>}
      <Text style={[styles.coinLabel, { fontSize: tileSize < 68 ? 12 : 15, color: coin.color }]}>{getLabel()}</Text>
      {tile.type === 'normal' && <Text style={[styles.value, { color: coin.color, fontSize: tileSize < 68 ? 7 : 9 }]}>{formatValue(tile.value)}</Text>}
      {isSelectingDestroy && tile.type === 'normal' && <View style={styles.destroyOverlay}><Text style={styles.destroyText}>REMOVE</Text></View>}
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  tile: { position: 'absolute', borderRadius: Radius.md, shadowColor: '#00180F', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 7, elevation: 5 },
  pressable: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.72)', paddingVertical: 2 },
  logoBadge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginBottom: 2, backgroundColor: 'rgba(255,255,255,0.72)' },
  specialBadge: { alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.72)', marginBottom: 2 },
  coinLabel: { fontWeight: '900', letterSpacing: 0.3 },
  value: { fontWeight: '800', marginTop: 1, opacity: 0.8 },
  destroyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(211,47,47,0.25)', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  destroyText: { fontSize: 9, color: Colors.error, fontWeight: '900', letterSpacing: 0.4 },
});
