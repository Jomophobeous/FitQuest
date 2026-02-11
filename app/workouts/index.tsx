import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Link } from 'expo-router';
import { lightColors } from '../../src/theme/theme';

interface WorkoutHistory {
  id: string;
  name: string;
  date: string;
  duration: number;
  exercises: number;
  caloriesBurned: number;
  status: 'completed' | 'in_progress';
}

const mockWorkouts: WorkoutHistory[] = [
  {
    id: '1',
    name: 'Full Body Strength',
    date: 'Feb 2, 2026',
    duration: 45,
    exercises: 8,
    caloriesBurned: 350,
    status: 'completed',
  },
  {
    id: '2',
    name: 'Cardio HIIT',
    date: 'Feb 1, 2026',
    duration: 30,
    exercises: 5,
    caloriesBurned: 420,
    status: 'completed',
  },
  {
    id: '3',
    name: 'Leg Day',
    date: 'Jan 31, 2026',
    duration: 50,
    exercises: 6,
    caloriesBurned: 380,
    status: 'completed',
  },
  {
    id: '4',
    name: 'Upper Body Push',
    date: 'Jan 30, 2026',
    duration: 40,
    exercises: 7,
    caloriesBurned: 320,
    status: 'completed',
  },
];

export default function WorkoutsScreen() {
  const renderWorkout = ({ item }: { item: WorkoutHistory }) => (
    <Link href="/workout" asChild>
      <TouchableOpacity style={styles.workoutCard}>
        <View style={styles.workoutInfo}>
          <Text style={styles.workoutName}>{item.name}</Text>
          <Text style={styles.workoutMeta}>
            {item.date} • {item.duration}m • {item.exercises} exercises
          </Text>
        </View>
        <View style={styles.workoutStats}>
          <Text style={styles.caloriesValue}>{item.caloriesBurned}</Text>
          <Text style={styles.caloriesLabel}>kcal</Text>
        </View>
      </TouchableOpacity>
    </Link>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Workouts</Text>
        <Text style={styles.subtitle}>{mockWorkouts.length} total workouts</Text>
      </View>

      <FlatList
        data={mockWorkouts}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkout}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>Start your first workout today!</Text>
          </View>
        }
      />

      <Link href="/workout" asChild>
        <TouchableOpacity style={styles.startButton}>
          <Text style={styles.startButtonText}>+ Start New Workout</Text>
        </TouchableOpacity>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: lightColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: lightColors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  workoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: lightColors.surface,
    borderRadius: 8,
    marginBottom: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
  },
  workoutMeta: {
    fontSize: 12,
    color: lightColors.textSecondary,
    marginTop: 4,
  },
  workoutStats: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  caloriesValue: {
    fontSize: 16,
    fontWeight: '700',
    color: lightColors.primary,
  },
  caloriesLabel: {
    fontSize: 10,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: lightColors.textSecondary,
    marginTop: 8,
  },
  startButton: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    paddingVertical: 16,
    backgroundColor: lightColors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.surface,
  },
});
