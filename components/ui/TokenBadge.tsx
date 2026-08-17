import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
}

export function TokenBadge({ amount, size = 'md' }: Props) {
  const sizes = {
    sm: { padding: 4, fontSize: 11, icon: 12 },
    md: { padding: 8, fontSize: 14, icon: 16 },
    lg: { padding: 12, fontSize: 18, icon: 20 },
  };
  const s = sizes[size];

  return (
    <View style={[styles.badge, { paddingHorizontal: s.padding + 4, paddingVertical: s.padding }]}>
      <Text style={{ fontSize: s.icon }}>🌿</Text>
      <Text style={[styles.amount, { fontSize: s.fontSize }]}>
        {amount >= 1000 ? `${(amount / 1000).toFixed(1)}K` : amount.toFixed(1)}
      </Text>
      <Text style={[styles.unit, { fontSize: s.fontSize - 2 }]}>MG</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 4,
  },
  amount: { fontWeight: '700', color: Colors.primary },
  unit: { fontWeight: '600', color: Colors.primaryDark },
});
