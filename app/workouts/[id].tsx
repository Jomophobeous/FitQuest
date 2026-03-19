import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useDatabase } from '../../src/context/DatabaseContext';
import ThemedText from '../../src/components/ThemedText';
import { getRecentSessions } from '../../src/database/service';

interface SessionExerciseRow {
  id: string;
  exercise_id: string;
  exercise_name: string;
  prescribed_sets: number;
  prescribed_reps: number;
  completed_sets: number;
  completed_reps: number | null;
  skipped: number;
}

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { isReady: dbReady } = useDatabase();
  const [session, setSession] = useState<any | null>(null);
  const [exercises, setExercises] = useState<SessionExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbReady) return;
    (async () => {
      try {
        // Try to find session in recent history
        const sessions = await getRecentSessions('user_local_001', 50);
        const found = sessions.find((s) => s.id === id);
        if (found) {
          setSession(found);
        } else {
          setSession({ id, notes: 'Workout session not found' });
        }
      } catch (e) {
        if (__DEV__) console.warn('Failed to load workout details', e);
        setSession({ id, notes: 'Could not load workout details' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, dbReady]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing[4] }}>
      <ThemedText variant="h2" color="primary">
        Workout Session
      </ThemedText>
      {session?.duration_minutes != null && (
        <ThemedText variant="body" color="secondary" style={{ marginTop: theme.spacing[1] }}>
          Duration: {session.duration_minutes} min · Exercises: {session.completed_exercises}/{session.total_exercises}
        </ThemedText>
      )}
      {session?.notes ? (
        <ThemedText variant="caption" color="muted" style={{ marginTop: theme.spacing[2] }}>
          {session.notes}
        </ThemedText>
      ) : null}
      {session?.started_at && (
        <ThemedText variant="caption" color="muted" style={{ marginTop: theme.spacing[1] }}>
          {new Date(session.started_at).toLocaleDateString()}
        </ThemedText>
      )}
    </ScrollView>
  );
}
