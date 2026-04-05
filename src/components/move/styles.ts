import { StyleSheet } from 'react-native';
import { typography, spacing, radius } from '../../design/theme-system';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ActivityType } from '../../viewmodels/useMoveViewModel';

export const moveStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing[25] },
  headerGradient: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2] },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: typography.sizes.h1Sm, fontWeight: '800' },
  historyToggle: { width: 38, height: 38, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  stepHero: { marginHorizontal: spacing[4], padding: spacing[5] },
  stepHeroInner: { flexDirection: 'row', alignItems: 'center', gap: spacing[5] },
  errorCard: { marginHorizontal: spacing[4], padding: spacing[4], borderRadius: radius.xl, marginTop: spacing[3] },
  errorText: { fontSize: typography.sizes.label, fontWeight: '600', textAlign: 'center' },
  stepDetails: { flex: 1 },
  stepCount: { fontSize: typography.sizes.display, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  stepGoal: { fontSize: typography.sizes.label, marginTop: spacing[0.5] },
  stepMiniStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
  },
  miniStatText: { fontSize: typography.sizes.caption, fontWeight: '600' },
  trackingButtonWrap: { marginTop: spacing[4], minHeight: 48 },
  trackingLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
    minHeight: 48,
  },
  trackingStatusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  trackingText: { fontSize: typography.sizes.label, fontWeight: '500' },
  stopTrackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  stopTrackingText: { fontSize: typography.sizes.label, fontWeight: '600' },
  jogCard: { marginHorizontal: spacing[4], marginTop: spacing[3], padding: spacing[4.5] },
  jogHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  jogIconWrap: { width: 42, height: 42, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  jogTitle: { fontSize: typography.sizes.h4, fontWeight: '700' },
  jogSub: { fontSize: typography.sizes.caption, marginTop: spacing['px'] },
  activeJog: { marginTop: spacing[4], gap: spacing[4] },
  jogStartButtonWrap: { marginTop: spacing[3.5], minHeight: 48 },
  jogTimerDisplay: { alignItems: 'center' },
  jogTimerText: { fontSize: typography.sizes.displayLg, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  jogLiveStats: { flexDirection: 'row', justifyContent: 'center', gap: spacing[6] },
  jogStat: { alignItems: 'center' },
  jogStatValue: { fontSize: typography.sizes.h3, fontWeight: '700' },
  jogStatLabel: { fontSize: typography.sizes.caption, marginTop: spacing[0.5] },
  jogStatDivider: { width: 1, height: 30 },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.lg,
    marginBottom: spacing[1],
  },
  gpsIndicatorText: { fontSize: typography.sizes.captionSm, fontWeight: '600' },
  showMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  emptyText: { textAlign: 'center', fontSize: typography.sizes.label },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  historyDate: { fontSize: typography.sizes.bodySmall, fontWeight: '500' },
  historySteps: { fontSize: typography.sizes.bodySmall, fontWeight: '700' },
  historyProgressTrack: { height: 4, borderRadius: radius.sm, overflow: 'hidden' },
  historyProgressFill: { height: 4, borderRadius: radius.sm },
  historyItemWrap: { paddingHorizontal: spacing[4], marginBottom: spacing[1.5] },
  historyInner: { flex: 1 },
  historyTopRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing[1.5],
  },
  infoCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2.5],
    padding: spacing[3.5],
  },
  infoText: { flex: 1, fontSize: typography.sizes.caption, lineHeight: 18 },

  // Weekly trend styles
  weeklyBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing[1.5] },
  weeklyBarCol: { flex: 1, alignItems: 'center', gap: spacing[1] },
  weeklyBarTrack: {
    width: '100%',
    height: 80,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weeklyBarFill: { width: '100%', borderRadius: radius.sm },
  weeklyBarCount: { fontSize: typography.sizes.xs, fontWeight: '600' },
  weeklyBarLabel: { fontSize: typography.sizes.captionSm },
  weeklyGoalMark: { position: 'absolute', left: 0, right: 0, height: 1 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    padding: spacing[7],
    alignItems: 'center',
    overflow: 'hidden',
  },
  modalGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  trophyGlow: {
    width: 90,
    height: 90,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalTitle: {
    fontSize: typography.sizes.h2,
    fontWeight: '800',
    marginBottom: spacing[5],
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing[2.5],
    marginBottom: spacing[5],
  },
  statBox: {
    flex: 1,
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[2],
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: spacing[1],
  },
  statValue: {
    fontSize: typography.sizes.h3,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  statLabel: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '500',
  },
  xpBadge: {
    marginBottom: spacing[5],
  },
  xpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
  },
  xpText: {
    fontSize: typography.sizes.bodyMid,
    fontWeight: '700',
  },
  modalButton: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
  },
  modalButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
  },

  // Route review modal
  routeModalContainer: {
    flex: 1,
  },
  routeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  routeModalTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: '700',
  },
  noRouteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: spacing[4],
    borderRadius: radius.xl,
    gap: spacing[3],
    padding: spacing[8],
  },
  noRouteText: {
    fontSize: typography.sizes.bodyMid,
    fontWeight: '600',
    textAlign: 'center',
  },
  noRouteHint: {
    fontSize: typography.sizes.caption,
    textAlign: 'center',
  },
  routeStatsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    borderTopWidth: 1,
  },
  routeStatItem: {
    alignItems: 'center',
    gap: spacing[1],
  },
  routeStatValue: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
  },
  routeStatDivider: {
    width: 1,
    height: 28,
  },
});

// ── Sensor Fusion Helpers ──

export function getActivityIcon(activity: ActivityType): keyof typeof MaterialCommunityIcons.glyphMap {
  const icons: Record<ActivityType, keyof typeof MaterialCommunityIcons.glyphMap> = {
    STATIONARY: 'human-handsdown',
    WALKING: 'walk',
    RUNNING: 'run-fast',
    CYCLING: 'bicycle',
    EXERCISE: 'dumbbell',
    UNKNOWN: 'help-circle-outline',
  };
  return icons[activity] || 'help-circle-outline';
}

export function formatActivity(activity: ActivityType, t: (key: string) => string): string {
  const labels: Record<ActivityType, string> = {
    STATIONARY: t('move.activity.stationary'),
    WALKING: t('move.activity.walking'),
    RUNNING: t('move.activity.running'),
    CYCLING: t('move.activity.cycling'),
    EXERCISE: t('move.activity.exercising'),
    UNKNOWN: t('move.activity.detecting'),
  };
  return labels[activity] || t('move.activity.unknown');
}

export const sensorStyles = StyleSheet.create({
  activityCard: { marginHorizontal: spacing[4], marginTop: spacing[3], padding: spacing[4] },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  activityIconWrap: { width: 42, height: 42, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  activityType: { fontSize: typography.sizes.h4, fontWeight: '700' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5], marginTop: spacing[0.5] },
  confidenceText: { fontSize: typography.sizes.caption, fontWeight: '500' },
  sensorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  sensorToggleText: { fontSize: typography.sizes.label, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3.5] },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    gap: spacing[1],
  },
  metricValue: { fontSize: typography.sizes.h4, fontWeight: '800' },
  metricLabel: { fontSize: typography.sizes.xs, fontWeight: '600' },
});
