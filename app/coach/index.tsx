/**
 * FitQuest AI Coach Screen
 * Premium glass-morphism chat interface with conversational coaching
 * Uses a rule-based coaching engine (no external API needed for offline-first)
 */

import React, { useMemo } from 'react';
import { View, FlatList, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../src/context/ThemeContext';
import { MOTION } from '../../src/design/motion';
import { useLanguage } from '../../src/context/LanguageContext';
import { PulseDot } from '../../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../../src/components/ScreenTutorial';
import PremiumGate from '../../src/components/PremiumGate';
import { useCoachViewModel, type ChatMessage } from '../../src/viewmodels/useCoachViewModel';
import { CoachStatusCard } from '../../src/components/coach/CoachStatusCard';
import { typography, spacing, radius } from '../../src/design/theme-system';
import ThemedText from '../../src/components/ThemedText';
import { coachStyles as styles } from '../../src/components/coach/styles';
import {
  TypingIndicator,
  MessageBubble,
  StreamingBubble,
  MessageActionSheet,
} from '../../src/components/coach/ChatComponents';
import CoachActivationModal from '../../src/components/coach/CoachActivationModal';

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
    theme.colors.indigo,
    theme.colors.skyBlue,
    theme.colors.error,
    theme.colors.accent,
    theme.colors.error,
    theme.colors.warning,
    theme.colors.purple,
    theme.colors.pink,
    theme.colors.orange,
    theme.colors.blue,
    theme.colors.accent,
    theme.colors.purple,
    theme.colors.skyBlue,
    theme.colors.pink,
  ];

  const keyExtractorMsg = useMemo(() => (item: ChatMessage) => item.id, []);
  const renderMessage = useMemo(
    () =>
      ({ item }: { item: ChatMessage }) => (
        <MessageBubble
          message={item}
          onLongPress={vm.handleLongPress}
          onReact={vm.handleReaction}
          onEdit={vm.handleEditMessage}
        />
      ),
    [vm.handleLongPress, vm.handleReaction, vm.handleEditMessage],
  );

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  return (
    <ScreenContainer edges={['top']}>
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
                <ThemedText style={[styles.headerTitle, { color: theme.colors.text }]}>{t('coach.title')}</ThemedText>
                <View style={styles.headerStatusRow}>
                  <PulseDot color={vm.cloudAvailable ? theme.colors.accent : theme.colors.warning} size={6} />
                  <ThemedText
                    style={[
                      styles.headerStatus,
                      { color: vm.cloudAvailable ? theme.colors.accent : theme.colors.warning },
                    ]}
                  >
                    {vm.cloudAvailable ? 'Online' : 'Offline'}
                  </ThemedText>
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
              <ThemedText
                style={{ color: theme.colors.accent, fontSize: typography.sizes.captionSm, fontWeight: '600' }}
              >
                New chat
              </ThemedText>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* ── STATUS CARD ── */}
        {vm.coachStatusData && <CoachStatusCard data={vm.coachStatusData} />}
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
                <ThemedText style={[styles.dateBadgeText, { color: theme.colors.textMuted }]}>
                  {t('common.today')}
                </ThemedText>
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
                  <ThemedText style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                    {t('coach.tapToStart')}
                  </ThemedText>
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
                              borderColor: theme.colors.accent + '33',
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
                          <ThemedText style={[styles.suggestionText, { color: theme.colors.text }]}>
                            {suggestion.text}
                          </ThemedText>
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
                      borderRadius: radius.xl,
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
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing[2],
                          marginBottom: spacing[2.5],
                        }}
                      >
                        <MaterialCommunityIcons name="dumbbell" size={18} color={theme.colors.accent} />
                        <ThemedText
                          style={{
                            color: theme.colors.text,
                            fontSize: typography.sizes.bodySmall,
                            fontWeight: '700',
                            flex: 1,
                          }}
                        >
                          {vm.lastWorkoutResult.name}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={{
                          color: theme.colors.textMuted,
                          fontSize: typography.sizes.caption,
                          marginBottom: spacing[3.5],
                        }}
                      >
                        {t('coach.exercisesMin')
                          .replace('{{count}}', String(vm.lastWorkoutResult.exerciseCount))
                          .replace('{{min}}', String(vm.lastWorkoutResult.durationEstimate))}
                      </ThemedText>
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
                            borderRadius: radius.lg,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: spacing[2],
                          }}
                        >
                          <MaterialCommunityIcons name="arrow-right-circle" size={18} color={theme.colors.onAccent} />
                          <ThemedText
                            style={{
                              color: theme.colors.onAccent,
                              fontSize: typography.sizes.bodySmall,
                              fontWeight: '700',
                              letterSpacing: 0.3,
                            }}
                          >
                            Take me there
                          </ThemedText>
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                </Animated.View>
              )}

              {/* Follow-up suggestions after a response */}
              {vm.activeSuggestions.length > 0 && vm.messages.length > 1 && !vm.isTyping && (
                <Animated.View entering={FadeInUp.delay(100).duration(150)} style={styles.followUpWrap}>
                  <ThemedText style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                    {t('coach.relatedTopics')}
                  </ThemedText>
                  <View style={styles.followUpRow}>
                    {vm.activeSuggestions.map((s, _idx) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.followUpChip,
                          {
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: theme.colors.accent + '33',
                          },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => vm.handleSuggestion(s)}
                      >
                        <ThemedText style={[styles.followUpText, { color: theme.colors.accent }]}>{s}</ThemedText>
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
                    inputScale.value = withTiming(0.92, { duration: MOTION.press });
                  }}
                  onPressOut={() => {
                    inputScale.value = withTiming(1, { duration: MOTION.press });
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
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: radius.sm,
                        backgroundColor: theme.colors.background,
                      }}
                    />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={vm.sendMessage}
                  disabled={!vm.input.trim()}
                  onPressIn={() => {
                    inputScale.value = withTiming(0.92, { duration: MOTION.press });
                  }}
                  onPressOut={() => {
                    inputScale.value = withTiming(1, { duration: MOTION.press });
                  }}
                  activeOpacity={1}
                >
                  <LinearGradient
                    colors={
                      vm.input.trim()
                        ? ([theme.colors.accent, theme.colors.accentDark] as [string, string])
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
    </ScreenContainer>
  );
}

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
        <CoachActivationModal onActivated={() => {}} />
        <CoachScreenInner />
      </PremiumGate>
    </ScreenErrorBoundary>
  );
}
