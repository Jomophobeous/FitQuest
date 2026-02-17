import React from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Text, Chip, ProgressBar, Divider } from 'react-native-paper';
import { Card, Badge } from './UIComponents';
import { lightColors } from '../../theme/theme';

// Exercise Card Component
interface ExerciseCardProps {
  id: number;
  name: string;
  difficulty?: string;
  targetMuscle?: string;
  equipment?: string;
  categoryName?: string;
  onPress: (id: number) => void;
  isFavorite?: boolean;
  onFavoritePress?: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  id,
  name,
  difficulty,
  targetMuscle,
  equipment,
  categoryName,
  onPress,
  isFavorite = false,
  onFavoritePress,
}) => {
  const difficultyColor =
    difficulty === 'beginner'
      ? 'success'
      : difficulty === 'intermediate'
      ? 'warning'
      : 'error';

  return (
    <TouchableOpacity onPress={() => onPress(id)}>
      <Card style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {name}
          </Text>
          {isFavorite !== undefined && (
            <TouchableOpacity onPress={onFavoritePress}>
              <Text style={styles.favoriteButton}>{isFavorite ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.exerciseMeta}>
          {categoryName && <Badge label={categoryName} color="primary" size="small" />}
          {difficulty && <Badge label={difficulty} color={difficultyColor} size="small" />}
        </View>

        {!!targetMuscle && (
          <Text style={styles.exerciseDetail}>
            <Text style={styles.label}>Target:</Text> {targetMuscle}
          </Text>
        )}
        {!!equipment && (
          <Text style={styles.exerciseDetail}>
            <Text style={styles.label}>Equipment:</Text> {equipment}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );
};

// Workout Progress Card
interface WorkoutProgressProps {
  completed: number;
  total: number;
  duration: number; // in minutes
  caloriesBurned?: number;
}

export const WorkoutProgress: React.FC<WorkoutProgressProps> = ({
  completed,
  total,
  duration,
  caloriesBurned,
}) => {
  const progress = total > 0 ? completed / total : 0;

  return (
    <Card style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Workout Progress</Text>
        <Badge label={`${Math.round(progress * 100)}%`} color="secondary" />
      </View>

      <ProgressBar progress={progress} color={lightColors.secondary} style={styles.progressBar} />

      <View style={styles.progressStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Exercises</Text>
          <Text style={styles.statValue}>
            {completed} / {total}
          </Text>
        </View>
        <Divider style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{duration} min</Text>
        </View>
        {caloriesBurned !== undefined && (
          <>
            <Divider style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Calories</Text>
              <Text style={styles.statValue}>{caloriesBurned}</Text>
            </View>
          </>
        )}
      </View>
    </Card>
  );
};

// Category Filter Chip
interface CategoryFilterProps {
  categories: Array<{ id: number; name: string }>;
  selected?: number[];
  onSelect: (categoryId: number) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selected = [],
  onSelect,
}) => {
  return (
    <View style={styles.filterContainer}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Chip
            selected={selected.includes(item.id)}
            onPress={() => onSelect(item.id)}
            style={styles.filterChip}
            selectedColor={lightColors.primary}
            mode="outlined"
          >
            {item.name}
          </Chip>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
      />
    </View>
  );
};

// Stats Card Component
interface StatsCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  unit,
  icon,
  color = 'primary',
}) => {
  const colorMap = {
    primary: lightColors.primary,
    secondary: lightColors.secondary,
    accent: lightColors.warning,
    success: lightColors.success,
    warning: lightColors.warning,
    error: lightColors.error,
  };

  return (
    <View style={[styles.statsCard, { borderLeftColor: colorMap[color] }]}>
      {icon && <Text style={styles.statsIcon}>{icon}</Text>}
      <View>
        <Text style={styles.statsLabel}>{label}</Text>
        <View style={styles.statsValue}>
          <Text style={styles.statsNumber}>{value}</Text>
          {unit && <Text style={styles.statsUnit}>{unit}</Text>}
        </View>
      </View>
    </View>
  );
};

// Difficulty Badge
export const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const color =
    difficulty === 'beginner'
      ? 'success'
      : difficulty === 'intermediate'
      ? 'warning'
      : difficulty === 'advanced'
      ? 'error'
      : 'primary';

  return <Badge label={difficulty} color={color} size="small" />;
};

// Workout Start Button
interface WorkoutStartButtonProps {
  title: string;
  exerciseCount: number;
  duration: string;
  onPress: () => void;
}

export const WorkoutStartButton: React.FC<WorkoutStartButtonProps> = ({
  title,
  exerciseCount,
  duration,
  onPress,
}) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.workoutStartButton}>
        <View>
          <Text style={styles.workoutTitle}>{title}</Text>
          <Text style={styles.workoutDetails}>
            {exerciseCount} exercises • {duration}
          </Text>
        </View>
        <Text style={styles.playButton}>▶️</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  exerciseCard: {
    marginHorizontal: 0,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: lightColors.text,
    flex: 1,
  },
  favoriteButton: {
    fontSize: 20,
    marginLeft: 8,
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  exerciseDetail: {
    fontSize: 13,
    color: lightColors.textSecondary,
    marginVertical: 2,
  },
  label: {
    fontWeight: '600',
    color: lightColors.text,
  },
  progressCard: {
    marginHorizontal: 0,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: lightColors.text,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 16,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: lightColors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: lightColors.text,
  },
  statDivider: {
    height: 30,
    width: 1,
  },
  filterContainer: {
    paddingVertical: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  filterChip: {
    marginRight: 8,
    marginVertical: 4,
  },
  statsCard: {
    backgroundColor: lightColors.surface,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statsLabel: {
    fontSize: 12,
    color: lightColors.textSecondary,
    marginBottom: 4,
  },
  statsValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: lightColors.text,
  },
  statsUnit: {
    fontSize: 12,
    color: lightColors.textSecondary,
    marginLeft: 4,
  },
  workoutStartButton: {
    backgroundColor: lightColors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: lightColors.surface,
    marginBottom: 4,
  },
  workoutDetails: {
    fontSize: 12,
    color: lightColors.surface,
  },
  playButton: {
    fontSize: 20,
  },
});
