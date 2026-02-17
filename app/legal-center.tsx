import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import {
  LEGAL_POLICY_VERSION,
  acceptCurrentPolicies,
  getConsentRecord,
  getLegalLinks,
  withdrawConsentLocally,
  type ConsentRecord,
} from '../src/services/legalService';
import { runReplayIfDue } from '../src/services/replayOrchestrator';

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 36 },
  title: { fontSize: 22, fontWeight: '800' },
  summaryCard: { marginHorizontal: 16, marginTop: 8, padding: 16, gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 13, lineHeight: 19 },
  linksSection: { paddingHorizontal: 16, marginTop: 8 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  linkTitle: { fontSize: 14, fontWeight: '700' },
  linkSub: { fontSize: 12, marginTop: 2 },
  actionsSection: { paddingHorizontal: 16, marginTop: 8, gap: 10 },
  noteCard: { marginHorizontal: 16, marginTop: 8, padding: 14, gap: 8 },
  noteText: { fontSize: 12, lineHeight: 18 },
});

export default function LegalCenterScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [consent, setConsent] = useState<ConsentRecord>({ timestamp: null, version: null, source: null });
  const [saving, setSaving] = useState(false);

  const links = getLegalLinks();

  const loadConsent = useCallback(async () => {
    const record = await getConsentRecord();
    setConsent(record);
  }, []);

  useEffect(() => {
    void runReplayIfDue({ reason: 'legal_center_load', cooldownMs: 45 * 1000 });
    void loadConsent();
  }, [loadConsent]);

  const openUrl = useCallback(async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(t('common.error'), t('legal.cannotOpenLink'));
      return;
    }
    await Linking.openURL(url);
  }, [t]);

  const handleAccept = useCallback(async () => {
    setSaving(true);
    try {
      const result = await acceptCurrentPolicies();
      await loadConsent();
      Alert.alert(
        t('legal.acceptSuccessTitle'),
        `${t('legal.acceptSuccessBody')}\n${new Date(result.timestamp).toLocaleString()}\n${t('legal.version')}: ${result.version}`,
      );
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message ?? t('legal.acceptFailed'));
    } finally {
      setSaving(false);
    }
  }, [loadConsent, t]);

  const handleWithdraw = useCallback(async () => {
    try {
      await withdrawConsentLocally();
      await loadConsent();
      Alert.alert(t('legal.withdrawSuccessTitle'), t('legal.withdrawSuccessBody'));
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message ?? t('legal.withdrawFailed'));
    }
  }, [loadConsent, t]);

  const consentStatus = consent.timestamp
    ? `${t('legal.acceptedOn')} ${new Date(consent.timestamp).toLocaleString()}\n${t('legal.version')}: ${consent.version || '-'} · ${t(`legal.source.${consent.source || 'local'}`)}`
    : t('legal.notAcceptedYet');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText style={[styles.title, { color: theme.colors.text }]}>{t('legal.title')}</ThemedText>
          <View style={styles.spacer} />
        </View>

        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.colors.success} />
            <ThemedText variant="body" color="primary">{t('legal.consentStatus')}</ThemedText>
          </View>
          <ThemedText style={[styles.statusText, { color: theme.colors.textSecondary }]}>{consentStatus}</ThemedText>
          <ThemedText style={[styles.statusText, { color: theme.colors.textMuted }]}>
            {t('legal.currentPolicyVersion')} {LEGAL_POLICY_VERSION}
          </ThemedText>
        </GlassCard>

        <SectionHeader title={t('legal.documents')} delay={100} />
        <View style={styles.linksSection}>
          <TouchableOpacity
            style={[styles.linkCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => router.push('/privacy-policy')}
          >
            <View style={styles.linkLeft}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color={theme.colors.accent} />
              <View>
                <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>{t('legal.privacyPolicy')}</ThemedText>
                <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>{t('legal.readInApp')}</ThemedText>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => router.push('/terms-of-service')}
          >
            <View style={styles.linkLeft}>
              <MaterialCommunityIcons name="scale-balance" size={18} color={theme.colors.warning} />
              <View>
                <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>{t('legal.termsOfService')}</ThemedText>
                <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>{t('legal.readInApp')}</ThemedText>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => openUrl(links.privacyPolicyUrl)}
          >
            <View style={styles.linkLeft}>
              <MaterialCommunityIcons name="open-in-new" size={18} color={theme.colors.accent2} />
              <View>
                <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>{t('legal.privacyPolicyExternal')}</ThemedText>
                <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>{links.privacyPolicyUrl}</ThemedText>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => openUrl(links.termsOfServiceUrl)}
          >
            <View style={styles.linkLeft}>
              <MaterialCommunityIcons name="open-in-new" size={18} color={theme.colors.accent2} />
              <View>
                <ThemedText style={[styles.linkTitle, { color: theme.colors.text }]}>{t('legal.termsOfServiceExternal')}</ThemedText>
                <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>{links.termsOfServiceUrl}</ThemedText>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <SectionHeader title={t('legal.actions')} delay={150} />
        <View style={styles.actionsSection}>
          <GradientButton
            title={saving ? t('common.loading') : t('legal.acceptPolicies')}
            icon="check-decagram"
            onPress={() => {
              if (!saving) {
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
    </SafeAreaView>
  );
}
