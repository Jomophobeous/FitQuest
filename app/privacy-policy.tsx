import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import { GlassCard } from '../src/components/ui/GlassUI';

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
  title: { fontSize: 20, fontWeight: '800' },
  card: { marginHorizontal: 16, marginTop: 8, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  paragraph: { fontSize: 13, lineHeight: 20 },
  bullet: { fontSize: 13, lineHeight: 20, marginLeft: 8 },
});

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

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
          <ThemedText style={[styles.title, { color: theme.colors.text }]}>{t('legal.privacyPolicy')}</ThemedText>
          <View style={styles.spacer} />
        </View>

        <GlassCard style={styles.card}>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textMuted }]}>
            {t('legal.lastUpdated')} 2026-02-17
          </ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.dataCollectTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.dataCollectBody')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.health')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.location')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.account')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.usage')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.device')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.storageTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.storageBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.securityTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.securityBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.thirdPartyTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.thirdPartyBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.childrenTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.childrenBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.retentionTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.retentionBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.rightsTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.rightsBody')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.accessRight')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.deleteRight')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.exportRight')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.privacy.bullets.correctRight')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.updatesTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.updatesBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.privacy.sections.contactTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.privacy.sections.contactBody')}</ThemedText>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
