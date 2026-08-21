import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

interface Props { label: string; value: string; accent?: boolean; }
export function ScoreCard({ label, value, accent }: Props) {
  return <View style={[styles.card, accent && styles.accentCard]}><Text style={[styles.value, accent && styles.accentValue]}>{value}</Text><Text style={styles.label}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 11, paddingHorizontal: 5, alignItems: 'center', borderWidth: 1.5, borderColor: '#D5E6DB', justifyContent: 'center' },
  accentCard: { borderColor: Colors.primary, backgroundColor: '#DDF5E9' },
  value: { color: '#123D2F', fontSize: 27, lineHeight: 31, fontWeight: '900' },
  accentValue: { color: Colors.primary },
  label: { color: '#8BA99C', marginTop: 3, fontSize: 16, lineHeight: 19, fontWeight: '700' },
});
