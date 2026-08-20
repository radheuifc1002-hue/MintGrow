import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Tile } from '@/types/game';
import { Colors, getCoinForValue, Radius } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';

interface Props {
  tile: Tile;
  tileSize: number;
  gap: number;
}

export function GameTile({ tile, tileSize, gap }: Props) {
  const { isSelectingDestroy, selectTileToDestroy } = useGame();

  const scaleAnim = useRef(new Animated.Value(tile.isNew ? 0.1 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(tile.isNew ? 0 : 1)).current;
  const mergeAnim = useRef(new Animated.Value(1)).current;
  const destroyPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (tile.isNew) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    if (tile.isMerged) {
      Animated.sequence([
        Animated.spring(mergeAnim, { toValue: 1.2, friction: 3, tension: 300, useNativeDriver: true }),
        Animated.spring(mergeAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [tile.isNew, tile.isMerged]);

  useEffect(() => {
    if (isSelectingDestroy && tile.type === 'normal') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(destroyPulse, { toValue: 0.85, duration: 400, useNativeDriver: true }),
          Animated.timing(destroyPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      destroyPulse.stopAnimation();
      destroyPulse.setValue(1);
    }
  }, [isSelectingDestroy]);

  const coin = getCoinForValue(tile.value);
  const left = gap + tile.col * (tileSize + gap);
  const top = gap + tile.row * (tileSize + gap);

  const getBg = () => {
    if (tile.type === 'bomb') return '#FFEBEE';
    if (tile.type === 'blocker') return '#ECEFF1';
    return coin.bg;
  };

  const getBorder = () => {
    if (isSelectingDestroy && tile.type === 'normal') return Colors.error;
    if (tile.type === 'bomb') return Colors.error;
    if (tile.type === 'blocker') return Colors.border;
    if (tile.isMerged) return coin.color;
    return Colors.border;
  };

  const getLabel = () => {
    if (tile.type === 'bomb') return '💣';
    if (tile.type === 'blocker') return '🔒';
    if (tile.type === 'multiplier') return '2×';
    return coin.emoji;
  };

  const getFontSize = () => {
    if (tileSize < 70) return 16;
    if (tileSize < 85) return 20;
    return 24;
  };

  const formatValue = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  };

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: tileSize,
          height: tileSize,
          left,
          top,
          backgroundColor: getBg(),
          borderColor: getBorder(),
          borderWidth: tile.isMerged || (isSelectingDestroy && tile.type === 'normal') ? 2 : 1,
          transform: [
            { scale: Animated.multiply(Animated.multiply(scaleAnim, mergeAnim), destroyPulse) },
          ],
          opacity: opacityAnim,
        }
      ]}
    >
      <Pressable
        style={styles.pressable}
        onPress={() => {
          if (isSelectingDestroy && tile.type === 'normal') {
            selectTileToDestroy(tile.row, tile.col);
          }
        }}
        hitSlop={0}
      >
        <Text style={[styles.emoji, { fontSize: getFontSize() }]}>{getLabel()}</Text>
        <Text style={[styles.symbol, { color: coin.color, fontSize: tileSize < 75 ? 8 : 10 }]}>
          {tile.type === 'normal' || tile.type === 'multiplier' ? coin.symbol : tile.type.toUpperCase()}
        </Text>
        {tile.type === 'normal' && (
          <Text style={[styles.value, { color: coin.color, fontSize: tileSize < 75 ? 7 : 9 }]}>
            {formatValue(tile.value)}
          </Text>
        )}
        {isSelectingDestroy && tile.type === 'normal' && (
          <View style={styles.destroyOverlay}>
            <Text style={styles.destroyX}>✕</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    borderRadius: Radius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { marginBottom: 1 },
  symbol: { fontWeight: '700', letterSpacing: 0.3 },
  value: { fontWeight: '500', marginTop: 1 },
  destroyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(211,47,47,0.25)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destroyX: { fontSize: 20, color: Colors.error, fontWeight: '900' },
});
