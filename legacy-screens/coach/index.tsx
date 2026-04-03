/**
 * FitQuest AI Coach Screen
 * Premium glass-morphism chat interface with conversational coaching
 * Uses a rule-based coaching engine (no external API needed for offline-first)
 */

import React, { useMemo } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import SimpleMarkdown from '../../src/components/SimpleMarkdown';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  SlideInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { PulseDot } from '../../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../../src/components/ScreenTutorial';
import PremiumGate from '../../src/components/PremiumGate';
import { useCoachViewModel, TIER_LABELS, type ChatMessage, type ModelTier } from '../../src/viewmodels/useCoachViewModel';
import { haptic } from '../../src/utils/haptics';
import { typography, spacing } from '../../src/design/theme-system';


const { width: _SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TYPING INDICATOR COMPONENT
// ============================================

/** Alive pulsing dot for thinking indicator */
function PulsingDot({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- progress is a Reanimated shared value (stable ref)
  }, []);

  const animStyle = useAnimatedStyle(() => {
    // Stagger each dot via phase offset
    const phase = (progress.value + delay) % 1;
    const scale = 0.5 + 0.6 * Math.sin(phase * Math.PI);
    const opacity = 0.3 + 0.7 * Math.sin(phase * Math.PI);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
          marginHorizontal: spacing[1],
        },
        animStyle,
      ]}
    />
  );
}

function TypingIndicator({ modelName }: { modelName?: string }) {
  const { theme } = useTheme();

  // Breathing glow for the whole bubble
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- glow is a Reanimated shared value (stable ref)
  }, []);

  const bubbleGlowStyle = useAnimatedStyle(() => {
    const borderOpacity = 0.15 + 0.35 * Math.sin(glow.value * Math.PI);
    return {
      borderColor: `rgba(16, 185, 129, ${borderOpacity})`,
    };
  });

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        styles.messageBubble,
        styles.coachBubble,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderWidth: 1.5,
          paddingVertical: spacing[4],
          paddingHorizontal: spacing[4.5],
        },
        bubbleGlowStyle,
      ]}
    >
      {!!modelName && (
        <Animated.Text
          entering={FadeIn.duration(300)}
          style={{
            fontSize: typography.sizes.xs, 
            fontWeight: '600',
            color: theme.colors.textMuted,
            marginBottom: spacing[2],
            letterSpacing: 0.3,
          }}
        >
          Thinking…
        </Animated.Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 14 }}>
        <PulsingDot delay={0} color={theme.colors.accent} />
        <PulsingDot delay={0.25} color={theme.colors.accent} />
        <PulsingDot delay={0.5} color={theme.colors.accent} />
      </View>
    </Animated.View>
  );
}

// ============================================
// MESSAGE BUBBLE COMPONENT
// ============================================

