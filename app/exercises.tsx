/**
 * FitQuest Exercises Screen (Exercise Library)
 * Premium glass-morphism design with animated cards
 */

import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { getExercises } from '../src/database/service';
import type { ExerciseWithDetails, Category, Difficulty } from '../src/database/types';
import { GlassCard, SectionHeader, AnimatedListItem } from '../src/components/ui/GlassUI';

// ============================================
// CATEGORY FILTERS
// ============================================

const CATEGORIES: { key: Category | 'all'; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'calisthenics', label: 'Calisthenics', icon: 'human-handsup' },
  { key: 'building_muscle', label: 'Muscle', icon: 'arm-flex' },
  { key: 'flexible', label: 'Flexibility', icon: 'yoga' },
  { key: 'faster', label: 'Speed', icon: 'run-fast' },
  { key: 'mental_clarity', label: 'Mind', icon: 'meditation' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#10B981',
  intermediate: '#F4A427',
  advanced: '#FF6B6B',
};

// ============================================
// COMPONENT
// ============================================

export default function ExercisesScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [exercises, setExercises] = useState<ExerciseWithDetails[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<ExerciseWithDetails[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => { loadExercises(); }, []);
  useEffect(() => { filterExercises(); }, [exercises, selectedCategory, searchQuery]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      console.log('[Exercises] Loading exercises...');
      const data = await getExercises();
      console.log(`[Exercises] Loaded ${data.length} exercises`);
      setExercises(data);
      if (data.length === 0) {
        console.warn('[Exercises] No exercises returned - database may not be seeded');
      }
    } catch (error) {
      console.error('[Exercises] Failed to load:', error);
      Alert.alert('Error', 'Failed to load exercises. Please restart the app.');
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = () => {
    let filtered = [...exercises];
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(ex => ex.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(q) ||
        ex.primary_muscles.some(m => m.toLowerCase().includes(q)) ||
        ex.category.toLowerCase().includes(q)
      );
    }
    setFilteredExercises(filtered);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExercises();
    setRefreshing(false);
  }, []);

  const handleExercisePress = (exercise: ExerciseWithDetails) => {
    const muscles = [
      ...exercise.primary_muscles.map(m => `• ${m} (primary)`),
      ...exercise.secondary_muscles.map(m => `• ${m} (secondary)`),
    ].join('\n');
    const instructions = exercise.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n');
    Alert.alert(
      exercise.name,
      `Difficulty: ${exercise.difficulty}\nEquipment: ${exercise.equipment_level}\nImpact: ${exercise.impact_level}\n\nMuscles:\n${muscles || 'Not specified'}\n\nInstructions:\n${instructions || 'Not specified'}`,
      [{ text: 'OK' }]
    );
  };

  const renderExercise = ({ item, index }: { item: ExerciseWithDetails; index: number }) => {
    const diffColor = DIFFICULTY_COLORS[item.difficulty] || theme.colors.textMuted;
    return (
      <AnimatedListItem index={index} onPress={() => handleExercisePress(item)} style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={[
          styles.exerciseCard,
          {
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
            borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          },
        ]}>
          <View style={styles.exerciseContent}>
            <View style={styles.exerciseTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exerciseName, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.muscleTags}>
                  {item.primary_muscles.slice(0, 2).map((m, i) => (
                    <View key={i} style={[styles.muscleTag, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                      <Text style={[styles.muscleTagText, { color: theme.colors.textSecondary }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.diffBadge, { backgroundColor: diffColor + '12' }]}>
                <Text style={[styles.diffText, { color: diffColor }]}>
                  {item.difficulty}
                </Text>
              </View>
            </View>

            <View style={styles.exerciseBottom}>
              <View style={styles.bottomTag}>
                <MaterialCommunityIcons name="dumbbell" size={12} color={theme.colors.textMuted} />
                <Text style={[styles.bottomTagText, { color: theme.colors.textMuted }]}>
                  {item.equipment_level === 'none' ? 'Bodyweight' : item.equipment_level}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
            </View>
          </View>
        </View>
      </AnimatedListItem>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Animated.Text
            entering={FadeIn.delay(300).duration(150)}
            style={[styles.loadingText, { color: theme.colors.textSecondary }]}
          >
            Loading exercise library...
          </Animated.Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── HEADER ── */}
      <Animated.View entering={FadeIn.duration(150)}>
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Library</Text>
          <Text style={[styles.headerCount, { color: theme.colors.textMuted }]}>
            {exercises.length} exercises
          </Text>
        </View>
      </Animated.View>

      {/* ── SEARCH BAR ── */}
      <Animated.View entering={FadeInDown.delay(100).duration(150)}>
        <View style={[
          styles.searchBar,
          {
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#fff',
            borderColor: searchFocused ? theme.colors.accent : (theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
          },
        ]}>
          <MaterialCommunityIcons name="magnify" size={20} color={searchFocused ? theme.colors.accent : theme.colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search exercises, muscles..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── CATEGORY PILLS ── */}
      <Animated.View entering={FadeInDown.delay(150).duration(150)}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.key;
            return (
              <TouchableOpacity
                onPress={() => setSelectedCategory(item.key)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected ? theme.colors.accent : (theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={15}
                  color={isSelected ? '#fff' : theme.colors.textMuted}
                />
                <Text style={[styles.categoryLabel, { color: isSelected ? '#fff' : theme.colors.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </Animated.View>

      {/* ── RESULTS COUNT ── */}
      <Animated.View entering={FadeIn.delay(200).duration(150)} style={styles.resultsRow}>
        <Text style={[styles.resultsText, { color: theme.colors.textSecondary }]}>
          {filteredExercises.length} result{filteredExercises.length !== 1 ? 's' : ''}
        </Text>
      </Animated.View>

      {/* ── EXERCISE LIST ── */}
      <FlatList
        data={filteredExercises}
        renderItem={renderExercise}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.emptyState}>
            <MaterialCommunityIcons name="magnify-close" size={48} color={theme.colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No exercises found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
              Try adjusting your search or filters
            </Text>
          </Animated.View>
        }
      />

      {/* ── FAB: CREATE WORKOUT ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.accent }]}
        onPress={() => router.push('/create-workout' as any)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="playlist-plus" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14 },
  headerGradient: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerCount: { fontSize: 13, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  categoryList: { paddingHorizontal: 16, paddingBottom: 8 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    overflow: 'hidden',
  },
  categoryLabel: { fontSize: 13, fontWeight: '500', marginLeft: 6 },
  resultsRow: { paddingHorizontal: 20, paddingVertical: 6 },
  resultsText: { fontSize: 12, fontWeight: '500' },
  list: { paddingBottom: 24 },
  exerciseCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exerciseContent: { flex: 1, padding: 14 },
  exerciseTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  exerciseName: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  muscleTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  muscleTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  muscleTagText: { fontSize: 11, fontWeight: '500' },
  diffBadge: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffText: { fontSize: 11, fontWeight: '500' },
  exerciseBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
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
});
