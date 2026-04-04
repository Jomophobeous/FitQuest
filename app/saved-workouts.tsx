/**
 * FitQuest Saved Workouts Screen
 * Displays user-created custom workouts with glass-morphism UI.
 * Supports expand/collapse, swipe/long-press delete, and quick-start.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn, SlideInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { useSavedWorkoutsViewModel, type WorkoutSession } from '../src/viewmodels/useSavedWorkoutsViewModel';
import { useToast } from '../src/context/ToastContext';
import ThemedText from '../src/components/ThemedText';
import ExerciseImage from '../src/components/ExerciseImage';
import { GlassCard, GradientButton, SectionHeader, AnimatedListItem } from '../src/components/ui/GlassUI';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { typography, spacing, radius } from '../src/design/theme-system';

// ============================================
// CONSTANTS
// ============================================

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
function formatDate(dateStr: string, t: (key: string) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('common.today');
  if (diffDays === 1) return t('common.yesterday');
  if (diffDays < 7) return `${diffDays} ${t('common.days')} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${t('common.weeks')} ago`;
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
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { isReady: dbReady } = useDatabase();
  const router = useRouter();
  const vm = useSavedWorkoutsViewModel();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (dbReady) vm.loadWorkouts();
  }, [dbReady, vm]);

  useFocusEffect(
    useCallback(() => {
      if (dbReady) vm.loadWorkouts();
    }, [dbReady, vm]),
  );

  // ------------------------------------------
  // ACTIONS
  // ------------------------------------------

  const confirmDelete = useCallback(
    (session: WorkoutSession) => {
      const name = getWorkoutName(session);
      Alert.alert(t('savedWorkouts.deleteTitle'), t('savedWorkouts.deleteConfirm').replace('{name}', name), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await vm.deleteWorkout(session.id);
              if (expandedId === session.id) setExpandedId(null);
            } catch {
              showToast({ message: t('savedWorkouts.deleteError'), type: 'error' });
            }
          },
        },
      ]);
    },
    [expandedId, vm, t, showToast],
  );

  const handleStartWorkout = useCallback(
    (session: WorkoutSession) => {
      router.push({
        pathname: '/workout',
        params: { sessionId: session.id },
      });
    },
    [router],
  );

  const toggleExpand = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(id);
      await vm.loadSessionExercises(id);
    },
    [expandedId, vm],
  );

  // ------------------------------------------
  // RENDER: EMPTY STATE
  // ------------------------------------------

  const renderEmptyState = () => (
    <Animated.View entering={FadeIn.delay(200).duration(150)} style={styles.emptyContainer}>
      <GlassCard style={styles.emptyCard} gradient glowColor={theme.colors.accent} delay={100}>
        <View style={styles.emptyContent}>
          <Animated.View entering={ZoomIn.delay(400).duration(150)}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.accent + '18' }]}>
              <MaterialCommunityIcons name="bookmark-plus-outline" size={56} color={theme.colors.accent} />
            </View>
          </Animated.View>

          <ThemedText style={[styles.emptyTitle, { color: theme.colors.text }]}>
            {t('savedWorkouts.emptyTitle')}
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
            {t('savedWorkouts.emptySubtitle')}
          </ThemedText>

          <View style={styles.emptyFeatures}>
            {[
              { icon: 'dumbbell' as const, text: t('savedWorkouts.featurePick') },
              { icon: 'timer-outline' as const, text: t('savedWorkouts.featureSet') },
              { icon: 'play-circle-outline' as const, text: t('savedWorkouts.featureStart') },
            ].map((f, i) => (
              <Animated.View
                key={f.text}
                entering={SlideInRight.delay(600 + i * 120).duration(150)}
                style={styles.emptyFeatureRow}
              >
                <View style={[styles.emptyFeatureIcon, { backgroundColor: theme.colors.accent + '14' }]}>
                  <MaterialCommunityIcons name={f.icon} size={18} color={theme.colors.accent} />
                </View>
                <ThemedText style={[styles.emptyFeatureText, { color: theme.colors.textSecondary }]}>
                  {f.text}
                </ThemedText>
              </Animated.View>
            ))}
          </View>

          <View style={{ marginTop: spacing[6], width: '100%' }}>
            <GradientButton
              title={t('savedWorkouts.createFirst')}
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

  const renderWorkoutCard = useCallback(
    (session: WorkoutSession, index: number) => {
      const isExpanded = expandedId === session.id;
      const name = getWorkoutName(session);
      const duration = formatDuration(session.duration_minutes);
      const dateLabel = formatDate(session.started_at, t);
      const exerciseCount = session.total_exercises;
      const completed = session.completed_exercises;
      const wasSuccessful = !!session.success;

      // Accent colour per card for visual variety
      const cardAccents = [
        theme.colors.accent,
        theme.colors.accent2 ?? theme.colors.purple,
        theme.colors.accent3 ?? theme.colors.accent,
        theme.colors.success,
        theme.colors.warning,
      ];
      const accentColor = cardAccents[index % cardAccents.length]!;

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
              <View style={[styles.cardIconWrap, { backgroundColor: accentColor + '20' }]}>
                <MaterialCommunityIcons name="lightning-bolt" size={22} color={accentColor} />
              </View>

              <View style={styles.cardTitleArea}>
                <ThemedText style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {name}
                </ThemedText>
                <ThemedText style={[styles.cardDate, { color: theme.colors.textMuted }]}>{dateLabel}</ThemedText>
              </View>

              {/* Status badge */}
              {!!wasSuccessful && (
                <View style={[styles.statusBadge, { backgroundColor: theme.colors.success + '18' }]}>
                  <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.success} />
                  <ThemedText style={[styles.statusText, { color: theme.colors.success }]}>Done</ThemedText>
                </View>
              )}

              {/* Delete (long-press alternative trigger) */}
              <TouchableOpacity
                onPress={() => confirmDelete(session)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete workout session"
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.error} />
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
                <View style={[styles.expandedDivider, { backgroundColor: theme.colors.border }]} />

                {/* Session details */}
                <View style={styles.expandedDetails}>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.textMuted} />
                    <ThemedText style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                      Created {dateLabel}
                    </ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="timer-sand" size={16} color={theme.colors.textMuted} />
                    <ThemedText style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                      Estimated {duration}
                    </ThemedText>
                  </View>
                </View>

                {/* Exercise list with images */}
                {(() => {
                  const exList = vm.expandedExercises[session.id];
                  if (!exList || exList.length === 0) return null;
                  return (
                    <View style={styles.expandedExerciseList}>
                      <ThemedText style={[styles.exerciseListHeader, { color: theme.colors.textMuted }]}>
                        Exercises
                      </ThemedText>
                      {exList.map((ex, idx) => (
                        <View
                          key={ex.exercise_id + idx}
                          style={[styles.exerciseRow, { borderColor: theme.colors.border }]}
                        >
                          <ExerciseImage
                            exerciseId={ex.exercise_id}
                            category={ex.category as any}
                            variant="thumbnail"
                            animate={false}
                          />
                          <View style={{ flex: 1, marginLeft: spacing[2.5] }}>
                            <ThemedText
                              style={[styles.exerciseRowName, { color: theme.colors.text }]}
                              numberOfLines={1}
                            >
                              {ex.name}
                            </ThemedText>
                            <ThemedText style={[styles.exerciseRowMeta, { color: theme.colors.textMuted }]}>
                              {ex.prescribed_sets} sets × {ex.prescribed_reps}
                            </ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Action Buttons */}
                <View style={styles.expandedActions}>
                  <View style={{ flex: 1 }}>
                    <GradientButton
                      title={t('savedWorkouts.startWorkout')}
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
                    accessibilityRole="button"
                    accessibilityLabel="Delete workout"
                  >
                    <MaterialCommunityIcons name="delete-outline" size={22} color={theme.colors.error} />
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
    },

    [expandedId, vm.expandedExercises, theme, t, confirmDelete, handleStartWorkout, toggleExpand],
  );

  const renderWorkoutItem = useCallback(
    ({ item, index }: { item: WorkoutSession; index: number }) => renderWorkoutCard(item, index),
    [renderWorkoutCard],
  );
  const keyExtractorWorkout = useCallback((item: WorkoutSession) => item.id, []);

  // ------------------------------------------
  // MAIN RENDER
  // ------------------------------------------

  return (
    <ScreenErrorBoundary screenName="SavedWorkouts" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <ScreenTutorial
          screenKey="saved-workouts"
          icon="content-save-all"
          title="Saved Workouts"
          description="View your completed workout history. Tap any workout to see details, or long-press to delete. Your progress is saved automatically."
        />
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
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
              style={[styles.backBtn, { backgroundColor: theme.colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
            </TouchableOpacity>

            <View style={styles.headerTextArea}>
              <ThemedText style={[styles.heroTitle, { color: theme.colors.text }]}>Saved Workouts</ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: theme.colors.textMuted }]}>
                {vm.workouts.length > 0
                  ? `${vm.workouts.length} custom workout${vm.workouts.length !== 1 ? 's' : ''}`
                  : 'Your personal collection'}
              </ThemedText>
            </View>

            <View style={[styles.headerIconWrap, { backgroundColor: theme.colors.accent + '18' }]}>
              <MaterialCommunityIcons name="bookmark-multiple" size={26} color={theme.colors.accent} />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Body */}
        {vm.loading ? (
          <Animated.View entering={FadeIn.duration(150)} style={styles.loadingContainer}>
            <MaterialCommunityIcons name="loading" size={36} color={theme.colors.accent} />
            <ThemedText style={[styles.loadingText, { color: theme.colors.textMuted }]}>
              {t('savedWorkouts.loading') || 'Loading workouts…'}
            </ThemedText>
          </Animated.View>
        ) : vm.loadError ? (
          <View style={[styles.loadingContainer, { alignItems: 'center' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
            <ThemedText
              style={[styles.loadingText, { color: theme.colors.error, textAlign: 'center', marginTop: spacing[4] }]}
            >
              {vm.loadError}
            </ThemedText>
            <GradientButton
              title="Retry"
              onPress={() => {
                vm.loadWorkouts();
              }}
              style={{ marginTop: spacing[4] }}
            />
          </View>
        ) : vm.workouts.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={vm.workouts}
            keyExtractor={keyExtractorWorkout}
            renderItem={renderWorkoutItem}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews={true}
            scrollEventThrottle={100}
            refreshControl={
              <RefreshControl
                refreshing={vm.refreshing}
                onRefresh={vm.handleRefresh}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
              />
            }
            ListHeaderComponent={<SectionHeader title={t('savedWorkouts.myWorkouts')} delay={100} />}
            ListFooterComponent={<View style={styles.bottomSpacer} />}
          />
        )}

        {/* Floating Action Button */}
        {!vm.loading && (
          <Animated.View entering={ZoomIn.delay(100).duration(150)} style={styles.fabContainer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/create-workout')}
              accessibilityRole="button"
              accessibilityLabel="Create new workout"
            >
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fab}
              >
                <MaterialCommunityIcons name="plus" size={28} color={theme.colors.onAccent} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScreenContainer>
    </ScreenErrorBoundary>
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
      <ThemedText style={[styles.statPillValue, { color }]}>{value}</ThemedText>
      {label ? <ThemedText style={[styles.statPillLabel, { color: textColor }]}>{label}</ThemedText> : null}
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4.5],
    borderRadius: 18,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3.5],
  },
  headerTextArea: {
    flex: 1,
  },
  heroTitle: {
    fontSize: typography.sizes.h2,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: typography.sizes.label,
    fontWeight: '600',
    marginTop: spacing[0.5],
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
    paddingBottom: spacing[25],
  },

  /* Loading */
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[20],
    gap: spacing[3],
  },
  loadingText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
  },

  /* Empty state */
  emptyContainer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
  },
  emptyCard: {
    padding: spacing[7],
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
    marginBottom: spacing[5],
  },
  emptyTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing[2.5],
  },
  emptySubtitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing[2],
    marginBottom: spacing[5],
  },
  emptyFeatures: {
    alignSelf: 'stretch',
    gap: spacing[3],
  },
  emptyFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFeatureText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
  },

  /* Workout Card */
  cardOuter: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  workoutCard: {
    padding: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginTop: spacing[0.5],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: spacing[1.5],
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.25],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: 20,
  },
  statPillValue: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
  },
  statPillLabel: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '500',
  },

  /* Expanded */
  expandedArea: {
    marginTop: spacing[3],
  },
  expandedDivider: {
    height: 1,
    marginBottom: spacing[3.5],
    opacity: 0.3,
  },
  expandedDetails: {
    gap: spacing[2.5],
    marginBottom: spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  detailText: {
    fontSize: typography.sizes.label,
    fontWeight: '500',
  },
  expandedExerciseList: {
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  exerciseListHeader: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseRowName: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
  },
  exerciseRowMeta: {
    fontSize: typography.sizes.caption,
    marginTop: spacing[0.5],
  },
  expandedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
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
    marginTop: spacing[2],
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
    shadowColor: '#7B7FCC',
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
