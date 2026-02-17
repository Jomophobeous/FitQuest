/**
 * FitQuest FitMind Library — Coming Soon
 *
 * Placeholder for the upcoming API-based AI reading companion.
 * Original implementation preserved in fitmind-library.tsx.bak.
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useTheme } from '../src/context/ThemeContext';
import { GlassCard } from '../src/components/ui/GlassUI';

export default function FitMindLibraryScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
          <MaterialCommunityIcons name="book-open-variant" size={22} color={theme.colors.accent} />
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>FitMind</Text>
        </Animated.View>

        {/* Coming Soon Content */}
        <View style={styles.content}>
          <Animated.View entering={ZoomIn.delay(100).duration(400)} style={styles.iconWrap}>
            <LinearGradient
              colors={[theme.colors.accent + '30', '#3B82F6' + '20', 'transparent'] as [string, string, string]}
              style={styles.iconGlow}
            >
              <LinearGradient
                colors={[theme.colors.accent, '#3B82F6'] as [string, string]}
                style={styles.iconGradient}
              >
                <MaterialCommunityIcons name="brain" size={56} color="#fff" />
              </LinearGradient>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              FitMind
            </Text>
            <Text style={[styles.badge, { backgroundColor: theme.colors.warning + '20', color: theme.colors.warning }]}>
              Coming Soon
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Train your body AND your mind. An AI-powered reading companion is coming:
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400).duration(300)} style={styles.featuresWrap}>
            <GlassCard delay={0}>
              <View style={styles.featuresList}>
                {[
                  { icon: 'book-open-page-variant', text: 'Smart document library', color: '#10B981' },
                  { icon: 'school', text: 'AI Professor reading companion', color: '#8B5CF6' },
                  { icon: 'card-text', text: 'Auto-generated flashcards', color: '#F4A427' },
                  { icon: 'chart-line', text: 'Reading analytics & streaks', color: '#3B82F6' },
                  { icon: 'text-box-search', text: 'Comprehension summaries', color: '#EC4899' },
                  { icon: 'file-document-multiple', text: 'Import from any source', color: '#5F63FF' },
                ].map((feature, i) => (
                  <Animated.View
                    key={feature.text}
                    entering={FadeInDown.delay(500 + i * 60).duration(200)}
                    style={styles.featureRow}
                  >
                    <View style={[styles.featureIcon, { backgroundColor: feature.color + '18' }]}>
                      <MaterialCommunityIcons name={feature.icon as any} size={18} color={feature.color} />
                    </View>
                    <Text style={[styles.featureText, { color: theme.colors.text }]}>
                      {feature.text}
                    </Text>
                  </Animated.View>
                ))}
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(800).duration(300)}>
            <Text style={[styles.footerNote, { color: theme.colors.textMuted }]}>
              Body + Mind = Complete Fitness 🧠
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  iconWrap: { marginBottom: 24 },
  iconGlow: {
    width: 140, height: 140, borderRadius: 70,
    justifyContent: 'center', alignItems: 'center',
  },
  iconGradient: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  title: {
    fontSize: 24, fontWeight: '800', textAlign: 'center',
    marginBottom: 8, letterSpacing: 0.3,
  },
  badge: {
    alignSelf: 'center', fontSize: 12, fontWeight: '700',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12,
    overflow: 'hidden', marginBottom: 16, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14, textAlign: 'center', lineHeight: 21,
    marginBottom: 28, maxWidth: 320,
  },
  featuresWrap: { width: '100%', marginBottom: 20 },
  featuresList: { gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  featureText: { fontSize: 14, fontWeight: '500', flex: 1, letterSpacing: 0.2 },
  footerNote: {
    fontSize: 13, textAlign: 'center', fontWeight: '500',
    letterSpacing: 0.3,
  },
});
