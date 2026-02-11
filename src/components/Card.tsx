import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'flat';
}

export default function Card({ children, variant = 'default', style, ...props }: CardProps) {
  const { theme } = useTheme();
  
  const baseStyle = {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing[4],
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing[4],
  };

  const variantStyle = 
    variant === 'elevated' ? { ...theme.shadows.md } :
    variant === 'flat' ? {
      ...StyleSheet.create({
        flat: {
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
      }).flat
    } : { ...theme.shadows.sm };

  return (
    <View style={[baseStyle, variantStyle, style]} {...props}>
      {children}
    </View>
  );
}
