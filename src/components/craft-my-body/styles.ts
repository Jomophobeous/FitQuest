import { StyleSheet } from 'react-native';
import { typography, spacing, radius } from '../../design/theme-system';

export const craftMyBodyStyles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[25] },

  // Progress bar
  progressContainer: { marginBottom: spacing[6] },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  progressStep: { alignItems: 'center', flex: 1 },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  progressLabel: { fontSize: typography.sizes.xs, textAlign: 'center' },
  progressLine: { height: 3, borderRadius: radius.sm, marginHorizontal: spacing[8] },
  progressLineFill: { height: 3, borderRadius: radius.sm },

  // Cards
  card: { marginBottom: spacing[4], padding: spacing[4] },

  // Labels
  label: { fontSize: typography.sizes.body, fontWeight: '700', marginBottom: spacing[2] },
  inputLabel: { fontSize: typography.sizes.caption, fontWeight: '500', marginBottom: spacing[1] },

  // Inputs
  inputRow: { flexDirection: 'row', gap: spacing[2] },
  inputGroup: { flex: 1 },
  textInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },

  // Chips
  chipRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  chipText: { fontSize: typography.sizes.bodySmall, fontWeight: '500' },

  // Option rows
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[2],
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: typography.sizes.bodyMid, fontWeight: '600' },
  optionDesc: { fontSize: typography.sizes.caption, marginTop: spacing[0.5] },

  // Goal rows
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[2],
  },
  goalIcon: { width: 48, height: 48, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { fontSize: typography.sizes.body, fontWeight: '700' },
  goalDesc: { fontSize: typography.sizes.caption, marginTop: spacing[0.5] },

  // Focus areas
  focusHint: { fontSize: typography.sizes.label, marginBottom: spacing[4], textAlign: 'center' },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'space-between' },
  muscleCard: {
    width: '47%' as any,
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: radius.lg,
    minWidth: 150,
  },
  muscleLabel: { fontSize: typography.sizes.label, fontWeight: '600', marginTop: spacing[2], marginBottom: spacing[2] },
  priorityBadge: { paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: radius.md },
  priorityText: { fontSize: typography.sizes.xs, fontWeight: '700' },

  // Results
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  resultTitle: { fontSize: typography.sizes.body, fontWeight: '700' },
  resultValue: { fontSize: typography.sizes.h3, fontWeight: '700', marginBottom: spacing[1] },
  resultSub: { fontSize: typography.sizes.label, marginBottom: spacing[4] },

  // Schedule
  scheduleRow: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[2] },
  scheduleDay: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.md },
  scheduleDayLabel: { fontSize: typography.sizes.micro, fontWeight: '500', marginBottom: spacing[0.5] },
  scheduleDayText: { fontSize: typography.sizes.xs, fontWeight: '600' },

  // Macros
  caloriesBig: { fontSize: typography.sizes.h1, fontWeight: '700', marginBottom: spacing[4] },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[4] },
  macroItem: { alignItems: 'center', flex: 1 },
  macroValue: { fontSize: typography.sizes.h3, fontWeight: '700' },
  macroLabel: { fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] },
  macroBar: { height: 8, borderRadius: radius.sm, flexDirection: 'row', overflow: 'hidden' },

  // Targets
  targetRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing[2] },
  targetItem: { alignItems: 'center', gap: spacing[1] },
  targetValue: { fontSize: typography.sizes.h4, fontWeight: '700' },
  targetLabel: { fontSize: typography.sizes.captionSm },

  // Tips
  tipRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2], alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: typography.sizes.label, lineHeight: 18 },

  // Apply
  applyContainer: { marginTop: spacing[2], marginBottom: spacing[8] },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    borderTopWidth: 1,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  navBtnText: { fontSize: typography.sizes.bodyMid, fontWeight: '600' },
  stepIndicator: { fontSize: typography.sizes.label, fontWeight: '500' },
});
