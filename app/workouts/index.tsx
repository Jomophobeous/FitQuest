import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDatabase } from '../../src/context/DatabaseContext';
import { getRecentSessions } from '../../src/database/service';
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
  const { isReady } = useDatabase();
  const router = useRouter();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const data = await getRecentSessions('user_local_001', 50);
      setSessions(data || []);
    } catch (e) {
      console.error('[Workouts] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady) loadSessions();
  }, [isReady, loadSessions]);

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

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkout}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={theme.colors.textMuted} />
            <ThemedText variant="body" color="muted" style={styles.emptyText}>
              No workouts yet. Start your first workout!
            </ThemedText>
          </View>
        }
      />

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
  workoutCard: { marginBottom: 8, padding: 10 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  workoutIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  workoutInfo: { flex: 1 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { textAlign: 'center', marginTop: 8 },
  fabWrap: { position: 'absolute', bottom: 32, left: 16, right: 16 },
});
