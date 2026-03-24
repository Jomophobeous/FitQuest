/**
 * FitQuest Exercises Screen (Exercise Library)
 * Premium glass-morphism design with animated cards
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { formatMuscleName } from '../src/utils/formatMuscle';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  Text,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Layout,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { getExercises } from '../src/database/service';
import { queryCache } from '../src/database/queryCache';
import ScreenTutorial from '../src/components/ScreenTutorial';
import type { ExerciseWithDetails, Category, Difficulty } from '../src/database/types';
import { GlassCard, SectionHeader, AnimatedListItem } from '../src/components/ui/GlassUI';
import { ExerciseDetailSheet } from '../src/components/ExerciseDetailSheet';
import ExerciseImage from '../src/components/ExerciseImage';

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
      style={{ paddingHorizontal: 16, marginBottom: 8 }}
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
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.exerciseName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.muscleTags}>
                {item.primary_muscles.slice(0, 2).map((m, i) => (
                  <View key={i} style={[styles.muscleTag, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text style={[styles.muscleTagText, { color: theme.colors.textSecondary }]}>
                      {formatMuscleName(m)}
                    </Text>
                  </View>
                ))}
                {item.primary_muscles.length > 2 && (
                  <View style={[styles.muscleTag, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text style={[styles.muscleTagText, { color: theme.colors.textMuted }]}>
                      +{item.primary_muscles.length - 2}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: diffColor + '12' }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>{item.difficulty}</Text>
            </View>
          </View>

          <View style={styles.exerciseBottom}>
            <View style={styles.bottomTag}>
              <MaterialCommunityIcons name="dumbbell" size={12} color={theme.colors.textMuted} />
              <Text style={[styles.bottomTagText, { color: theme.colors.textMuted }]}>
                {item.equipment_level === 'none' ? t('exercises.bodyweight') || 'Bodyweight' : item.equipment_level}
              </Text>
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
  const { isReady } = useDatabase();
  const router = useRouter();

  const [exercises, setExercises] = useState<ExerciseWithDetails[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<Category | 'all'>>(new Set(['all']));
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(new Set());
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
        headerVisible.value = withTiming(0, { duration: 250 });
      } else if (diff < -5) {
        headerVisible.value = withTiming(1, { duration: 200 });
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
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (isReady) loadExercises();
  }, [isReady]);

  // Memoized filtering — no separate state, derived from source data
  const filteredExercises = useMemo(() => {
    let filtered = exercises;
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
  }, [exercises, selectedCategories, selectedDifficulties, selectedEquipment, debouncedQuery]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      // Use cache — exercises rarely change
      const data = await queryCache.getOrFetch('exercises:all', () => getExercises(), 120_000);
      setExercises(data);
    } catch (error) {
      if (__DEV__) console.error('[Exercises] Failed to load:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('exercises.loadFailed') || 'Failed to load exercises. Please restart the app.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    queryCache.invalidate('exercises:all');
    await loadExercises();
    setRefreshing(false);
  }, []);

  const handleExercisePress = useCallback((exercise: ExerciseWithDetails) => {
    setSelectedExercise(exercise);
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    // Delay clearing to allow exit animation
    setTimeout(() => setSelectedExercise(null), 300);
  }, []);

  const renderExercise = useCallback(
    ({ item, index }: { item: ExerciseWithDetails; index: number }) => (
      <ExerciseCard item={item} index={index} theme={theme} t={t} onPress={handleExercisePress} />
    ),
    [theme, t, handleExercisePress],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Animated.Text
            entering={FadeIn.delay(300).duration(150)}
            style={[styles.loadingText, { color: theme.colors.textSecondary }]}
          >
            {t('exercises.loading') || 'Loading exercise library...'}
          </Animated.Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScreenErrorBoundary
      screenName="Exercises"
      onGoBack={() => (router.canGoBack() ? router.back() : router.replace('/dashboard' as any))}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                  {t('exercises.library') || 'Library'}
                </Text>
                <Text style={[styles.headerCount, { color: theme.colors.textSecondary }]}>
                  {filteredExercises.length} {t('exercises.of') || 'of'} {exercises.length}{' '}
                  {t('library.exercises') || 'exercises'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFilters(!showFilters)}
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
                <Text
                  style={{
                    color: activeFilterCount > 0 ? theme.colors.accent : theme.colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '600',
                    marginLeft: 3,
                  }}
                >
                  {t('exercises.filters') || 'Filters'}
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
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
                    <Text
                      style={[styles.categoryLabel, { color: isSelected ? theme.colors.onAccent : theme.colors.text }]}
                    >
                      {t(`exercises.category.${item.key}`) || item.label}
                    </Text>
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
            <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary }]}>
              {t('exercises.difficulty') || 'Difficulty'}
            </Text>
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
                    <Text style={{ color: isOn ? d.color : theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Equipment */}
            <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary, marginTop: 12 }]}>
              {t('exercises.equipment') || 'Equipment'}
            </Text>
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
                    <Text
                      style={{
                        color: isOn ? theme.colors.accent : theme.colors.text,
                        fontSize: 13,
                        fontWeight: '600',
                        marginLeft: 4,
                      }}
                    >
                      {eq.label}
                    </Text>
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
                style={{ marginTop: 12, alignSelf: 'flex-end' }}
              >
                <Text style={{ color: theme.colors.error, fontSize: 13, fontWeight: '600' }}>
                  {t('exercises.clearFilters') || 'Clear all filters'}
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* ── RESULTS COUNT ── */}
        <Animated.View entering={FadeIn.delay(200).duration(150)} style={styles.resultsRow}>
          <Text style={[styles.resultsText, { color: theme.colors.textSecondary }]}>
            {filteredExercises.length} {t('exercises.results') || 'exercises'}
          </Text>
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
          }
          ListEmptyComponent={
            <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.emptyState}>
              <MaterialCommunityIcons name="magnify-close" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {t('exercises.noResults') || 'No exercises found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                {t('exercises.adjustFilters') || 'Try adjusting your search or filters'}
              </Text>
            </Animated.View>
          }
        />

        {/* ── FAB: CREATE WORKOUT ── */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.accent }]}
          onPress={() => router.push('/create-workout' as any)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create new workout"
        >
          <MaterialCommunityIcons name="playlist-plus" size={26} color="#fff" />
        </TouchableOpacity>

        {/* ── EXERCISE DETAIL SHEET ── */}
        <ExerciseDetailSheet exercise={selectedExercise} visible={detailVisible} onClose={handleCloseDetail} />
      </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14 },
  headerWrapper: { zIndex: 10, overflow: 'hidden' },
  headerGradient: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerCount: { fontSize: 11, marginTop: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  categoryList: { paddingHorizontal: 12, paddingBottom: 8 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 16,
    marginRight: 6,
    overflow: 'hidden',
  },
  categoryLabel: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  resultsRow: { paddingHorizontal: 20, paddingVertical: 8 },
  resultsText: { fontSize: 13, fontWeight: '500' },
  list: { paddingBottom: 112 },
  exerciseCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exerciseContent: { flex: 1, padding: 14 },
  exerciseTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  exerciseName: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  muscleTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  muscleTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  muscleTagText: { fontSize: 12, fontWeight: '500' },
  diffBadge: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  diffText: { fontSize: 12, fontWeight: '600' },
  exerciseBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 14 },
  bottomTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottomTagText: { fontSize: 11 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '500', marginTop: 16 },
  emptySubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  expandedFilters: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
