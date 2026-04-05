/**
 * Inline compact pickers for Profile — Language (2×2 grid) and Theme (3-pill row).
 * Replace full-screen modal selectors for low-complexity settings.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeMode } from '../../design/theme-system';
import ThemedText from '../ThemedText';
import { typography, spacing, radius } from '../../design/theme-system';
import { PressableScale } from '../ui/InteractionFeedback';

// ─── Language Pill Grid ──────────────────────────────────

interface LanguagePillGridProps {
  current: string;
  onSelect: (code: string) => void;
  languages: readonly { code: string; name: string; flag: string }[];
}

export const LanguagePillGrid = memo(function LanguagePillGrid({
  current,
  onSelect,
  languages,
}: LanguagePillGridProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.pillGrid}>
      {languages.map((lang) => {
        const isActive = lang.code === current;
        return (
          <PressableScale
            key={lang.code}
            scaleTo={0.95}
            hapticEvent="buttonPress"
            onPress={() => onSelect(lang.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={lang.name}
            style={[
              styles.langPill,
              {
                backgroundColor: isActive ? theme.colors.accent + '20' : theme.colors.surfaceVariant,
                borderColor: isActive ? theme.colors.accent + '50' : theme.colors.border,
              },
            ]}
          >
            <ThemedText style={styles.langFlag}>{lang.flag}</ThemedText>
            <ThemedText
              style={[
                styles.langLabel,
                {
                  color: isActive ? theme.colors.accent : theme.colors.text,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {lang.code.toUpperCase()}
            </ThemedText>
            {isActive && <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.accent} />}
          </PressableScale>
        );
      })}
    </Animated.View>
  );
});

// ─── Theme Pill Row ──────────────────────────────────────

interface ThemePillRowProps {
  current: ThemeMode;
  onSelect: (mode: ThemeMode) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; icon: string; label: string; dots: string[] }[] = [
  { mode: 'dark', icon: 'weather-night', label: 'Charcoal', dots: ['#10B981', '#F4A427', '#050507'] },
  { mode: 'light', icon: 'weather-sunny', label: 'Light', dots: ['#10B981', '#F4A427', '#F5F6F8'] },
  { mode: 'blackGold', icon: 'crown', label: 'Premium', dots: ['#D4AF37', '#10B981', '#0A0A0F'] },
];

export const ThemePillRow = memo(function ThemePillRow({ current, onSelect }: ThemePillRowProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.themeRow}>
      {THEME_OPTIONS.map((opt) => {
        const isActive = opt.mode === current;
        const accentColor = opt.mode === 'blackGold' ? theme.colors.accent3 : theme.colors.accent;
        return (
          <PressableScale
            key={opt.mode}
            scaleTo={0.95}
            hapticEvent="buttonPress"
            onPress={() => onSelect(opt.mode)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${opt.label} theme`}
            style={[
              styles.themePill,
              {
                backgroundColor: isActive ? accentColor + '20' : theme.colors.surfaceVariant,
                borderColor: isActive ? accentColor + '50' : theme.colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={opt.icon as any}
              size={16}
              color={isActive ? accentColor : theme.colors.textMuted}
            />
            <ThemedText
              style={[
                styles.themeLabel,
                {
                  color: isActive ? accentColor : theme.colors.text,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {opt.label}
            </ThemedText>
            <View style={styles.themeDots}>
              {opt.dots.map((dotColor, i) => (
                <View key={i} style={[styles.themeDot, { backgroundColor: dotColor }]} />
              ))}
            </View>
          </PressableScale>
        );
      })}
    </Animated.View>
  );
});

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  // Language grid — 2 columns
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    minWidth: '45%' as any,
    flex: 1,
  },
  langFlag: {
    fontSize: typography.sizes.bodyMid,
  },
  langLabel: {
    fontSize: typography.sizes.bodySmall,
    flex: 1,
  },

  // Theme row — 3 pills
  themeRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  themeLabel: {
    fontSize: typography.sizes.caption,
  },
  themeDots: {
    flexDirection: 'row',
    gap: spacing[0.75],
    marginLeft: spacing[1],
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
