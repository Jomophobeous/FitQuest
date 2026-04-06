import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useDatabase } from '../../src/context/DatabaseContext';
import ThemedText from '../../src/components/ThemedText';
import { ScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { ScreenContainer } from '../../src/components/ui/primitives';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { getRecentSessions } from '../../src/database/service';
import { spacing } from '../../src/design/theme-system';

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
  const router = useRouter();
  const { isReady: dbReady } = useDatabase();
  const [session, setSession] = useState<any | null>(null);
  const [_exercises, _setExercises] = useState<SessionExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbReady) return;
    (async () => {
      try {
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
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary screenName="WorkoutDetail" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <ScrollView style={{ flex: 1, padding: spacing[4] }}>
          <Animated.View entering={FadeInDown.delay(50).duration(200)}>
            <ThemedText variant="h2" color="primary">
              Workout Session
            </ThemedText>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(200)}>
            <GlassCard style={{ marginTop: spacing[4], padding: spacing[4] }}>
              {session?.duration_minutes != null && (
                <ThemedText variant="body" color="secondary" style={{ marginTop: spacing[1] }}>
                  Duration: {session.duration_minutes} min · Exercises: {session.completed_exercises}/
                  {session.total_exercises}
                </ThemedText>
              )}
              {session?.notes ? (
                <ThemedText variant="caption" color="muted" style={{ marginTop: spacing[2] }}>
                  {session.notes}
                </ThemedText>
              ) : null}
              {session?.started_at && (
                <ThemedText variant="caption" color="muted" style={{ marginTop: spacing[1] }}>
                  {new Date(session.started_at).toLocaleDateString()}
                </ThemedText>
              )}
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
