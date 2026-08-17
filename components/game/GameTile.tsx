import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Tile } from '@/types/game';
import { getCoinForValue } from '@/constants/theme';
import { Colors, Radius, Typography } from '@/constants/theme';

interface Props {
  tile: Tile;
  tileSize: number;
  gap: number;
}

export function GameTile({ tile, tileSize, gap }: Props) {
  const scaleAnim = useRef(new Animated.Value(tile.isNew ? 0.1 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(tile.isNew ? 0 : 1)).current;
  const mergeAnim = useRef(new Animated.Value(1)).current;

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

  const coin = getCoinForValue(tile.value);
  const left = gap + tile.col * (tileSize + gap);
  const top = gap + tile.row * (tileSize + gap);

  const getBg = () => {
    if (tile.type === 'bomb') return '#3D0A0A';
    if (tile.type === 'blocker') return '#1A1A2E';
    return coin.bg;
  };

  const getBorder = () => {
    if (tile.type === 'bomb') return Colors.error;
    if (tile.type === 'blocker') return Colors.border;
    if (tile.isMerged) return coin.color;
    return 'transparent';
  };

  const getLabel = () => {
    if (tile.type === 'bomb') return '💣';
    if (tile.type === 'blocker') return '🔒';
    if (tile.type === 'multiplier') return '2×';
    return coin.emoji;
  };

  const getFontSize = () => {
    if (tileSize < 70) return 18;
    if (tileSize < 85) return 22;
    return 26;
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
          borderWidth: tile.isMerged ? 2 : 1,
          transform: [
            { scale: Animated.multiply(scaleAnim, mergeAnim) },
          ],
          opacity: opacityAnim,
        }
      ]}
    >
      <Text style={[styles.emoji, { fontSize: getFontSize() }]}>{getLabel()}</Text>
      <Text style={[styles.symbol, { color: coin.color, fontSize: tileSize < 75 ? 9 : 11 }]}>
        {tile.type === 'normal' || tile.type === 'multiplier' ? coin.symbol : tile.type.toUpperCase()}
      </Text>
      {tile.type === 'normal' && (
        <Text style={[styles.value, { color: coin.color, fontSize: tileSize < 75 ? 8 : 10 }]}>
          {tile.value >= 1024 ? `${tile.value / 1024}K` : tile.value}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emoji: {
    marginBottom: 2,
  },
  symbol: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  value: {
    fontWeight: '500',
    marginTop: 1,
  },
});
