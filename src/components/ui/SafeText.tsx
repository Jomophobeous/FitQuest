/**
 * SafeText — Text wrapper with overflow protection.
 *
 * Extends ThemedText with safe defaults:
 * - Prevents text overflow (numberOfLines + ellipsizeMode)
 * - Handles null/undefined children gracefully
 *
 * Usage:
 *   <SafeText maxLines={2}>{potentiallyLongText}</SafeText>
 *   <SafeText variant="label" maxLines={1}>{title}</SafeText>
 */

import React from 'react';
import { type TextProps } from 'react-native';
import ThemedText from '../ThemedText';

type Variant = 'hero' | 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySmall' | 'label' | 'caption' | 'xs';
type Color = 'primary' | 'secondary' | 'muted' | 'error' | 'accent' | 'accent2';

interface SafeTextProps extends TextProps {
  variant?: Variant;
  color?: Color;
  /** Maximum number of lines before truncation (default: undefined = no limit) */
  maxLines?: number;
  /** Fallback text when children is null/undefined/empty */
  fallback?: string;
  children?: React.ReactNode;
}

export default React.memo(function SafeText({
  maxLines,
  fallback = '',
  children,
  ...props
}: SafeTextProps) {
  const content = children ?? fallback;

  return (
    <ThemedText
      numberOfLines={maxLines}
      ellipsizeMode={maxLines ? 'tail' : undefined}
      {...props}
    >
      {content}
    </ThemedText>
  );
});
