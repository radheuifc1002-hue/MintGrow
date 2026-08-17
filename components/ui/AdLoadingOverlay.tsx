import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  message?: string;
}

export function AdLoadingOverlay({ visible, message = 'Loading your reward...' }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📺</Text>
          <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
          <Text style={styles.title}>Watch & Earn</Text>
          <Text style={styles.msg}>{message}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Powered by Monetag</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: 280,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  emoji: { fontSize: 40, marginBottom: Spacing.sm },
  spinner: { marginBottom: Spacing.md },
  title: { ...Typography.h3, color: Colors.textPrimary, marginBottom: 4 },
  msg: { ...Typography.small, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.md },
  pill: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillText: { ...Typography.caption, color: Colors.textMuted },
});
