/**
 * Account Section for Profile screen
 * Email display, change password, sign out, delete account
 */

import React, { useState, useCallback } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemedText from '../ThemedText';
import { SectionHeader } from '../ui/GlassUI';
import { MenuItem } from './ProfileParts';
import { ChangePasswordModal } from './ChangePasswordModal';
import { typography, spacing } from '../../design/theme-system';

interface AccountSectionProps {
  email?: string;
  onLogout: () => void;
  onDeleteAccount?: () => void;
  delay?: number;
}

export function AccountSection({ email, onLogout, onDeleteAccount, delay = 700 }: AccountSectionProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      t('profile.signOutTitle') || 'Sign Out',
      t('profile.signOutMessage') || 'Are you sure you want to sign out?',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        { text: t('profile.signOut') || 'Sign Out', style: 'destructive', onPress: onLogout },
      ],
    );
  }, [onLogout, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('profile.deleteAccountTitle') || 'Delete Account',
      t('profile.deleteAccountMessage') || 'This action is irreversible. All your data will be permanently deleted.',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('profile.deleteAccount') || 'Delete Account',
          style: 'destructive',
          onPress: onDeleteAccount,
        },
      ],
    );
  }, [onDeleteAccount, t]);

  return (
    <View style={styles.section}>
      <SectionHeader title={t('profile.account') || 'Account'} delay={delay} />

      <MenuItem
        icon="email-outline"
        label={t('profile.email') || 'Email'}
        sublabel={email || 'Not set'}
        color={theme.colors.accent}
        delay={delay + 20}
      />

      <MenuItem
        icon="lock-outline"
        label={t('profile.changePassword') || 'Change Password'}
        sublabel={t('profile.changePasswordSub') || 'Update your account password'}
        color={theme.colors.indigo}
        delay={delay + 40}
        onPress={() => setShowPasswordModal(true)}
      />

      <MenuItem
        icon="logout"
        label={t('profile.signOut') || 'Sign Out'}
        sublabel={t('profile.signOutSub') || 'Log out of your account'}
        color={theme.colors.warning}
        delay={delay + 60}
        onPress={handleSignOut}
      />

      <MenuItem
        icon="alert-circle-outline"
        label={t('profile.deleteAccount') || 'Delete Account'}
        sublabel={t('profile.deleteAccountSub') || 'Permanently remove your account and data'}
        color={theme.colors.error}
        delay={delay + 80}
        onPress={handleDeleteAccount}
      />

      <ChangePasswordModal visible={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
});
