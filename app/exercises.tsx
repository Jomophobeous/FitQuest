/**
 * FitQuest Exercises Screen (Exercise Library)
 * Premium glass-morphism design with animated cards
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { formatMuscleName } from '../src/utils/formatMuscle';
import { haptic } from '../src/utils/haptics';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import {
  useExercisesViewModel,
  type ExerciseWithDetails,
  type Category,
} from '../src/viewmodels/useExercisesViewModel';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { AnimatedListItem, GradientButton } from '../src/components/ui/GlassUI';
import { ExerciseDetailSheet } from '../src/components/ExerciseDetailSheet';
import ExerciseImage from '../src/components/ExerciseImage';
import ThemedText from '../src/components/ThemedText';
import { typography, spacing, radius } from '../src/design/theme-system';
import { MOTION } from '../src/design/motion';

// ============================================
// CATEGORY FILTERS
// ============================================

const CATEGORIES: { key: Category | 'all'; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'body_control', label: 'Body Control', icon: 'human-handsup' },
  { key: 'strength', label: 'Strength', icon: 'arm-flex' },
  { key: 'mobility', label: 'Mobility', icon: 'yoga' },
  { key: 'speed', label: 'Speed', icon: 'run-fast' },
  { key: 'posture', label: 'Posture', icon: 'human' },
  { key: 'focus', label: 'Focus', icon: 'meditation' },
];

const getDifficultyColors = (colors: { accent: string; warning: string; error: string }): Record<string, string> => ({
  beginner: colors.accent,
  intermediate: colors.warning,
  advanced: colors.error,
});

// ============================================
// MEMOIZED EXERCISE CARD
// ============================================

const ExerciseCard = React.memo(function ExerciseCard({
  item,
  index,
  theme,
  t,
  onPress,
}: {
  item: ExerciseWithDetails;
  index: number;
  theme: any;
  t: (key: string) => string | undefined;
  onPress: (exercise: ExerciseWithDetails) => void;
}) {
  const diffColor = getDifficultyColors(theme.colors)[item.difficulty] || theme.colors.textMuted;
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  return (
    <AnimatedListItem
      index={index}
      onPress={handlePress}
      style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.difficulty}, ${item.category}`}
      accessibilityHint="Double tap to view exercise details"
    >
      <View
        style={[
          styles.exerciseCard,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.exerciseContent}>
          <View style={styles.exerciseTop}>
            <ExerciseImage
              exerciseId={item.id}
              category={item.category}
              variant="thumbnail"
              animate={false}
              style={{ marginRight: spacing[3] }}
            />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.exerciseName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </ThemedText>
              <View style={styles.muscleTags}>
                {item.primary_muscles.slice(0, 2).map((m, i) => (
                  <View key={i} style={[styles.muscleTag, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <ThemedText style={[styles.muscleTagText, { color: theme.colors.textSecondary }]}>
                      {formatMuscleName(m)}
                    </ThemedText>
                  </View>
                ))}
                {item.primary_muscles.length > 2 && (
                  <View style={[styles.muscleTag, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <ThemedText style={[styles.muscleTagText, { color: theme.colors.textMuted }]}>
                      +{item.primary_muscles.length - 2}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: diffColor + '12' }]}>
              <ThemedText style={[styles.diffText, { color: diffColor }]}>{item.difficulty}</ThemedText>
            </View>
          </View>

          <View style={styles.exerciseBottom}>
            <View style={styles.bottomTag}>
              <MaterialCommunityIcons name="dumbbell" size={12} color={theme.colors.textMuted} />
              <ThemedText style={[styles.bottomTagText, { color: theme.colors.textMuted }]}>
                {item.equipment_level === 'none' ? t('exercises.bodyweight') || 'Bodyweight' : item.equipment_level}
              </ThemedText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
          </View>
        </View>
      </View>
    </AnimatedListItem>
  );
});

// ============================================
// COMPONENT
// ============================================

export default function ExercisesScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const vm = useExercisesViewModel();
  const router = useRouter();

  const [selectedCategories, setSelectedCategories] = useState<Set<Category | 'all'>>(new Set(['all']));
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(new Set());
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWithDetails | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Scroll-driven header collapse
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const headerVisible = useSharedValue(1); // 1 = visible, 0 = hidden

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const diff = y - lastScrollY.value;
      // Scrolling down past 60px → hide header; scrolling up → show
      if (diff > 5 && y > 60) {
        headerVisible.value = withTiming(0, { duration: MOTION.base });
      } else if (diff < -5) {
        headerVisible.value = withTiming(1, { duration: MOTION.swift });
      }
      lastScrollY.value = y;
      scrollY.value = y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(headerVisible.value, [0, 1], [0, 200], Extrapolation.CLAMP),
    opacity: headerVisible.value,
  }));

  const DIFFICULTIES = [
    { key: 'beginner', label: t('exercises.beginner') || 'Beginner', color: theme.colors.accent },
    { key: 'intermediate', label: t('exercises.intermediate') || 'Intermediate', color: theme.colors.warning },
    { key: 'advanced', label: t('exercises.advanced') || 'Advanced', color: theme.colors.error },
  ];

  const EQUIPMENT = [
    { key: 'none', label: t('exercises.bodyweight') || 'Bodyweight', icon: 'human' as const },
    { key: 'minimal', label: t('exercises.minimal') || 'Minimal', icon: 'dumbbell' as const },
    { key: 'playground', label: t('exercises.playground') || 'Playground', icon: 'weight-lifter' as const },
  ];

  const toggleCategory = (key: Category | 'all') => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (key === 'all') return new Set(['all']);
      next.delete('all');
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next.size === 0 ? new Set(['all'] as (Category | 'all')[]) : next;
    });
  };

  const toggleDifficulty = (key: string) => {
    setSelectedDifficulties((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleEquipment = (key: string) => {
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedCategories(new Set(['all']));
    setSelectedDifficulties(new Set());
    setSelectedEquipment(new Set());
    setSearchQuery('');
  };

  const activeFilterCount =
    (selectedCategories.has('all') ? 0 : selectedCategories.size) + selectedDifficulties.size + selectedEquipment.size;

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 200); // debounce
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  // Memoized filtering — no separate state, derived from source data
  const filteredExercises = useMemo(() => {
    let filtered = vm.exercises;
    if (!selectedCategories.has('all')) {
      filtered = filtered.filter((ex) => selectedCategories.has(ex.category));
    }
    if (selectedDifficulties.size > 0) {
      filtered = filtered.filter((ex) => selectedDifficulties.has(ex.difficulty));
    }
    if (selectedEquipment.size > 0) {
      filtered = filtered.filter((ex) => selectedEquipment.has(ex.equipment_level));
    }
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      filtered = filtered.filter(
        (ex) =>
          ex.name.toLowerCase().includes(q) ||
          ex.primary_muscles.some((m) => m.toLowerCase().includes(q)) ||
          ex.category.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [vm.exercises, selectedCategories, selectedDifficulties, selectedEquipment, debouncedQuery]);

  const handleExercisePress = useCallback((exercise: ExerciseWithDetails) => {
    setSelectedExercise(exercise);
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    // Delay clearing to allow exit animation
    setTimeout(() => setSelectedExercise(null), 300); // debounce
  }, []);

  const renderExercise = useCallback(
    ({ item, index }: { item: ExerciseWithDetails; index: number }) => (
      <ExerciseCard item={item} index={index} theme={theme} t={t} onPress={handleExercisePress} />
    ),
    [theme, t, handleExercisePress],
  );

  if (vm.loading) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Animated.Text
            entering={FadeIn.delay(300).duration(150)}
            style={[styles.loadingText, { color: theme.colors.textSecondary }]}
          >
            {t('exercises.loading') || 'Loading exercise library...'}
          </Animated.Text>
        </View>
      </ScreenContainer>
    );
  }

  if (vm.loadError) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>
            {vm.loadError}
          </ThemedText>
          <GradientButton
            title={t('common.retry') ?? 'Retry'}
            onPress={() => {
              vm.loadExercises();
            }}
            style={{ marginTop: spacing[4] }}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary
      screenName="Exercises"
      onGoBack={() => (router.canGoBack() ? router.back() : router.replace('/dashboard' as any))}
    >
      <ScreenContainer>
        <ScreenTutorial
          screenKey="exercises"
          icon="dumbbell"
          title="Exercise Library"
          description="Browse and search all available exercises. Filter by category, difficulty, and equipment to find the perfect exercise for your workout."
        />
        {/* ── COLLAPSIBLE HEADER SECTION ── */}
        <Animated.View style={[styles.headerWrapper, headerAnimatedStyle]}>
          {/* ── HEADER ── */}
          <View
            style={[
              styles.headerGradient,
              {
                backgroundColor: theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <ThemedText style={[styles.headerTitle, { color: theme.colors.text }]}>
                  {t('exercises.library') || 'Library'}
                </ThemedText>
                <ThemedText style={[styles.headerCount, { color: theme.colors.textSecondary }]}>
                  {filteredExercises.length} {t('exercises.of') || 'of'} {vm.exercises.length}{' '}
                  {t('library.exercises') || 'exercises'}
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptic('buttonPress');
                  setShowFilters(!showFilters);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
                accessibilityState={{ expanded: showFilters }}
                style={[
                  styles.filterToggle,
                  {
                    backgroundColor: activeFilterCount > 0 ? theme.colors.accent + '18' : theme.colors.surfaceVariant,
                    borderColor: activeFilterCount > 0 ? theme.colors.accent : theme.colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="filter-variant"
                  size={16}
                  color={activeFilterCount > 0 ? theme.colors.accent : theme.colors.textSecondary}
                />
                <ThemedText
                  style={{
                    color: activeFilterCount > 0 ? theme.colors.accent : theme.colors.textSecondary,
                    fontSize: typography.sizes.caption,
                    fontWeight: '600',
                    marginLeft: spacing[0.75],
                  }}
                >
                  {t('exercises.filters') || 'Filters'}
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </ThemedText>
                <MaterialCommunityIcons
                  name={showFilters ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SEARCH BAR ── */}
          <View>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: searchFocused ? theme.colors.accent : theme.colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={18}
                color={searchFocused ? theme.colors.accent : theme.colors.textMuted}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder={t('exercises.searchPlaceholder') || 'Search exercises, muscles...'}
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                accessibilityLabel="Search exercises"
                accessibilityRole="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── CATEGORY PILLS ── */}
          <View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CATEGORIES}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.categoryList}
              renderItem={({ item }) => {
                const isSelected = selectedCategories.has(item.key);
                return (
                  <TouchableOpacity
                    onPress={() => toggleCategory(item.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${item.label}`}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: isSelected ? theme.colors.accent : theme.colors.surfaceVariant,
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={15}
                      color={isSelected ? theme.colors.onAccent : theme.colors.textSecondary}
                    />
                    <ThemedText
                      style={[styles.categoryLabel, { color: isSelected ? theme.colors.onAccent : theme.colors.text }]}
                    >
                      {t(`exercises.category.${item.key}`) || item.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Animated.View>

        {/* ── EXPANDED FILTERS (difficulty + equipment) ── */}
        {showFilters && (
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={[
              styles.expandedFilters,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            {/* Difficulty */}
            <ThemedText style={[styles.filterSectionLabel, { color: theme.colors.textSecondary }]}>
              {t('exercises.difficulty') || 'Difficulty'}
            </ThemedText>
            <View style={styles.filterChipsRow}>
              {DIFFICULTIES.map((d) => {
                const isOn = selectedDifficulties.has(d.key);
                return (
                  <TouchableOpacity
                    key={d.key}
                    onPress={() => toggleDifficulty(d.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${d.label} difficulty`}
                    accessibilityState={{ selected: isOn }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isOn ? d.color + '20' : theme.colors.surfaceVariant,
                        borderColor: isOn ? d.color : theme.colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.filterDot, { backgroundColor: d.color }]} />
                    <ThemedText
                      style={{
                        color: isOn ? d.color : theme.colors.text,
                        fontSize: typography.sizes.label,
                        fontWeight: '600',
                      }}
                    >
                      {d.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Equipment */}
            <ThemedText
              style={[styles.filterSectionLabel, { color: theme.colors.textSecondary, marginTop: spacing[3] }]}
            >
              {t('exercises.equipment') || 'Equipment'}
            </ThemedText>
            <View style={styles.filterChipsRow}>
              {EQUIPMENT.map((eq) => {
                const isOn = selectedEquipment.has(eq.key);
                return (
                  <TouchableOpacity
                    key={eq.key}
                    onPress={() => toggleEquipment(eq.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${eq.label} equipment`}
                    accessibilityState={{ selected: isOn }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isOn ? theme.colors.accent + '20' : theme.colors.surfaceVariant,
                        borderColor: isOn ? theme.colors.accent : theme.colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={eq.icon}
                      size={14}
                      color={isOn ? theme.colors.accent : theme.colors.textSecondary}
                    />
                    <ThemedText
                      style={{
                        color: isOn ? theme.colors.accent : theme.colors.text,
                        fontSize: typography.sizes.label,
                        fontWeight: '600',
                        marginLeft: spacing[1],
                      }}
                    >
                      {eq.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <TouchableOpacity
                onPress={clearAllFilters}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                style={{ marginTop: spacing[3], alignSelf: 'flex-end' }}
              >
                <ThemedText style={{ color: theme.colors.error, fontSize: typography.sizes.label, fontWeight: '600' }}>
                  {t('exercises.clearFilters') || 'Clear all filters'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* ── RESULTS COUNT ── */}
        <Animated.View entering={FadeIn.delay(200).duration(150)} style={styles.resultsRow}>
          <ThemedText style={[styles.resultsText, { color: theme.colors.textSecondary }]}>
            {filteredExercises.length} {t('exercises.results') || 'exercises'}
          </ThemedText>
        </Animated.View>

        {/* ── EXERCISE LIST ── */}
        <Animated.FlatList
          data={filteredExercises}
          renderItem={renderExercise}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          getItemLayout={(_data, index) => ({ length: 130, offset: 130 * index, index })}
          refreshControl={
            <RefreshControl refreshing={vm.refreshing} onRefresh={vm.handleRefresh} tintColor={theme.colors.accent} />
          }
          ListEmptyComponent={
            <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.emptyState}>
              <MaterialCommunityIcons name="magnify-close" size={48} color={theme.colors.textMuted} />
              <ThemedText style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {t('exercises.noResults') || 'No exercises found'}
              </ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                {t('exercises.adjustFilters') || 'Try adjusting your search or filters'}
              </ThemedText>
            </Animated.View>
          }
        />

        {/* ── FAB: CREATE WORKOUT ── */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.accent }]}
          onPress={() => {
            haptic('buttonPress');
            router.push('/create-workout' as any);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create new workout"
        >
          <MaterialCommunityIcons name="playlist-plus" size={26} color={theme.colors.onAccent} />
        </TouchableOpacity>

        {/* ── EXERCISE DETAIL SHEET ── */}
        <ExerciseDetailSheet exercise={selectedExercise} visible={detailVisible} onClose={handleCloseDetail} />
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing[4], fontSize: typography.sizes.bodySmall },
  headerWrapper: { zIndex: 10, overflow: 'hidden' },
  headerGradient: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[1.5] },
  headerTitle: { fontSize: typography.sizes.h3, fontWeight: '700' },
  headerCount: { fontSize: typography.sizes.captionSm, marginTop: spacing['px'] },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[3],
    marginTop: spacing[1.5],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: spacing[2], fontSize: typography.sizes.bodySmall },
  categoryList: { paddingHorizontal: spacing[3], paddingBottom: spacing[2] },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    minHeight: 44,
    borderRadius: radius.xl,
    marginRight: spacing[1.5],
    overflow: 'hidden',
  },
  categoryLabel: { fontSize: typography.sizes.caption, fontWeight: '600', marginLeft: spacing[1] },
  resultsRow: { paddingHorizontal: spacing[5], paddingVertical: spacing[2] },
  resultsText: { fontSize: typography.sizes.label, fontWeight: '500' },
  list: { paddingBottom: spacing[25] },
  exerciseCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exerciseContent: { flex: 1, padding: spacing[3.5] },
  exerciseTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  exerciseName: { fontSize: typography.sizes.h4, fontWeight: '700', marginBottom: spacing[2] },
  muscleTags: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  muscleTag: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: radius.md },
  muscleTagText: { fontSize: typography.sizes.caption, fontWeight: '500' },
  diffBadge: {
    alignItems: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.25],
    borderRadius: radius.md,
  },
  diffText: { fontSize: typography.sizes.caption, fontWeight: '600' },
  exerciseBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[3.5], gap: spacing[3.5] },
  bottomTag: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  bottomTagText: { fontSize: typography.sizes.captionSm },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[12] },
  emptyTitle: { fontSize: typography.sizes.body, fontWeight: '500', marginTop: spacing[4] },
  emptySubtitle: { fontSize: typography.sizes.label, marginTop: spacing[1], lineHeight: 18 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000', // TODO: theme-aware shadows
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[0.5],
  },
  expandedFilters: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  filterSectionLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[1],
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: radius.sm,
  },
});
