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

export default function TermsOfServiceScreen() {
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
          <ThemedText style={[styles.title, { color: theme.colors.text }]}>{t('legal.termsOfService')}</ThemedText>
          <View style={styles.spacer} />
        </View>

        <GlassCard style={styles.card}>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textMuted }]}>
            {t('legal.lastUpdated')} 2026-02-17
          </ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.terms.sections.useTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.terms.sections.useBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.terms.sections.medicalTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.terms.sections.medicalBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.terms.sections.subscriptionTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.terms.sections.subscriptionBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.terms.sections.liabilityTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.terms.sections.liabilityBody')}</ThemedText>

          <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('legal.terms.sections.governingLawTitle')}</ThemedText>
          <ThemedText style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{t('legal.terms.sections.governingLawBody')}</ThemedText>

          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.terms.bullets.compliance')}</ThemedText>
          <ThemedText style={[styles.bullet, { color: theme.colors.textSecondary }]}>• {t('legal.terms.bullets.accountDelete')}</ThemedText>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
