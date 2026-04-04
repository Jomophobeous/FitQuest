/**
 * WorkoutReadyView — READY state render for FitQuest.
 * Extracted from fitquest.tsx for structural reduction.
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { GlassCard, GradientButton, SectionHeader } from '../ui/GlassUI';
import ThemedText from '../ThemedText';
import { useRouter } from 'expo-router';
import { typography, spacing, radius } from '../../design/theme-system';
import { PhaseTag, ExercisePreviewList, AIInsightPanel, AdaptiveMemoryPanel } from './FitQuestParts';
import type { GeneratedWorkoutDisplay } from '../../hooks/workout/types';

interface WorkoutReadyViewProps {
  workout: GeneratedWorkoutDisplay;
  deloadStatus: { needed: boolean; reason: string } | null | undefined;
  trialSnapshot: { hasIntelligence?: boolean; hasMemory?: boolean; previewAvailable?: boolean } | null;
  onStart: () => void;
  onRegenerate: () => void;
}

export default function WorkoutReadyView({
  workout,
  deloadStatus,
  trialSnapshot,
  onStart,
  onRegenerate,
}: WorkoutReadyViewProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [showInsight, setShowInsight] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(150)}>
          <View
            style={[
              styles.readyHeader,
              {
                backgroundColor: theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.readyHeaderRow}>
              <ThemedText style={[styles.readyTitle, { color: theme.colors.text }]}>
                {t('fitquest.todaysWorkout')}
              </ThemedText>
              {!!workout.isDeload && (
                <View style={[styles.deloadBadge, { backgroundColor: theme.colors.warning }]}>
                  <ThemedText style={[styles.deloadBadgeText, { color: theme.colors.text }]}>
                    {t('fitquest.deload')}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Explanation */}
        <Animated.View entering={FadeInDown.delay(100).duration(150)}>
          <GlassCard
            style={{ marginHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}
          >
            <View style={[styles.hintIcon, { backgroundColor: theme.colors.accent + '12' }]}>
              <MaterialCommunityIcons name="lightbulb-outline" size={20} color={theme.colors.accent} />
            </View>
            <ThemedText style={[styles.explanationText, { color: theme.colors.textSecondary }]}>
              {workout.explanation}
            </ThemedText>
          </GlassCard>
        </Animated.View>

        {/* AI Workout Insight — expandable reasoning panel (gated by subscription) */}
        {workout.aiInsight && trialSnapshot?.hasIntelligence !== false && (
          <Animated.View entering={FadeInDown.delay(120).duration(150)}>
            <AIInsightPanel
              insight={workout.aiInsight}
              expanded={showInsight}
              onToggle={() => setShowInsight((v) => !v)}
              theme={theme}
              t={t}
            />
            {/* Preview panel — locked AI Insight (post-trial, not subscribed) */}
            {trialSnapshot && !trialSnapshot.hasIntelligence && trialSnapshot.previewAvailable && (
              <Animated.View entering={FadeInDown.delay(120).duration(150)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/paywall')}
                  style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock AI workout insight"
                >
                  <GlassCard style={{ padding: spacing[0] }}>
                    <View style={styles.insightHeader}>
                      <View style={[styles.hintIcon, { backgroundColor: theme.colors.blue + '15' }]}>
                        <MaterialCommunityIcons name="brain" size={18} color={theme.colors.blue} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.insightTitle, { color: theme.colors.textMuted }]}>
                          AI Workout Intelligence
                        </ThemedText>
                        <ThemedText style={[styles.insightSub, { color: theme.colors.textMuted }]}>
                          Advanced intelligence requires subscription.
                        </ThemedText>
                      </View>
                      <MaterialCommunityIcons name="lock-outline" size={20} color={theme.colors.textMuted} />
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Adaptive Memory — Session comparison + progression context (gated by subscription) */}
        {(workout.lastImpact?.hasHistory || workout.workoutDelta?.hasChanges) && trialSnapshot?.hasMemory !== false && (
          <Animated.View entering={FadeInDown.delay(140).duration(150)}>
            <AdaptiveMemoryPanel
              workout={workout}
              expanded={showMemory}
              onToggle={() => setShowMemory((v) => !v)}
              theme={theme}
              t={t}
            />
          </Animated.View>
        )}

        {/* Preview panel — locked Session Memory (post-trial, not subscribed) */}
        {(workout.lastImpact?.hasHistory || workout.workoutDelta?.hasChanges) &&
          trialSnapshot &&
          !trialSnapshot.hasMemory &&
          trialSnapshot.previewAvailable && (
            <Animated.View entering={FadeInDown.delay(140).duration(150)}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/paywall')}
                style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}
                accessibilityRole="button"
                accessibilityLabel="Unlock session memory"
              >
                <GlassCard style={{ padding: spacing[0] }}>
                  <View style={styles.insightHeader}>
                    <View style={[styles.hintIcon, { backgroundColor: theme.colors.accent + '15' }]}>
                      <MaterialCommunityIcons name="memory" size={18} color={theme.colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.insightTitle, { color: theme.colors.textMuted }]}>
                        Session Memory
                      </ThemedText>
                      <ThemedText style={[styles.insightSub, { color: theme.colors.textMuted }]}>
                        Advanced intelligence requires subscription.
                      </ThemedText>
                    </View>
                    <MaterialCommunityIcons name="lock-outline" size={20} color={theme.colors.textMuted} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          )}

        {/* Warnings */}
        {workout.warnings?.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(150).duration(150)}
            accessibilityRole="alert"
            accessibilityLabel="Workout warnings"
          >
            <GlassCard style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}>
              {workout.warnings.map((warning: string, idx: number) => (
                <ThemedText key={idx} style={[styles.warningText, { color: theme.colors.warning }]}>
                  ⚠️ {warning}
                </ThemedText>
              ))}
            </GlassCard>
          </Animated.View>
        )}

        {/* Deload Status */}
        {!!deloadStatus && (
          <Animated.View entering={FadeInDown.delay(200).duration(150)}>
            <GlassCard
              style={{
                marginHorizontal: spacing[4],
                marginTop: spacing[2],
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
              }}
            >
              <MaterialCommunityIcons
                name={deloadStatus.needed ? 'battery-low' : 'battery-high'}
                size={24}
                color={deloadStatus.needed ? theme.colors.warning : theme.colors.success}
              />
              <View>
                <ThemedText style={[styles.recoveryLabel, { color: theme.colors.text }]}>
                  {t('fitquest.recoveryStatus')}
                </ThemedText>
                <ThemedText style={[styles.recoverySub, { color: theme.colors.textMuted }]}>
                  {deloadStatus.reason}
                </ThemedText>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Exercise Count */}
        <SectionHeader
          title={`${(workout.exercises ?? []).filter((e) => e.phase === 'main' || !e.phase).length} ${t('library.exercises')} · ~${workout.totalDuration} ${t('fitquest.minShort')}`}
          delay={250}
        />

        {/* Warm-Up */}
        {workout.warmup && workout.warmup.length > 0 && (
          <>
            <PhaseTag
              icon="fire"
              label={`${t('fitquest.warmUp') || 'Warm Up'} · ${workout.warmup.length} ${t('library.exercises')}`}
              color={theme.colors.success}
              delay={260}
            />
            <ExercisePreviewList
              exercises={workout.warmup}
              borderColor={theme.colors.success + '30'}
              baseDelay={270}
              delayStep={30}
              textColor={theme.colors.text}
              metaColor={theme.colors.textMuted}
              bgColor={theme.colors.surfaceVariant}
            />
          </>
        )}

        {/* Main Workout Header */}
        {workout.warmup && workout.warmup.length > 0 && (
          <PhaseTag
            icon="dumbbell"
            label={t('fitquest.mainWorkout') || 'Main Workout'}
            color={theme.colors.accent}
            delay={300}
          />
        )}

        {/* Main Exercise List */}
        <ExercisePreviewList
          exercises={(workout.exercises ?? []).filter((e) => e.phase === 'main' || !e.phase)}
          borderColor={theme.colors.border}
          baseDelay={250}
          delayStep={40}
          textColor={theme.colors.text}
          metaColor={theme.colors.textMuted}
          bgColor={theme.colors.surfaceVariant}
        />

        {/* Cool-Down */}
        {workout.cooldown && workout.cooldown.length > 0 && (
          <>
            <PhaseTag
              icon="snowflake"
              label={`${t('fitquest.coolDown') || 'Cool Down'} · ${workout.cooldown.length} ${t('library.exercises')}`}
              color={theme.colors.blue}
              delay={380}
            />
            <ExercisePreviewList
              exercises={workout.cooldown}
              borderColor={theme.colors.blue + '30'}
              baseDelay={390}
              delayStep={30}
              textColor={theme.colors.text}
              metaColor={theme.colors.textMuted}
              bgColor={theme.colors.surfaceVariant}
            />
          </>
        )}

        {/* Start Button */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(150)}
          style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}
        >
          <GradientButton title={t('train.startWorkout')} icon="play" onPress={onStart} variant="success" size="lg" />
        </Animated.View>

        {/* Regenerate */}
        <Animated.View
          entering={FadeIn.delay(450).duration(150)}
          style={{ paddingHorizontal: spacing[4], marginTop: spacing[2] }}
        >
          <TouchableOpacity
            style={[styles.regenBtn, { borderColor: theme.colors.border }]}
            onPress={onRegenerate}
            accessibilityRole="button"
            accessibilityLabel={t('fitquest.regenerate')}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.text} />
            <ThemedText style={[styles.regenBtnText, { color: theme.colors.text }]}>
              {t('fitquest.regenerate')}
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing[25] },
  readyHeader: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2] },
  readyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readyTitle: { fontSize: typography.sizes.h2, fontWeight: '700' },
  deloadBadge: { paddingHorizontal: spacing[3], paddingVertical: spacing[1.25], borderRadius: radius.md },
  deloadBadgeText: { fontSize: typography.sizes.captionSm, fontWeight: '700' },
  hintIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  explanationText: { flex: 1, fontSize: typography.sizes.bodySmall, lineHeight: 21 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3.5] },
  insightTitle: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },
  insightSub: { fontSize: typography.sizes.caption, marginTop: spacing[0.5], lineHeight: 17 },
  warningText: { fontSize: typography.sizes.label, marginBottom: spacing[1] },
  recoveryLabel: { fontSize: typography.sizes.bodySmall, fontWeight: '500' },
  recoverySub: { fontSize: typography.sizes.caption, marginTop: spacing[0.5], lineHeight: 17 },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[2],
  },
  regenBtnText: { fontSize: typography.sizes.bodyMid, fontWeight: '600' },
});
