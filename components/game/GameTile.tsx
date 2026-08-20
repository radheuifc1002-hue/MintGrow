import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Tile } from '@/types/game';
import { Colors, getCoinForValue, Radius } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';

interface Props { tile: Tile; tileSize: number; gap: number; }

export function GameTile({ tile, tileSize, gap }: Props) {
  const { isSelectingDestroy, selectTileToDestroy } = useGame();
  const scaleAnim = useRef(new Animated.Value(tile.isNew ? 0.1 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(tile.isNew ? 0 : 1)).current;
  const mergeAnim = useRef(new Animated.Value(1)).current;
  const destroyPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (tile.isNew) Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    if (tile.isMerged) Animated.sequence([
      Animated.spring(mergeAnim, { toValue: 1.2, friction: 3, tension: 300, useNativeDriver: true }),
      Animated.spring(mergeAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  }, [tile.isNew, tile.isMerged]);

  useEffect(() => {
    if (isSelectingDestroy && tile.type === 'normal') {
      Animated.loop(Animated.sequence([
        Animated.timing(destroyPulse, { toValue: 0.85, duration: 400, useNativeDriver: true }),
        Animated.timing(destroyPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])).start();
    } else { destroyPulse.stopAnimation(); destroyPulse.setValue(1); }
  }, [isSelectingDestroy]);

  const coin = getCoinForValue(tile.value);
  const left = gap + tile.col * (tileSize + gap);
  const top = gap + tile.row * (tileSize + gap);
  const logoSize = Math.max(30, Math.min(46, tileSize * 0.48));
  const logoFont = tileSize < 70 ? 10 : tileSize < 85 ? 12 : 14;

  const getBg = () => tile.type === 'bomb' ? '#FFEBEE' : tile.type === 'blocker' ? '#ECEFF1' : coin.bg;
  const getBorder = () => {
    if (isSelectingDestroy && tile.type === 'normal') return Colors.error;
    if (tile.type === 'bomb') return Colors.error;
    if (tile.type === 'blocker') return Colors.border;
    if (tile.isMerged) return coin.color;
    return Colors.border;
  };
  const formatValue = (v: number) => v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)}B` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

  return (
    <Animated.View style={[styles.tile, {
      width: tileSize, height: tileSize, left, top, backgroundColor: getBg(), borderColor: getBorder(),
      borderWidth: tile.isMerged || (isSelectingDestroy && tile.type === 'normal') ? 3 : 2,
      transform: [{ scale: Animated.multiply(Animated.multiply(scaleAnim, mergeAnim), destroyPulse) }], opacity: opacityAnim,
    }]}>
      <Pressable style={styles.pressable} onPress={() => isSelectingDestroy && tile.type === 'normal' && selectTileToDestroy(tile.row, tile.col)}>
        {tile.type === 'bomb' ? (
          <View style={[styles.specialLogo, { width: logoSize, height: logoSize, borderColor: Colors.error }]}><MaterialIcons name="bolt" size={logoSize * 0.52} color={Colors.error} /></View>
        ) : tile.type === 'blocker' ? (
          <View style={[styles.specialLogo, { width: logoSize, height: logoSize, borderColor: Colors.textMuted }]}><MaterialIcons name="lock" size={logoSize * 0.48} color={Colors.textMuted} /></View>
        ) : tile.type === 'multiplier' ? (
          <View style={[styles.specialLogo, { width: logoSize, height: logoSize, borderColor: Colors.primary }]}><Text style={[styles.multiplier, { fontSize: logoFont + 3 }]}>2×</Text></View>
        ) : (
          <View style={[styles.coinLogo, { width: logoSize, height: logoSize, backgroundColor: coin.color, shadowColor: coin.color }]}>
            <Text style={[styles.coinLogoText, { fontSize: logoFont }]}>{coin.symbol === 'MATIC' ? 'M' : coin.symbol === 'NEAR' ? 'N' : coin.symbol === 'ATOM' ? 'A' : coin.symbol === 'DOGE' ? 'Ð' : coin.symbol === 'ETH' ? 'Ξ' : coin.symbol === 'BTC' ? '₿' : coin.symbol === 'BNB' ? 'B' : coin.symbol === 'SOL' ? 'S' : coin.symbol === 'ADA' ? 'A' : coin.symbol === 'LTC' ? 'Ł' : coin.symbol === 'MG' ? 'MG' : coin.symbol.slice(0, 1)}</Text>
          </View>
        )}
        <Text style={[styles.symbol, { color: coin.color, fontSize: tileSize < 75 ? 8 : 10 }]}>{tile.type === 'normal' || tile.type === 'multiplier' ? coin.symbol : tile.type.toUpperCase()}</Text>
        {tile.type === 'normal' && <Text style={[styles.value, { color: coin.color, fontSize: tileSize < 75 ? 7 : 9 }]}>{formatValue(tile.value)}</Text>}
        {isSelectingDestroy && tile.type === 'normal' && <View style={styles.destroyOverlay}><MaterialIcons name="close" size={Math.min(26, tileSize * 0.32)} color={Colors.error} /></View>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { position: 'absolute', borderRadius: Radius.md, shadowColor: '#00180F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8 },
  pressable: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.65)' },
  coinLogo: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', shadowOpacity: 0.28, shadowRadius: 7, elevation: 4 },
  coinLogoText: { color: '#fff', fontWeight: '900', letterSpacing: -0.4, textAlign: 'center' },
  specialLogo: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.7)' },
  multiplier: { color: Colors.primary, fontWeight: '900' },
  symbol: { fontWeight: '900', letterSpacing: 0.8, marginTop: 1 },
  value: { fontWeight: '800', marginTop: 1, opacity: 0.8 },
  destroyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(211,47,47,0.25)', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.65)' },
});
