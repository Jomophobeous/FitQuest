/**
 * PremiumGate — wraps premium screens with subscription check.
 * Shows upgrade prompt if user has no access (trial expired, no subscription).
 *
 * Enforcement: RevenueCat is the single source of truth. The gate blocks
 * rendering of children until accessState confirms TRIAL_ACTIVE or SUBSCRIBED.
 * RESOLVING → spinner, EXPIRED → upgrade prompt + paywall redirect.
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../purchases/SubscriptionContext';
import { GradientButton } from './ui/GlassUI';
import { logEvent } from '../services/telemetry';
import { tamperEngine } from '../services/security/tamperEngine';
import { typography, spacing } from '../design/theme-system';
import {
  sentinelRecordPremiumAccess,
  sentinelVerifyEngine,
  microCheckStateCoherence,
} from '../services/security/sentinel';

interface PremiumGateProps {
  children: React.ReactNode;
  /** Feature name shown on the upgrade screen */
  featureName: string;
}

export default function PremiumGate({ children, featureName }: PremiumGateProps) {
  const { accessState } = useSubscription();
  const { theme } = useTheme();
  const router = useRouter();

  // RESOLVING — subscription state not yet hydrated, show loading
  if (accessState === 'RESOLVING') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // TRIAL_ACTIVE or SUBSCRIBED — user has access, render children
  if (accessState === 'TRIAL_ACTIVE' || accessState === 'SUBSCRIBED') {
    tamperEngine.updateEntitlementState(true);
    tamperEngine.recordPremiumFeatureUsed();
    sentinelRecordPremiumAccess(true);
    sentinelVerifyEngine(tamperEngine.getHeartbeatCounter());
    microCheckStateCoherence();
    // Phase 16: Entitlement check suggests verification — medium confidence
    tamperEngine.updateVerificationConfidence('medium');
    // Phase 18: Opportunistic bridge verification — server confirms entitlement ground truth
    tamperEngine.requestBridgeVerification();
    return <>{children}</>;
  }

  // EXPIRED — show upgrade prompt
  tamperEngine.updateEntitlementState(false);
  sentinelRecordPremiumAccess(false);
  void logEvent('premium_gate_blocked', { feature: featureName, accessState });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent + '20' }]}>
        <MaterialCommunityIcons name="lock-outline" size={48} color={theme.colors.accent} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>Premium Feature</Text>
      <Text style={[styles.feature, { color: theme.colors.accent }]}>{featureName}</Text>
      <Text style={[styles.desc, { color: theme.colors.textSecondary }]}>
        Your trial has ended. Subscribe to unlock {featureName} and all premium features.
      </Text>
      <View style={styles.cta}>
        <GradientButton title="View Plans" variant="primary" size="lg" onPress={() => router.push('/paywall')} />
      </View>
      <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>Cancel anytime. No commitment required.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: typography.sizes.h3, 
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  feature: {
    fontSize: typography.sizes.body, 
    fontWeight: '600',
    marginBottom: spacing[4],
  },
  desc: {
    fontSize: typography.sizes.bodySmall, 
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing[8],
  },
  cta: {
    width: '100%',
    marginBottom: spacing[4],
  },
  hint: {
    fontSize: typography.sizes.caption, 
  },
});
