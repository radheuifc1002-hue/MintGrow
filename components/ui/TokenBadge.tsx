import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface Props {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showPlus?: boolean;
}

export function TokenBadge({ amount, size = 'md', showPlus }: Props) {
  const sizes = {
    sm: { fontSize: 11, padding: 4, paddingH: 8 },
    md: { fontSize: 14, padding: 6, paddingH: 12 },
    lg: { fontSize: 20, padding: 10, paddingH: 18 },
  };
  const s = sizes[size];

  return (
    <View style={[styles.badge, { paddingVertical: s.padding, paddingHorizontal: s.paddingH }]}>
      <Text style={styles.icon}>✦</Text>
      <Text style={[styles.text, { fontSize: s.fontSize }]}>
        {showPlus ? '+' : ''}{amount.toFixed(2)} MG
      </Text>
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
  icon: { color: Colors.primary, fontSize: 10 },
  text: { color: Colors.primary, fontWeight: '700', letterSpacing: 0.5 },
});
