/**
 * @deprecated Use `GradientButton` from `src/components/ui/GlassUI.tsx` instead.
 * This component is kept for backward compatibility in style-guide.tsx only.
 * Do NOT use in new code.
 */
import React from 'react';
import { Text, TouchableOpacity, TouchableOpacityProps, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';

interface Props extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export default function Button({ children, variant = 'primary', size = 'md', style, ...props }: Props) {
  const { theme } = useTheme();
  const isDark = theme.isDark;

  const sizeConfig = {
    sm: { padding: theme.spacing[2], fontSize: 13 },
    md: { padding: theme.spacing[3], fontSize: 16 },
    lg: { padding: theme.spacing[4], fontSize: 16 },
  };

  const variantConfig = {
    primary: {
      backgroundColor: theme.colors.accent,
      textColor: theme.colors.background,
      shadow: theme.shadows.md,
    },
    secondary: {
      backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surfaceVariant,
      textColor: theme.colors.accent,
      shadow: theme.shadows.sm,
    },
    ghost: {
      backgroundColor: 'transparent',
      textColor: theme.colors.accent,
      shadow: undefined,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
      textColor: theme.colors.text,
      shadow: undefined,
    },
  };

  const config = variantConfig[variant];
  const sizeStyle = sizeConfig[size];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: config.backgroundColor,
          paddingVertical: sizeStyle.padding,
          paddingHorizontal: theme.spacing[4],
          borderRadius: theme.radius.md,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: variant === 'outline' ? (config as any).borderColor : undefined,
          ...config.shadow,
        },
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
            fontSize: sizeStyle.fontSize,
            fontWeight: '600',
          },
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});
