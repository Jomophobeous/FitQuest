/**
 * Profile screen reusable sub-components:
 * - ThemedPickerModal  (option-picker dialog)
 * - MenuItem           (animated settings row)
 * - adaptiveLabel()    (0-2 → human-friendly string)
 */

import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import Animated, { FadeInRight, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemedText from '../ThemedText';
import { typography, spacing, radius } from '../../design/theme-system';
import { MOTION } from '../../design/motion';

// ─── Types ───────────────────────────────────────────────
export interface PickerOption {
  label: string;
  value: string;
}

interface ThemedPickerModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
  destructiveIndex?: number;
}

// ─── ThemedPickerModal ───────────────────────────────────
export function ThemedPickerModal({
  visible,
  title,
  subtitle,
  options,
  onSelect,
  onClose,
  destructiveIndex,
}: ThemedPickerModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={modalStyles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss dialog"
      >
        <Pressable
          style={[
            modalStyles.content,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText style={[modalStyles.title, { color: theme.colors.text }]}>{title}</ThemedText>
          {!!subtitle && (
            <ThemedText style={[modalStyles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</ThemedText>
          )}

          <ScrollView style={modalStyles.optionsList} showsVerticalScrollIndicator={false} bounces={false}>
            {options.map((opt, i) => {
              const isDestructive = destructiveIndex === i;
              return (
                <TouchableOpacity
                  key={`${opt.value}-${i}`}
                  style={[
                    modalStyles.optionItem,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  onPress={() => {
                    onClose();
                    onSelect(opt.value);
                  }}
                >
                  <ThemedText
                    style={[
                      modalStyles.optionText,
                      {
                        color: isDestructive ? theme.colors.error : theme.colors.text,
                        fontWeight: isDestructive ? '600' : '500',
                      },
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[
              modalStyles.cancelBtn,
              {
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <ThemedText style={[modalStyles.cancelText, { color: theme.colors.accent }]}>
              {t('common.cancel')}
            </ThemedText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  content: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    padding: spacing[5],
    borderWidth: 1,
    maxHeight: '80%',
  },
  title: {
    fontSize: typography.sizes.h4,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[1],
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: typography.sizes.label,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  optionsList: {
    gap: spacing[1.5],
    marginBottom: spacing[3],
  },
  optionItem: {
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionText: {
    fontSize: typography.sizes.bodyMid,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: typography.sizes.bodyMid,
    fontWeight: '600',
  },
});

// ─── MenuItem ────────────────────────────────────────────
interface MenuItemProps {
  icon: string;
  label: string;
  sublabel?: string;
  color: string;
  onPress?: () => void;
  delay?: number;
  rightContent?: React.ReactNode;
}

export function MenuItem({ icon, label, sublabel, color, onPress, delay = 0, rightContent }: MenuItemProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(150)}>
      <Animated.View style={animStyle}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          onPressIn={() => {
            scale.value = withTiming(0.97, { duration: MOTION.press });
          }}
          onPressOut={() => {
            scale.value = withTiming(1, { duration: MOTION.press });
          }}
          accessibilityRole="button"
          accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
          style={[
            menuStyles.menuItem,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[menuStyles.menuIconWrap, { backgroundColor: color + '18' }]}>
            <MaterialCommunityIcons name={icon as any} size={18} color={color} />
          </View>
          <View style={menuStyles.menuTextWrap}>
            <ThemedText style={[menuStyles.menuLabel, { color: theme.colors.text }]}>{label}</ThemedText>
            {!!sublabel && (
              <ThemedText numberOfLines={3} style={[menuStyles.menuSublabel, { color: theme.colors.textSecondary }]}>
                {sublabel}
              </ThemedText>
            )}
          </View>
          {rightContent || <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export const menuStyles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing[2.5],
    gap: spacing[3],
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuLabel: {
    fontSize: typography.sizes.bodyMid,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  menuSublabel: {
    fontSize: typography.sizes.label,
    fontWeight: '400',
    marginTop: spacing[1],
    lineHeight: 18,
  },
});

// ─── Helpers ─────────────────────────────────────────────
/** Translate a 0–2 adaptive metric into a user-friendly label */
export function adaptiveLabel(value: number): string {
  if (value <= 0.6) return 'Very Low';
  if (value <= 0.85) return 'Low';
  if (value <= 1.15) return 'Normal';
  if (value <= 1.4) return 'High';
  return 'Very High';
}
