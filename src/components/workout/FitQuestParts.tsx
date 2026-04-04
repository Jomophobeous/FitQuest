/**
 * FitQuest Workout Sub-Components
 * Extracted from fitquest.tsx to reduce screen file size.
 * These are tightly-scoped display components — no hooks, no state.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInRight, FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedText from '../ThemedText';
import ExerciseImage from '../ExerciseImage';
import { GlassCard } from '../ui/GlassUI';
import { spacing, typography, radius } from '../../design/theme-system';
import type { WorkoutExerciseDisplay } from '../../hooks/workout/types';

// ============================================
// PHASE TAG
// ============================================

export function PhaseTag({
  icon,
  label,
  color,
  delay = 0,
  centered = false,
}: {
  icon: string;
  label: string;
  color: string;
  delay?: number;
  centered?: boolean;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(150)}
      style={{ paddingHorizontal: spacing[4], marginBottom: spacing[1], marginTop: spacing[1] }}
    >
      <View style={[phaseStyles.tag, { backgroundColor: color + '18' }, centered && { alignSelf: 'center' }]}>
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
        <ThemedText style={[phaseStyles.tagText, { color }]}>{label}</ThemedText>
      </View>
    </Animated.View>
  );
}

const phaseStyles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing[1],
  },
  tagText: { fontSize: typography.sizes.label, fontWeight: '600' },
});

// ============================================
// EXERCISE PREVIEW LIST
// ============================================

export function ExercisePreviewList({
  exercises,
  borderColor,
  baseDelay = 250,
  delayStep = 40,
  textColor,
  metaColor,
  bgColor,
}: {
  exercises: WorkoutExerciseDisplay[];
  borderColor: string;
  baseDelay?: number;
  delayStep?: number;
  textColor: string;
  metaColor: string;
  bgColor: string;
}) {
  return (
    <>
      {exercises.map((exercise, index) => (
        <Animated.View
          key={exercise.id}
          entering={FadeInRight.delay(baseDelay + index * delayStep).duration(150)}
          style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}
        >
          <View style={[listStyles.card, { backgroundColor: bgColor, borderColor }]}>
            <ExerciseImage exerciseId={exercise.exerciseId} category={exercise.category} variant="thumbnail" />
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <ThemedText style={[listStyles.name, { color: textColor }]}>{exercise.name}</ThemedText>
              <ThemedText style={[listStyles.meta, { color: metaColor }]}>
                {exercise.sets}× ({exercise.reps}){exercise.restSeconds > 15 ? ` · ${exercise.restSeconds}s` : ''}
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      ))}
    </>
  );
}

const listStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
    borderRadius: 14,
    borderWidth: 1,
  },
  name: { fontSize: typography.sizes.bodyMid, fontWeight: '600' },
  meta: { fontSize: typography.sizes.caption, marginTop: spacing[0.75], fontWeight: '400' },
});

// ============================================
// AI INSIGHT PANEL
// ============================================

export function AIInsightPanel({
  insight,
  expanded,
  onToggle,
  theme,
  t,
}: {
  insight: {
    session_reason: string;
    volume_reason: string;
    exercise_reasons: Array<{
      exercise_id?: string;
      exercise_name: string;
      reason: string;
      score_breakdown?: { freshness: string; goal_alignment: string; pattern_balance: string };
    }>;
    general_notes: string[];
  };
  expanded: boolean;
  onToggle: () => void;
  theme: any;
  t: (key: string) => string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggle}
      style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}
      accessibilityRole="button"
      accessibilityLabel={`AI workout insight${expanded ? ', expanded' : ''}`}
    >
      <GlassCard style={{ padding: spacing[0] }}>
        <View style={insightStyles.header}>
          <View style={[insightStyles.hintIcon, { backgroundColor: theme.colors.blue + '15' }]}>
            <MaterialCommunityIcons name="brain" size={18} color={theme.colors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[insightStyles.title, { color: theme.colors.text }]}>
              {t('fitquest.aiInsight') || 'AI Workout Intelligence'}
            </ThemedText>
            <ThemedText style={[insightStyles.sub, { color: theme.colors.textMuted }]}>
              {insight.session_reason}
            </ThemedText>
          </View>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.colors.textMuted}
          />
        </View>
        {expanded && (
          <View style={insightStyles.body}>
            <View style={insightStyles.row}>
              <MaterialCommunityIcons name="chart-bar" size={16} color={theme.colors.accent} />
              <ThemedText style={[insightStyles.rowText, { color: theme.colors.textSecondary }]}>
                {insight.volume_reason}
              </ThemedText>
            </View>
            {insight.exercise_reasons.map((er, idx) => (
              <View key={er.exercise_id || idx} style={insightStyles.row}>
                <MaterialCommunityIcons name="dumbbell" size={14} color={theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[insightStyles.exName, { color: theme.colors.text }]}>
                    {er.exercise_name}
                  </ThemedText>
                  <ThemedText style={[insightStyles.exReason, { color: theme.colors.textMuted }]}>
                    {er.reason}
                  </ThemedText>
                  {er.score_breakdown && (
                    <View style={insightStyles.chips}>
                      <View style={[insightStyles.chip, { backgroundColor: theme.colors.accent + '15' }]}>
                        <ThemedText style={[insightStyles.chipText, { color: theme.colors.accent }]}>
                          {er.score_breakdown.freshness}
                        </ThemedText>
                      </View>
                      <View style={[insightStyles.chip, { backgroundColor: theme.colors.blue + '15' }]}>
                        <ThemedText style={[insightStyles.chipText, { color: theme.colors.blue }]}>
                          {er.score_breakdown.goal_alignment}
                        </ThemedText>
                      </View>
                      <View style={[insightStyles.chip, { backgroundColor: theme.colors.warning + '15' }]}>
                        <ThemedText style={[insightStyles.chipText, { color: theme.colors.warning }]}>
                          {er.score_breakdown.pattern_balance}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {insight.general_notes.map((note, idx) => (
              <View key={idx} style={insightStyles.row}>
                <MaterialCommunityIcons name="information-outline" size={14} color={theme.colors.warning} />
                <ThemedText style={[insightStyles.rowText, { color: theme.colors.warning }]}>{note}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

const insightStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3.5] },
  hintIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },
  sub: { fontSize: typography.sizes.caption, marginTop: spacing[0.5], lineHeight: 17 },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
    paddingHorizontal: spacing[3.5],
    paddingTop: spacing[2.5],
    paddingBottom: spacing[3.5],
    gap: spacing[2.5],
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2.5] },
  rowText: { flex: 1, fontSize: typography.sizes.label, lineHeight: 19 },
  exName: { fontSize: typography.sizes.label, fontWeight: '600' },
  exReason: { fontSize: typography.sizes.caption, lineHeight: 17, marginTop: spacing['px'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  chip: { paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: 6 },
  chipText: { fontSize: typography.sizes.xs, fontWeight: '600' },
});

// ============================================
// ADAPTIVE MEMORY PANEL
// ============================================

export function AdaptiveMemoryPanel({
  workout,
  expanded,
  onToggle,
  theme,
  t,
}: {
  workout: {
    lastImpact: {
      hasHistory: boolean;
      headline: string;
      trend: string;
      trendStatement: string;
      timeSince: string;
    } | null;
    workoutDelta: { hasChanges: boolean; headline: string; removed: string[]; added: string[] } | null;
    progressionNarratives: Array<{ exerciseId: string; exerciseName: string; trend: string; narrative: string }>;
  };
  expanded: boolean;
  onToggle: () => void;
  theme: any;
  t: (key: string) => string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggle}
      style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}
      accessibilityRole="button"
      accessibilityLabel={`Session memory${expanded ? ', expanded' : ''}`}
    >
      <GlassCard style={{ padding: spacing[0] }}>
        <View style={insightStyles.header}>
          <View style={[insightStyles.hintIcon, { backgroundColor: theme.colors.accent + '15' }]}>
            <MaterialCommunityIcons name="memory" size={18} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[insightStyles.title, { color: theme.colors.text }]}>
              {t('fitquest.adaptiveMemory') || 'Session Memory'}
            </ThemedText>
            <ThemedText style={[insightStyles.sub, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {workout.workoutDelta?.headline || workout.lastImpact?.headline || ''}
            </ThemedText>
          </View>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.colors.textMuted}
          />
        </View>
        {expanded && (
          <View style={insightStyles.body}>
            {workout.lastImpact?.hasHistory && (
              <>
                <View style={insightStyles.row}>
                  <MaterialCommunityIcons name="history" size={15} color={theme.colors.accent} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[memoryStyles.label, { color: theme.colors.text }]}>Last Session</ThemedText>
                    <ThemedText style={[insightStyles.exReason, { color: theme.colors.textMuted }]}>
                      {workout.lastImpact.headline}
                    </ThemedText>
                  </View>
                  <ThemedText style={[memoryStyles.time, { color: theme.colors.textMuted }]}>
                    {workout.lastImpact.timeSince}
                  </ThemedText>
                </View>
                <View style={insightStyles.row}>
                  <MaterialCommunityIcons
                    name={
                      workout.lastImpact.trend === 'improving'
                        ? 'trending-up'
                        : workout.lastImpact.trend === 'declining'
                          ? 'trending-down'
                          : 'trending-neutral'
                    }
                    size={15}
                    color={
                      workout.lastImpact.trend === 'improving'
                        ? theme.colors.success
                        : workout.lastImpact.trend === 'declining'
                          ? theme.colors.warning
                          : theme.colors.textMuted
                    }
                  />
                  <ThemedText style={[insightStyles.rowText, { color: theme.colors.textSecondary }]}>
                    {workout.lastImpact.trendStatement}
                  </ThemedText>
                </View>
              </>
            )}
            {workout.workoutDelta?.hasChanges && (
              <View style={insightStyles.row}>
                <MaterialCommunityIcons name="swap-horizontal" size={15} color={theme.colors.blue} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[memoryStyles.label, { color: theme.colors.text }]}>Changes</ThemedText>
                  <ThemedText style={[insightStyles.exReason, { color: theme.colors.textMuted }]}>
                    {workout.workoutDelta.headline}
                  </ThemedText>
                  {workout.workoutDelta.removed.length > 0 && (
                    <View style={insightStyles.chips}>
                      {workout.workoutDelta.removed.slice(0, 3).map((name, i) => (
                        <View key={i} style={[insightStyles.chip, { backgroundColor: theme.colors.error + '12' }]}>
                          <ThemedText style={[insightStyles.chipText, { color: theme.colors.error }]}>
                            - {name}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
            {workout.progressionNarratives.length > 0 && (
              <>
                <View style={[insightStyles.row, { marginTop: spacing[1] }]}>
                  <MaterialCommunityIcons name="chart-line" size={15} color={theme.colors.accent} />
                  <ThemedText style={[memoryStyles.label, { color: theme.colors.text }]}>Progression</ThemedText>
                </View>
                {workout.progressionNarratives.slice(0, 4).map((pn) => (
                  <View key={pn.exerciseId} style={[insightStyles.row, { paddingLeft: spacing[2] }]}>
                    <View
                      style={[
                        memoryStyles.dot,
                        {
                          backgroundColor:
                            pn.trend === 'improving'
                              ? theme.colors.success
                              : pn.trend === 'declining'
                                ? theme.colors.warning
                                : theme.colors.textMuted,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[insightStyles.exName, { color: theme.colors.text }]}>
                        {pn.exerciseName}
                      </ThemedText>
                      <ThemedText style={[insightStyles.exReason, { color: theme.colors.textMuted }]}>
                        {pn.narrative}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

const memoryStyles = StyleSheet.create({
  label: { fontSize: typography.sizes.label, fontWeight: '700' },
  time: { fontSize: typography.sizes.captionSm, fontWeight: '500' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: spacing[1.5] },
});
