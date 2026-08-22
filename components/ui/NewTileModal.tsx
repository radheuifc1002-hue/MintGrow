import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { getCoinForValue } from '@/constants/theme';

interface Props {
  visible: boolean;
  tileValue: number;
  onDismiss: () => void;
}

export function NewTileModal({ visible, tileValue, onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.3);
      rotateAnim.setValue(0);
      opacAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rotateAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: -0.5, duration: 150, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]),
      ]).start();

      // Auto-dismiss after 2.5s
      const timer = setTimeout(onDismiss, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const coin = getCoinForValue(tileValue);
  const rotate = rotateAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] });

  const formatValue = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: opacAnim }]}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }, { rotate }] }]}>
          <Text style={styles.congrats}>NEW COIN!</Text>
          <View style={[styles.coinBadge, { backgroundColor: coin.bg, borderColor: coin.color }]}>
            <Text style={styles.coinEmoji}>{coin.emoji}</Text>
          </View>
          <Text style={[styles.coinName, { color: coin.color }]}>{coin.symbol}</Text>
          <Text style={styles.coinValue}>{formatValue(tileValue)}</Text>
          <Text style={styles.message}>Amazing! You unlocked {coin.symbol}! 🎉</Text>
          <Pressable style={[styles.continueBtn, { backgroundColor: coin.color }]} onPress={onDismiss}>
            <Text style={styles.continueBtnText}>Keep Going!</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
  },
  congrats: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 3,
    marginBottom: Spacing.md,
  },
  coinBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: Spacing.sm,
  },
  coinEmoji: { fontSize: 36 },
  coinName: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  coinValue: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  message: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  continueBtn: {
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    minWidth: 140,
  },
  continueBtnText: { ...Typography.bodyBold, color: '#fff' },
});
