/**
 * Change Password Modal
 * Glass-morphism modal with validation for password change
 */

import React, { useState, useCallback } from 'react';
import { View, Modal, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemedText from '../ThemedText';
import { GlassCard } from '../ui/GlassUI';
import { PressableScale } from '../ui/InteractionFeedback';
import { typography, spacing, radius } from '../../design/theme-system';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const isValid = currentPassword.length >= 1 && newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      // TODO: Wire to auth service when Phase D is complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert('Success', 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [isValid, currentPassword, newPassword, confirmPassword, onClose]);

  const handleClose = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View entering={FadeInDown.duration(250)}>
            <GlassCard style={[styles.modal, { borderColor: theme.colors.border }]}>
              <ThemedText style={[styles.title, { color: theme.colors.text }]}>
                {t('profile.changePassword') || 'Change Password'}
              </ThemedText>

              {/* Current Password */}
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
                  {t('profile.currentPassword') || 'Current Password'}
                </ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    secureTextEntry={!showCurrent}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    accessibilityLabel="Current password"
                  />
                  <Pressable onPress={() => setShowCurrent(!showCurrent)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showCurrent ? 'eye-off' : 'eye'}
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
                  {t('profile.newPassword') || 'New Password'}
                </ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    secureTextEntry={!showNew}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Min 8 characters"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    accessibilityLabel="New password"
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showNew ? 'eye-off' : 'eye'}
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                </View>
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <ThemedText style={[styles.validationText, { color: theme.colors.error }]}>
                    Must be at least 8 characters
                  </ThemedText>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
                  {t('profile.confirmPassword') || 'Confirm Password'}
                </ThemedText>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter new password"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    accessibilityLabel="Confirm new password"
                  />
                </View>
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <ThemedText style={[styles.validationText, { color: theme.colors.error }]}>
                    Passwords do not match
                  </ThemedText>
                )}
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <PressableScale
                  scaleTo={0.97}
                  hapticEvent="buttonPress"
                  onPress={handleClose}
                  style={[styles.button, styles.cancelButton, { borderColor: theme.colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <ThemedText style={[styles.buttonText, { color: theme.colors.textSecondary }]}>
                    {t('common.cancel') || 'Cancel'}
                  </ThemedText>
                </PressableScale>

                <PressableScale
                  scaleTo={0.97}
                  hapticEvent="buttonPress"
                  onPress={handleSubmit}
                  disabled={!isValid || saving}
                  style={[
                    styles.button,
                    styles.primaryButton,
                    {
                      backgroundColor: isValid ? theme.colors.accent : theme.colors.accent + '40',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Update password"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={theme.colors.onAccent} />
                  ) : (
                    <ThemedText style={[styles.buttonText, { color: theme.colors.onAccent }]}>
                      {t('profile.updatePassword') || 'Update Password'}
                    </ThemedText>
                  )}
                </PressableScale>
              </View>
            </GlassCard>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  modal: {
    width: 340,
    maxWidth: '100%',
    padding: spacing[5],
  },
  title: {
    fontSize: typography.sizes.h4,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  fieldContainer: {
    marginBottom: spacing[3.5],
  },
  fieldLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '600',
    marginBottom: spacing[1.5],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.body,
    paddingVertical: spacing[2.5],
  },
  validationText: {
    fontSize: typography.sizes.caption,
    marginTop: spacing[1],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  button: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  primaryButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },
});
