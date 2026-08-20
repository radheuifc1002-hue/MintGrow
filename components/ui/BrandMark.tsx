import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface Props {
  size?: number;
}

export function BrandMark({ size = 40 }: Props) {
  const radius = Math.round(size * 0.28);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: radius }]}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={100}
        onError={() => {/* fallback handled below */}}
      />
    </View>
  );
}

function BrandMarkFallback({ size = 40 }: Props) {
  const radius = Math.round(size * 0.28);
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
      <MaterialIcons name="spa" size={Math.round(size * 0.56)} color="#06251A" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#1DE89B',
  },
  fallback: {
    backgroundColor: '#1DE89B',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
