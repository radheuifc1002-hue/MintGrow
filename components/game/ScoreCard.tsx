import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography, Spacing } from '@/constants/theme';

interface Props {
  label: string;
  value: string | number;
  accent?: boolean;
  small?: boolean;
}

export function ScoreCard({ label, value, accent, small }: Props) {
  return (
    <View style={[styles.card, accent && styles.accentCard, small && styles.smallCard]}>
      <Text style={[styles.label, small && styles.smallLabel]}>{label}</Text>
      <Text style={[styles.value, accent && styles.accentValue, small && styles.smallValue]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accentCard: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  smallCard: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 60,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  smallLabel: {
    fontSize: 9,
  },
  value: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
    fontSize: 18,
  },
  accentValue: {
    color: Colors.primary,
  },
  smallValue: {
    fontSize: 14,
  },
});
