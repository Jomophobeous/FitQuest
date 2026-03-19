import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDatabase } from '../../src/context/DatabaseContext';
import { getRecentSessions } from '../../src/database/service';
import { analyzeWorkoutGeneration, type WorkoutGenerationDiagnostics } from '../../src/engines/workoutGenerator';
import ThemedText from '../../src/components/ThemedText';
import { GlassCard, GradientButton, SectionHeader } from '../../src/components/ui/GlassUI';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

  const runDiagnostics = useCallback(async (deload = false) => {
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
  }, [userId]);

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return t('common.today');
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === yesterday.toDateString()) return t('common.yesterday');
    return d.toLocaleDateString();
  };

  const renderWorkout = ({ item }: { item: WorkoutSession }) => (
    <GlassCard
      onPress={() => router.push(`/workouts/${item.id}` as any)}
      style={styles.workoutCard}
    >
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SectionHeader title="My Workouts" delay={0} />

      <ScrollView contentContainerStyle={styles.listContent}>
        <GlassCard style={styles.diagnosticsCard}>
          <View style={styles.diagnosticsHeader}>
            <View>
              <ThemedText variant="body" color="primary">Workout Generator Diagnostics</ThemedText>
              <ThemedText variant="caption" color="muted">
                Runs the real generator against the on-device database for {userId}
              </ThemedText>
            </View>
            <MaterialCommunityIcons name="flask-outline" size={20} color={theme.colors.accent} />
          </View>

          <View style={styles.diagnosticsActions}>
            <GradientButton title="Preview Workout" size="sm" variant="primary" onPress={() => runDiagnostics(false)} />
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
                Focus: {diagnostics.intent.focus_pattern || 'none'} · Candidates: {diagnostics.candidate_count} · Selected: {diagnostics.selected_count}/{diagnostics.target_count}
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
          sessions.map((item) => (
            <View key={item.id}>
              {renderWorkout({ item })}
            </View>
          ))
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  diagnosticsCard: { marginBottom: 16, padding: 12 },
  diagnosticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  diagnosticsActions: { gap: 8, marginBottom: 12 },
  diagnosticsLoading: { paddingVertical: 8 },
  diagnosticsError: { marginTop: 4 },
  diagnosticsBody: { gap: 6 },
  diagnosticRow: { paddingVertical: 2 },
  workoutCard: { marginBottom: 8, padding: 10 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  workoutIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  workoutInfo: { flex: 1 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { textAlign: 'center', marginTop: 8 },
  fabWrap: { position: 'absolute', bottom: 32, left: 16, right: 16 },
});
