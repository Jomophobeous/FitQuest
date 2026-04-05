/**
 * CoachActivationModal — First-visit onboarding modal for AI Coach.
 * Shows once ever, stores coach_activated flag in app_state table.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { typography, spacing, radius } from '../../design/theme-system';
import { getAppState, setAppState } from '../../database/service';
import ThemedText from '../ThemedText';
import { GradientButton } from '../ui/GlassUI';
import AnimatedFQLogoMark from '../AnimatedFQLogoMark';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACTIVATION_KEY = 'coach_activated';

interface Props {
  onActivated: () => void;
}

export default function CoachActivationModal({ onActivated }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const val = await getAppState(ACTIVATION_KEY);
        if (!cancelled && val !== '1') {
          setVisible(true);
        }
      } catch {
        // If DB read fails, don't block the user
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGetStarted = useCallback(async () => {
    try {
      await setAppState(ACTIVATION_KEY, '1');
    } catch {
      // Non-critical — modal won't show again after dismiss anyway
    }
    setVisible(false);
    onActivated();
  }, [onActivated]);

  if (!visible) return null;

  const features = [
    {
      icon: 'dumbbell' as const,
      text: t('coach.featureWorkouts') || 'Personalised workout plans tailored to your goals',
    },
    { icon: 'chart-line' as const, text: t('coach.featureProgress') || 'Track progress and get real-time feedback' },
    {
      icon: 'food-apple-outline' as const,
      text: t('coach.featureNutrition') || 'Nutrition tips and recovery guidance',
    },
  ];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleGetStarted}>
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(250)}
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.accent + '4D',
              borderWidth: 1,
            },
          ]}
        >
          {/* Logo */}
          <Animated.View entering={FadeInUp.delay(100).duration(200)} style={styles.logoWrap}>
            <AnimatedFQLogoMark size={56} showGlow={true} />
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInUp.delay(150).duration(200)}>
            <ThemedText variant="h2" weight="700" style={[styles.title, { color: theme.colors.text }]}>
              {t('coach.activationTitle') || 'Meet Your AI Coach'}
            </ThemedText>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInUp.delay(200).duration(200)}>
            <ThemedText variant="body" style={[styles.description, { color: theme.colors.textSecondary }]}>
              {t('coach.activationDesc') ||
                'Your personal fitness coach powered by AI. Ask anything about workouts, nutrition, and recovery.'}
            </ThemedText>
          </Animated.View>

          {/* Feature list */}
          {features.map((feature, idx) => (
            <Animated.View
              key={feature.icon}
              entering={FadeInUp.delay(250 + idx * 50).duration(200)}
              style={styles.featureRow}
            >
              <View style={[styles.featureIcon, { backgroundColor: theme.colors.accent + '18' }]}>
                <MaterialCommunityIcons name={feature.icon} size={18} color={theme.colors.accent} />
              </View>
              <ThemedText variant="bodySmall" style={[styles.featureText, { color: theme.colors.text }]}>
                {feature.text}
              </ThemedText>
            </Animated.View>
          ))}

          {/* CTA */}
          <Animated.View entering={FadeInUp.delay(400).duration(200)} style={styles.ctaWrap}>
            <GradientButton
              title={t('coach.getStarted') || 'Get Started'}
              onPress={handleGetStarted}
              variant="primary"
              style={styles.ctaButton}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.sizes.h2,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  description: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing[4],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    width: '100%',
    marginBottom: spacing[3],
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20,
  },
  ctaWrap: {
    width: '100%',
    marginTop: spacing[4],
  },
  ctaButton: {
    width: '100%',
  },
});
