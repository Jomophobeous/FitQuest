/**
 * Spacer — Controlled whitespace between elements.
 * Replaces manual margin/padding hacks with semantic spacing.
 */
import React, { memo } from 'react';
import { View } from 'react-native';
import { spacing } from '../../design/theme-system';

type SpacerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const sizeMap: Record<SpacerSize, number> = {
  xs: spacing[1],   // 4
  sm: spacing[2],   // 8
  md: spacing[4],   // 16
  lg: spacing[6],   // 24
  xl: spacing[8],   // 32
  xxl: spacing[12], // 48
};

interface SpacerProps {
  /** Spacer size. Default: 'md' */
  size?: SpacerSize;
  /** Horizontal spacer (width instead of height). Default: false */
  horizontal?: boolean;
}

export const Spacer = memo(function Spacer({ size = 'md', horizontal = false }: SpacerProps) {
  const dim = sizeMap[size];
  return <View style={horizontal ? { width: dim } : { height: dim }} />;
});
