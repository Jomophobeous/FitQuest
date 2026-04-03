/**
 * Section — Consistent vertical content block with standardized spacing.
 * Wraps a group of related elements with predictable margins.
 */
import React, { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '../../design/theme-system';

type SectionSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const spacingMap: Record<SectionSpacing, number> = {
  none: 0,
  xs: spacing[1],   // 4
  sm: spacing[2],   // 8
  md: spacing[4],   // 16
  lg: spacing[6],   // 24
  xl: spacing[8],   // 32
};

interface SectionProps {
  children: React.ReactNode;
  /** Top margin. Default: 'md' */
  gap?: SectionSpacing;
  /** Horizontal padding. Default: 'md' (16px) */
  px?: SectionSpacing;
  style?: StyleProp<ViewStyle>;
}

export const Section = memo(function Section({
  children,
  gap = 'md',
  px = 'md',
  style,
}: SectionProps) {
  return (
    <View
      style={[
        { marginTop: spacingMap[gap], paddingHorizontal: spacingMap[px] },
        style,
      ]}
    >
      {children}
    </View>
  );
});
