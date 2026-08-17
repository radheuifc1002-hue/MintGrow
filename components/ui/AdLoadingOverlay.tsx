import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  visible: boolean;
}

export function AdLoadingOverlay({ visible }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Animated.Text style={[styles.icon, { transform: [{ scale: pulseAnim }] }]}>📺</Animated.Text>
          <Text style={styles.title}>Loading Ad...</Text>
          <Text style={styles.subtitle}>Please watch the full ad{'\n'}to unlock your withdrawal</Text>
          <View style={styles.bar}>
            <Animated.View style={[styles.barFill, { width: '70%' }]} />
          </View>
          <Text style={styles.note}>🔒 Withdrawal unlocks after ad completes</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '88%',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  icon: { fontSize: 52, marginBottom: Spacing.md },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 22 },
  bar: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },
  note: { ...Typography.small, color: Colors.textMuted, textAlign: 'center' },
});
