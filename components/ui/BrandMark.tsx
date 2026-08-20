import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#23F0A7', '#00A86B', '#063B2A']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.26 }]}
    >
      <View style={[styles.inner, { borderRadius: size * 0.2 }]}>
        <Text style={[styles.leaf, { fontSize: size * 0.42 }]}>◆</Text>
        <Text style={[styles.text, { fontSize: size * 0.22 }]}>MG</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mark: {
    padding: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  inner: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  leaf: { color: '#DFFFF0', lineHeight: 28, transform: [{ rotate: '45deg' }] },
  text: { position: 'absolute', color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.4 },
});
