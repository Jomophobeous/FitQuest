/**
 * Title — Semantic heading component with predefined variants.
 * Wraps ThemedText with enforced heading hierarchy.
 */
import React, { memo } from 'react';
import type { TextProps } from 'react-native';
import ThemedText from '../ThemedText';
import type { StyleProp, TextStyle } from 'react-native';

type TitleLevel = 'h1' | 'h2' | 'h3';
type TitleColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'error';

interface TitleProps extends Omit<TextProps, 'style'> {
  children: React.ReactNode;
  /** Heading level. Default: 'h2' */
  level?: TitleLevel;
  /** Text color. Default: 'primary' */
  color?: TitleColor;
  style?: StyleProp<TextStyle>;
}

export const Title = memo(function Title({ children, level = 'h2', color = 'primary', style, ...rest }: TitleProps) {
  return (
    <ThemedText variant={level} color={color} style={style} {...rest}>
      {children}
    </ThemedText>
  );
});
