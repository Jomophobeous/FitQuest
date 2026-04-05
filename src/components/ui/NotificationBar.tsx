/**
 * NotificationBar — Toast notification system
 *
 * Displays auto-dismissing toast messages at the top of screen.
 * Supports success/error/warning/info types with color-coding and icons.
 * Max 2 visible simultaneously. Slide-in from top, fade-out on dismiss.
 *
 * Usage:
 *   import { useNotifications, NotificationProvider } from './NotificationBar';
 *   // Wrap app: <NotificationProvider>...</NotificationProvider>
 *   // In component: const { notify } = useNotifications();
 *   // notify({ message: 'Saved!', type: 'success' });
 */

import React, { createContext, useContext, useCallback, useState, useEffect, memo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../design/theme-system';
import ThemedText from '../ThemedText';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationBarProps {
  /** Notification message */
  message: string;
  /** Visual type */
  type?: NotificationType;
  /** Auto-dismiss duration in ms (default 3000) */
  duration?: number;
  /** Optional action button */
  action?: { label: string; onPress: () => void };
}

interface Notification extends Required<Pick<NotificationBarProps, 'message' | 'type'>> {
  id: string;
  duration: number;
  action?: NotificationBarProps['action'];
}

// ============================================================================
// CONTEXT
// ============================================================================

interface NotificationContextType {
  notify: (props: NotificationBarProps) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

// ============================================================================
// ICON & COLOR MAP
// ============================================================================

const TYPE_CONFIG: Record<
  NotificationType,
  {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    colorKey: 'success' | 'error' | 'warning' | 'info';
  }
> = {
  success: { icon: 'check-circle', colorKey: 'success' },
  error: { icon: 'close-circle', colorKey: 'error' },
  warning: { icon: 'alert-circle', colorKey: 'warning' },
  info: { icon: 'information', colorKey: 'info' },
};

// ============================================================================
// SINGLE TOAST
// ============================================================================

const MAX_VISIBLE = 2;

const Toast = memo(function Toast({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
}) {
  const { theme } = useTheme();
  const config = TYPE_CONFIG[notification.type];
  const color = theme.colors[config.colorKey];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), notification.duration);
    return () => clearTimeout(timer);
  }, [notification.id, notification.duration, onDismiss]);

  return (
    <Animated.View
      entering={SlideInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.toast,
        {
          backgroundColor: theme.isDark ? 'rgba(20,20,24,0.95)' : 'rgba(255,255,255,0.97)',
          borderColor: `${color}50`,
          borderLeftColor: color,
          shadowColor: color,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <MaterialCommunityIcons name={config.icon} size={20} color={color} />
      <ThemedText style={[styles.message, { color: theme.colors.text }]} numberOfLines={2}>
        {notification.message}
      </ThemedText>
      {notification.action && (
        <TouchableOpacity
          onPress={notification.action.onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={notification.action.label}
        >
          <ThemedText style={[styles.actionLabel, { color }]}>{notification.action.label}</ThemedText>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => onDismiss(notification.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <MaterialCommunityIcons name="close" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
});

// ============================================================================
// PROVIDER
// ============================================================================

let notifCounter = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((props: NotificationBarProps) => {
    const id = `notif_${++notifCounter}_${Date.now()}`;
    const notification: Notification = {
      id,
      message: props.message,
      type: props.type ?? 'info',
      duration: props.duration ?? 3000,
      action: props.action,
    };
    setNotifications((prev) => {
      // Keep only MAX_VISIBLE - 1 to make room for new one
      const trimmed = prev.length >= MAX_VISIBLE ? prev.slice(-(MAX_VISIBLE - 1)) : prev;
      return [...trimmed, notification];
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      <View style={[styles.container, { top: insets.top + spacing[2] }]} pointerEvents="box-none">
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} onDismiss={dismiss} />
        ))}
      </View>
    </NotificationContext.Provider>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    zIndex: 9999,
    gap: spacing[2],
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    // Shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default NotificationProvider;
