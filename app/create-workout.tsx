/**
 * FitQuest Create Workout Screen
 * Custom workout builder - users pick exercises to create their own workout
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { getExercises, createWorkoutSession, addSessionExercise } from '../src/database/service';
import { notifyCustomWorkoutCreated } from '../src/services/dataSyncService';
import type { ExerciseWithDetails, Category } from '../src/database/types';
import ThemedText from '../src/components/ThemedText';
import Card from '../src/components/Card';
import ExerciseImage from '../src/components/ExerciseImage';
import { audioService } from '../src/services/audioService';

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

const getDifficulties = (t: (key: string) => string, colors: { textMuted: string; accent: string; warning: string; error: string }): { key: 'all' | 'beginner' | 'intermediate' | 'advanced'; label: string; color: string }[] => [
  { key: 'all', label: t('createWorkout.allLevels'), color: colors.textMuted },
  { key: 'beginner', label: t('createWorkout.beginner'), color: colors.accent },
  { key: 'intermediate', label: t('createWorkout.intermediate'), color: colors.warning },
  { key: 'advanced', label: t('createWorkout.advanced'), color: colors.error },
];

const getEquipmentLevels = (t: (key: string) => string): { key: 'all' | 'none' | 'minimal' | 'playground'; label: string }[] => [
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
  const { isReady: dbReady } = useDatabase();
  const categories = useMemo(() => getCategories(t), [t]);
  const difficulties = useMemo(() => getDifficulties(t, theme.colors), [t, theme.colors]);
  const equipmentLevels = useMemo(() => getEquipmentLevels(t), [t]);
  const router = useRouter();

  // State
  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');
  const [allExercises, setAllExercises] = useState<ExerciseWithDetails[]>([]);
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
    if (dbReady) loadExercises();
  }, [dbReady]);

  useEffect(() => {
    filterExercises();
  }, [selectedCategory, selectedDifficulty, selectedEquipment, searchQuery, allExercises]);

  const loadExercises = async () => {
    const exercises = await getExercises();
    setAllExercises(exercises);
    setFilteredExercises(exercises);
  };

  const filterExercises = () => {
    let filtered = allExercises;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(e => e.difficulty === selectedDifficulty);
    }
    if (selectedEquipment !== 'all') {
      filtered = filtered.filter(e => e.equipment_level === selectedEquipment);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.primary_muscles.some(m => m.toLowerCase().includes(q))
      );
    }
    setFilteredExercises(filtered);
  };

  const activeFiltersCount = [
    selectedDifficulty !== 'all',
    selectedEquipment !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedDifficulty('all');
    setSelectedEquipment('all');
    setSearchQuery('');
  };

  const toggleExercise = (exercise: ExerciseWithDetails) => {
    const exists = selected.find(s => s.exercise.id === exercise.id);
    if (exists) {
      setSelected(selected.filter(s => s.exercise.id !== exercise.id));
    } else {
      setSelected([...selected, {
        exercise,
        sets: 3,
        reps: '8-12',
        restSeconds: 60,
      }]);
    }
  };

  const updateExerciseConfig = (exerciseId: string, field: string, value: any) => {
    setSelected(selected.map(s => {
      if (s.exercise.id === exerciseId) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const newSelected = [...selected];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSelected.length) return;
    [newSelected[index], newSelected[targetIndex]] = [newSelected[targetIndex]!, newSelected[index]!];
    setSelected(newSelected);
  };

  const removeExercise = (exerciseId: string) => {
    setSelected(selected.filter(s => s.exercise.id !== exerciseId));
  };

  const estimatedDuration = selected.reduce((total, s) => {
    return total + (s.sets * ((s.exercise.time_per_set_seconds || 30) + s.restSeconds));
  }, 0) / 60;

  const handleSaveWorkout = async () => {
    if (selected.length === 0) {
      Alert.alert(t('createWorkout.selectFirst'), t('createWorkout.noExercises'));
      return;
    }

    const name = workoutName.trim() || `${t('createWorkout.customWorkout')} (${selected.length} ${t('createWorkout.exercises')})`;
    const sessionId = `custom_${Date.now()}`;

    try {
      await createWorkoutSession({
        id: sessionId,
        user_id: 'user_local_001',
        duration_minutes: Math.round(estimatedDuration),
        total_exercises: selected.length,
        completed_exercises: 0,
        success: false,
        notes: `Custom: ${name}`,
      });

      for (let i = 0; i < selected.length; i++) {
        const s = selected[i];
        if (!s) continue;
        await addSessionExercise({
          id: `${sessionId}_ex_${i}`,
          session_id: sessionId,
          exercise_id: s.exercise.id,
          order_in_session: i + 1,
          prescribed_sets: s.sets,
          prescribed_reps: s.reps,
          completed_sets: 0,
          skipped: false,
        });
      }

      // Notify other screens that a new custom workout was created
      notifyCustomWorkoutCreated(sessionId);

      Alert.alert(
        t('createWorkout.saved'),
        t('createWorkout.savedDetail'),
        [
          { text: t('createWorkout.startNow') || 'Start Now', onPress: () => {
            router.push({
              pathname: '/workout',
              params: { sessionId },
            } as any);
          }},
          { text: t('common.ok'), onPress: () => router.canGoBack() ? router.back() : router.replace('/dashboard') },
        ]
      );
    } catch (error) {
      if (__DEV__) console.error('[CreateWorkout] Failed to save:', error);
      Alert.alert(t('error.title'), t('createWorkout.saveFailed'));
    }
  };

  // ===== STEP 1: SELECT EXERCISES =====
  if (step === 'select') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="h3">{t('createWorkout.title')}</ThemedText>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push('/saved-workouts' as any)}>
              <MaterialCommunityIcons name="folder-star" size={22} color={theme.colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selected.length > 0 ? setStep('configure') : Alert.alert(t('createWorkout.selectFirst'))}
            >
              <ThemedText variant="body" color="accent" weight="600">
                {t('createWorkout.next')} ({selected.length})
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flex: 1 }]}>
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
            style={[styles.filterButton, {
              backgroundColor: showFilters ? theme.colors.accent : theme.colors.surface,
              borderColor: showFilters ? theme.colors.accent : theme.colors.border,
            }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color={showFilters ? theme.colors.onAccent : theme.colors.text}
            />
            {activeFiltersCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={[styles.filterBadgeText, { color: theme.colors.text }]}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Advanced Filters */}
        {!!showFilters && (
          <View style={[styles.filtersPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.filterHeader}>
              <ThemedText variant="body" weight="600">{t('createWorkout.filters')}</ThemedText>
              <TouchableOpacity onPress={clearFilters}>
                <ThemedText variant="bodySmall" color="accent">{t('createWorkout.clearAll')}</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Difficulty Filter */}
            <ThemedText variant="bodySmall" color="secondary" style={{ marginTop: 12 }}>{t('createWorkout.difficulty')}</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {difficulties.map(diff => (
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
                >
                  <Text style={{
                    color: selectedDifficulty === diff.key ? theme.colors.onAccent : theme.colors.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}>
                    {diff.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Equipment Filter */}
            <ThemedText variant="bodySmall" color="secondary" style={{ marginTop: 12 }}>{t('createWorkout.equipment')}</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {equipmentLevels.map(eq => (
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
                >
                  <Text style={{
                    color: selectedEquipment === eq.key ? theme.colors.onAccent : theme.colors.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}>
                    {eq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map(cat => (
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
            >
              <Text style={{
                color: selectedCategory === cat.key ? theme.colors.onAccent : theme.colors.text,
                fontSize: 12,
                fontWeight: '600',
              }}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Exercise count */}
        <ThemedText variant="bodySmall" color="secondary" style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          {filteredExercises.length} {t('createWorkout.exercisesAvailable')}
        </ThemedText>

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isSelected = !!selected.find(s => s.exercise.id === item.id);
            return (
              <TouchableOpacity
                style={[
                  styles.exerciseItem,
                  { backgroundColor: theme.colors.surface, borderColor: isSelected ? theme.colors.accent : theme.colors.border },
                ]}
                onPress={() => toggleExercise(item)}
              >
                <View style={[
                  styles.checkCircle,
                  {
                    backgroundColor: isSelected ? theme.colors.accent : 'transparent',
                    borderColor: isSelected ? theme.colors.accent : theme.colors.textMuted,
                  },
                ]}>
                  {isSelected && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                </View>
                <ExerciseImage
                  exerciseId={item.id}
                  category={item.category}
                  variant="thumbnail"
                  animate={false}
                  style={{ marginLeft: 10 }}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 14 }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {item.difficulty} • {item.primary_muscles.slice(0, 2).join(', ')}
                  </Text>
                </View>
                <View style={[styles.diffBadge, { backgroundColor: theme.colors.surface }]}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 10, textTransform: 'uppercase' }}>
                    {item.category.replace('_', ' ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        />
      </SafeAreaView>
    );
  }

  // ===== STEP 2: CONFIGURE EXERCISES =====
  if (step === 'configure') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('select')}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="h3">{t('createWorkout.configure')}</ThemedText>
          <TouchableOpacity onPress={() => setStep('preview')}>
            <ThemedText variant="body" color="accent" weight="600">{t('createWorkout.preview')}</ThemedText>
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

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {selected.map((item, index) => (
            <Card key={item.exercise.id} style={styles.configCard}>
              <View style={styles.configHeader}>
                <ExerciseImage
                  exerciseId={item.exercise.id}
                  category={item.exercise.category}
                  variant="thumbnail"
                  animate={false}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" weight="600">{item.exercise.name}</ThemedText>
                  <ThemedText variant="bodySmall" color="secondary">
                    {item.exercise.primary_muscles.slice(0, 2).join(', ')}
                  </ThemedText>
                </View>
                <View style={styles.configActions}>
                  <TouchableOpacity onPress={() => moveExercise(index, 'up')} disabled={index === 0}>
                    <MaterialCommunityIcons name="chevron-up" size={20} color={index === 0 ? theme.colors.textMuted : theme.colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveExercise(index, 'down')} disabled={index === selected.length - 1}>
                    <MaterialCommunityIcons name="chevron-down" size={20} color={index === selected.length - 1 ? theme.colors.textMuted : theme.colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeExercise(item.exercise.id)}>
                    <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sets / Reps / Rest */}
              <View style={styles.configRow}>
                <View style={styles.configField}>
                  <ThemedText variant="bodySmall" color="secondary">{t('createWorkout.sets')}</ThemedText>
                  <View style={styles.stepper}>
                    <TouchableOpacity onPress={() => updateExerciseConfig(item.exercise.id, 'sets', Math.max(1, item.sets - 1))}>
                      <MaterialCommunityIcons name="minus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                    <ThemedText variant="h4" style={{ marginHorizontal: 12 }}>{item.sets}</ThemedText>
                    <TouchableOpacity onPress={() => updateExerciseConfig(item.exercise.id, 'sets', Math.min(10, item.sets + 1))}>
                      <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.configField}>
                  <ThemedText variant="bodySmall" color="secondary">{t('createWorkout.reps')}</ThemedText>
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
                  <ThemedText variant="bodySmall" color="secondary">{t('createWorkout.restSeconds')}</ThemedText>
                  <View style={styles.stepper}>
                    <TouchableOpacity onPress={() => updateExerciseConfig(item.exercise.id, 'restSeconds', Math.max(15, item.restSeconds - 15))}>
                      <MaterialCommunityIcons name="minus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                    <ThemedText variant="h4" style={{ marginHorizontal: 8 }}>{item.restSeconds}</ThemedText>
                    <TouchableOpacity onPress={() => updateExerciseConfig(item.exercise.id, 'restSeconds', Math.min(180, item.restSeconds + 15))}>
                      <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Instructions (expandable) */}
              <TouchableOpacity
                style={[styles.instructionToggle, { borderTopColor: theme.colors.border }]}
                onPress={() => setExpandedInstructions(prev => ({
                  ...prev,
                  [item.exercise.id]: !prev[item.exercise.id],
                }))}
              >
                <MaterialCommunityIcons
                  name={expandedInstructions[item.exercise.id] ? 'chevron-up' : 'text-box-outline'}
                  size={16}
                  color={theme.colors.accent}
                />
                <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                  {expandedInstructions[item.exercise.id] ? 'Hide Instructions' : 'Show Instructions'}
                </Text>
              </TouchableOpacity>

              {expandedInstructions[item.exercise.id] && item.exercise.instructions.length > 0 && (
                <View style={[styles.instructionBox, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}>
                  {item.exercise.instructions.map((instruction, idx) => (
                    <View key={idx} style={styles.instructionStep}>
                      <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700', width: 20 }}>
                        {idx + 1}.
                      </Text>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 }}>
                        {instruction}
                      </Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.narrateBtn, { backgroundColor: theme.colors.accent + '15' }]}
                    onPress={() => {
                      const text = `${item.exercise.name}. ${item.exercise.instructions.join('. ')}`;
                      audioService.speakNarration(text);
                    }}
                  >
                    <MaterialCommunityIcons name="volume-high" size={16} color={theme.colors.accent} />
                    <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
                      Read Aloud
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ===== STEP 3: PREVIEW =====
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('configure')}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <ThemedText variant="h3">{t('createWorkout.preview')}</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Summary */}
        <Card style={styles.summaryCard}>
          <ThemedText variant="h3">
            {workoutName.trim() || t('createWorkout.customWorkout')}
          </ThemedText>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="dumbbell" size={20} color={theme.colors.accent} />
              <ThemedText variant="body" style={{ marginLeft: 6 }}>{selected.length}</ThemedText>
              <ThemedText variant="bodySmall" color="secondary" style={{ marginLeft: 4 }}>{t('createWorkout.exercises')}</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.accent} />
              <ThemedText variant="body" style={{ marginLeft: 6 }}>~{Math.round(estimatedDuration)}</ThemedText>
              <ThemedText variant="bodySmall" color="secondary" style={{ marginLeft: 4 }}>{t('createWorkout.min')}</ThemedText>
            </View>
          </View>
        </Card>

        {/* Exercise List */}
        {selected.map((item, index) => (
          <Card key={item.exercise.id} style={styles.previewExercise}>
            <View style={styles.previewRow}>
              <View style={[styles.orderBadge, { backgroundColor: theme.colors.accent }]}>
                <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 12 }}>{index + 1}</Text>
              </View>
              <ExerciseImage
                exerciseId={item.exercise.id}
                category={item.exercise.category}
                variant="thumbnail"
                animate={false}
                style={{ marginLeft: 10 }}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText variant="body" weight="600">{item.exercise.name}</ThemedText>
                <ThemedText variant="bodySmall" color="secondary">
                  {item.sets} sets × {item.reps} • {item.restSeconds}s rest
                </ThemedText>
                {item.exercise.instructions.length > 0 && (
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>
                    {item.exercise.instructions[0]}
                  </Text>
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
          <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
          <Text style={[styles.saveButtonText, { color: theme.colors.text }]}>{t('createWorkout.saveWorkout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    padding: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
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
    fontSize: 10,
    fontWeight: '600',
  },
  filtersPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  categoryScroll: {
    flexGrow: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nameInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nameField: {
    fontSize: 15,
  },
  configCard: {
    padding: 16,
    marginBottom: 12,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  configActions: {
    flexDirection: 'row',
    gap: 8,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  configField: {
    flex: 1,
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  repsInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
    width: '100%',
  },
  summaryCard: {
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewExercise: {
    padding: 14,
    marginBottom: 8,
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
    padding: 18,
    borderRadius: 14,
    marginTop: 16,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  instructionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  instructionBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  narrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
});
