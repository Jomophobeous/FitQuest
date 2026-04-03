/**
 * FitQuest Paywall Screen
 *
 * Premium subscription paywall with Figma-inspired dark aesthetic.
 * Shows feature highlights, plan selection (monthly vs annual),
 * and handles purchase flow.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useSubscription } from '../src/purchases/SubscriptionContext';
import { useToast } from '../src/context/ToastContext';
import ThemedText from '../src/components/ThemedText';
import { getRegionalPricing } from '../src/utils/regionalPricing';
import { usePaywallViewModel } from '../src/viewmodels/usePaywallViewModel';
import { typography, spacing, radius } from '../src/design/theme-system';


const { width: SCREEN_W } = Dimensions.get('window');

// ── Feature list (built inside component to use t()) ──
const getFeatures = (t: (key: string) => string) => [
  {
    icon: 'lightning-bolt' as const,
    title: t('paywall.features.aiWorkouts'),
    desc: t('paywall.features.aiWorkoutsSub'),
  },
  {
    icon: 'book-open-variant' as const,
    title: t('paywall.features.fitmindLibrary'),
    desc: t('paywall.features.fitmindLibrarySub'),
  },
  {
    icon: 'heart-pulse' as const,
    title: t('paywall.features.healthMonitoring'),
    desc: t('paywall.features.healthMonitoringSub'),
  },
  {
    icon: 'chart-areaspline' as const,
    title: t('paywall.features.analytics'),
    desc: t('paywall.features.analyticsSub'),
  },
  { icon: 'shield-lock' as const, title: t('paywall.features.encrypted'), desc: t('paywall.features.encryptedSub') },
  { icon: 'sync' as const, title: t('paywall.features.cloudBackup'), desc: t('paywall.features.cloudBackupSub') },
];

const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${normalized}${channel}`;
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme'], accentColor: string) => {
  const closeSize = (theme.spacing[8] ?? 32) + (theme.spacing[1] ?? 4);
  const heroGlowHeight = (theme.spacing[10] ?? 40) * 3;
  const heroGlowRadius = heroGlowHeight / 2;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { paddingBottom: theme.spacing[10] },

    closeBtn: {
      position: 'absolute',
      top: theme.spacing[2],
      right: theme.spacing[4],
      width: closeSize,
      height: closeSize,
      borderRadius: closeSize / 2,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
      backgroundColor: withAlpha(theme.colors.text, theme.isDark ? 0.06 : 0.08),
    },

    // Hero
    hero: {
      alignItems: 'center',
      paddingTop: theme.spacing[6],
      paddingBottom: theme.spacing[6],
      marginBottom: theme.spacing[2],
    },
    heroGlow: {
      position: 'absolute',
      top: 0,
      left: SCREEN_W * 0.2,
      right: SCREEN_W * 0.2,
      height: heroGlowHeight,
      borderRadius: heroGlowRadius,
    },
    logoWrap: {
      width: (theme.spacing[10] ?? 40) * 2,
      height: (theme.spacing[10] ?? 40) * 2,
      borderRadius: theme.borderRadius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing[5],
      backgroundColor: withAlpha(accentColor, 0.12),
    },
    heroTitle: {
      fontSize: typography.sizes.h1, 
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: -0.5,
      lineHeight: 38,
      color: theme.colors.text,
    },
    heroSub: {
      fontSize: typography.sizes.bodyMid, 
      fontWeight: '500',
      marginTop: theme.spacing[2],
      textAlign: 'center',
      color: theme.colors.textMuted,
    },

    // Features
    featureGrid: { paddingHorizontal: theme.spacing[4], gap: theme.spacing[2], marginBottom: theme.spacing[6] },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing[4],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      gap: theme.spacing[3],
      backgroundColor: withAlpha(theme.colors.text, theme.isDark ? 0.03 : 0.04),
      borderColor: withAlpha(theme.colors.text, theme.isDark ? 0.06 : 0.08),
    },
    featureIcon: {
      width: theme.spacing[10],
      height: theme.spacing[10],
      borderRadius: theme.borderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: withAlpha(accentColor, 0.12),
    },
    featureText: { flex: 1 },
    featureTitle: { fontSize: typography.sizes.bodySmall, fontWeight: '700', color: theme.colors.text },
    featureDesc: { fontSize: typography.sizes.caption, marginTop: theme.spacing[1], color: theme.colors.textMuted },

    // Plans
    planSection: { paddingHorizontal: theme.spacing[4], marginBottom: theme.spacing[4] },
    planSectionTitle: {
      fontSize: typography.sizes.h3, 
      fontWeight: '800',
      marginBottom: theme.spacing[3],
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: theme.colors.text,
    },
    planCard: {
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing[5],
      marginBottom: theme.spacing[2],
      overflow: 'hidden',
    },
    badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[1],
      borderBottomLeftRadius: theme.borderRadius.md,
      backgroundColor: accentColor,
    },
    badgeText: {
      color: theme.colors.background,
      fontSize: typography.sizes.xs, 
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    planInfo: { flex: 1 },
    planName: { fontSize: typography.sizes.h4, fontWeight: '800', textTransform: 'uppercase', color: theme.colors.text },
    planDetail: { fontSize: typography.sizes.caption, fontWeight: '500', marginTop: theme.spacing[1], color: theme.colors.textMuted },
    planPriceWrap: { alignItems: 'flex-end', marginRight: theme.spacing[3] },
    planPrice: { fontSize: typography.sizes.h3, fontWeight: '900', color: theme.colors.text },
    planPeriod: { fontSize: typography.sizes.captionSm, fontWeight: '500', color: theme.colors.textMuted },
    radio: {
      width: theme.spacing[6],
      height: theme.spacing[6],
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: theme.spacing[3],
      height: theme.spacing[3],
      borderRadius: theme.borderRadius.full,
    },
    saveBadge: {
      marginTop: theme.spacing[3],
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[1],
      borderRadius: theme.borderRadius.full,
      backgroundColor: withAlpha(accentColor, 0.12),
    },
    saveText: { fontSize: typography.sizes.caption, fontWeight: '700', color: accentColor },

    // CTA
    ctaSection: { paddingHorizontal: theme.spacing[4], marginTop: theme.spacing[2] },
    ctaBtn: {
      paddingVertical: theme.spacing[4],
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      backgroundColor: accentColor,
    },
    ctaText: { fontSize: typography.sizes.body, fontWeight: '800', color: theme.colors.background },
    terms: { fontSize: typography.sizes.caption, textAlign: 'center', marginTop: theme.spacing[3], color: theme.colors.textMuted },
    restoreBtn: { alignSelf: 'center', marginTop: theme.spacing[2] },
    restoreText: { fontSize: typography.sizes.label, fontWeight: '600', color: theme.colors.textSecondary },
  });
};

const getPlanCardStyle = (theme: ReturnType<typeof useTheme>['theme'], accentColor: string, selected: boolean) => ({
  backgroundColor: theme.isDark ? withAlpha(theme.colors.text, 0.04) : theme.colors.surface,
  borderColor: selected ? accentColor : withAlpha(theme.colors.text, theme.isDark ? 0.08 : 0.1),
  borderWidth: selected ? 2 : 1,
});

const getRadioStyle = (theme: ReturnType<typeof useTheme>['theme'], accentColor: string, selected: boolean) => ({
  borderColor: selected ? accentColor : theme.colors.textMuted,
});

export default function PaywallScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const {
    state: subscriptionState,
    trialDaysRemaining,
    offerings,
    purchaseMonthly,
    purchaseAnnual,
    restorePurchases,
    accessState,
  } = useSubscription();

  const vm = usePaywallViewModel();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const regionalPricing = useMemo(() => getRegionalPricing(), []);

  // Redirect if user already has full access (paid subscriber)
  useEffect(() => {
    if (accessState === 'SUBSCRIBED') {
      router.replace('/dashboard');
    }
  }, [accessState]);

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      const success = selectedPlan === 'monthly' ? await purchaseMonthly() : await purchaseAnnual();

      if (success) {
        vm.trackPurchase(selectedPlan);
        router.canGoBack() ? router.back() : router.replace('/dashboard');
      }
    } catch (error) {
      showToast({ message: t('paywall.purchaseFailed') || 'Something went wrong. Please try again.', type: 'error' });
      if (__DEV__) console.error('[Paywall] Purchase error:', error);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const state = await restorePurchases();
      if (state.status === 'ACTIVE' || state.status === 'TRIAL') {
        router.canGoBack() ? router.back() : router.replace('/dashboard');
      }
    } catch (error) {
      showToast({ message: t('paywall.restoreFailed') || 'Could not restore purchases. Please try again.', type: 'error' });
      if (__DEV__) console.error('[Paywall] Restore error:', error);
    } finally {
      setPurchasing(false);
    }
  };

  const accentColor = theme.colors.accent;
  const styles = useMemo(() => createStyles(theme, accentColor), [theme, accentColor]);
  const planCardAnnualStyle = useMemo(
    () => getPlanCardStyle(theme, accentColor, selectedPlan === 'annual'),
    [theme, accentColor, selectedPlan],
  );
  const planCardMonthlyStyle = useMemo(
    () => getPlanCardStyle(theme, accentColor, selectedPlan === 'monthly'),
    [theme, accentColor, selectedPlan],
  );
  const annualRadioStyle = useMemo(
    () => getRadioStyle(theme, accentColor, selectedPlan === 'annual'),
    [theme, accentColor, selectedPlan],
  );
  const monthlyRadioStyle = useMemo(
    () => getRadioStyle(theme, accentColor, selectedPlan === 'monthly'),
    [theme, accentColor, selectedPlan],
  );
  const radioInnerStyle = useMemo(() => ({ backgroundColor: accentColor }), [accentColor]);
  const features = useMemo(() => getFeatures(t), [t]);
  const heroGlowColors = useMemo(() => [withAlpha(accentColor, 0.12), 'transparent'] as const, [accentColor]);

  return (
    <ScreenErrorBoundary screenName="Paywall" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── Close Button (hidden when expired — user must subscribe) ── */}
          {accessState !== 'EXPIRED' && (
            <Animated.View entering={FadeIn.duration(150)}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  vm.trackDismiss();
                  router.canGoBack() ? router.back() : router.replace('/dashboard');
                }}
                accessibilityRole="button"
                accessibilityLabel="Close paywall"
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Hero Header ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(150)} style={styles.hero}>
            <LinearGradient colors={heroGlowColors} style={styles.heroGlow} />
            <View style={styles.logoWrap}>
              <MaterialCommunityIcons name="lightning-bolt" size={40} color={accentColor} />
            </View>
            <ThemedText style={styles.heroTitle}>{t('paywall.unlockTitle')}</ThemedText>
            <ThemedText style={styles.heroSub}>
              {accessState === 'TRIAL_ACTIVE'
                ? `${trialDaysRemaining} ${t('paywall.trialDaysLeft')}`
                : accessState === 'SUBSCRIBED'
                  ? ''
                  : t('paywall.trialEnded')}
            </ThemedText>
          </Animated.View>

          {/* ── Features Grid ── */}
          <Animated.View entering={FadeInDown.delay(200).duration(150)}>
            <View style={styles.featureGrid}>
              {features.map((feat, i) => (
                <Animated.View
                  key={feat.title}
                  entering={FadeInUp.delay(250 + i * 60).duration(150)}
                  style={styles.featureItem}
                >
                  <View style={styles.featureIcon}>
                    <MaterialCommunityIcons name={feat.icon} size={20} color={accentColor} />
                  </View>
                  <View style={styles.featureText}>
                    <ThemedText style={styles.featureTitle}>{feat.title}</ThemedText>
                    <ThemedText style={styles.featureDesc} numberOfLines={1}>
                      {feat.desc}
                    </ThemedText>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* ── Plan Selection ── */}
          <Animated.View entering={FadeInDown.delay(500).duration(150)} style={styles.planSection}>
            <ThemedText style={styles.planSectionTitle}>{t('paywall.choosePlan')}</ThemedText>

            {/* Annual Plan */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedPlan('annual')}
              style={[styles.planCard, planCardAnnualStyle]}
              accessibilityRole="radio"
              accessibilityLabel="Annual plan"
              accessibilityState={{ selected: selectedPlan === 'annual' }}
            >
              {/* Best Value badge */}
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{t('paywall.bestValue')}</ThemedText>
              </View>

              <View style={styles.planRow}>
                <View style={styles.planInfo}>
                  <ThemedText style={styles.planName}>{t('paywall.annual')}</ThemedText>
                  <ThemedText style={styles.planDetail}>
                    {offerings.annual?.pricePerMonth ?? regionalPricing.monthlyPerMonth}/month
                  </ThemedText>
                </View>
                <View style={styles.planPriceWrap}>
                  <ThemedText style={styles.planPrice}>{offerings.annual?.price ?? regionalPricing.annual}</ThemedText>
                  <ThemedText style={styles.planPeriod}>{t('paywall.perYear')}</ThemedText>
                </View>
                <View style={[styles.radio, annualRadioStyle]}>
                  {selectedPlan === 'annual' && (
                    <Animated.View entering={ZoomIn.duration(150)} style={[styles.radioInner, radioInnerStyle]} />
                  )}
                </View>
              </View>

              <View style={styles.saveBadge}>
                <ThemedText style={styles.saveText}>{t('paywall.save33')}</ThemedText>
              </View>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedPlan('monthly')}
              style={[styles.planCard, planCardMonthlyStyle]}
              accessibilityRole="radio"
              accessibilityLabel="Monthly plan"
              accessibilityState={{ selected: selectedPlan === 'monthly' }}
            >
              <View style={styles.planRow}>
                <View style={styles.planInfo}>
                  <ThemedText style={styles.planName}>{t('paywall.monthly')}</ThemedText>
                  <ThemedText style={styles.planDetail}>{t('paywall.flexibleBilling')}</ThemedText>
                </View>
                <View style={styles.planPriceWrap}>
                  <ThemedText style={styles.planPrice}>{offerings.monthly?.price ?? regionalPricing.monthly}</ThemedText>
                  <ThemedText style={styles.planPeriod}>{t('paywall.perMonth')}</ThemedText>
                </View>
                <View style={[styles.radio, monthlyRadioStyle]}>
                  {selectedPlan === 'monthly' && (
                    <Animated.View entering={ZoomIn.duration(150)} style={[styles.radioInner, radioInnerStyle]} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── CTA Button ── */}
          <Animated.View entering={FadeInDown.delay(600).duration(150)} style={styles.ctaSection}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleSubscribe}
              disabled={purchasing}
              style={[styles.ctaBtn, purchasing && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Subscribe"
            >
              {purchasing ? (
                <ActivityIndicator color={theme.colors.background} />
              ) : (
                <ThemedText style={styles.ctaText}>
                  {trialDaysRemaining > 0 ? t('paywall.startSubscription') : t('paywall.continueAccess')}
                </ThemedText>
              )}
            </TouchableOpacity>

            <ThemedText style={styles.terms}>{t('paywall.cancelAnytime')}</ThemedText>

            {/* Restore Purchases */}
            <TouchableOpacity
              onPress={handleRestore}
              style={styles.restoreBtn}
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
            >
              <ThemedText style={styles.restoreText}>{t('paywall.restorePurchases')}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
