import { StyleSheet } from 'react-native';
import { spacing, radius, typography } from '../../design/theme-system';

export const dashboardStyles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: spacing[25] },

  // ── LEVEL UP BANNER ──
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  // ── GOAL CARD ──
  goalCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  goalBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  goalBarFill: {
    height: 6,
    borderRadius: 3,
  },
  goalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },

  // ── ADAPTIVE NUDGE ──
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  // ── HEADER (Compact) ──
  heroHeader: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { fontSize: typography.sizes.caption, fontWeight: '500', marginBottom: spacing[0.5] },
  heroTitle: { fontSize: typography.sizes.h2, fontWeight: '700' },

  headerStats: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
  },
  statValue: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },

  // ── TODAY'S GOAL ──
  todayGoalCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    padding: spacing[6],
    minHeight: 180,
  },
  todayGoalInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[6],
  },
  todayGoalInnerCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[4],
  },
  todayGoalLeft: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayGoalRight: {
    flex: 1,
  },
  todayGoalPercent: {
    fontSize: typography.sizes.h2,
    fontWeight: '800',
  },
  todayGoalTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: '700',
  },
  todayGoalSub: {
    fontSize: typography.sizes.bodySmall,
    marginTop: spacing[1],
    lineHeight: 20,
  },
  todayGoalMeta: {
    flexDirection: 'row',
    gap: spacing[4],
    marginTop: spacing[2],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metaValue: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
  },
  metaLabel: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '400',
  },
  primaryActionContainer: {
    marginTop: spacing[4],
  },
  primaryButton: {
    paddingVertical: spacing[4],
  },

  // ── RECOVERY STATUS ──
  recoveryCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  recoveryInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recoveryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  recoveryRight: {
    alignItems: 'flex-end',
  },
  recoveryTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
  },
  recoveryValue: {
    fontSize: typography.sizes.h3,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  recoveryLabel: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '500',
    marginTop: spacing[0.5],
  },
  recoveryWarning: {
    fontSize: typography.sizes.caption,
    fontWeight: '500',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.15)',
  },

  // ── BEHAVIORAL SIGNAL CARD ──
  signalCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  signalInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  signalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  trialCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  trialIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── LAST WORKOUT ──
  workoutItem: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  workoutCard: {
    padding: spacing[3],
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  workoutIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutInfo: { flex: 1 },
  workoutName: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },
  workoutMeta: { fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] },
  workoutCalValue: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
  },

  // ── SECONDARY ACTIONS ──
  secondaryActions: {
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
  },
  secondaryButton: {
    opacity: 0.85,
  },

  // ── LIVE STATUS (Minimal) ──
  liveCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
  },
  liveText: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '500',
  },

  // ── DAILY ACTIVITY STATS ──
  dailyStatsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  dailyStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  // ── UPDATES BANNER ──
  updatesBanner: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  // ── EXPLORE GRID (2-column) ──
  exploreGrid: {
    flexDirection: 'column',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
  },
  exploreTileWrap: {
    width: '100%',
    marginBottom: spacing[4],
  },
  exploreTileWrapCompact: {
    width: '100%',
  },
  exploreTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 74,
  },
  exploreTileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  exploreTileContent: {
    flex: 1,
    gap: spacing[0.5],
  },
  exploreTileArrowRow: {
    marginLeft: spacing[2],
    alignItems: 'center',
  },
  exploreTileLabel: {
    fontSize: typography.sizes.bodyMid,
    fontWeight: '700',
  },
  exploreTileDesc: {
    fontSize: typography.sizes.caption,
    fontWeight: '500',
    lineHeight: 15,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  quickTileWrap: {
    width: '31%',
  },
  quickTile: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
  },
  quickTileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  quickTileLabel: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
