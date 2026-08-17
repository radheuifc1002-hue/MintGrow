import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'accent';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function GlowButton({ label, onPress, variant = 'primary', disabled, loading, style, textStyle, fullWidth }: Props) {
  const bgMap = {
    primary: Colors.primary,
    secondary: 'transparent',
    danger: Colors.error,
    accent: Colors.accent,
  };
  const borderMap = {
    primary: Colors.primary,
    secondary: Colors.border,
    danger: Colors.error,
    accent: Colors.accent,
  };
  const textColorMap = {
    primary: Colors.bg,
    secondary: Colors.textSecondary,
    danger: '#fff',
    accent: Colors.bg,
  };

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bgMap[variant],
          borderColor: borderMap[variant],
          opacity: pressed ? 0.75 : disabled ? 0.4 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {loading ? (
        <ActivityIndicator color={textColorMap[variant]} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColorMap[variant] }, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  text: {
    ...Typography.bodyBold,
    letterSpacing: 0.5,
  },
});
