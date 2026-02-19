/**
 * Medical Disclaimer Component
 *
 * Shows a persistent but dismissible medical disclaimer banner on
 * health-related screens. Uses app_state to track acknowledgment.
 *
 * Usage:
 *   <MedicalDisclaimer screen="health-dashboard" />
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ThemedText from './ThemedText';
import { getAppState, setAppState } from '../database/service';

const DISCLAIMER_STATE_KEY = 'medical.disclaimer.acknowledged';

interface MedicalDisclaimerProps {
  /** Identifier for the screen showing the disclaimer */
  screen: string;
  /** Compact mode shows just icon + one line */
  compact?: boolean;
}

export default function MedicalDisclaimer({ screen, compact = false }: MedicalDisclaimerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    checkAcknowledged();
  }, [screen]);

  const checkAcknowledged = useCallback(async () => {
    try {
      const key = `${DISCLAIMER_STATE_KEY}.${screen}`;
      const value = await getAppState(key);
      // Show disclaimer if not acknowledged or acknowledged more than 30 days ago
      if (value) {
        const ackTime = parseInt(value, 10);
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        setDismissed(Date.now() - ackTime < thirtyDaysMs);
      } else {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    } finally {
      setLoaded(true);
    }
  }, [screen]);

  const handleAcknowledge = useCallback(async () => {
    setDismissed(true);
    try {
      const key = `${DISCLAIMER_STATE_KEY}.${screen}`;
      await setAppState(key, String(Date.now()));
    } catch {
      // Best-effort persistence
    }
  }, [screen]);

  if (!loaded || dismissed) return null;

  if (compact) {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
        <TouchableOpacity
          onPress={handleAcknowledge}
          style={[styles.compactBanner, { backgroundColor: theme.colors.warning + '12', borderColor: theme.colors.warning + '30' }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={14} color={theme.colors.warning} />
          <ThemedText variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
            {t('legal.noteMedical') || 'Not a substitute for medical advice. Consult a physician before starting any fitness program.'}
          </ThemedText>
          <MaterialCommunityIcons name="close" size={14} color={theme.colors.warning} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <View style={[styles.banner, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '25' }]}>
        <View style={styles.bannerHeader}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.warning + '20' }]}>
            <MaterialCommunityIcons name="stethoscope" size={18} color={theme.colors.warning} />
          </View>
          <ThemedText variant="body" style={{ color: theme.colors.warning, fontWeight: '700', flex: 1 }}>
            {t('legal.terms.sections.medicalTitle') || 'Medical Disclaimer'}
          </ThemedText>
          <TouchableOpacity onPress={handleAcknowledge} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.warning + '80'} />
          </TouchableOpacity>
        </View>
        <ThemedText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 18 }}>
          {t('legal.terms.sections.medicalBody') || 'FitQuest is not a medical service. Always consult a qualified clinician before beginning or changing training or nutrition routines.'}
        </ThemedText>
        <TouchableOpacity
          onPress={handleAcknowledge}
          style={[styles.ackButton, { backgroundColor: theme.colors.warning + '18' }]}
        >
          <ThemedText variant="caption" style={{ color: theme.colors.warning, fontWeight: '600' }}>
            I understand
          </ThemedText>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ackButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  compactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
