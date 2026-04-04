/**
 * FitQuest Create Workout Screen
 * Custom workout builder - users pick exercises to create their own workout
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useToast } from '../src/context/ToastContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { useCreateWorkoutViewModel } from '../src/viewmodels/useCreateWorkoutViewModel';
import { haptic } from '../src/utils/haptics';
import type { ExerciseWithDetails, Category } from '../src/database/types';
import ThemedText from '../src/components/ThemedText';
import Card from '../src/components/Card';
import ExerciseImage from '../src/components/ExerciseImage';
import { typography, spacing, radius } from '../src/design/theme-system';

// ============================================
// MEMOIZED LIST ITEM
// ============================================

const ExerciseListItem = memo(function ExerciseListItem({
  item,
  isSelected,
  onToggle,
  colors,
}: {
  item: ExerciseWithDetails;
  isSelected: boolean;
  onToggle: (exercise: ExerciseWithDetails) => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.exerciseItem,
        { backgroundColor: colors.surface, borderColor: isSelected ? colors.accent : colors.border },
      ]}
      onPress={() => onToggle(item)}
    >
      <View
        style={[
          styles.checkCircle,
          {
            backgroundColor: isSelected ? colors.accent : 'transparent',
            borderColor: isSelected ? colors.accent : colors.textMuted,
          },
        ]}
      >
        {isSelected && <MaterialCommunityIcons name="check" size={14} color={colors.onAccent} />}
      </View>
      <ExerciseImage
        exerciseId={item.id}
        category={item.category}
        variant="thumbnail"
        animate={false}
        style={{ marginLeft: spacing[2.5] }}
      />
      <View style={{ flex: 1, marginLeft: spacing[3] }}>
        <ThemedText style={{ color: colors.text, fontWeight: '600', fontSize: typography.sizes.bodySmall }}>
          {item.name}
        </ThemedText>
        <ThemedText style={{ color: colors.textMuted, fontSize: typography.sizes.caption, marginTop: spacing[0.5] }}>
          {item.difficulty} • {item.primary_muscles.slice(0, 2).join(', ')}
        </ThemedText>
      </View>
      <View style={[styles.diffBadge, { backgroundColor: colors.surface }]}>
        <ThemedText style={{ color: colors.textMuted, fontSize: typography.sizes.xs, textTransform: 'uppercase' }}>
          {item.category.replace('_', ' ')}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
});

// ============================================
// TYPES
// ============================================

interface SelectedExercise {
  exercise: ExerciseWithDetails;
  sets: number;
  reps: string;
  restSeconds: number;
}

const getCategories = (t: (key: string) => string): { key: Category | 'all'; label: string; icon: string }[] => [
  { key: 'all', label: t('createWorkout.category.all'), icon: 'view-grid' },
  { key: 'body_control', label: t('createWorkout.category.body_control'), icon: 'arm-flex' },
  { key: 'posture', label: t('createWorkout.category.posture'), icon: 'human-male-height' },
  { key: 'strength', label: t('createWorkout.category.strength'), icon: 'dumbbell' },
  { key: 'mobility', label: t('createWorkout.category.mobility'), icon: 'yoga' },
  { key: 'speed', label: t('createWorkout.category.speed'), icon: 'run-fast' },
  { key: 'focus', label: t('createWorkout.category.focus'), icon: 'head-heart' },
];

const getDifficulties = (
  t: (key: string) => string,
  colors: { textMuted: string; accent: string; warning: string; error: string },
): { key: 'all' | 'beginner' | 'intermediate' | 'advanced'; label: string; color: string }[] => [
  { key: 'all', label: t('createWorkout.allLevels'), color: colors.textMuted },
  { key: 'beginner', label: t('createWorkout.beginner'), color: colors.accent },
  { key: 'intermediate', label: t('createWorkout.intermediate'), color: colors.warning },
  { key: 'advanced', label: t('createWorkout.advanced'), color: colors.error },
];

const getEquipmentLevels = (
  t: (key: string) => string,
): { key: 'all' | 'none' | 'minimal' | 'playground'; label: string }[] => [
  { key: 'all', label: t('createWorkout.anyEquipment') },
  { key: 'none', label: t('createWorkout.noEquipment') },
  { key: 'minimal', label: t('createWorkout.minimal') },
  { key: 'playground', label: t('createWorkout.playground') },
];

// ============================================
// SCREEN
// ============================================

export default function CreateWorkoutScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { isReady: dbReady } = useDatabase();
  const categories = useMemo(() => getCategories(t), [t]);
  const difficulties = useMemo(() => getDifficulties(t, theme.colors), [t, theme.colors]);
  const equipmentLevels = useMemo(() => getEquipmentLevels(t), [t]);
  const router = useRouter();
  const vm = useCreateWorkoutViewModel();

  // State
  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');
  const [filteredExercises, setFilteredExercises] = useState<ExerciseWithDetails[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<'all' | 'none' | 'minimal' | 'playground'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [expandedInstructions, setExpandedInstructions] = useState<Record<string, boolean>>({});

  // Load exercises
  useEffect(() => {
    if (dbReady) vm.loadExercises();
  }, [dbReady, vm.loadExercises]);

  useEffect(() => {
    filterExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterExercises is stable (useCallback)
  }, [selectedCategory, selectedDifficulty, selectedEquipment, searchQuery, vm.allExercises]);

  const filterExercises = () => {
    let filtered = vm.allExercises;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((e) => e.category === selectedCategory);
    }
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter((e) => e.difficulty === selectedDifficulty);
    }
    if (selectedEquipment !== 'all') {
      filtered = filtered.filter((e) => e.equipment_level === selectedEquipment);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) => e.name.toLowerCase().includes(q) || e.primary_muscles.some((m) => m.toLowerCase().includes(q)),
      );
    }
    setFilteredExercises(filtered);
  };

  const activeFiltersCount = [selectedDifficulty !== 'all', selectedEquipment !== 'all'].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedDifficulty('all');
    setSelectedEquipment('all');
    setSearchQuery('');
  };

  const toggleExercise = useCallback((exercise: ExerciseWithDetails) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.exercise.id === exercise.id);
      if (exists) return prev.filter((s) => s.exercise.id !== exercise.id);
      return [...prev, { exercise, sets: 3, reps: '8-12', restSeconds: 60 }];
    });
  }, []);

  // O(1) selection lookup for FlatList items
  const selectedIdSet = useMemo(() => new Set(selected.map((s) => s.exercise.id)), [selected]);

  const updateExerciseConfig = (exerciseId: string, field: string, value: any) => {
    setSelected(
      selected.map((s) => {
        if (s.exercise.id === exerciseId) {
          return { ...s, [field]: value };
        }
        return s;
      }),
    );
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const newSelected = [...selected];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSelected.length) return;
    [newSelected[index], newSelected[targetIndex]] = [newSelected[targetIndex]!, newSelected[index]!];
    setSelected(newSelected);
  };

  const removeExercise = (exerciseId: string) => {
    setSelected(selected.filter((s) => s.exercise.id !== exerciseId));
  };

  const estimatedDuration =
    selected.reduce((total, s) => {
      return total + s.sets * ((s.exercise.time_per_set_seconds || 30) + s.restSeconds);
    }, 0) / 60;

  const handleSaveWorkout = async () => {
    if (selected.length === 0) {
      showToast({ message: t('createWorkout.noExercises'), type: 'info' });
      return;
    }

    const sessionId = await vm.saveWorkout({ selected, workoutName, estimatedDuration, t });
    if (sessionId) {
      Alert.alert(t('createWorkout.saved'), t('createWorkout.savedDetail'), [
        {
          text: t('createWorkout.startNow') || 'Start Now',
          onPress: () => {
            router.push({
              pathname: '/workout',
              params: { sessionId },
            } as any);
          },
        },
        { text: t('common.ok'), onPress: () => (router.canGoBack() ? router.back() : router.replace('/dashboard')) },
      ]);
    } else {
      showToast({ message: t('createWorkout.saveFailed'), type: 'error' });
    }
  };

  // Stable FlatList helpers (prevent re-render churn)
  const keyExtractorExercise = useCallback((item: ExerciseWithDetails) => item.id, []);
  const EXERCISE_ITEM_HEIGHT = 72;
  const getExerciseItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: EXERCISE_ITEM_HEIGHT,
      offset: EXERCISE_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );
  const renderExerciseItem = useCallback(
    ({ item }: { item: ExerciseWithDetails }) => (
      <ExerciseListItem
        item={item}
        isSelected={selectedIdSet.has(item.id)}
        onToggle={toggleExercise}
        colors={theme.colors}
      />
    ),
    [selectedIdSet, toggleExercise, theme.colors],
  );

  // ===== LOADING GATE =====
  if (!dbReady || vm.loading) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </ScreenContainer>
    );
  }

  // ===== STEP 1: SELECT EXERCISES =====
  if (step === 'select') {
    return (
      <ScreenContainer>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="h3">{t('createWorkout.title')}</ThemedText>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => router.push('/saved-workouts' as any)}
              accessibilityRole="button"
              accessibilityLabel="Saved workouts"
            >
              <MaterialCommunityIcons name="folder-star" size={22} color={theme.colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                haptic('buttonPress');
                selected.length > 0
                  ? setStep('configure')
                  : showToast({ message: t('createWorkout.noExercises'), type: 'info' });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Next, ${selected.length} exercises selected`}
            >
              <ThemedText variant="body" color="accent" weight="600">
                {t('createWorkout.next')} ({selected.length})
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flex: 1 },
            ]}
          >
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder={t('createWorkout.searchPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: showFilters ? theme.colors.accent : theme.colors.surface,
                borderColor: showFilters ? theme.colors.accent : theme.colors.border,
              },
            ]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color={showFilters ? theme.colors.onAccent : theme.colors.text}
            />
            {activeFiltersCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: theme.colors.error }]}>
                <ThemedText style={[styles.filterBadgeText, { color: theme.colors.text }]}>
                  {activeFiltersCount}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Advanced Filters */}
        {!!showFilters && (
          <View
            style={[styles.filtersPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <View style={styles.filterHeader}>
              <ThemedText variant="body" weight="600">
                {t('createWorkout.filters')}
              </ThemedText>
              <TouchableOpacity
                onPress={clearFilters}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
              >
                <ThemedText variant="bodySmall" color="accent">
                  {t('createWorkout.clearAll')}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Difficulty Filter */}
            <ThemedText variant="bodySmall" color="secondary" style={{ marginTop: spacing[3] }}>
              {t('createWorkout.difficulty')}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing[2] }}>
              {difficulties.map((diff) => (
                <TouchableOpacity
                  key={diff.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedDifficulty === diff.key ? diff.color : theme.colors.surfaceVariant,
                      borderColor: selectedDifficulty === diff.key ? diff.color : theme.colors.textMuted,
                    },
                  ]}
                  onPress={() => setSelectedDifficulty(diff.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${diff.label} difficulty${selectedDifficulty === diff.key ? ', selected' : ''}`}
                >
                  <ThemedText
                    style={{
                      color: selectedDifficulty === diff.key ? theme.colors.onAccent : theme.colors.text,
                      fontSize: typography.sizes.caption,
                      fontWeight: '600',
                    }}
                  >
                    {diff.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Equipment Filter */}
            <ThemedText variant="bodySmall" color="secondary" style={{ marginTop: spacing[3] }}>
              {t('createWorkout.equipment')}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing[2] }}>
              {equipmentLevels.map((eq) => (
                <TouchableOpacity
                  key={eq.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedEquipment === eq.key ? theme.colors.accent : theme.colors.surfaceVariant,
                      borderColor: selectedEquipment === eq.key ? theme.colors.accent : theme.colors.textMuted,
                    },
                  ]}
                  onPress={() => setSelectedEquipment(eq.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${eq.label} equipment${selectedEquipment === eq.key ? ', selected' : ''}`}
                >
                  <ThemedText
                    style={{
                      color: selectedEquipment === eq.key ? theme.colors.onAccent : theme.colors.text,
                      fontSize: typography.sizes.caption,
                      fontWeight: '600',
                    }}
                  >
                    {eq.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === cat.key ? theme.colors.accent : theme.colors.surfaceVariant,
                  borderColor: selectedCategory === cat.key ? theme.colors.accent : theme.colors.textMuted,
                },
              ]}
              onPress={() => setSelectedCategory(cat.key)}
              accessibilityRole="button"
              accessibilityLabel={`${cat.label} category${selectedCategory === cat.key ? ', selected' : ''}`}
            >
              <ThemedText
                style={{
                  color: selectedCategory === cat.key ? theme.colors.onAccent : theme.colors.text,
                  fontSize: typography.sizes.caption,
                  fontWeight: '600',
                }}
              >
                {cat.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Exercise count */}
        <ThemedText
          variant="bodySmall"
          color="secondary"
          style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}
        >
          {filteredExercises.length} {t('createWorkout.exercisesAvailable')}
        </ThemedText>

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={keyExtractorExercise}
          renderItem={renderExerciseItem}
          contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[25] }}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          getItemLayout={getExerciseItemLayout}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing[12] }}>
              <MaterialCommunityIcons name="magnify-close" size={48} color={theme.colors.textMuted} />
              <ThemedText variant="h4" color="secondary" style={{ marginTop: spacing[3] }}>
                {t('exercises.noResults') || 'No exercises found'}
              </ThemedText>
              <ThemedText variant="bodySmall" color="muted" style={{ marginTop: spacing[1] }}>
                {t('exercises.adjustFilters') || 'Try adjusting your search or filters'}
              </ThemedText>
            </View>
          }
        />
      </ScreenContainer>
    );
  }

  // ===== STEP 2: CONFIGURE EXERCISES =====
  if (step === 'configure') {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setStep('select')}
            accessibilityRole="button"
            accessibilityLabel="Back to exercise selection"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="h3">{t('createWorkout.configure')}</ThemedText>
          <TouchableOpacity
            onPress={() => {
              haptic('buttonPress');
              setStep('preview');
            }}
            accessibilityRole="button"
            accessibilityLabel="Preview workout"
          >
            <ThemedText variant="body" color="accent" weight="600">
              {t('createWorkout.preview')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Workout Name */}
        <View style={[styles.nameInput, { borderColor: theme.colors.border }]}>
          <TextInput
            style={[styles.nameField, { color: theme.colors.text }]}
            placeholder={t('createWorkout.workoutNamePlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={workoutName}
            onChangeText={setWorkoutName}
            maxLength={100}
          />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[25] }}>
          {selected.map((item, index) => (
            <Card key={item.exercise.id} style={styles.configCard}>
              <View style={styles.configHeader}>
                <ExerciseImage
                  exerciseId={item.exercise.id}
                  category={item.exercise.category}
                  variant="thumbnail"
                  animate={false}
                  style={{ marginRight: spacing[3] }}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" weight="600">
                    {item.exercise.name}
                  </ThemedText>
                  <ThemedText variant="bodySmall" color="secondary">
                    {item.exercise.primary_muscles.slice(0, 2).join(', ')}
                  </ThemedText>
                </View>
                <View style={styles.configActions}>
                  <TouchableOpacity
                    onPress={() => moveExercise(index, 'up')}
                    disabled={index === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${item.exercise.name} up`}
                  >
                    <MaterialCommunityIcons
                      name="chevron-up"
                      size={20}
                      color={index === 0 ? theme.colors.textMuted : theme.colors.text}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveExercise(index, 'down')}
                    disabled={index === selected.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${item.exercise.name} down`}
                  >
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={index === selected.length - 1 ? theme.colors.textMuted : theme.colors.text}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeExercise(item.exercise.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.exercise.name}`}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sets / Reps / Rest */}
              <View style={styles.configRow}>
                <View style={styles.configField}>
                  <ThemedText variant="bodySmall" color="secondary">
                    {t('createWorkout.sets')}
                  </ThemedText>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => updateExerciseConfig(item.exercise.id, 'sets', Math.max(1, item.sets - 1))}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease sets for ${item.exercise.name}`}
                    >
                      <MaterialCommunityIcons name="minus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                    <ThemedText variant="h4" style={{ marginHorizontal: spacing[3] }}>
                      {item.sets}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => updateExerciseConfig(item.exercise.id, 'sets', Math.min(10, item.sets + 1))}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase sets for ${item.exercise.name}`}
                    >
                      <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.configField}>
                  <ThemedText variant="bodySmall" color="secondary">
                    {t('createWorkout.reps')}
                  </ThemedText>
                  <TextInput
                    style={[styles.repsInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={item.reps}
                    onChangeText={(text) => updateExerciseConfig(item.exercise.id, 'reps', text)}
                    keyboardType="default"
                    maxLength={10}
                    placeholder="8-12"
                  />
                </View>
                <View style={styles.configField}>
                  <ThemedText variant="bodySmall" color="secondary">
                    {t('createWorkout.restSeconds')}
                  </ThemedText>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() =>
                        updateExerciseConfig(item.exercise.id, 'restSeconds', Math.max(15, item.restSeconds - 15))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease rest time for ${item.exercise.name}`}
                    >
                      <MaterialCommunityIcons name="minus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                    <ThemedText variant="h4" style={{ marginHorizontal: spacing[2] }}>
                      {item.restSeconds}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() =>
                        updateExerciseConfig(item.exercise.id, 'restSeconds', Math.min(180, item.restSeconds + 15))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Increase rest time for ${item.exercise.name}`}
                    >
                      <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Instructions (expandable) */}
              <TouchableOpacity
                style={[styles.instructionToggle, { borderTopColor: theme.colors.border }]}
                onPress={() =>
                  setExpandedInstructions((prev) => ({
                    ...prev,
                    [item.exercise.id]: !prev[item.exercise.id],
                  }))
                }
                accessibilityRole="button"
                accessibilityLabel={`${expandedInstructions[item.exercise.id] ? 'Hide' : 'Show'} instructions for ${item.exercise.name}`}
              >
                <MaterialCommunityIcons
                  name={expandedInstructions[item.exercise.id] ? 'chevron-up' : 'text-box-outline'}
                  size={16}
                  color={theme.colors.accent}
                />
                <ThemedText
                  style={{
                    color: theme.colors.accent,
                    fontSize: typography.sizes.label,
                    fontWeight: '600',
                    marginLeft: spacing[1.5],
                  }}
                >
                  {expandedInstructions[item.exercise.id] ? 'Hide Instructions' : 'Show Instructions'}
                </ThemedText>
              </TouchableOpacity>

              {expandedInstructions[item.exercise.id] && item.exercise.instructions.length > 0 && (
                <View
                  style={[
                    styles.instructionBox,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                  ]}
                >
                  {item.exercise.instructions.map((instruction, idx) => (
                    <View key={idx} style={styles.instructionStep}>
                      <ThemedText
                        style={{
                          color: theme.colors.accent,
                          fontSize: typography.sizes.caption,
                          fontWeight: '700',
                          width: 20,
                        }}
                      >
                        {idx + 1}.
                      </ThemedText>
                      <ThemedText
                        style={{
                          color: theme.colors.textSecondary,
                          fontSize: typography.sizes.label,
                          flex: 1,
                          lineHeight: 18,
                        }}
                      >
                        {instruction}
                      </ThemedText>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.narrateBtn, { backgroundColor: theme.colors.accent + '15' }]}
                    onPress={() => {
                      const text = `${item.exercise.name}. ${item.exercise.instructions.join('. ')}`;
                      vm.speakNarration(text);
                    }}
                  >
                    <MaterialCommunityIcons name="volume-high" size={16} color={theme.colors.accent} />
                    <ThemedText
                      style={{
                        color: theme.colors.accent,
                        fontSize: typography.sizes.caption,
                        fontWeight: '600',
                        marginLeft: spacing[1.5],
                      }}
                    >
                      Read Aloud
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ===== STEP 3: PREVIEW =====
  return (
    <ScreenErrorBoundary screenName="CreateWorkout" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('configure')}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="h3">{t('createWorkout.preview')}</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[25] }}>
          {/* Summary */}
          <Card style={styles.summaryCard}>
            <ThemedText variant="h3">{workoutName.trim() || t('createWorkout.customWorkout')}</ThemedText>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="dumbbell" size={20} color={theme.colors.accent} />
                <ThemedText variant="body" style={{ marginLeft: spacing[1.5] }}>
                  {selected.length}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary" style={{ marginLeft: spacing[1] }}>
                  {t('createWorkout.exercises')}
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.accent} />
                <ThemedText variant="body" style={{ marginLeft: spacing[1.5] }}>
                  ~{Math.round(estimatedDuration)}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary" style={{ marginLeft: spacing[1] }}>
                  {t('createWorkout.min')}
                </ThemedText>
              </View>
            </View>
          </Card>

          {/* Exercise List */}
          {selected.map((item, index) => (
            <Card key={item.exercise.id} style={styles.previewExercise}>
              <View style={styles.previewRow}>
                <View style={[styles.orderBadge, { backgroundColor: theme.colors.accent }]}>
                  <ThemedText
                    style={{ color: theme.colors.text, fontWeight: '700', fontSize: typography.sizes.caption }}
                  >
                    {index + 1}
                  </ThemedText>
                </View>
                <ExerciseImage
                  exerciseId={item.exercise.id}
                  category={item.exercise.category}
                  variant="thumbnail"
                  animate={false}
                  style={{ marginLeft: spacing[2.5] }}
                />
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <ThemedText variant="body" weight="600">
                    {item.exercise.name}
                  </ThemedText>
                  <ThemedText variant="bodySmall" color="secondary">
                    {item.sets} sets × {item.reps} • {item.restSeconds}s rest
                  </ThemedText>
                  {item.exercise.instructions.length > 0 && (
                    <ThemedText
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: typography.sizes.caption,
                        marginTop: spacing[1],
                        lineHeight: 16,
                      }}
                      numberOfLines={2}
                    >
                      {item.exercise.instructions[0]}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Card>
          ))}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.success }]}
            onPress={handleSaveWorkout}
          >
            <MaterialCommunityIcons name="content-save" size={20} color={theme.colors.onAccent} />
            <ThemedText style={[styles.saveButtonText, { color: theme.colors.text }]}>
              {t('createWorkout.saveWorkout')}
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3.5],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: 10,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[2.5],
    marginBottom: spacing[3],
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  filtersPanel: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    padding: spacing[3.5],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing[2],
    fontSize: typography.sizes.bodySmall,
  },
  categoryScroll: {
    flexGrow: 0,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  categoryChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: 20,
    borderWidth: 1,
    marginRight: spacing[2.5],
    minWidth: 70,
    alignItems: 'center',
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing[2],
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diffBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 6,
  },
  nameInput: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[3],
  },
  nameField: {
    fontSize: typography.sizes.bodyMid,
  },
  configCard: {
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  configActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  configField: {
    flex: 1,
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  repsInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    textAlign: 'center',
    fontSize: typography.sizes.bodySmall,
    marginTop: spacing[1],
    width: '100%',
  },
  summaryCard: {
    padding: spacing[5],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[6],
    marginTop: spacing[3],
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewExercise: {
    padding: spacing[3.5],
    marginBottom: spacing[2],
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4.5],
    borderRadius: 14,
    marginTop: spacing[4],
    gap: spacing[2.5],
  },
  saveButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },
  instructionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  instructionBox: {
    marginTop: spacing[2.5],
    padding: spacing[3],
    borderRadius: 10,
    borderWidth: 1,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  narrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginTop: spacing[2],
  },
});
