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
  // App is FREE — all features unlocked unconditionally.
  return <>{children}</>;
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
