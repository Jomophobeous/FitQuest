/**
 * Coach Chat Sub-Components
 * Extracted from coach/index.tsx — PulsingDot, TypingIndicator, MessageBubble, StreamingBubble, MessageActionSheet
 */

import React, { useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Modal, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SimpleMarkdown from '../SimpleMarkdown';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { TIER_LABELS, type ChatMessage, type ModelTier } from '../../viewmodels/useCoachViewModel';
import { haptic } from '../../utils/haptics';
import { typography, spacing } from '../../design/theme-system';
import ThemedText from '../ThemedText';
import { coachStyles as styles } from './styles';

// ============================================
// PULSING DOT (typing indicator element)
// ============================================

export function PulsingDot({ delay, color }: { delay: number; color: string }) {
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

// ============================================
// TYPING INDICATOR
// ============================================

export function TypingIndicator({ modelName }: { modelName?: string }) {
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

export const MessageBubble = React.memo(
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
              <ThemedText style={[styles.coachLabel, { color: theme.colors.accent }]}>
                {t('coach.coachLabel')}
              </ThemedText>
              {!!message.modelLabel &&
                (() => {
                  const tierKey = message.modelLabel.split(' · ')[0]?.toLowerCase() as ModelTier | undefined;
                  const tierColor =
                    tierKey && TIER_LABELS[tierKey] ? TIER_LABELS[tierKey].color : theme.colors.textMuted;
                  return (
                    <View style={[styles.modelLabelBadge, { backgroundColor: tierColor + '18' }]}>
                      <ThemedText
                        style={{
                          color: tierColor,
                          fontSize: typography.sizes.micro,
                          fontWeight: '700',
                          letterSpacing: 0.3,
                        }}
                      >
                        {message.modelLabel}
                      </ThemedText>
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
              <ThemedText style={[styles.messageText, { color: theme.colors.text }]}>{message.text}</ThemedText>
            </LinearGradient>
          )}
          {/* Footer: timestamp + response time + reactions/edit */}
          <View style={styles.bubbleFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
              <ThemedText style={[styles.timestamp, { color: theme.colors.textMuted }]}>{timeStr}</ThemedText>
              {isCoach && !!message.responseTimeMs && (
                <ThemedText
                  style={{ fontSize: typography.sizes.micro, color: theme.colors.textMuted, fontWeight: '500' }}
                >
                  ·{' '}
                  {message.responseTimeMs < 1000
                    ? `${message.responseTimeMs}ms`
                    : `${(message.responseTimeMs / 1000).toFixed(1)}s`}
                </ThemedText>
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

// ============================================
// STREAMING BUBBLE
// ============================================

/** Streaming bubble — renders the AI response as it types, completely decoupled from FlatList */
export const StreamingBubble = React.memo(function StreamingBubble({ text }: { text: string }) {
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
        <ThemedText style={[styles.coachLabel, { color: theme.colors.accent }]}>{t('coach.coachLabel')}</ThemedText>
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

export function MessageActionSheet({
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
          <ThemedText style={[styles.actionSheetTitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
            Message actions
          </ThemedText>
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
              <ThemedText style={[styles.actionSheetLabel, { color: action.color }]}>{action.label}</ThemedText>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
