/**
 * FitQuest Paywall Screen
 * 
 * Premium subscription paywall with Figma-inspired dark aesthetic.
 * Shows feature highlights, plan selection (monthly vs annual),
 * and handles purchase flow.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useSubscription } from '../src/purchases/SubscriptionContext';
import {
  GlassCard,
  GradientButton,
} from '../src/components/ui/GlassUI';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Feature list ──
const FEATURES = [
  { icon: 'lightning-bolt' as const, title: 'AI Workout Generation', desc: 'Unlimited smart workouts tailored to you' },
  { icon: 'book-open-variant' as const, title: 'FitMind Library', desc: 'Import unlimited documents & flashcards' },
  { icon: 'heart-pulse' as const, title: 'Health Monitoring', desc: '24/7 anomaly detection & sleep analysis' },
  { icon: 'chart-areaspline' as const, title: 'Advanced Analytics', desc: 'Detailed trends, insights & predictions' },
  { icon: 'shield-lock' as const, title: 'Encrypted & Private', desc: 'Military-grade encryption, always on-device' },
  { icon: 'sync' as const, title: 'Cloud Backup', desc: 'Secure encrypted backup & restore' },
];

export default function PaywallScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { 
    trialDaysRemaining, 
    offerings,
    purchaseMonthly,
    purchaseAnnual,
    restorePurchases,
    hasAccess,
    isLoading: subLoading,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);

  // If user already has access, go back
  useEffect(() => {
    if (hasAccess && !subLoading) {
      // Already subscribed — don't show paywall
    }
  }, [hasAccess, subLoading]);

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      const success = selectedPlan === 'monthly'
        ? await purchaseMonthly()
        : await purchaseAnnual();
      
      if (success) {
        router.back();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const state = await restorePurchases();
      if (state.status === 'ACTIVE' || state.status === 'TRIAL') {
        router.back();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const isDark = theme.isDark;
  const accentColor = '#CCFF00'; // Figma-inspired lime accent

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0A0E17' : '#F4F5F7' }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Close Button ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="close" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Hero Header ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(150)} style={styles.hero}>
          <LinearGradient
            colors={[accentColor + '20', 'transparent']}
            style={styles.heroGlow}
          />
          <View style={[styles.logoWrap, { backgroundColor: accentColor + '15' }]}>
            <MaterialCommunityIcons name="lightning-bolt" size={40} color={accentColor} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
            Unlock Full{'\n'}FitQuest
          </Text>
          <Text style={[styles.heroSub, { color: theme.colors.textMuted }]}>
            {trialDaysRemaining > 0
              ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left in your free trial`
              : 'Your trial has ended'}
          </Text>
        </Animated.View>

        {/* ── Features Grid ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(150)}>
          <View style={styles.featureGrid}>
            {FEATURES.map((feat, i) => (
              <Animated.View
                key={feat.title}
                entering={FadeInUp.delay(250 + i * 60).duration(150)}
                style={[styles.featureItem, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }]}
              >
                <View style={[styles.featureIcon, { backgroundColor: accentColor + '12' }]}>
                  <MaterialCommunityIcons name={feat.icon} size={20} color={accentColor} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                    {feat.title}
                  </Text>
                  <Text style={[styles.featureDesc, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {feat.desc}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* ── Plan Selection ── */}
        <Animated.View entering={FadeInDown.delay(500).duration(150)} style={styles.planSection}>
          <Text style={[styles.planSectionTitle, { color: theme.colors.text }]}>
            Choose Your Plan
          </Text>

          {/* Annual Plan */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedPlan('annual')}
            style={[
              styles.planCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                borderColor: selectedPlan === 'annual' ? accentColor : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                borderWidth: selectedPlan === 'annual' ? 2 : 1,
              },
            ]}
          >
            {/* Best Value badge */}
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={styles.badgeText}>BEST VALUE</Text>
            </View>

            <View style={styles.planRow}>
              <View style={styles.planInfo}>
                <Text style={[styles.planName, { color: theme.colors.text }]}>Annual</Text>
                <Text style={[styles.planDetail, { color: theme.colors.textMuted }]}>
                  {offerings.annual?.pricePerMonth ?? '$6.67'}/month
                </Text>
              </View>
              <View style={styles.planPriceWrap}>
                <Text style={[styles.planPrice, { color: theme.colors.text }]}>
                  {offerings.annual?.price ?? '$79.99'}
                </Text>
                <Text style={[styles.planPeriod, { color: theme.colors.textMuted }]}>/year</Text>
              </View>
              <View style={[styles.radio, {
                borderColor: selectedPlan === 'annual' ? accentColor : theme.colors.textMuted,
              }]}>
                {selectedPlan === 'annual' && (
                  <Animated.View entering={ZoomIn.duration(150)} style={[styles.radioInner, { backgroundColor: accentColor }]} />
                )}
              </View>
            </View>

            <View style={[styles.saveBadge, { backgroundColor: accentColor + '15' }]}>
              <Text style={[styles.saveText, { color: accentColor }]}>Save 33%</Text>
            </View>
          </TouchableOpacity>

          {/* Monthly Plan */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedPlan('monthly')}
            style={[
              styles.planCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                borderColor: selectedPlan === 'monthly' ? accentColor : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                borderWidth: selectedPlan === 'monthly' ? 2 : 1,
              },
            ]}
          >
            <View style={styles.planRow}>
              <View style={styles.planInfo}>
                <Text style={[styles.planName, { color: theme.colors.text }]}>Monthly</Text>
                <Text style={[styles.planDetail, { color: theme.colors.textMuted }]}>
                  Flexible billing
                </Text>
              </View>
              <View style={styles.planPriceWrap}>
                <Text style={[styles.planPrice, { color: theme.colors.text }]}>
                  {offerings.monthly?.price ?? '$9.99'}
                </Text>
                <Text style={[styles.planPeriod, { color: theme.colors.textMuted }]}>/month</Text>
              </View>
              <View style={[styles.radio, {
                borderColor: selectedPlan === 'monthly' ? accentColor : theme.colors.textMuted,
              }]}>
                {selectedPlan === 'monthly' && (
                  <Animated.View entering={ZoomIn.duration(150)} style={[styles.radioInner, { backgroundColor: accentColor }]} />
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
            style={[styles.ctaBtn, { backgroundColor: accentColor, opacity: purchasing ? 0.6 : 1 }]}
          >
            {purchasing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.ctaText}>
                {trialDaysRemaining > 0 ? 'Start Subscription' : 'Continue with Full Access'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.terms, { color: theme.colors.textMuted }]}>
            Cancel anytime. No refunds for partial periods.
          </Text>

          {/* Restore Purchases */}
          <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={[styles.restoreText, { color: theme.colors.textSecondary }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // Hero
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 24, marginBottom: 8 },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: SCREEN_W * 0.2,
    right: SCREEN_W * 0.2,
    height: 120,
    borderRadius: 60,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },

  // Features
  featureGrid: { paddingHorizontal: 16, gap: 8, marginBottom: 24 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700' },
  featureDesc: { fontSize: 12, marginTop: 2 },

  // Plans
  planSection: { paddingHorizontal: 16, marginBottom: 16 },
  planSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  planCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  badgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planInfo: { flex: 1 },
  planName: { fontSize: 18, fontWeight: '800', textTransform: 'uppercase' },
  planDetail: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  planPriceWrap: { alignItems: 'flex-end', marginRight: 14 },
  planPrice: { fontSize: 22, fontWeight: '900' },
  planPeriod: { fontSize: 11, fontWeight: '500' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  saveBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 10,
  },
  saveText: { fontSize: 12, fontWeight: '800' },

  // CTA
  ctaSection: { paddingHorizontal: 16, alignItems: 'center' },
  ctaBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  terms: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  restoreBtn: { marginTop: 16, padding: 8 },
  restoreText: { fontSize: 13, fontWeight: '600' },
});
