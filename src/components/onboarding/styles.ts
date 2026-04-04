import { StyleSheet, Dimensions } from 'react-native';
import { typography, spacing, radius } from '../../design/theme-system';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const onboardingStyles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.3 },

  // Progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    gap: spacing[2.5],
  },
  backBtn: { padding: spacing[1] },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  stepIndicator: { fontSize: typography.sizes.label, fontWeight: '700', minWidth: 30, textAlign: 'right' },

  // Content
  scrollContent: { paddingHorizontal: spacing[6], paddingBottom: spacing[10], flexGrow: 1 },
  stepContainer: { paddingTop: spacing[8] },

  // Welcome
  welcomeIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 40,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: spacing[8],
  },
  welcomeGlow: { ...StyleSheet.absoluteFillObject },
  welcomeTitle: {
    fontSize: typography.sizes.display,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
  },
  welcomeDesc: {
    fontSize: typography.sizes.body,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing[3],
    lineHeight: 24,
  },

  // Pillars
  pillarsRow: { flexDirection: 'row', gap: spacing[2.5], marginTop: spacing[8], paddingHorizontal: spacing[1] },
  pillarCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4.5],
    paddingHorizontal: spacing[2],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  pillarIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  pillarTitle: { fontSize: typography.sizes.label, fontWeight: '800', textAlign: 'center' },
  pillarSub: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing[0.75],
    lineHeight: 14,
  },

  // Steps
  stepTitle: { fontSize: typography.sizes.h2, fontWeight: '900', letterSpacing: -0.5 },
  stepDesc: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '500',
    marginTop: spacing[1],
    marginBottom: spacing[5],
  },

  // Options
  optionsList: { gap: spacing[2.5] },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
    borderRadius: radius.xl,
    gap: spacing[3],
  },
  optionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: typography.sizes.body, fontWeight: '800' },
  optionDesc: { fontSize: typography.sizes.caption, fontWeight: '500', marginTop: spacing['px'] },

  // Metrics
  inputRow: { flexDirection: 'row', gap: spacing[3] },
  metricInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[3],
  },
  metricField: { fontSize: typography.sizes.bodyMid, fontWeight: '600' },
  sexRow: { flexDirection: 'row', gap: spacing[3] },
  sexBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderRadius: 14,
  },
  sexLabel: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },

  // Schedule
  sliderLabel: { fontSize: typography.sizes.body, fontWeight: '700', marginBottom: spacing[3.5] },
  daysRow: { flexDirection: 'row', gap: spacing[2.5], flexWrap: 'wrap' },
  dayBtn: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4.5],
    borderRadius: 14,
    minWidth: 48,
    alignItems: 'center',
  },
  dayBtnText: { fontSize: typography.sizes.body, fontWeight: '800' },

  // Equipment
  equipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2.5] },
  equipCard: {
    width: (SCREEN_W - 58) / 2,
    alignItems: 'center',
    paddingVertical: spacing[5],
    borderRadius: radius.xl,
    position: 'relative',
  },
  equipLabel: { fontSize: typography.sizes.label, fontWeight: '700', marginTop: spacing[2] },
  equipCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // CTA
  ctaRow: { paddingHorizontal: spacing[6], paddingBottom: spacing[7], paddingTop: spacing[2], alignItems: 'center' },
  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    gap: spacing[2],
  },
  ctaBtnText: { fontSize: typography.sizes.body, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  skipText: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },

  // Permissions step
  permCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
    borderRadius: 14,
    gap: spacing[3],
  },
  permAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing[2],
  },
  permIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },
  permDesc: { fontSize: typography.sizes.caption, fontWeight: '500', marginTop: spacing[0.5] },
  permAction: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.md,
  },
  permSkipNote: { fontSize: typography.sizes.caption, fontWeight: '500', textAlign: 'center', marginTop: spacing[6] },

  // Consent & Age Gate
  consentIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[4],
    marginTop: spacing[4],
    gap: spacing[3.5],
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  consentItemText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  consentCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  consentCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentCheckText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
});
