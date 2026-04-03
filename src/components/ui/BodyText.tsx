/**
 * BodyText — Standard paragraph/body text component.
 * Wraps ThemedText with consistent body styling.
 */
import React, { memo } from 'react';
import type { TextProps, StyleProp, TextStyle } from 'react-native';
import ThemedText from '../ThemedText';

type BodySize = 'default' | 'small';
type BodyColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'error';

interface BodyTextProps extends Omit<TextProps, 'style'> {
  children: React.ReactNode;
  /** Size variant. Default: 'default' (body) */
  size?: BodySize;
  /** Text color. Default: 'secondary' */
  color?: BodyColor;
  style?: StyleProp<TextStyle>;
}

const sizeVariant = { default: 'body', small: 'bodySmall' } as const;

export const BodyText = memo(function BodyText({
  children,
  size = 'default',
  color = 'secondary',
  style,
  ...rest
}: BodyTextProps) {
  return (
    <ThemedText variant={sizeVariant[size]} color={color} style={style} {...rest}>
      {children}
    </ThemedText>
  );
});
