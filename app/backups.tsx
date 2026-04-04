import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import ThemedText from '../src/components/ThemedText';
import { spacing } from '../src/design/theme-system';

export default function BackupsScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name="cloud-upload-outline" size={64} color={theme.colors.accent} />
      <ThemedText variant="h2" style={styles.title}>
        Backup & Restore
      </ThemedText>
      <ThemedText variant="body" color="muted" style={styles.subtitle}>
        Secure local backups and data export — coming soon.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  title: { marginTop: spacing[4] },
  subtitle: { marginTop: spacing[2], textAlign: 'center' },
});
