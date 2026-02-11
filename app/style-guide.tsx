import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import ThemedText from '../src/components/ThemedText';
import Card from '../src/components/Card';
import ThemeToggle from '../src/components/ThemeToggle';
import StatRing from '../src/components/StatRing';
import ProgressBar from '../src/components/ProgressBar';
import Button from '../src/components/Button';

/**
 * Design System Preview / Style Guide
 * 
 * This screen showcases all theme colors, components, and design tokens.
 * Useful for development and design verification.
 * 
 * Toggle between dark and light modes to see the philosophy in action:
 * - Dark: Emotion, immersion, glow effects
 * - Light: Speed, clarity, crisp lines
 */

const ColorBox = ({ label, color, hex }: { label: string; color: string; hex: string }) => (
  <View style={{ marginBottom: 16 }}>
    <View style={[styles.colorBox, { backgroundColor: color }]} />
    <ThemedText variant="label" weight="600" style={{ marginTop: 8 }}>
      {label}
    </ThemedText>
    <ThemedText variant="caption" color="muted">
      {hex}
    </ThemedText>
  </View>
);

export default function StyleGuideScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h1" weight="700">
            Design System
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginTop: 4 }}>
            {theme.isDark ? 'Dark Mode' : 'Light Mode'} • Theme Preview
          </ThemedText>
        </View>

        {/* Theme Toggle */}
        <View style={styles.section}>
          <ThemeToggle />
        </View>

        {/* Color Palette */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            Colors
          </ThemedText>

          <Card variant={theme.isDark ? 'elevated' : 'flat'}>
            <ThemedText variant="h4" weight="600" style={styles.subsectionTitle}>
              Base Colors
            </ThemedText>
            <ColorBox
              label="Background"
              color={theme.colors.background}
              hex={theme.isDark ? '#0A0E17' : '#F4F5F7'}
            />
            <ColorBox
              label="Surface"
              color={theme.colors.surface}
              hex={theme.isDark ? '#121820' : '#FFFFFF'}
            />
            <ColorBox
              label="Surface Variant"
              color={theme.colors.surfaceVariant}
              hex={theme.isDark ? '#1A1F2B' : '#ECEEF2'}
            />
          </Card>

          <Card variant={theme.isDark ? 'elevated' : 'flat'} style={{ marginTop: 16 }}>
            <ThemedText variant="h4" weight="600" style={styles.subsectionTitle}>
              Text Colors
            </ThemedText>
            <ColorBox
              label="Primary Text"
              color={theme.colors.text}
              hex={theme.isDark ? '#F5F7FB' : '#121316'}
            />
            <ColorBox
              label="Secondary Text"
              color={theme.colors.textSecondary}
              hex={theme.isDark ? '#A8B0BD' : '#4B4F58'}
            />
            <ColorBox
              label="Muted Text"
              color={theme.colors.textMuted}
              hex={theme.isDark ? '#6B7280' : '#7A7F89'}
            />
          </Card>

          <Card variant={theme.isDark ? 'elevated' : 'flat'} style={{ marginTop: 16 }}>
            <ThemedText variant="h4" weight="600" style={styles.subsectionTitle}>
              Accent Colors (Consistent Across Modes)
            </ThemedText>
            <ColorBox
              label="Primary Accent"
              color={theme.colors.accent}
              hex="#5F63FF"
            />
            <ColorBox
              label="Energy Accent"
              color={theme.colors.accent2}
              hex="#F4A427"
            />
            <ColorBox
              label="Success Accent"
              color={theme.colors.accent3}
              hex="#10B981"
            />
          </Card>

          <Card variant={theme.isDark ? 'elevated' : 'flat'} style={{ marginTop: 16 }}>
            <ThemedText variant="h4" weight="600" style={styles.subsectionTitle}>
              Semantic Colors
            </ThemedText>
            <ColorBox
              label="Error"
              color={theme.colors.error}
              hex={theme.isDark ? '#FF6B6B' : '#DC2626'}
            />
            <ColorBox
              label="Warning"
              color={theme.colors.warning}
              hex={theme.isDark ? '#FFA500' : '#EA580C'}
            />
            <ColorBox
              label="Border"
              color={theme.colors.border}
              hex={theme.isDark ? '#2A2F3B' : '#DADDE3'}
            />
          </Card>
        </View>

        {/* Typography */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            Typography
          </ThemedText>

          <Card variant={theme.isDark ? 'elevated' : 'flat'}>
            <ThemedText variant="h1" weight="700">
              Heading 1
            </ThemedText>
            <ThemedText variant="caption" color="muted">
              32px • Bold • h1
            </ThemedText>

            <ThemedText variant="h2" weight="700" style={{ marginTop: 16 }}>
              Heading 2
            </ThemedText>
            <ThemedText variant="caption" color="muted">
              24px • Bold • h2
            </ThemedText>

            <ThemedText variant="h3" weight="600" style={{ marginTop: 16 }}>
              Heading 3
            </ThemedText>
            <ThemedText variant="caption" color="muted">
              20px • Semibold • h3
            </ThemedText>

            <ThemedText variant="body" style={{ marginTop: 16 }}>
              Body text (16px • Regular)
            </ThemedText>

            <ThemedText variant="bodySmall" style={{ marginTop: 12 }}>
              Small body text (14px • Regular)
            </ThemedText>

            <ThemedText variant="label" weight="600" style={{ marginTop: 12 }}>
              Label text (13px • Semibold)
            </ThemedText>

            <ThemedText variant="caption" style={{ marginTop: 12 }}>
              Caption text (12px • Regular)
            </ThemedText>
          </Card>
        </View>

        {/* Components */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            Components
          </ThemedText>

          <Card variant={theme.isDark ? 'elevated' : 'flat'}>
            <ThemedText variant="h4" weight="600" style={styles.subsectionTitle}>
              Buttons
            </ThemedText>
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary" style={{ marginTop: 12 }}>
              Secondary Button
            </Button>
            <Button variant="outline" style={{ marginTop: 12 }}>
              Outline Button
            </Button>
            <Button variant="ghost" style={{ marginTop: 12 }}>
              Ghost Button
            </Button>
          </Card>

          <Card variant={theme.isDark ? 'elevated' : 'flat'} style={{ marginTop: 16 }}>
            <ThemedText variant="h4" weight="600" style={styles.subsectionTitle}>
              Progress Rings
            </ThemedText>
            <View style={styles.ringContainer}>
              <View style={styles.ringItem}>
                <StatRing progress={0.65} label="65%" sub="Progress" />
              </View>
              <View style={styles.ringItem}>
                <StatRing progress={0.85} variant="energy" label="540" sub="kcal" />
              </View>
            </View>
          </Card>

          <Card variant={theme.isDark ? 'elevated' : 'flat'} style={{ marginTop: 16 }}>
            <ThemedText variant="h4" weight="600" style={styles.subsectionTitle}>
              Progress Bars
            </ThemedText>
            <ThemedText variant="bodySmall" color="secondary">
              Progress (65%)
            </ThemedText>
            <ProgressBar progress={0.65} variant="progress" />

            <ThemedText variant="bodySmall" color="secondary" style={{ marginTop: 16 }}>
              Energy (85%)
            </ThemedText>
            <ProgressBar progress={0.85} variant="energy" />
          </Card>
        </View>

        {/* Spacing */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            Spacing Scale
          </ThemedText>

          <Card variant={theme.isDark ? 'elevated' : 'flat'}>
            {([1, 2, 3, 4, 5, 6, 8, 10, 12] as const).map((size) => (
              <View key={size} style={{ marginBottom: 12 }}>
                <View
                  style={{
                    height: theme.spacing[size],
                    backgroundColor: theme.colors.accent,
                    borderRadius: theme.radius.sm,
                    marginBottom: 4,
                  }}
                />
                <ThemedText variant="caption" color="muted">
                  spacing[{size}] = {theme.spacing[size]}px
                </ThemedText>
              </View>
            ))}
          </Card>
        </View>

        {/* Border Radius */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            Border Radius
          </ThemedText>

          <Card variant={theme.isDark ? 'elevated' : 'flat'}>
            {Object.entries(theme.radius).map(([key, value]) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <View
                  style={{
                    width: 100,
                    height: 100,
                    backgroundColor: theme.colors.accent,
                    borderRadius: value as number,
                    marginBottom: 8,
                  }}
                />
                <ThemedText variant="caption" weight="600">
                  {key} = {value}px
                </ThemedText>
              </View>
            ))}
          </Card>
        </View>

        {/* Motion */}
        <View style={styles.section}>
          <ThemedText variant="h2" weight="700" style={styles.sectionTitle}>
            Motion / Animation
          </ThemedText>

          <Card variant={theme.isDark ? 'elevated' : 'flat'}>
            <View>
              <ThemedText variant="h4" weight="600">
                Duration
              </ThemedText>
              <ThemedText variant="body" style={{ marginTop: 8 }}>
                Fast: {theme.motion.fast}ms
              </ThemedText>
              <ThemedText variant="body">
                Base: {theme.motion.base}ms
              </ThemedText>
              <ThemedText variant="body">
                Slow: {theme.motion.slow}ms
              </ThemedText>

              <ThemedText variant="h4" weight="600" style={{ marginTop: 16 }}>
                Easing
              </ThemedText>
              <ThemedText variant="body" style={{ marginTop: 8 }}>
                {theme.motion.easing}
              </ThemedText>

              <ThemedText variant="h4" weight="600" style={{ marginTop: 16 }}>
                Philosophy
              </ThemedText>
              <ThemedText
                variant="body"
                color="secondary"
                style={{ marginTop: 8, fontStyle: 'italic' }}
              >
                {theme.isDark
                  ? 'Dark: Longer, dramatic animations for immersion'
                  : 'Light: Short, snappy animations for speed'}
              </ThemedText>
            </View>
          </Card>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            This is a design system preview
          </ThemedText>
          <ThemedText variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 4 }}>
            Toggle theme to see dark/light mode philosophy in action
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  subsectionTitle: {
    marginBottom: 16,
  },
  colorBox: {
    width: '100%',
    height: 80,
    borderRadius: 8,
  },
  ringContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  ringItem: {
    alignItems: 'center',
  },
  footer: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
});
