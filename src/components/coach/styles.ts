import { StyleSheet, Platform } from 'react-native';
import { typography, spacing, radius } from '../../design/theme-system';

export const coachStyles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerGradient: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.25],
    marginTop: spacing['px'],
  },
  headerStatus: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '600',
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing[4],
    paddingBottom: spacing[2],
  },
  dateBadgeWrap: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  dateBadge: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.25],
    borderRadius: radius.lg,
  },
  dateBadgeText: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '88%',
    marginBottom: spacing[3.5],
  },
  coachBubble: {
    alignSelf: 'flex-start',
    padding: spacing[4],
    borderRadius: radius.xl,
    borderBottomLeftRadius: radius.sm,
  },
  coachAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[1.5],
  },
  coachAvatarIcon: {
    width: 20,
    height: 20,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachLabel: {
    fontSize: typography.sizes.captionSm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  userBubbleGradient: {
    padding: spacing[3.5],
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
  },
  messageText: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 21,
    fontWeight: '400',
  },
  timestamp: {
    fontSize: typography.sizes.xs,
  },

  // Bubble footer (timestamp + reactions)
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
  },
  reactionBtn: {
    padding: spacing[1],
    borderRadius: radius.md,
  },

  // Header actions
  headerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing[1.5],
    gap: spacing[2],
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.25],
    borderRadius: radius.md,
  },

  // Suggestions
  suggestionsWrap: {
    marginTop: spacing[3],
  },
  suggestionsLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginBottom: spacing[2.5],
    letterSpacing: 0.3,
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingRight: spacing[4],
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[2],
  },
  suggestionIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: typography.sizes.label,
    fontWeight: '500',
  },

  // Follow-up suggestions
  followUpWrap: {
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  followUpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  followUpChip: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  followUpText: {
    fontSize: typography.sizes.label,
    fontWeight: '600',
  },

  // Input
  inputBarWrap: {
    paddingHorizontal: spacing[3.5],
    paddingTop: spacing[2.5],
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[1],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    fontSize: typography.sizes.bodyMid,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3.5],
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Action Sheet
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    paddingTop: spacing[3],
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.sm,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  actionSheetTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginBottom: spacing[3],
    letterSpacing: 0.3,
  },
  actionSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionSheetLabel: {
    fontSize: typography.sizes.bodyMid,
    fontWeight: '500',
  },

  // Scroll-to-bottom FAB
  scrollFabWrap: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    zIndex: 10,
  },
  scrollFab: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000', // TODO: theme-aware shadows
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modelLabelBadge: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
    borderRadius: radius.sm,
    marginLeft: spacing[1.5],
  },
});
