import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import ThemedText from '../src/components/ThemedText';
import { GlassCard } from '../src/components/ui/GlassCard';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { ScreenContainer } from '../src/components/ui/primitives';
import { spacing, radius } from '../src/design/theme-system';
import { useDatabase } from '../src/context/DatabaseContext';

type GlyphMapKey = keyof typeof MaterialCommunityIcons.glyphMap;

// ─── Action Card ───

function ActionCard({
  icon,
  title,
  description,
  onPress,
  loading,
  destructive,
  bgColor,
  accentColor,
}: {
  icon: GlyphMapKey;
  title: string;
  description: string;
  onPress: () => void;
  loading: boolean;
  destructive?: boolean;
  bgColor: string;
  accentColor: string;
}) {
  const { theme } = useTheme();
  const color = destructive ? theme.colors.error : accentColor;

  return (
    <Pressable onPress={loading ? undefined : onPress} style={[styles.actionCard, { opacity: loading ? 0.6 : 1 }]}>
      <GlassCard variant="card" noPadding style={styles.actionCardInner}>
        <View style={styles.actionIcon}>
          {loading ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <MaterialCommunityIcons name={icon} size={28} color={color} />
          )}
        </View>
        <View style={styles.actionContent}>
          <ThemedText variant="h4" style={destructive ? { color: theme.colors.error } : undefined}>
            {title}
          </ThemedText>
          <ThemedText variant="caption" color="muted" style={styles.actionDesc}>
            {description}
          </ThemedText>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={color} />
      </GlassCard>
    </Pressable>
  );
}

// ─── Main Screen ───

function BackupsContent() {
  const { theme } = useTheme();
  const { userProfile, resetAll } = useDatabase();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      // Try server export if connected, otherwise show local-only message
      const { getApiBaseUrl } = await import('../src/services/apiBaseUrl');
      const baseUrl = getApiBaseUrl();

      if (!baseUrl) {
        Alert.alert(
          'Offline Mode',
          'Data export to server requires backend connectivity. Your data is stored locally on this device in SQLite.',
          [{ text: 'OK' }],
        );
        return;
      }

      const { exportMyUserData } = await import('../src/services/authApi');
      const data = await exportMyUserData();
      Alert.alert(
        'Export Complete',
        `Exported ${data.backups?.length ?? 0} backup(s) and ${data.migrations?.length ?? 0} device migration(s).`,
        [{ text: 'OK' }],
      );
    } catch (error) {
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setExporting(false);
    }
  }, []);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete ALL your data including workouts, progress, health data, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const userId = userProfile?.id ?? 'user_local_001';
              const { deleteAllUserData } = await import('../src/database/service');
              await deleteAllUserData(userId);
              resetAll();
              Alert.alert('Data Deleted', 'All user data has been removed.');
            } catch (error) {
              Alert.alert('Delete Failed', error instanceof Error ? error.message : 'Unknown error');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [userProfile?.id, resetAll]);

  const cardBg = theme.colors.surface;

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(200)} style={styles.header}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={28} color={theme.colors.accent} />
          <ThemedText variant="h2" style={styles.headerTitle}>
            Backup & Restore
          </ThemedText>
        </Animated.View>

        <ThemedText variant="body" color="muted" style={styles.subtitle}>
          Your data is stored locally on this device. Use these tools to manage your data.
        </ThemedText>

        {/* Storage info */}
        <GlassCard variant="card" style={styles.infoCard}>
          <MaterialCommunityIcons name="database" size={20} color={theme.colors.accent} />
          <View style={styles.infoContent}>
            <ThemedText variant="body">Local SQLite Database</ThemedText>
            <ThemedText variant="caption" color="muted">
              All data encrypted on device — Schema v21
            </ThemedText>
          </View>
        </GlassCard>
        <ThemedText variant="h4" color="secondary" style={styles.sectionLabel}>
          Actions
        </ThemedText>

        <ActionCard
          icon="download"
          title="Export Data"
          description="Download your data from the server (requires connection)"
          onPress={handleExport}
          loading={exporting}
          bgColor={cardBg}
          accentColor={theme.colors.accent}
        />

        <ThemedText variant="h4" color="secondary" style={styles.sectionLabel}>
          Danger Zone
        </ThemedText>

        <ActionCard
          icon="delete-forever"
          title="Delete All Data"
          description="Permanently remove all workouts, progress, and settings"
          onPress={handleDeleteAll}
          loading={deleting}
          destructive
          bgColor={cardBg}
          accentColor={theme.colors.accent}
        />

        <View style={styles.spacer} />
      </ScrollView>
    </ScreenContainer>
  );
}

export default function BackupsScreen() {
  return (
    <ScreenErrorBoundary screenName="backups">
      <BackupsContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] },
  headerTitle: { marginLeft: spacing[2] },
  subtitle: { marginBottom: spacing[4] },
  sectionLabel: { marginTop: spacing[4], marginBottom: spacing[2] },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: radius.lg,
    gap: spacing[3],
  },
  infoContent: { flex: 1 },
  actionCard: {
    marginBottom: spacing[2],
  },
  actionCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
  },
  actionIcon: { width: 40, alignItems: 'center' },
  actionContent: { flex: 1, marginLeft: spacing[2] },
  actionDesc: { marginTop: spacing[0.5] },
  spacer: { height: spacing[12] },
});
