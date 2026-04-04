import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { ScreenContainer } from '../../src/components/ui/primitives';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDatabase } from '../../src/context/DatabaseContext';
import { getRecentSessions } from '../../src/database/service';
import { analyzeWorkoutGeneration, type WorkoutGenerationDiagnostics } from '../../src/engines/workoutGenerator';
import ThemedText from '../../src/components/ThemedText';
import { GlassCard, GradientButton, SectionHeader } from '../../src/components/ui/GlassUI';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, radius } from '../../src/design/theme-system';

interface WorkoutSession {
  id: string;
  started_at: string;
  completed_at?: string;
  duration_minutes: number;
  total_exercises: number;
  completed_exercises: number;
  success: boolean | number;
  notes?: string;
}

export default function WorkoutsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isReady, userProfile } = useDatabase();
  const router = useRouter();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<WorkoutGenerationDiagnostics | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);

  const userId = userProfile?.id || 'user_local_001';

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecentSessions(userId, 50);
      setSessions(data || []);
    } catch (e) {
      if (__DEV__) console.error('[Workouts] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isReady) loadSessions();
  }, [isReady, loadSessions]);

  const runDiagnostics = useCallback(
    async (deload = false) => {
      try {
        setDiagnosticsLoading(true);
        setDiagnosticsError(null);
        const result = await analyzeWorkoutGeneration(userId, deload);
        setDiagnostics(result);
      } catch (error) {
        setDiagnosticsError(error instanceof Error ? error.message : 'Failed to run generator diagnostics');
      } finally {
        setDiagnosticsLoading(false);
      }
    },
    [userId],
  );

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return t('common.today');
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === yesterday.toDateString()) return t('common.yesterday');
    return d.toLocaleDateString();
  };

  const renderWorkout = ({ item }: { item: WorkoutSession }) => (
    <GlassCard onPress={() => router.push(`/workouts/${item.id}` as any)} style={styles.workoutCard}>
      <View style={styles.workoutRow}>
        <View style={[styles.workoutIcon, { backgroundColor: theme.colors.accent + '15' }]}>
          <MaterialCommunityIcons name="arm-flex" size={18} color={theme.colors.accent} />
        </View>
        <View style={styles.workoutInfo}>
          <ThemedText variant="body" color="primary">
            {item.completed_exercises} of {item.total_exercises} exercises
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            {formatDate(item.started_at)} · {item.duration_minutes}m
          </ThemedText>
        </View>
        <ThemedText variant="body" color="accent" style={{ fontWeight: '700' }}>
          {Math.round((item.duration_minutes || 0) * 6.5)}
        </ThemedText>
      </View>
    </GlassCard>
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary screenName="WorkoutList" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <SectionHeader title="My Workouts" delay={0} />

        <ScrollView contentContainerStyle={styles.listContent}>
          <GlassCard style={styles.diagnosticsCard}>
            <View style={styles.diagnosticsHeader}>
              <View>
                <ThemedText variant="body" color="primary">
                  Workout Generator Diagnostics
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  Runs the real generator against the on-device database for {userId}
                </ThemedText>
              </View>
              <MaterialCommunityIcons name="flask-outline" size={20} color={theme.colors.accent} />
            </View>

            <View style={styles.diagnosticsActions}>
              <GradientButton
                title="Preview Workout"
                size="sm"
                variant="primary"
                onPress={() => runDiagnostics(false)}
              />
              <GradientButton title="Preview Deload" size="sm" variant="warning" onPress={() => runDiagnostics(true)} />
            </View>

            {diagnosticsLoading ? (
              <View style={styles.diagnosticsLoading}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
              </View>
            ) : null}

            {diagnosticsError ? (
              <ThemedText variant="caption" color="muted" style={styles.diagnosticsError}>
                {diagnosticsError}
              </ThemedText>
            ) : null}

            {diagnostics ? (
              <View style={styles.diagnosticsBody}>
                <ThemedText variant="caption" color="muted">
                  Focus: {diagnostics.intent.focus_pattern || 'none'} · Candidates: {diagnostics.candidate_count} ·
                  Selected: {diagnostics.selected_count}/{diagnostics.target_count}
                </ThemedText>
                {diagnostics.selected.map((entry) => (
                  <View key={entry.id} style={styles.diagnosticRow}>
                    <ThemedText variant="caption" color={entry.matches_focus_pattern ? 'accent' : 'secondary'}>
                      {entry.order}. {entry.name} · {entry.category} · {entry.score}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </GlassCard>

          {sessions.length > 0 ? (
            sessions.map((item) => <View key={item.id}>{renderWorkout({ item })}</View>)
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="dumbbell" size={48} color={theme.colors.textMuted} />
              <ThemedText variant="body" color="muted" style={styles.emptyText}>
                No workouts yet. Start your first workout!
              </ThemedText>
            </View>
          )}
        </ScrollView>

        <View style={styles.fabWrap}>
          <GradientButton
            title="Start Workout"
            icon="lightning-bolt"
            variant="primary"
            onPress={() => router.push('/fitquest')}
          />
        </View>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[25] },
  diagnosticsCard: { marginBottom: spacing[4], padding: spacing[3] },
  diagnosticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  diagnosticsActions: { gap: spacing[2], marginBottom: spacing[3] },
  diagnosticsLoading: { paddingVertical: spacing[2] },
  diagnosticsError: { marginTop: spacing[1] },
  diagnosticsBody: { gap: spacing[1.5] },
  diagnosticRow: { paddingVertical: spacing[0.5] },
  workoutCard: { marginBottom: spacing[2], padding: spacing[2.5] },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  workoutIcon: { width: 36, height: 36, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  workoutInfo: { flex: 1 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[15], gap: spacing[3] },
  emptyText: { textAlign: 'center', marginTop: spacing[2] },
  fabWrap: { position: 'absolute', bottom: 32, left: 16, right: 16 },
});
