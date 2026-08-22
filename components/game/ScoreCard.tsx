import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  label: string;
  value: string;
  accent?: boolean;
}

export function ScoreCard({ label, value, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.accentCard]}>
      <Text style={[styles.value, accent && styles.accentValue]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 52,
    justifyContent: 'center',
  },
  accentCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  value: { ...Typography.bodyBold, color: Colors.textPrimary, fontSize: 15 },
  accentValue: { color: Colors.primary },
  label: { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
});
