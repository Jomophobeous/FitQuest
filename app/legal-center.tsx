import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import ThemedText from '../src/components/ThemedText';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import { useToast } from '../src/context/ToastContext';
import {
  useLegalCenterViewModel,
  LEGAL_POLICY_VERSION,
  type ConsentRecord,
} from '../src/viewmodels/useLegalCenterViewModel';
import { typography, spacing, radius } from '../src/design/theme-system';

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing[8] },
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 36 },
  title: { fontSize: typography.sizes.h3, fontWeight: '800' },
  summaryCard: { marginHorizontal: spacing[4], marginTop: spacing[2], padding: spacing[4], gap: spacing[2] },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  statusText: { fontSize: typography.sizes.label, lineHeight: 19 },
  linksSection: { paddingHorizontal: spacing[4], marginTop: spacing[2] },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3.5],
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing[2],
    gap: spacing[2.5],
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], flex: 1 },
  linkTitle: { fontSize: typography.sizes.bodySmall, fontWeight: '700' },
  linkSub: { fontSize: typography.sizes.caption, marginTop: spacing[0.5] },
  actionsSection: { paddingHorizontal: spacing[4], marginTop: spacing[2], gap: spacing[2.5] },
  noteCard: { marginHorizontal: spacing[4], marginTop: spacing[2], padding: spacing[3.5], gap: spacing[2] },
  noteText: { fontSize: typography.sizes.caption, lineHeight: 18 },
});

export default function LegalCenterScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { isReady: dbReady } = useDatabase();
  const router = useRouter();
  const vm = useLegalCenterViewModel();

  useEffect(() => {
    if (!dbReady) return;
    vm.triggerReplay();
    void vm.loadConsent();
  }, [dbReady, vm]);

  const openUrl = useCallback(
    async (url: string) => {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          showToast({ message: t('legal.cannotOpenLink'), type: 'error' });
          return;
        }
        await Linking.openURL(url);
      } catch {
        showToast({ message: t('legal.cannotOpenLink'), type: 'error' });
      }
    },
    [t],
  );

  const handleAccept = useCallback(async () => {
    try {
      await vm.acceptPolicies();
      showToast({
        message: `${t('legal.acceptSuccessBody')}`,
        type: 'success',
      });
    } catch (error: any) {
      showToast({ message: error?.message ?? t('legal.acceptFailed'), type: 'error' });
    }
  }, [vm, t]);

  const handleWithdraw = useCallback(async () => {
    try {
      await vm.withdrawConsent();
      showToast({ message: t('legal.withdrawSuccessBody'), type: 'success' });
    } catch (error: any) {
      showToast({ message: error?.message ?? t('legal.withdrawFailed'), type: 'error' });
    }
  }, [vm, t]);

  const consentStatus = vm.consent.timestamp
    ? `${t('legal.acceptedOn')} ${new Date(vm.consent.timestamp).toLocaleString()}\n${t('legal.version')}: ${vm.consent.version || '-'} · ${t(`legal.source.${vm.consent.source || 'local'}`)}`
    : t('legal.notAcceptedYet');

  return (
    <ScreenErrorBoundary screenName="LegalCenter" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <ThemedText style={[styles.title, { color: theme.colors.text }]}>{t('legal.title')}</ThemedText>
            <View style={styles.spacer} />
          </View>

          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.colors.success} />
              <ThemedText variant="body" color="primary">
                {t('legal.consentStatus')}
              </ThemedText>
            </View>
            <ThemedText style={[styles.statusText, { color: theme.colors.textSecondary }]}>{consentStatus}</ThemedText>
            <ThemedText style={[styles.statusText, { color: theme.colors.textMuted }]}>
              {t('legal.currentPolicyVersion')} {LEGAL_POLICY_VERSION}
            </ThemedText>
          </GlassCard>

          <SectionHeader title={t('legal.documents')} delay={100} />
          <View style={styles.linksSection}>
            <TouchableOpacity
              style={[
                styles.linkCard,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={() => router.push('/privacy-policy')}
            >
              <View style={styles.linkLeft}>
                <MaterialCommunityIcons name="file-document-outline" size={18} color={theme.colors.accent} />
                <View>
                  <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>
                    {t('legal.privacyPolicy')}
                  </ThemedText>
                  <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>
                    {t('legal.readInApp')}
                  </ThemedText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.linkCard,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={() => router.push('/terms-of-service')}
            >
              <View style={styles.linkLeft}>
                <MaterialCommunityIcons name="scale-balance" size={18} color={theme.colors.warning} />
                <View>
                  <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>
                    {t('legal.termsOfService')}
                  </ThemedText>
                  <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>
                    {t('legal.readInApp')}
                  </ThemedText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.linkCard,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={() => openUrl(links.privacyPolicyUrl)}
            >
              <View style={styles.linkLeft}>
                <MaterialCommunityIcons name="open-in-new" size={18} color={theme.colors.accent2} />
                <View>
                  <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>
                    {t('legal.privacyPolicyExternal')}
                  </ThemedText>
                  <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>
                    {vm.links.privacyPolicyUrl}
                  </ThemedText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.linkCard,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={() => openUrl(links.termsOfServiceUrl)}
            >
              <View style={styles.linkLeft}>
                <MaterialCommunityIcons name="open-in-new" size={18} color={theme.colors.accent2} />
                <View>
                  <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>
                    {t('legal.termsOfServiceExternal')}
                  </ThemedText>
                  <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>
                    {vm.links.termsOfServiceUrl}
                  </ThemedText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <SectionHeader title={t('legal.actions')} delay={150} />
          <View style={styles.actionsSection}>
            <GradientButton
              title={vm.saving ? t('common.loading') : t('legal.acceptPolicies')}
              icon="check-decagram"
              onPress={() => {
                if (!vm.saving) {
                  void handleAccept();
                }
              }}
              variant="success"
            />
            <GradientButton
              title={t('legal.withdrawConsent')}
              icon="shield-off-outline"
              onPress={() => {
                void handleWithdraw();
              }}
              variant="warning"
            />
          </View>

          <GlassCard style={styles.noteCard}>
            <ThemedText style={[styles.noteText, { color: theme.colors.textSecondary }]}>
              {t('legal.noteMedical')}
            </ThemedText>
            <ThemedText style={[styles.noteText, { color: theme.colors.textMuted }]}>
              {t('legal.noteCounsel')}
            </ThemedText>
          </GlassCard>
        </ScrollView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
