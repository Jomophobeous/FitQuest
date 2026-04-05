/**
 * LongPressMenu — Context menu bottom sheet triggered by long press.
 *
 * Features:
 * - Haptic tap on long press activation
 * - Bottom sheet slides up from bottom
 * - Velocity-matched dismiss animation
 * - Each action item has haptic on tap
 *
 * Phase 6 implementation.
 */

import React, { useState, useCallback } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ThemedText from '../ThemedText';
import { typography, spacing, radius } from '../../design/theme-system';
import { haptic } from '../../utils/haptics';

export interface ContextMenuItem {
  label: string;
  icon: string;
  color?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface LongPressMenuProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
  title?: string;
  disabled?: boolean;
}

export function LongPressMenu({ children, items, title, disabled = false }: LongPressMenuProps) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => {
    haptic('buttonPress');
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const handleItem = useCallback((item: ContextMenuItem) => {
    haptic(item.destructive ? 'error' : 'buttonPress');
    setVisible(false);
    // Small delay so sheet can animate out before action fires
    setTimeout(item.onPress, 150);
  }, []);

  return (
    <>
      <TouchableOpacity
        onLongPress={disabled ? undefined : open}
        delayLongPress={350}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <TouchableWithoutFeedback onPress={close}>
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(200)}
            style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(180)}
          exiting={SlideOutDown.duration(200)}
          style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
        >
          {title && (
            <View style={styles.titleRow}>
              <ThemedText style={[styles.title, { color: theme.colors.textMuted }]}>{title}</ThemedText>
              <View style={[styles.titleDivider, { backgroundColor: theme.colors.border }]} />
            </View>
          )}

          {items.map((item, i) => (
            <TouchableOpacity
              key={`${item.label}-${i}`}
              onPress={() => handleItem(item)}
              activeOpacity={0.7}
              style={[
                styles.menuItem,
                i < items.length - 1 && styles.menuItemBorder,
                { borderBottomColor: theme.colors.border },
              ]}
            >
              <View
                style={[
                  styles.menuIconWrap,
                  {
                    backgroundColor:
                      (item.destructive ? theme.colors.error : (item.color ?? theme.colors.accent)) + '18',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={20}
                  color={item.destructive ? theme.colors.error : (item.color ?? theme.colors.accent)}
                />
              </View>
              <ThemedText
                style={[styles.menuLabel, { color: item.destructive ? theme.colors.error : theme.colors.text }]}
              >
                {item.label}
              </ThemedText>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={close}
            style={[styles.cancelBtn, { backgroundColor: theme.colors.surfaceVariant }]}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.cancelLabel, { color: theme.colors.textSecondary }]}>Cancel</ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing[8],
    paddingTop: spacing[2],
    paddingHorizontal: spacing[4],
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  titleRow: {
    marginBottom: spacing[2],
  },
  title: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing[2],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  titleDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing[1],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: typography.sizes.body,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: spacing[3],
    paddingVertical: spacing[3.5],
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },
});
