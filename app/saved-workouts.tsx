/**
 * FitQuest Saved Workouts Screen
 * Displays user-created custom workouts with glass-morphism UI.
 * Supports expand/collapse, swipe/long-press delete, and quick-start.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  SlideInRight,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { getRecentSessions, deleteWorkoutSession } from '../src/database/service';
import type { WorkoutSession } from '../src/database/types';
import {
  GlassCard,
  GradientButton,
  SectionHeader,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';

// ============================================
// CONSTANTS
// ============================================

const USER_ID = 'user_local_001';

// ============================================
// HELPERS
// ============================================

/** Extract a display name from a custom workout session */
function getWorkoutName(session: WorkoutSession): string {
  if (session.notes?.startsWith('Custom:')) {
    return session.notes.replace('Custom:', '').trim();
  }
  return 'Unnamed Workout';
}

/** Format a date string into a human-readable relative label */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/** Estimate duration label */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ============================================
// SCREEN
// ============================================

export default function SavedWorkoutsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ------------------------------------------
  // DATA LOADING
  // ------------------------------------------

  const loadWorkouts = useCallback(async () => {
    try {
      const sessions = await getRecentSessions(USER_ID, 50);
      const custom = sessions.filter(
        (s) => s.id.startsWith('custom_') || s.notes?.startsWith('Custom:'),
      );
      setWorkouts(custom);
    } catch (err) {
      console.warn('[SavedWorkouts] Failed to load:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  // Refresh when the screen gains focus (e.g. after creating a workout)
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkouts();
  }, [loadWorkouts]);

  // ------------------------------------------
  // ACTIONS
  // ------------------------------------------

  const confirmDelete = (session: WorkoutSession) => {
    const name = getWorkoutName(session);
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkoutSession(session.id);
              setWorkouts((prev) => prev.filter((w) => w.id !== session.id));
              if (expandedId === session.id) setExpandedId(null);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete workout. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleStartWorkout = (session: WorkoutSession) => {
    router.push({
      pathname: '/workout',
      params: { sessionId: session.id },
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ------------------------------------------
  // RENDER: EMPTY STATE
  // ------------------------------------------

  const renderEmptyState = () => (
    <Animated.View entering={FadeIn.delay(200).duration(150)} style={styles.emptyContainer}>
      <GlassCard
        style={styles.emptyCard}
        gradient
        glowColor={theme.colors.accent}
        delay={100}
      >
        <View style={styles.emptyContent}>
          <Animated.View entering={ZoomIn.delay(400).duration(150)}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: theme.colors.accent + '18' },
              ]}
            >
              <MaterialCommunityIcons
                name="bookmark-plus-outline"
                size={56}
                color={theme.colors.accent}
              />
            </View>
          </Animated.View>

          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Saved Workouts Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
            Build your first custom workout by selecting exercises tailored to your goals.
            It only takes a minute!
          </Text>

          <View style={styles.emptyFeatures}>
            {[
              { icon: 'dumbbell' as const, text: 'Pick your exercises' },
              { icon: 'timer-outline' as const, text: 'Set reps & rest' },
              { icon: 'play-circle-outline' as const, text: 'Start anytime' },
            ].map((f, i) => (
              <Animated.View
                key={f.text}
                entering={SlideInRight.delay(600 + i * 120).duration(150)}
                style={styles.emptyFeatureRow}
              >
                <View
                  style={[
                    styles.emptyFeatureIcon,
                    { backgroundColor: theme.colors.accent + '14' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={f.icon}
                    size={18}
                    color={theme.colors.accent}
                  />
                </View>
                <Text style={[styles.emptyFeatureText, { color: theme.colors.textSecondary }]}>
                  {f.text}
                </Text>
              </Animated.View>
            ))}
          </View>

          <View style={{ marginTop: 24, width: '100%' }}>
            <GradientButton
              title="Create Your First Workout"
              icon="plus"
              onPress={() => router.push('/create-workout')}
              variant="primary"
            />
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );

  // ------------------------------------------
  // RENDER: WORKOUT CARD
  // ------------------------------------------

  const renderWorkoutCard = (session: WorkoutSession, index: number) => {
    const isExpanded = expandedId === session.id;
    const name = getWorkoutName(session);
    const duration = formatDuration(session.duration_minutes);
    const dateLabel = formatDate(session.started_at);
    const exerciseCount = session.total_exercises;
    const completed = session.completed_exercises;
    const wasSuccessful = !!session.success;

    // Accent colour per card for visual variety
    const cardAccents = [
      theme.colors.accent,
      theme.colors.accent2 ?? '#7C3AED',
      theme.colors.accent3 ?? '#10B981',
      theme.colors.success,
      theme.colors.warning,
    ];
    const accentColor = cardAccents[index % cardAccents.length];

    return (
      <AnimatedListItem key={session.id} index={index} style={styles.cardOuter}>
        <GlassCard
          style={styles.workoutCard}
          gradient
          glowColor={accentColor}
          delay={index * 80}
          onPress={() => toggleExpand(session.id)}
        >
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIconWrap,
                { backgroundColor: accentColor + '20' },
              ]}
            >
              <MaterialCommunityIcons
                name="lightning-bolt"
                size={22}
                color={accentColor}
              />
            </View>

            <View style={styles.cardTitleArea}>
              <Text
                style={[styles.cardTitle, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text style={[styles.cardDate, { color: theme.colors.textMuted }]}>
                {dateLabel}
              </Text>
            </View>

            {/* Status badge */}
            {!!wasSuccessful && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.colors.success + '18' },
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={14}
                  color={theme.colors.success}
                />
                <Text style={[styles.statusText, { color: theme.colors.success }]}>
                  Done
                </Text>
              </View>
            )}

            {/* Delete (long-press alternative trigger) */}
            <TouchableOpacity
              onPress={() => confirmDelete(session)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteBtn}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={20}
                color={theme.colors.error}
              />
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <StatPill
              icon="dumbbell"
              value={`${exerciseCount}`}
              label="exercises"
              color={accentColor}
              textColor={theme.colors.textSecondary}
              bgColor={accentColor + '12'}
            />
            <StatPill
              icon="clock-outline"
              value={duration}
              label=""
              color={accentColor}
              textColor={theme.colors.textSecondary}
              bgColor={accentColor + '12'}
            />
            {completed > 0 && (
              <StatPill
                icon="check-bold"
                value={`${completed}/${exerciseCount}`}
                label="done"
                color={theme.colors.success}
                textColor={theme.colors.textSecondary}
                bgColor={theme.colors.success + '12'}
              />
            )}
          </View>

          {/* Expanded Area */}
          {!!isExpanded && (
            <Animated.View entering={FadeInDown.duration(150)} style={styles.expandedArea}>
              <View
                style={[
                  styles.expandedDivider,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              {/* Session details */}
              <View style={styles.expandedDetails}>
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                  <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                    Created {dateLabel}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons
                    name="timer-sand"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                  <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                    Estimated {duration}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons
                    name="format-list-numbered"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                  <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                    {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} in this workout
                  </Text>
                </View>
                {session.notes && !session.notes.startsWith('Custom:') && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="note-text-outline"
                      size={16}
                      color={theme.colors.textMuted}
                    />
                    <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                      {session.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.expandedActions}>
                <View style={{ flex: 1 }}>
                  <GradientButton
                    title="Start Workout"
                    icon="play"
                    onPress={() => handleStartWorkout(session)}
                    variant="primary"
                    size="md"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.deleteActionBtn,
                    {
                      borderColor: theme.colors.error + '30',
                      backgroundColor: theme.colors.error + '0A',
                    },
                  ]}
                  onPress={() => confirmDelete(session)}
                >
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={22}
                    color={theme.colors.error}
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Expand chevron */}
          <View style={styles.chevronRow}>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.colors.textMuted}
            />
          </View>
        </GlassCard>
      </AnimatedListItem>
    );
  };

  // ------------------------------------------
  // MAIN RENDER
  // ------------------------------------------

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(150)} style={styles.headerContainer}>
        <LinearGradient
          colors={
            theme.isDark
              ? ([theme.colors.accent + '25', 'transparent'] as [string, string])
              : ([theme.colors.accent + '10', 'transparent'] as [string, string])
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.colors.surface }]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={theme.colors.text}
            />
          </TouchableOpacity>

          <View style={styles.headerTextArea}>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
              Saved Workouts
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.colors.textMuted }]}>
              {workouts.length > 0
                ? `${workouts.length} custom workout${workouts.length !== 1 ? 's' : ''}`
                : 'Your personal collection'}
            </Text>
          </View>

          <View
            style={[
              styles.headerIconWrap,
              { backgroundColor: theme.colors.accent + '18' },
            ]}
          >
            <MaterialCommunityIcons
              name="bookmark-multiple"
              size={26}
              color={theme.colors.accent}
            />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Body */}
      {loading ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.loadingContainer}>
          <MaterialCommunityIcons
            name="loading"
            size={36}
            color={theme.colors.accent}
          />
          <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
            Loading workouts…
          </Text>
        </Animated.View>
      ) : workouts.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => renderWorkoutCard(item, index)}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          ListHeaderComponent={<SectionHeader title="My Workouts" delay={100} />}
          ListFooterComponent={<View style={styles.bottomSpacer} />}
        />
      )}

      {/* Floating Action Button */}
      {!loading && (
        <Animated.View
          entering={ZoomIn.delay(100).duration(150)}
          style={styles.fabContainer}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/create-workout')}
          >
            <LinearGradient
              colors={[theme.colors.accent, '#4338CA'] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fab}
            >
              <MaterialCommunityIcons name="plus" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ============================================
// STAT PILL SUB-COMPONENT
// ============================================

interface StatPillProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
  color: string;
  textColor: string;
  bgColor: string;
}

function StatPill({ icon, value, label, color, textColor, bgColor }: StatPillProps) {
  return (
    <View style={[styles.statPill, { backgroundColor: bgColor }]}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      {label ? (
        <Text style={[styles.statPillLabel, { color: textColor }]}>{label}</Text>
      ) : null}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  /* Header */
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 18,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTextArea: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  /* Loading */
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Empty state */
  emptyContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  emptyCard: {
    padding: 28,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  emptyFeatures: {
    alignSelf: 'stretch',
    gap: 12,
  },
  emptyFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFeatureText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Workout Card */
  cardOuter: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  workoutCard: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 6,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statPillValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  /* Expanded */
  expandedArea: {
    marginTop: 12,
  },
  expandedDivider: {
    height: 1,
    marginBottom: 14,
    opacity: 0.3,
  },
  expandedDetails: {
    gap: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  expandedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Chevron */
  chevronRow: {
    alignItems: 'center',
    marginTop: 8,
  },

  /* FAB */
  fabContainer: {
    position: 'absolute',
    bottom: 28,
    right: 22,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5F63FF',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  /* Bottom spacer */
  bottomSpacer: {
    height: 24,
  },
});
