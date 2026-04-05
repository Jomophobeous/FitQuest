import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 36 },
  title: { fontSize: typography.sizes.h3, fontWeight: '800' },
  card: { marginHorizontal: spacing[4], marginTop: spacing[2], padding: spacing[4], gap: spacing[2.5] },
  sectionTitle: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },
  paragraph: { fontSize: typography.sizes.label, lineHeight: 20 },
  bullet: { fontSize: typography.sizes.label, lineHeight: 20, marginLeft: spacing[2] },
});

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <ScreenErrorBoundary screenName="PrivacyPolicy" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <ThemedText style={[styles.title, { color: theme.colors.text }]}>{t('legal.privacyPolicy')}</ThemedText>
            <View style={styles.spacer} />
          </View>

          <GlassCard style={styles.card}>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textMuted }]}>
              {t('legal.lastUpdated')} 2026-03-20
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.accent }]}>
              {t('legal.privacy.sections.developerTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.developerBody')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.dataCollectTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.dataCollectBody')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.health')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.biometric')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.location')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.account')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.usage')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.device')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.photos')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.healthConnect')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.storageTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.storageBody')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.securityTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.securityBody')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.thirdPartyTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.thirdPartyBody')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.thirdPartyAI')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.thirdPartyHealthConnect')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.thirdPartyRevenueCat')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.thirdPartySentry')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.thirdPartyPostHog')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.thirdPartyExpo')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.childrenTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.childrenBody')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.retentionTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.retentionBody')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.rightsTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.rightsBody')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.accessRight')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.deleteRight')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.exportRight')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.correctRight')}
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • {t('legal.privacy.bullets.objectionRight')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.popiaTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.popiaBody')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.updatesTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.updatesBody')}
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Background Health Monitoring
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              FitQuest periodically collects lightweight health metrics (steps, active minutes, heart rate) while the
              app is open to provide accurate readiness scores and training recommendations. This data is:
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • Collected every 1 minute while the app is active for optimal accuracy
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • Stored only on your device using AES-256-GCM encryption
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • Never transmitted to external servers
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • You can disable background collection in Profile → Settings
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>Work Schedule Data</ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              If you optionally provide your work schedule (start/end hours, shift type), this information is used
              solely to optimize workout timing recommendations. Schedule data is stored locally on your device and is
              never shared or transmitted.
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>Analytics & Usage Data</ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              FitQuest collects anonymized usage analytics to improve the app experience. This includes:
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • Screen views, feature usage frequency, and navigation patterns
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • Workout completion rates and session durations (no exercise-level health data)
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • App performance metrics (launch time, error rates)
            </ThemedText>
            <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>
              • Analytics are processed by PostHog (privacy-focused, EU-hosted)
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              You can disable usage analytics at any time in Profile → Privacy & Legal → Usage Analytics. Critical
              events (app crashes and launch diagnostics) are always recorded regardless of this setting to maintain app
              stability.
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Behavioral Personalization
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              FitQuest uses on-device behavioral analysis to personalize your experience. This includes consistency
              scoring, engagement level assessment, and fatigue tracking. All personalization data is computed and
              stored exclusively on your device — it is never uploaded to any server of ours. This analysis drives
              workout recommendations, recovery guidance, and adaptive UI features.
            </ThemedText>

            <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('legal.privacy.sections.contactTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
              {t('legal.privacy.sections.contactBody')}
            </ThemedText>
          </GlassCard>
        </ScrollView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
