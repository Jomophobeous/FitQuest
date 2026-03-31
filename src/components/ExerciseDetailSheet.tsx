/**
 * ExerciseDetailSheet — Rich exercise detail bottom sheet
 *
 * Replaces the primitive Alert.alert() with an immersive,
 * glass-morphism exercise detail drawer.
 *
 * Shows: muscle groups, instructions, equipment, stats, difficulty.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { ExerciseWithDetails } from '../database/types';
import ExerciseImage from './ExerciseImage';

// ─── Muscle → Icon mapping ───

const MUSCLE_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  chest: 'human',
  back: 'human-handsdown',
  shoulders: 'human-greeting-variant',
  biceps: 'arm-flex',
  triceps: 'arm-flex-outline',
  forearms: 'hand-front-right',
  core: 'human',
  abs: 'human',
  obliques: 'human',
  quads: 'human-handsdown',
  hamstrings: 'human-handsdown',
  glutes: 'seat',
  calves: 'shoe-ballet',
  hip_flexors: 'human-handsup',
  lats: 'human-handsdown',
  traps: 'human-greeting-variant',
  neck: 'head-outline',
  lower_back: 'human',
  full_body: 'human-handsup',
  spine: 'human',
};

// ─── Difficulty visual ───

function getDifficultyConfig(difficulty: string) {
  switch (difficulty) {
    case 'beginner':
      return { label: 'Beginner', colorKey: 'accent', filled: 1 };
    case 'intermediate':
      return { label: 'Intermediate', colorKey: 'warning', filled: 2 };
    case 'advanced':
      return { label: 'Advanced', colorKey: 'error', filled: 3 };
    default:
      return { label: difficulty, colorKey: 'textMuted', filled: 1 };
  }
}

// ─── Equipment label helper ───

function formatEquipmentLabel(equip: string): string {
  return equip.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Category label ───

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Impact level icon ───

function getImpactIcon(impact: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (impact) {
    case 'no_impact':
      return 'feather';
    case 'low_impact':
      return 'walk';
    case 'high_impact':
      return 'run-fast';
    default:
      return 'help-circle-outline';
  }
}

function getSpaceLabel(space: string): string {
  switch (space) {
    case 'mat_only_1x1':
      return 'Mat (1×1m)';
    case 'small_bedroom_2x2':
      return 'Small (2×2m)';
    case 'living_room_3x3':
      return 'Room (3×3m)';
    case 'outdoors_hall':
      return 'Outdoors';
    default:
      return space.replace(/_/g, ' ');
  }
}

// ============================================
// COMPONENT
// ============================================

interface ExerciseDetailSheetProps {
  exercise: ExerciseWithDetails | null;
  visible: boolean;
  onClose: () => void;
  onAddToWorkout?: (exercise: ExerciseWithDetails) => void;
}

export function ExerciseDetailSheet({ exercise, visible, onClose, onAddToWorkout }: ExerciseDetailSheetProps) {
  const { theme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();

  if (!exercise) return null;

  const diffConfig = getDifficultyConfig(exercise.difficulty);
  const allMuscles = [
    ...exercise.primary_muscles.map((m) => ({ name: m, primary: true })),
    ...exercise.secondary_muscles.map((m) => ({ name: m, primary: false })),
  ];
  const hasEquipment = exercise.equipment_required.length > 0 || exercise.equipment_optional.length > 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.backdropFill} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.duration(350).damping(18)}
        exiting={SlideOutDown.duration(250)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            maxHeight: screenHeight * 0.88,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme.colors.textMuted + '40' }]} />
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* ── Exercise Image ── */}
          <Animated.View entering={FadeIn.delay(60).duration(250)}>
            <ExerciseImage
              exerciseId={exercise.id}
              category={exercise.category}
              variant="detail"
              animate={true}
              style={{ alignSelf: 'center', marginBottom: 16, borderRadius: 16 }}
            />
          </Animated.View>

          {/* ── Header ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(200)}>
            <View style={styles.headerSection}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exerciseName, { color: theme.colors.text }]}>{exercise.name}</Text>
                <View style={styles.headerTags}>
                  <View style={[styles.categoryTag, { backgroundColor: theme.colors.accent + '15' }]}>
                    <Text style={[styles.categoryText, { color: theme.colors.accent }]}>
                      {formatCategory(exercise.category)}
                    </Text>
                  </View>
                  <View
                    style={[styles.diffTag, { backgroundColor: (theme.colors as any)[diffConfig.colorKey] + '15' }]}
                  >
                    <Text style={[styles.diffTagText, { color: (theme.colors as any)[diffConfig.colorKey] }]}>
                      {diffConfig.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Close button */}
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: theme.colors.textMuted + '15' }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── Difficulty bar ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(200)}>
            <View style={styles.difficultyBar}>
              {[1, 2, 3].map((level) => (
                <View
                  key={level}
                  style={[
                    styles.diffDot,
                    {
                      backgroundColor:
                        level <= diffConfig.filled
                          ? (theme.colors as any)[diffConfig.colorKey]
                          : theme.colors.textMuted + '25',
                    },
                  ]}
                />
              ))}
              <Text style={[styles.diffLabel, { color: theme.colors.textMuted }]}>Difficulty</Text>
            </View>
          </Animated.View>

          {/* ── Quick Stats Row ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(200)}>
            <View style={styles.statsRow}>
              <StatPill
                icon={getImpactIcon(exercise.impact_level)}
                label={exercise.impact_level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                color={theme.colors.accent2 || theme.colors.accent}
                theme={theme}
              />
              <StatPill
                icon="ruler-square"
                label={getSpaceLabel(exercise.space_required)}
                color={theme.colors.accent3 || theme.colors.warning}
                theme={theme}
              />
              <StatPill
                icon="timer-outline"
                label={`${exercise.time_per_set_seconds}s/set`}
                color={theme.colors.accent}
                theme={theme}
              />
            </View>
          </Animated.View>

          {/* ── Muscles Targeted ── */}
          {allMuscles.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(200)}>
              <SectionTitle title="Target Muscles" icon="arm-flex" theme={theme} />
              <View style={styles.muscleGrid}>
                {allMuscles.map(({ name, primary }, idx) => (
                  <View
                    key={`${name}-${idx}`}
                    style={[
                      styles.muscleChip,
                      {
                        backgroundColor: primary ? theme.colors.accent + '15' : theme.colors.textMuted + '10',
                        borderColor: primary ? theme.colors.accent + '30' : theme.colors.textMuted + '15',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={MUSCLE_ICONS[name] || 'human'}
                      size={14}
                      color={primary ? theme.colors.accent : theme.colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.muscleText,
                        {
                          color: primary ? theme.colors.accent : theme.colors.textSecondary,
                          fontWeight: primary ? '600' : '400',
                        },
                      ]}
                    >
                      {name.replace(/_/g, ' ')}
                    </Text>
                    {primary && <View style={[styles.primaryDot, { backgroundColor: theme.colors.accent }]} />}
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ── Equipment ── */}
          {hasEquipment && (
            <Animated.View entering={FadeInDown.delay(240).duration(200)}>
              <SectionTitle title="Equipment" icon="dumbbell" theme={theme} />
              <View style={styles.equipmentList}>
                {exercise.equipment_required.map((eq, idx) => (
                  <View key={`req-${idx}`} style={styles.equipRow}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.accent} />
                    <Text style={[styles.equipText, { color: theme.colors.text }]}>{formatEquipmentLabel(eq)}</Text>
                    <View style={[styles.requiredBadge, { backgroundColor: theme.colors.accent + '15' }]}>
                      <Text style={[styles.requiredText, { color: theme.colors.accent }]}>Required</Text>
                    </View>
                  </View>
                ))}
                {exercise.equipment_optional.map((eq, idx) => (
                  <View key={`opt-${idx}`} style={styles.equipRow}>
                    <MaterialCommunityIcons name="circle-outline" size={16} color={theme.colors.textMuted} />
                    <Text style={[styles.equipText, { color: theme.colors.textSecondary }]}>
                      {formatEquipmentLabel(eq)}
                    </Text>
                    <View style={[styles.requiredBadge, { backgroundColor: theme.colors.textMuted + '10' }]}>
                      <Text style={[styles.requiredText, { color: theme.colors.textMuted }]}>Optional</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {exercise.equipment_level === 'none' && (
            <Animated.View entering={FadeInDown.delay(240).duration(200)}>
              <SectionTitle title="Equipment" icon="dumbbell" theme={theme} />
              <View style={[styles.noEquipCard, { backgroundColor: theme.colors.success + '10' }]}>
                <MaterialCommunityIcons name="check-decagram" size={20} color={theme.colors.success} />
                <Text style={[styles.noEquipText, { color: theme.colors.success }]}>
                  No equipment needed — bodyweight only
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ── Instructions ── */}
          <Animated.View entering={FadeInDown.delay(280).duration(200)}>
            <SectionTitle title="How To Perform" icon="format-list-numbered" theme={theme} />
            <View style={styles.instructionsList}>
              {exercise.instructions.map((instruction, idx) => (
                <View key={idx} style={styles.instructionRow}>
                  <View style={[styles.stepNumber, { backgroundColor: theme.colors.accent + '15' }]}>
                    <Text style={[styles.stepNumText, { color: theme.colors.accent }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.instructionText, { color: theme.colors.text }]}>{instruction}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Training Types ── */}
          {exercise.training_types.length > 0 && (
            <Animated.View entering={FadeInDown.delay(320).duration(200)}>
              <SectionTitle title="Training Focus" icon="target" theme={theme} />
              <View style={styles.trainingGrid}>
                {exercise.training_types
                  .sort((a, b) => b.effectiveness - a.effectiveness)
                  .map(({ type, effectiveness }, idx) => (
                    <View key={idx} style={[styles.trainingChip, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <Text style={[styles.trainingLabel, { color: theme.colors.text }]}>
                        {type.replace(/_/g, ' ')}
                      </Text>
                      <View style={styles.effectivenessBar}>
                        {[...Array(5)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.effectDot,
                              {
                                backgroundColor:
                                  i < Math.round(effectiveness / 2)
                                    ? theme.colors.accent
                                    : theme.colors.textMuted + '20',
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
              </View>
            </Animated.View>
          )}

          {/* ── Action Buttons ── */}
          <Animated.View entering={FadeInUp.delay(350).duration(200)}>
            <View style={styles.actionsSection}>
              {onAddToWorkout && (
                <TouchableOpacity
                  onPress={() => {
                    onAddToWorkout(exercise);
                    onClose();
                  }}
                  style={[
                    styles.addBtn,
                    {
                      backgroundColor: theme.colors.accent + '15',
                      borderColor: theme.colors.accent + '30',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="playlist-plus" size={20} color={theme.colors.accent} />
                  <Text style={[styles.addBtnText, { color: theme.colors.accent }]}>Add to Workout</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Bottom safe area */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Sub-components ───

function StatPill({
  icon,
  label,
  color,
  theme,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  theme: any;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: color + '10' }]}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  icon,
  theme,
}: {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  theme: any;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.colors.accent} />
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Header
  headerSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  headerTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  categoryTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diffTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  diffTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  // Difficulty bar
  difficultyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  diffDot: {
    width: 28,
    height: 6,
    borderRadius: 3,
  },
  diffLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },

  // Muscles
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  muscleText: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  primaryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Equipment
  equipmentList: {
    gap: 10,
    marginBottom: 24,
  },
  equipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  equipText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noEquipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 24,
  },
  noEquipText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Instructions
  instructionsList: {
    gap: 14,
    marginBottom: 24,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  // Training types
  trainingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  trainingChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  trainingLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  effectivenessBar: {
    flexDirection: 'row',
    gap: 3,
  },
  effectDot: {
    width: 8,
    height: 4,
    borderRadius: 2,
  },

  // Section titles
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Actions
  actionsSection: {
    marginTop: 8,
    paddingBottom: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ExerciseDetailSheet;
