/**
 * ScreenContainer — Standardized root wrapper for all screens.
 * Handles safe area, background color, and optional scroll.
 */
import React, { memo } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../design/theme-system';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Enable ScrollView wrapping. Default: false (static layout) */
  scroll?: boolean;
  /** Safe area edges to respect. Default: all edges */
  edges?: Edge[];
  /** Horizontal content padding. Default: spacing[4] (16px) */
  padded?: boolean;
  /** Pull-to-refresh handler */
  onRefresh?: () => void;
  /** Whether refresh control is active */
  refreshing?: boolean;
  /** Additional style on the outer container */
  style?: StyleProp<ViewStyle>;
  /** Additional style on the scroll content */
  contentStyle?: StyleProp<ViewStyle>;
}

export const ScreenContainer = memo(function ScreenContainer({
  children,
  scroll = false,
  edges,
  padded = false,
  onRefresh,
  refreshing = false,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const { theme } = useTheme();

  const bg = { backgroundColor: theme.colors.background };
  const px = padded ? { paddingHorizontal: spacing[4] } : undefined;

  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, bg, style]} edges={edges}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, px, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, bg, style]} edges={edges}>
      <View style={[styles.inner, px, contentStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { paddingBottom: spacing[25] },
});
