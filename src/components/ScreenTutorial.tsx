/**
 * ScreenTutorial — First-visit popup that explains what a screen does.
 * Dismisses with "Got it" and stores dismissal in app_state so it
 * only shows once per screen.
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getAppState, setAppState } from '../database/service';

interface ScreenTutorialProps {
  /** Unique key for this screen (e.g. 'dashboard', 'exercises') */
  screenKey: string;
  /** Icon name from MaterialCommunityIcons */
  icon: string;
  /** Title of the tutorial popup */
  title: string;
  /** Description of what the screen does */
  description: string;
}

export default function ScreenTutorial({ screenKey, icon, title, description }: ScreenTutorialProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dismissed = await getAppState(`tutorial.dismissed.${screenKey}`);
        if (!cancelled && dismissed !== 'true') {
          setVisible(true);
        }
      } catch {
        // DB not ready yet — don't show tutorial
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screenKey]);

  const dismiss = async () => {
    setVisible(false);
    try {
      await setAppState(`tutorial.dismissed.${screenKey}`, 'true');
    } catch {
      // Best-effort persistence
    }
  };

  if (!visible) return null;

  const colors = theme.colors;
  const isDark = theme.isDark;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={dismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}20` }]}>
            <MaterialCommunityIcons name={icon as any} size={32} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
          <TouchableOpacity onPress={dismiss} style={[styles.button, { backgroundColor: colors.accent }]}>
            <Text style={[styles.buttonText, { color: colors.onAccent }]}>{t('common.gotIt') || 'Got it'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
