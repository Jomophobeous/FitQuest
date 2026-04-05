/**
 * ToastContext — Non-blocking toast/snackbar notification system.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ message: 'Backup saved', type: 'success' });
 *
 * Types: 'success' | 'error' | 'warning' | 'info'
 * Auto-dismisses after 3s (configurable). Swipe up to dismiss.
 */

import React, { createContext, useContext, useCallback, useRef, useState, useMemo } from 'react';
import { Text, StyleSheet, Animated as RNAnimated, PanResponder, AccessibilityInfo, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { typography, spacing, radius } from '../design/theme-system';

// ─── Types ──────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number; // ms, default 3000
  vibrate?: boolean; // trigger short vibration for emphasis
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Icon map ───────────────────────────────────────────
const TOAST_ICONS: Record<ToastType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert',
  info: 'information',
};

// ─── Provider ───────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ToastConfig>({ message: '', type: 'info' });

  const translateY = useRef(new RNAnimated.Value(-120)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    RNAnimated.parallel([
      RNAnimated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [translateY, opacity]);

  const showToast = useCallback(
    (c: ToastConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setConfig(c);
      setVisible(true);
      translateY.setValue(-120);
      opacity.setValue(0);

      RNAnimated.parallel([
        RNAnimated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        RNAnimated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      // Announce for screen readers
      AccessibilityInfo.announceForAccessibility(c.message);

      // Vibrate for emphasis when requested
      if (c.vibrate) Vibration.vibrate(80);

      timerRef.current = setTimeout(dismiss, c.duration ?? 3000);
    },
    [translateY, opacity, dismiss],
  );

  // Swipe-up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy < -10,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -20) dismiss();
      },
    }),
  ).current;

  const type = config.type ?? 'info';
  const colorMap: Record<ToastType, string> = {
    success: theme.colors.success,
    error: theme.colors.error,
    warning: theme.colors.warning,
    info: theme.colors.info,
  };
  const accentColor = colorMap[type];

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {visible && (
        <RNAnimated.View
          {...panResponder.panHandlers}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel={config.message}
          style={[
            styles.container,
            {
              top: insets.top + (spacing[2] ?? 8),
              transform: [{ translateY }],
              opacity,
              backgroundColor: theme.isDark ? 'rgba(30,30,40,0.95)' : 'rgba(255,255,255,0.97)',
              borderLeftColor: accentColor,
              shadowColor: accentColor,
            },
          ]}
        >
          <MaterialCommunityIcons name={TOAST_ICONS[type]} size={22} color={accentColor} style={styles.icon} />
          <Text
            style={[
              styles.message,
              {
                color: theme.colors.text,
                fontSize: typography.sizes.body,
              },
            ]}
            numberOfLines={2}
          >
            {config.message}
          </Text>
        </RNAnimated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  icon: {
    marginRight: spacing[3],
  },
  message: {
    flex: 1,
    fontWeight: '500',
  },
});
