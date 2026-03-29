import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';

import type { TextStyle } from 'react-native';

type Variant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySmall' | 'label' | 'caption';
type Color = 'primary' | 'secondary' | 'muted' | 'error' | 'accent' | 'accent2';
type FontWeight = TextStyle['fontWeight'];

interface ThemedTextProps extends TextProps {
  variant?: Variant;
  color?: Color;
  weight?: FontWeight;
}

export default React.memo(function ThemedText({
  variant = 'body',
  color = 'primary',
  weight,
  style,
  ...props
}: ThemedTextProps) {
  const { theme } = useTheme();

  const variantSizes = {
    h1: theme.typography.sizes.h1,
    h2: theme.typography.sizes.h2,
    h3: theme.typography.sizes.h3,
    h4: theme.typography.sizes.h4,
    body: theme.typography.sizes.body,
    bodySmall: theme.typography.sizes.bodySmall,
    label: theme.typography.sizes.label,
    caption: theme.typography.sizes.caption,
  };

  const colorMap = {
    primary: theme.colors.text,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    error: theme.colors.error,
    accent: theme.colors.accent,
    accent2: theme.colors.accent2,
  };

  // Light mode should have slightly heavier weights
  const variantWeights: Record<Variant, FontWeight> = {
    h1: '700',
    h2: '700',
    h3: '600',
    h4: '600',
    body: '400',
    bodySmall: '400',
    label: theme.isDark ? '500' : '600',
    caption: '400',
  };

  return (
    <Text
      style={[
        {
          fontSize: variantSizes[variant],
          color: colorMap[color],
          fontWeight: weight || variantWeights[variant],
          lineHeight: theme.typography.lineHeights.normal * variantSizes[variant],
        },
        style,
      ]}
      {...props}
    />
  );
});
