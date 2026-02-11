/**
 * FitQuest AI Coach Screen — Coming Soon
 *
 * Placeholder for the upcoming API-based AI Coach.
 * Original rule-based implementation preserved in index.tsx.bak.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useTheme } from '../../src/context/ThemeContext';
import { GlassCard, GradientButton } from '../../src/components/ui/GlassUI';

export default function CoachScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="robot-happy" size={22} color={theme.colors.accent} />
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>AI Coach</Text>
          </View>
          <View style={styles.backBtn} />
        </Animated.View>

        {/* Coming Soon Content */}
        <View style={styles.content}>
          <Animated.View entering={ZoomIn.delay(100).duration(400)} style={styles.iconWrap}>
            <LinearGradient
              colors={[theme.colors.accent + '30', '#8B5CF6' + '20', 'transparent'] as [string, string, string]}
              style={styles.iconGlow}
            >
              <LinearGradient
                colors={[theme.colors.accent, '#8B5CF6'] as [string, string]}
                style={styles.iconGradient}
              >
                <MaterialCommunityIcons name="robot-happy-outline" size={56} color="#fff" />
              </LinearGradient>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              AI Coach
            </Text>
            <Text style={[styles.badge, { backgroundColor: '#F4A427' + '20', color: '#F4A427' }]}>
              Coming Soon
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Your personal fitness coach powered by advanced AI is on the way. Get ready for:
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400).duration(300)} style={styles.featuresWrap}>
            <GlassCard delay={0}>
              <View style={styles.featuresList}>
                {[
                  { icon: 'chat-processing', text: 'Real-time coaching conversations', color: '#10B981' },
                  { icon: 'food-apple', text: 'Personalized nutrition guidance', color: '#F4A427' },
                  { icon: 'arm-flex', text: 'Smart form corrections', color: '#5F63FF' },
                  { icon: 'heart-pulse', text: 'Recovery & injury prevention', color: '#EF4444' },
                  { icon: 'chart-timeline-variant', text: 'Adaptive training plans', color: '#8B5CF6' },
                  { icon: 'brain', text: 'Context-aware fitness insights', color: '#EC4899' },
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

          <Animated.View entering={FadeInUp.delay(800).duration(300)} style={styles.bottomAction}>
            <GradientButton
              title="Back to Dashboard"
              onPress={() => router.back()}
              variant="primary"
              size="lg"
            />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  featuresWrap: { width: '100%', marginBottom: 28 },
  featuresList: { gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  featureText: { fontSize: 14, fontWeight: '500', flex: 1, letterSpacing: 0.2 },
  bottomAction: { width: '100%', paddingHorizontal: 16 },
});
