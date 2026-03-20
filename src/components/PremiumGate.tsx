/**
 * PremiumGate — wraps premium screens with subscription check.
 * Shows upgrade prompt if user has no access (trial expired, no subscription).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../purchases/SubscriptionContext';
import { GradientButton } from './ui/GlassUI';

interface PremiumGateProps {
  children: React.ReactNode;
  /** Feature name shown on the upgrade screen */
  featureName: string;
}

export default function PremiumGate({ children, featureName }: PremiumGateProps) {
  const { hasAccess, state, isLoading } = useSubscription();
  const { theme } = useTheme();
  const router = useRouter();

  // Don't block access while subscription state is still loading
  if (isLoading || hasAccess) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent + '15' }]}>
        <MaterialCommunityIcons name="lock-outline" size={48} color={theme.colors.accent} />
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>
        Premium Feature
      </Text>

      <Text style={[styles.feature, { color: theme.colors.accent }]}>
        {featureName}
      </Text>

      <Text style={[styles.desc, { color: theme.colors.textMuted }]}>
        {state.status === 'EXPIRED'
          ? 'Your trial has ended. Upgrade to continue using this feature.'
          : 'This feature requires a FitQuest subscription.'}
      </Text>

      <View style={styles.cta}>
        <GradientButton
          title="Upgrade Now"
          variant="primary"
          size="lg"
          onPress={() => router.push('/paywall')}
        />
      </View>

      <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
        Start with a free 14-day trial
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  feature: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  desc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  cta: {
    width: '100%',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
  },
});
