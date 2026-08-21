import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
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
    if (tile.isNew) Animated.parallel([Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }), Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true })]).start();
    if (tile.isMerged) Animated.sequence([Animated.spring(mergeAnim, { toValue: 1.2, friction: 3, tension: 300, useNativeDriver: true }), Animated.spring(mergeAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true })]).start();
  }, [tile.isNew, tile.isMerged]);
  useEffect(() => {
    if (isSelectingDestroy && tile.type === 'normal') Animated.loop(Animated.sequence([Animated.timing(destroyPulse, { toValue: 0.85, duration: 400, useNativeDriver: true }), Animated.timing(destroyPulse, { toValue: 1, duration: 400, useNativeDriver: true })])).start();
    else { destroyPulse.stopAnimation(); destroyPulse.setValue(1); }
  }, [isSelectingDestroy]);
  const coin = getCoinForValue(tile.value);
  const left = gap + tile.col * (tileSize + gap);
  const top = gap + tile.row * (tileSize + gap);
  const getBg = () => tile.type === 'bomb' ? '#FFEBEE' : tile.type === 'blocker' ? '#ECEFF1' : coin.bg;
  const getBorder = () => { if (isSelectingDestroy && tile.type === 'normal') return Colors.error; if (tile.type === 'bomb') return Colors.error; if (tile.type === 'blocker') return Colors.border; if (tile.isMerged) return coin.color; return Colors.border; };
  const getLabel = () => tile.type === 'bomb' ? 'BOMB' : tile.type === 'blocker' ? 'BLOCK' : tile.type === 'multiplier' ? '2X' : coin.symbol;
  const getFontSize = () => tileSize < 70 ? 14 : tileSize < 85 ? 18 : 22;
  const formatValue = (v: number) => v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)}B` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);
  return <Animated.View style={[styles.tile, { width: tileSize, height: tileSize, left, top, backgroundColor: getBg(), borderColor: getBorder(), borderWidth: tile.isMerged || (isSelectingDestroy && tile.type === 'normal') ? 3 : 2, transform: [{ scale: Animated.multiply(Animated.multiply(scaleAnim, mergeAnim), destroyPulse) }], opacity: opacityAnim }]}>
    <Pressable style={styles.pressable} onPress={() => { if (isSelectingDestroy && tile.type === 'normal') selectTileToDestroy(tile.row, tile.col); }}>
      <Text style={[styles.coinLabel, { fontSize: getFontSize(), color: coin.color }]}>{getLabel()}</Text>
      <Text style={[styles.symbol, { color: coin.color, fontSize: tileSize < 75 ? 8 : 10 }]}>{tile.type === 'normal' || tile.type === 'multiplier' ? coin.symbol : tile.type.toUpperCase()}</Text>
      {tile.type === 'normal' && <Text style={[styles.value, { color: coin.color, fontSize: tileSize < 75 ? 7 : 9 }]}>{formatValue(tile.value)}</Text>}
      {isSelectingDestroy && tile.type === 'normal' && <View style={styles.destroyOverlay}><Text style={styles.destroyX}>REMOVE</Text></View>}
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  tile: { position: 'absolute', borderRadius: Radius.md, shadowColor: '#00180F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8 },
  pressable: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.65)' },
  coinLabel: { fontWeight: '900', letterSpacing: 0.4, marginBottom: 1 },
  symbol: { fontWeight: '900', letterSpacing: 0.8 },
  value: { fontWeight: '800', marginTop: 1, opacity: 0.8 },
  destroyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(211,47,47,0.25)', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.65)' },
  destroyX: { fontSize: 10, color: Colors.error, fontWeight: '900', letterSpacing: 0.5 },
});
