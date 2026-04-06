import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import { GlassCard } from '../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { typography, spacing, radius } from '../src/design/theme-system';

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing[20] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 48 },
  title: { fontSize: typography.sizes.h3, fontWeight: '800' },
  card: { marginHorizontal: spacing[4], marginTop: spacing[2], padding: spacing[4], gap: spacing[2.5] },
  sectionTitle: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },
  paragraph: { fontSize: typography.sizes.label, lineHeight: 20 },
  bullet: { fontSize: typography.sizes.label, lineHeight: 20, marginLeft: spacing[2] },
});

export default function TermsOfServiceScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <ScreenErrorBoundary screenName="TermsOfService" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <ThemedText style={[styles.title, { color: theme.colors.text }]}>{t('legal.termsOfService')}</ThemedText>
            <View style={styles.spacer} />
          </View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <GlassCard style={styles.card}>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textMuted }]}>
                {t('legal.lastUpdated')} 2026-03-13
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('legal.terms.sections.useTitle')}
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                {t('legal.terms.sections.useBody')}
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('legal.terms.sections.medicalTitle')}
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                {t('legal.terms.sections.medicalBody')}
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('legal.terms.sections.subscriptionTitle')}
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                {t('legal.terms.sections.subscriptionBody')}
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('legal.terms.sections.ipTitle')}
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                {t('legal.terms.sections.ipBody')}
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('legal.terms.sections.liabilityTitle')}
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                {t('legal.terms.sections.liabilityBody')}
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('legal.terms.sections.terminationTitle')}
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                {t('legal.terms.sections.terminationBody')}
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('legal.terms.sections.governingLawTitle')}
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                {t('legal.terms.sections.governingLawBody')}
              </ThemedText>

              <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
                • {t('legal.terms.bullets.compliance')}
              </ThemedText>
              <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
                • {t('legal.terms.bullets.accountDelete')}
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Disclaimer of Warranties
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either
                express or implied, including but not limited to implied warranties of merchantability, fitness for a
                particular purpose, and non-infringement.
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                No Fitness or Medical Guarantees
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                FitQuest does not guarantee any specific fitness outcomes, health improvements, or physical results.
                Workout recommendations, health scores, and recovery assessments are algorithmic estimates and should
                not be treated as medical or professional fitness advice. Always consult a qualified healthcare provider
                before starting any exercise program.
              </ThemedText>

              <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Analytics & Data Processing
              </ThemedText>
              <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
                By using FitQuest, you acknowledge that anonymized usage analytics may be collected to improve the
                service. You may opt out of non-essential analytics at any time via Profile → Privacy & Legal → Usage
                Analytics. Behavioral personalization (consistency scoring, engagement tracking) is computed entirely on
                your device and is not transmitted to external servers at any point.
              </ThemedText>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