const MessageBubble = React.memo(
  function MessageBubble({
    message,
    onLongPress,
    onReact,
    onEdit,
  }: {
    message: ChatMessage;
    onLongPress?: (msg: ChatMessage) => void;
    onReact?: (msgId: string, reaction: 'up' | 'down') => void;
    onEdit?: (msg: ChatMessage) => void;
  }) {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const isCoach = message.role === 'coach';
    const timeStr = useMemo(
      () => message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      [message.timestamp],
    );

    return (
      <Pressable
        onLongPress={
          isCoach
            ? () => {
                haptic('buttonPress');
                onLongPress?.(message);
              }
            : undefined
        }
        onPress={!isCoach ? () => onEdit?.(message) : undefined}
        delayLongPress={400}
      >
        <Animated.View
          entering={isCoach ? FadeInDown.duration(120) : FadeInRight.duration(100)}
          style={[
            styles.messageBubble,
            isCoach ? styles.coachBubble : styles.userBubble,
            isCoach
              ? {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                }
              : {},
          ]}
        >
          {!!isCoach && (
            <View style={styles.coachAvatarRow}>
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                style={styles.coachAvatarIcon}
              >
                <MaterialCommunityIcons name="robot-happy" size={12} color={theme.colors.onAccent} />
              </LinearGradient>
              <Text style={[styles.coachLabel, { color: theme.colors.accent }]}>{t('coach.coachLabel')}</Text>
              {!!message.modelLabel &&
                (() => {
                  const tierKey = message.modelLabel.split(' · ')[0]?.toLowerCase() as ModelTier | undefined;
                  const tierColor =
                    tierKey && TIER_LABELS[tierKey] ? TIER_LABELS[tierKey].color : theme.colors.textMuted;
                  return (
                    <View style={[styles.modelLabelBadge, { backgroundColor: tierColor + '18' }]}>
                      <Text style={{ color: tierColor, fontSize: typography.sizes.micro, fontWeight: '700', letterSpacing: 0.3 }}>
                        {message.modelLabel}
                      </Text>
                    </View>
                  );
                })()}
            </View>
          )}
          {isCoach ? (
            <View style={{ overflow: 'hidden', flexShrink: 1 }}>
              <SimpleMarkdown
                text={message.text}
                style={[styles.messageText, { color: theme.colors.text }]}
                boldStyle={{ color: theme.colors.accent }}
              />
            </View>
          ) : (
            <LinearGradient
              colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.userBubbleGradient}
            >
              <Text style={[styles.messageText, { color: theme.colors.text }]}>{message.text}</Text>
            </LinearGradient>
          )}
          {/* Footer: timestamp + response time + reactions/edit */}
          <View style={styles.bubbleFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
              <Text style={[styles.timestamp, { color: theme.colors.textMuted }]}>{timeStr}</Text>
              {isCoach && !!message.responseTimeMs && (
                <Text style={{ fontSize: typography.sizes.micro, color: theme.colors.textMuted, fontWeight: '500' }}>
                  ·{' '}
                  {message.responseTimeMs < 1000
                    ? `${message.responseTimeMs}ms`
                    : `${(message.responseTimeMs / 1000).toFixed(1)}s`}
                </Text>
              )}
            </View>
            {!isCoach && (
              <TouchableOpacity
                onPress={() => onEdit?.(message)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.reactionBtn}
                accessibilityRole="button"
                accessibilityLabel="Edit message"
              >
                <MaterialCommunityIcons name="pencil-outline" size={12} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
            {isCoach && message.id !== 'greeting' && (
              <View style={styles.reactionRow}>
                <TouchableOpacity
                  onPress={() => {
                    haptic('buttonPress');
                    onReact?.(message.id, 'up');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.reactionBtn,
                    message.reaction === 'up' && { backgroundColor: theme.colors.accent + '20' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Thumbs up"
                  accessibilityState={{ selected: message.reaction === 'up' }}
                >
                  <MaterialCommunityIcons
                    name={message.reaction === 'up' ? 'thumb-up' : 'thumb-up-outline'}
                    size={13}
                    color={message.reaction === 'up' ? theme.colors.accent : theme.colors.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    haptic('buttonPress');
                    onReact?.(message.id, 'down');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.reactionBtn,
                    message.reaction === 'down' && { backgroundColor: theme.colors.error + '20' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Thumbs down"
                  accessibilityState={{ selected: message.reaction === 'down' }}
                >
                  <MaterialCommunityIcons
                    name={message.reaction === 'down' ? 'thumb-down' : 'thumb-down-outline'}
                    size={13}
                    color={message.reaction === 'down' ? theme.colors.error : theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.text === next.message.text &&
    prev.message.reaction === next.message.reaction,
);

/** Streaming bubble — renders the AI response as it types, completely decoupled from FlatList */
const StreamingBubble = React.memo(function StreamingBubble({ text }: { text: string }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  return (
    <Animated.View
      entering={FadeInDown.duration(80)}
      style={[
        styles.messageBubble,
        styles.coachBubble,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.border,
          borderWidth: 1,
        },
      ]}
    >
      <View style={styles.coachAvatarRow}>
        <LinearGradient
          colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
          style={styles.coachAvatarIcon}
        >
          <MaterialCommunityIcons name="robot-happy" size={12} color={theme.colors.onAccent} />
        </LinearGradient>
        <Text style={[styles.coachLabel, { color: theme.colors.accent }]}>{t('coach.coachLabel')}</Text>
      </View>
      <View style={{ overflow: 'hidden', flexShrink: 1 }}>
        <SimpleMarkdown
          text={text}
          style={[styles.messageText, { color: theme.colors.text }]}
          boldStyle={{ color: theme.colors.accent }}
        />
      </View>
    </Animated.View>
  );
});

// ============================================
// MESSAGE ACTION SHEET (long-press menu)
// ============================================

function MessageActionSheet({
  message,
  visible,
  onClose,
  onCopy,
  onRegenerate,
  onShare,
}: {
  message: ChatMessage | null;
  visible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  onShare: () => void;
}) {
  const { theme } = useTheme();
  if (!message) return null;

  const actions = [
    { icon: 'content-copy' as const, label: 'Copy text', onPress: onCopy, color: theme.colors.text },
    { icon: 'refresh' as const, label: 'Regenerate', onPress: onRegenerate, color: theme.colors.accent },
    { icon: 'share-variant' as const, label: 'Share', onPress: onShare, color: theme.colors.blue },
  ];

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.actionSheetOverlay} onPress={onClose}>
        <Animated.View
          entering={SlideInDown.duration(200).springify()}
          style={[styles.actionSheet, { backgroundColor: theme.colors.surface }]}
        >
          <View style={[styles.actionSheetHandle, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.actionSheetTitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
            Message actions
          </Text>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionSheetBtn, { borderBottomColor: theme.colors.border }]}
              onPress={() => {
                action.onPress();
                onClose();
              }}
              activeOpacity={0.6}
            >
              <MaterialCommunityIcons name={action.icon} size={20} color={action.color} />
              <Text style={[styles.actionSheetLabel, { color: action.color }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ============================================
// SCREEN
// ============================================

function CoachScreenInner() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const vm = useCoachViewModel();
  const inputScale = useSharedValue(1);

  const quickSuggestions = [
    { text: 'Design a workout for me', icon: 'dumbbell' as const },
    { text: "I'm tired today", icon: 'emoticon-sad-outline' as const },
    { text: "How's my progress?", icon: 'chart-line' as const },
    { text: 'Help me eat better', icon: 'food-apple-outline' as const },
    { text: 'Recovery tips', icon: 'medical-bag' as const },
    { text: 'Quick meal prep ideas', icon: 'food-variant' as const },
    { text: 'Warm-up routine', icon: 'fire' as const },
    { text: 'How often should I train?', icon: 'calendar-clock' as const },
  ];

  const suggestionColors = [
    theme.colors.indigo, theme.colors.skyBlue, theme.colors.error, theme.colors.accent,
    theme.colors.error, theme.colors.warning, theme.colors.purple, theme.colors.pink,
    theme.colors.orange, theme.colors.blue, theme.colors.accent, theme.colors.purple,
    theme.colors.skyBlue, theme.colors.pink,
  ];

  const keyExtractorMsg = useMemo(() => (item: ChatMessage) => item.id, []);
  const renderMessage = useMemo(
    () =>
      ({ item }: { item: ChatMessage }) => (
        <MessageBubble message={item} onLongPress={vm.handleLongPress} onReact={vm.handleReaction} onEdit={vm.handleEditMessage} />
      ),
    [vm.handleLongPress, vm.handleReaction, vm.handleEditMessage],
  );

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── HEADER ── */}
        <Animated.View entering={FadeInDown.duration(150)}>
          <LinearGradient
            colors={
              theme.isDark
                ? ([`${theme.colors.indigo}33`, `${theme.colors.indigo}0D`, 'transparent'] as [string, string, string])
                : ([`${theme.colors.indigo}1A`, `${theme.colors.indigo}05`, 'transparent'] as [string, string, string])
            }
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              {router.canGoBack() && (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={[
                    styles.headerBackBtn,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              )}

              <View style={styles.headerCenter}>
                <LinearGradient
                  colors={[theme.colors.accent, theme.colors.purple] as [string, string]}
                  style={styles.headerAvatar}
                >
                  <MaterialCommunityIcons name="robot-happy" size={22} color={theme.colors.onAccent} />
                </LinearGradient>
                <View>
                  <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('coach.title')}</Text>
                  <View style={styles.headerStatusRow}>
                    <PulseDot color={vm.cloudAvailable ? theme.colors.accent : theme.colors.warning} size={6} />
                    <Text
                      style={[
                        styles.headerStatus,
                        { color: vm.cloudAvailable ? theme.colors.accent : theme.colors.warning },
                      ]}
                    >
                      {vm.cloudAvailable ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ width: 36 }} />
            </View>

            {/* New chat button row */}
            <View style={styles.headerActionsRow}>
              <TouchableOpacity
                onPress={vm.handleNewChat}
                style={[styles.headerActionBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Start new chat"
              >
                <MaterialCommunityIcons name="chat-plus-outline" size={16} color={theme.colors.accent} />
                <Text style={{ color: theme.colors.accent, fontSize: typography.sizes.captionSm, fontWeight: '600' }}>New chat</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          {/* ── MESSAGES ── */}
          <FlatList
            ref={vm.scrollRef}
            data={vm.messages}
            keyExtractor={keyExtractorMsg}
            renderItem={renderMessage}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            onScroll={vm.handleScroll}
            scrollEventThrottle={100}
            ListHeaderComponent={
              <Animated.View entering={FadeIn.delay(200)} style={styles.dateBadgeWrap}>
                <View
                  style={[
                    styles.dateBadge,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text style={[styles.dateBadgeText, { color: theme.colors.textMuted }]}>{t('common.today')}</Text>
                </View>
              </Animated.View>
            }
            ListFooterComponent={
              <>
                {/* Streaming bubble — decoupled from FlatList, only this updates during typewriting */}
                {vm.streamingText !== null && <StreamingBubble text={vm.streamingText} />}

                {vm.isTyping && <TypingIndicator modelName={vm.typingModelName} />}

                {/* Quick Suggestions (show only after greeting) */}
                {vm.messages.length <= 1 && !vm.isTyping && (
                  <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.suggestionsWrap}>
                    <Text style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                      {t('coach.tapToStart')}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.suggestionsScroll}
                    >
                      {quickSuggestions.map((suggestion, idx) => (
                        <Animated.View key={suggestion.text} entering={FadeInDown.delay(180 + idx * 30).duration(150)}>
                          <TouchableOpacity
                            style={[
                              styles.suggestionChip,
                              {
                                backgroundColor: theme.colors.surfaceVariant,
                                borderColor: theme.colors.border,
                              },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => vm.handleSuggestion(suggestion.text)}
                          >
                            <View
                              style={[
                                styles.suggestionIcon,
                                { backgroundColor: suggestionColors[idx % suggestionColors.length] + '20' },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name={suggestion.icon}
                                size={14}
                                color={suggestionColors[idx % suggestionColors.length]}
                              />
                            </View>
                            <Text style={[styles.suggestionText, { color: theme.colors.text }]}>{suggestion.text}</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      ))}
                    </ScrollView>
                  </Animated.View>
                )}

                {/* Workout result card — tap to navigate to the workout */}
                {vm.lastWorkoutResult && !vm.isTyping && (
                  <Animated.View
                    entering={FadeInUp.delay(100).duration(200)}
                    style={{ paddingHorizontal: spacing[4], marginTop: spacing[1], marginBottom: spacing[4] }}
                  >
                    <View
                      style={{
                        borderRadius: 16,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: theme.colors.accent + '40',
                      }}
                    >
                      <LinearGradient
                        colors={[theme.colors.accent + '20', theme.colors.indigo + '15'] as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ padding: spacing[4.5] }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2.5] }}>
                          <MaterialCommunityIcons name="dumbbell" size={18} color={theme.colors.accent} />
                          <Text style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '700', flex: 1 }}>
                            {vm.lastWorkoutResult.name}
                          </Text>
                        </View>
                        <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, marginBottom: spacing[3.5] }}>
                          {vm.lastWorkoutResult.exerciseCount} exercises · ~{vm.lastWorkoutResult.durationEstimate} min
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => vm.navigateToWorkout(vm.lastWorkoutResult!.sessionId)}
                        >
                          <LinearGradient
                            colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingVertical: spacing[3],
                              paddingHorizontal: spacing[5],
                              borderRadius: 12,
                              alignItems: 'center',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              gap: spacing[2],
                            }}
                          >
                            <MaterialCommunityIcons name="arrow-right-circle" size={18} color={theme.colors.onAccent} />
                            <Text
                              style={{
                                color: theme.colors.onAccent,
                                fontSize: typography.sizes.bodySmall, 
                                fontWeight: '700',
                                letterSpacing: 0.3,
                              }}
                            >
                              Take me there
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  </Animated.View>
                )}

                {/* Follow-up suggestions after a response */}
                {vm.activeSuggestions.length > 0 && vm.messages.length > 1 && !vm.isTyping && (
                  <Animated.View entering={FadeInUp.delay(100).duration(150)} style={styles.followUpWrap}>
                    <Text style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                      {t('coach.relatedTopics')}
                    </Text>
                    <View style={styles.followUpRow}>
                      {vm.activeSuggestions.map((s, _idx) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.followUpChip,
                            {
                              backgroundColor: theme.colors.surfaceVariant,
                              borderColor: theme.colors.border,
                            },
                          ]}
                          activeOpacity={0.7}
                          onPress={() => vm.handleSuggestion(s)}
                        >
                          <Text style={[styles.followUpText, { color: theme.colors.accent }]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Animated.View>
                )}
              </>
            }
          />

          {/* ── SCROLL TO BOTTOM FAB ── */}
          {vm.showScrollBtn && !vm.isTyping && vm.streamingText === null && (
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={styles.scrollFabWrap}>
              <TouchableOpacity
                style={[styles.scrollFab, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={vm.scrollToBottom}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chevron-double-down" size={20} color={theme.colors.accent} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── INPUT BAR ── */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(150)}
            style={[
              styles.inputBarWrap,
              {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
                // When keyboard hidden: account for floating tab bar (height + bottom offset)
                // Tab bar: height = 64 + max(0, insets.bottom-4), bottom = max(8, insets.bottom+2)
                paddingBottom: vm.keyboardVisible
                  ? 12
                  : Math.max(12, Math.max(8, insets.bottom + 2) + 64 + Math.max(0, insets.bottom - 4) + 4),
              },
            ]}
          >
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <TextInput
                ref={vm.inputRef}
                style={[styles.textInput, { color: theme.colors.text, maxHeight: 100 }]}
                placeholder={t('coach.placeholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={vm.input}
                onChangeText={vm.setInput}
                onSubmitEditing={vm.sendMessage}
                returnKeyType="send"
                multiline
                blurOnSubmit={false}
              />
              <Animated.View style={sendAnimatedStyle}>
                {vm.streamingText !== null || vm.isTyping ? (
                  <TouchableOpacity
                    onPress={vm.handleStopGeneration}
                    onPressIn={() => {
                      inputScale.value = withTiming(0.92, { duration: 120 });
                    }}
                    onPressOut={() => {
                      inputScale.value = withTiming(1, { duration: 120 });
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.sendButton,
                        { backgroundColor: theme.colors.text, justifyContent: 'center', alignItems: 'center' },
                      ]}
                    >
                      <View
                        style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.background }}
                      />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={vm.sendMessage}
                    disabled={!vm.input.trim()}
                    onPressIn={() => {
                      inputScale.value = withTiming(0.92, { duration: 120 });
                    }}
                    onPressOut={() => {
                      inputScale.value = withTiming(1, { duration: 120 });
                    }}
                    activeOpacity={1}
                  >
                    <LinearGradient
                      colors={
                        vm.input.trim()
                          ? ([theme.colors.accent, theme.colors.indigo] as [string, string])
                          : ([theme.colors.surfaceVariant, theme.colors.surface] as [string, string])
                      }
                      style={styles.sendButton}
                    >
                      <MaterialCommunityIcons name="arrow-up" size={20} color={theme.colors.onAccent} />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── MESSAGE ACTION SHEET ── */}
      <MessageActionSheet
        message={vm.actionMessage}
        visible={vm.showActions}
        onClose={vm.closeActions}
        onCopy={vm.handleCopyMessage}
        onRegenerate={() => {
          vm.closeActions();
          vm.handleRegenerate();
        }}
        onShare={vm.handleShareMessage}
      />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
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
    borderRadius: 12,
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
    borderRadius: 14,
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
    borderRadius: 12,
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
    borderRadius: 18,
    borderBottomLeftRadius: 6,
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
    borderRadius: 7,
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
    borderRadius: 18,
    borderBottomRightRadius: 6,
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
    borderRadius: 8,
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
    borderRadius: 10,
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
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing[2],
  },
  suggestionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    borderRadius: 16,
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
    borderRadius: 24,
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
    borderRadius: 14,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    paddingTop: spacing[3],
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
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
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modelLabelBadge: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
    borderRadius: 6,
    marginLeft: spacing[1.5],
  },
});

export default function CoachScreen() {
  const router = useRouter();
  const handleBack = () => (router.canGoBack() ? router.back() : router.replace('/dashboard'));
  return (
    <ScreenErrorBoundary screenName="AI Coach" onGoBack={handleBack}>
      <PremiumGate featureName="AI Coach">
        <ScreenTutorial
          screenKey="ai-coach"
          icon="robot-happy"
          title="AI Coach"
          description="Chat with your AI fitness coach for personalised workout advice, form tips, and motivation. Start a new chat anytime to keep things fresh."
        />
        <CoachScreenInner />
      </PremiumGate>
    </ScreenErrorBoundary>
  );
}
