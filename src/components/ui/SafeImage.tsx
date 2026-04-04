/**
 * SafeImage — Image component with error handling and placeholder fallback.
 *
 * Prevents broken image UI:
 * - Shows themed placeholder on load error
 * - Handles null/undefined source gracefully
 * - Accessible alt text via accessibilityLabel
 *
 * Usage:
 *   <SafeImage source={{ uri: photo.uri }} style={styles.photo} fallbackIcon="image-off" />
 */

import React, { useState, useCallback } from 'react';
import {
  Image,
  View,
  type ImageProps,
  type StyleProp,
  type ImageStyle,
  type ViewStyle,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface SafeImageProps extends Omit<ImageProps, 'source' | 'style'> {
  /** Image source — handles null/undefined gracefully */
  source: ImageProps['source'] | null | undefined;
  /** Icon shown when image fails to load (default: 'image-off') */
  fallbackIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Style applied to both image and fallback container */
  style?: StyleProp<ImageStyle> | StyleProp<ViewStyle>;
}

export default React.memo(function SafeImage({ source, fallbackIcon = 'image-off', style, ...props }: SafeImageProps) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => setFailed(true), []);

  // No source or failed load → show placeholder
  if (!source || failed) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }, style as StyleProp<ViewStyle>]}
      >
        <MaterialCommunityIcons name={fallbackIcon} size={24} color={theme.colors.textMuted} />
      </View>
    );
  }

  return <Image source={source} onError={handleError} style={style as StyleProp<ImageStyle>} {...props} />;
});

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
