/**
 * FitQuest AI Coach Screen
 * Premium glass-morphism chat interface with conversational coaching
 * Uses a rule-based coaching engine (no external API needed for offline-first)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  BackHandler,
  Share,
  Modal,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import SimpleMarkdown from '../../src/components/SimpleMarkdown';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  SlideInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDatabase } from '../../src/context/DatabaseContext';
import { getUserProgress, getStreak, getMuscleFatigue, getUserProfile, getExercises, getAppState, getUserInjuries, getUserEquipment } from '../../src/database/service';
import { getActiveBodyCraftAlgorithm } from '../../src/database/bodyCraftService';
import { getXPData } from '../../src/services/xpService';
import { getCachedReadiness, formatStatusForAI } from '../../src/engines/ReadinessEngine';
import { PulseDot } from '../../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../../src/components/ScreenTutorial';
import PremiumGate from '../../src/components/PremiumGate';
import { intentRouter } from '../../src/engines/IntentRouter';
import { dualAI, type ConversationMemory } from '../../src/fitmind/DualAIEngine';
import { encryptedDB } from '../../src/security/EncryptedDatabase';
import { aiProvider, TIER_LABELS, type ModelTier } from '../../src/services/aiProvider';
import { isWorkoutCreationIntent, extractWorkoutParams, buildAIWorkoutContext, parseAIWorkoutResponse, createDirectWorkout, type AIWorkoutResult } from '../../src/services/aiWorkoutService';
import { haptic } from '../../src/utils/haptics';
import { getCurrentLocation, getDefaultLocation } from '../../src/services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  id: string;
  role: 'coach' | 'user';
  text: string;
  timestamp: Date;
  modelLabel?: string;
  reaction?: 'up' | 'down' | null;
  responseTimeMs?: number;
}

interface CoachContext {
  streak: number;
  longestStreak: number;
  totalWorkouts: number;
  level: number;
  totalXP: number;
  fatigueHighMuscles: string[];
  lastWorkoutDate: string | null;
  daysSinceLastWorkout: number;
  goal: string;
  exerciseCount: number;
  readinessStatus?: string;
  userName: string;
  experience: string;
  weight?: number;
  height?: number;
  trainingDaysPerWeek: number;
  sessionMinutes: number;
  injuries: string;
  equipment: string;
  bodyCraftPlan?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    isoCountryCode?: string;
  };
}

// ============================================
// COACHING ENGINE (Offline rule-based)
// ============================================

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// TOPIC_RESPONSES & generateCoachResponse removed — all responses now routed through aiProvider
// (cloud LLM when online, DualAI templates offline)

// ============================================
// TYPING INDICATOR COMPONENT
// ============================================

/** Alive pulsing dot for thinking indicator */
function PulsingDot({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
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
    <Animated.View style={[{
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: color,
      marginHorizontal: 4,
    }, animStyle]} />
  );
}

function TypingIndicator({ modelName }: { modelName?: string }) {
  const { theme } = useTheme();

  // Breathing glow for the whole bubble
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const bubbleGlowStyle = useAnimatedStyle(() => {
    const borderOpacity = 0.15 + 0.35 * Math.sin(glow.value * Math.PI);
    return {
      borderColor: `rgba(16, 185, 129, ${borderOpacity})`,
    };
  });

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.messageBubble, styles.coachBubble, {
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1.5,
      paddingVertical: 16,
      paddingHorizontal: 18,
    }, bubbleGlowStyle]}>
      {!!modelName && (
        <Animated.Text
          entering={FadeIn.duration(300)}
          style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 8, letterSpacing: 0.3 }}
        >
          {modelName} is thinking…
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

const MessageBubble = React.memo(function MessageBubble({
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
  const timeStr = useMemo(() => message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), [message.timestamp]);

  return (
    <Pressable
      onLongPress={isCoach ? () => { haptic('buttonPress'); onLongPress?.(message); } : undefined}
      onPress={!isCoach ? () => onEdit?.(message) : undefined}
      delayLongPress={400}
    >
      <Animated.View
        entering={isCoach
          ? FadeInDown.duration(120)
          : FadeInRight.duration(100)
        }
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
            {!!message.modelLabel && (() => {
              const tierKey = message.modelLabel.split(' · ')[0]?.toLowerCase() as ModelTier | undefined;
              const tierColor = tierKey && TIER_LABELS[tierKey] ? TIER_LABELS[tierKey].color : theme.colors.textMuted;
              return (
                <View style={[styles.modelLabelBadge, { backgroundColor: tierColor + '18' }]}>
                  <Text style={{ color: tierColor, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>{message.modelLabel}</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.timestamp, { color: theme.colors.textMuted }]}>
              {timeStr}
            </Text>
            {isCoach && !!message.responseTimeMs && (
              <Text style={{ fontSize: 9, color: theme.colors.textMuted, fontWeight: '500' }}>
                ·  {message.responseTimeMs < 1000
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
                onPress={() => { haptic('buttonPress'); onReact?.(message.id, 'up'); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.reactionBtn, message.reaction === 'up' && { backgroundColor: theme.colors.accent + '20' }]}
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
                onPress={() => { haptic('buttonPress'); onReact?.(message.id, 'down'); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.reactionBtn, message.reaction === 'down' && { backgroundColor: theme.colors.error + '20' }]}
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
}, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.text === next.message.text &&
  prev.message.reaction === next.message.reaction
);

/** Streaming bubble — renders the AI response as it types, completely decoupled from FlatList */
function StreamingBubble({ text }: { text: string }) {
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
}

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
        <Animated.View entering={SlideInDown.duration(200).springify()} style={[styles.actionSheet, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.actionSheetHandle, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.actionSheetTitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
            Message actions
          </Text>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionSheetBtn, { borderBottomColor: theme.colors.border }]}
              onPress={() => { action.onPress(); onClose(); }}
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
// MODEL PICKER SHEET
// ============================================

function ModelPickerSheet({
  visible,
  onClose,
  onSelectModel,
  onEnableAutoRoute,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectModel: (modelId: string) => void;
  onEnableAutoRoute: () => void;
}) {
  const { theme } = useTheme();
  const models = aiProvider.getAvailableModels();
  const isAuto = aiProvider.autoRoute;
  const activeId = aiProvider.activeModel?.id;

  // Only show tiers that actually have available models
  const allTiers: ModelTier[] = ['elite', 'strong', 'fast', 'free'];
  const tiers = allTiers.filter(t => models.some(m => m.tier === t));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.actionSheetOverlay} onPress={onClose}>
        <Animated.View
          entering={SlideInDown.duration(200).springify()}
          style={[styles.modelPickerSheet, { backgroundColor: theme.colors.surface }]}
        >
          <View style={[styles.actionSheetHandle, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.actionSheetTitle, { color: theme.colors.textMuted }]}>Model selection</Text>

          {/* Auto-route toggle */}
          <TouchableOpacity
            style={[styles.modelRow, {
              borderBottomColor: theme.colors.border,
              backgroundColor: isAuto ? theme.colors.accent + '15' : 'transparent',
            }]}
            onPress={() => { onEnableAutoRoute(); onClose(); }}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons name="auto-fix" size={18} color={isAuto ? theme.colors.accent : theme.colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.modelName, { color: isAuto ? theme.colors.accent : theme.colors.text }]}>Auto-route</Text>
              <Text style={[styles.modelDesc, { color: theme.colors.textMuted }]}>Best model per query complexity</Text>
            </View>
            {isAuto && <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.accent} />}
          </TouchableOpacity>

          {/* Models grouped by tier */}
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {tiers.map(tier => {
              const tierModels = models.filter(m => m.tier === tier)
                .sort((a, b) => (b.qualityScore + b.speedScore) - (a.qualityScore + a.speedScore));
              if (tierModels.length === 0) return null;
              const tierInfo = TIER_LABELS[tier];
              return (
                <View key={tier}>
                  <Text style={[styles.modelTierLabel, { color: tierInfo.color }]}>
                    {tierInfo.badge} {tierInfo.label}
                  </Text>
                  {tierModels.map(model => {
                    const selected = !isAuto && model.id === activeId;
                    return (
                      <TouchableOpacity
                        key={model.id}
                        style={[styles.modelRow, {
                          borderBottomColor: theme.colors.border,
                          backgroundColor: selected ? theme.colors.accent + '15' : 'transparent',
                        }]}
                        onPress={() => { onSelectModel(model.id); onClose(); }}
                        activeOpacity={0.6}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modelName, { color: selected ? theme.colors.accent : theme.colors.text }]}>
                            {model.displayName}
                          </Text>
                          <Text style={[styles.modelDesc, { color: theme.colors.textMuted }]} numberOfLines={1}>
                            {model.description}
                          </Text>
                        </View>
                        {selected && <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.accent} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
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
  const { t, language, languageName } = useLanguage();
  const { isReady: dbReady } = useDatabase();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);   // mirror — lets callbacks read latest without re-creating
  const [input, setInput] = useState('');
  const [coachCtx, setCoachCtx] = useState<CoachContext | null>(null);
  const coachCtxRef = useRef<CoachContext | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null); // decoupled streaming state
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const inputScale = useSharedValue(1);
  const cachedMemoryRef = useRef<ConversationMemory | null>(null);
  const languageRef = useRef({ language, languageName });

  // ── New feature states ──
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null); // long-press menu target
  const [showActions, setShowActions] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const stopRequestedRef = useRef(false); // stop generation flag
  const lastUserInputRef = useRef<string>(''); // for regenerate
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [typingModelName, setTypingModelName] = useState<string | undefined>();
  const [lastWorkoutResult, setLastWorkoutResult] = useState<AIWorkoutResult | null>(null);

  // Keep refs in sync — avoids re-creating useCallbacks when messages/ctx change
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { coachCtxRef.current = coachCtx; }, [coachCtx]);
  useEffect(() => { languageRef.current = { language, languageName }; }, [language, languageName]);

  // Scroll helper — debounced soft scroll
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => { if (dbReady) loadCoachContext(); }, [dbReady]);

  // Handle Android hardware back button — navigate to dashboard tab
  useEffect(() => {
    const backAction = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/dashboard');
      }
      return true; // Prevent default (which dispatches GO_BACK to navigator)
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [router]);



  const loadCoachContext = async () => {
    try {
      const [progress, streak, fatigue, xp, profile, exercises, readinessSnap, displayName, injuries, equipment, bodyCraftAlgo] = await Promise.all([
        getUserProgress(),
        getStreak('user_local_001'),
        getMuscleFatigue('user_local_001'),
        getXPData(),
        getUserProfile('user_local_001'),
        getExercises(),
        getCachedReadiness('user_local_001').catch(() => null),
        getAppState('user.display_name').catch(() => null),
        getUserInjuries('user_local_001').catch(() => []),
        getUserEquipment('user_local_001').catch(() => []),
        getActiveBodyCraftAlgorithm('user_local_001').catch(() => null),
      ]);

      const fatigueHigh = fatigue
        .filter(f => f.fatigue_level > 60)
        .map(f => f.muscle.replace(/_/g, ' '));

      const daysSince = progress.last_workout_date
        ? Math.floor((Date.now() - new Date(progress.last_workout_date).getTime()) / 86400000)
        : 999;

      const readinessStatus = readinessSnap ? formatStatusForAI(readinessSnap) : undefined;

      const userName = displayName || 'Athlete';
      const injuryStr = injuries.length > 0
        ? injuries.map(i => `${i.muscle.replace(/_/g, ' ')} (${i.severity})`).join(', ')
        : 'none';
      const equipmentStr = equipment.length > 0 ? equipment.join(', ') : 'bodyweight';

      // Summarize body craft plan if exists
      let bodyCraftSummary: string | undefined;
      if (bodyCraftAlgo) {
        bodyCraftSummary = `Body type: ${bodyCraftAlgo.body_type}, Goal: ${bodyCraftAlgo.goal_type}, Timeline: ${bodyCraftAlgo.timeline_months}mo, Split: ${bodyCraftAlgo.recommended_training_split}, ${bodyCraftAlgo.training_days_per_week}d/wk, Calories: ${bodyCraftAlgo.calories_target}, Protein: ${bodyCraftAlgo.protein_g}g, Cardio: ${bodyCraftAlgo.cardio_minutes_per_week}min/wk`;
      }

      const ctx: CoachContext = {
        streak: streak.current,
        longestStreak: streak.longest,
        totalWorkouts: progress.total_workouts,
        level: xp.level,
        totalXP: xp.totalXP,
        fatigueHighMuscles: fatigueHigh,
        lastWorkoutDate: progress.last_workout_date,
        daysSinceLastWorkout: daysSince,
        goal: profile?.goal || 'body_control',
        exerciseCount: exercises.length,
        readinessStatus,
        userName,
        experience: profile?.experience || 'intermediate',
        weight: profile?.weight_kg ?? undefined,
        height: profile?.height_cm ?? undefined,
        trainingDaysPerWeek: profile?.training_days_per_week || 3,
        sessionMinutes: profile?.time_per_session_minutes || 30,
        injuries: injuryStr,
        equipment: equipmentStr,
        bodyCraftPlan: bodyCraftSummary,
      };

      // Fetch location for diet recommendations (async, non-blocking)
      try {
        const loc = await getCurrentLocation();
        if (loc) {
          ctx.location = {
            city: loc.city ?? undefined,
            region: loc.region ?? undefined,
            country: loc.country ?? undefined,
            isoCountryCode: loc.isoCountryCode ?? undefined,
          };
        }
      } catch {
        try {
          const fallback = getDefaultLocation();
          ctx.location = {
            country: fallback.country ?? undefined,
            isoCountryCode: fallback.isoCountryCode ?? undefined,
          };
        } catch { /* ignore */ }
      }

      setCoachCtx(ctx);

      // Pre-cache conversation memory so DualAI queries skip DB reads
      try {
        const memory = await dualAI.loadConversationMemory('COACH', 5);
        cachedMemoryRef.current = memory;
      } catch {
        // Continue without cached memory
      }

      // Generate context-aware greeting via DualAI
      let greeting: string;
      try {
        // Check if user just completed a workout (within last 30 minutes)
        const lastWorkoutRaw = await getAppState('last_completed_workout');
        const lastWorkout = lastWorkoutRaw ? JSON.parse(lastWorkoutRaw) : null;
        const isRecentWorkout = lastWorkout && (Date.now() - lastWorkout.completedAt) < 30 * 60 * 1000;

        if (isRecentWorkout) {
          greeting = dualAI.getPostWorkoutGreeting(lastWorkout);
        } else {
          // Build greeting with readiness status prefix
          const baseGreeting = await dualAI.getGreeting({
            personality: 'COACH',
            conversationHistory: [],
            userProfile: {
              name: userName,
              fitnessLevel: ctx.experience,
              goals: [ctx.goal],
              streakDays: ctx.streak,
              longestStreak: ctx.longestStreak,
              level: ctx.level,
              totalXP: ctx.totalXP,
              weight: ctx.weight,
              height: ctx.height,
              trainingDaysPerWeek: ctx.trainingDaysPerWeek,
              sessionMinutes: ctx.sessionMinutes,
              injuries: ctx.injuries,
              equipment: ctx.equipment,
            },
            workoutContext: {
              fatigueLevel: ctx.fatigueHighMuscles.length > 0 ? 75 : 30,
              lastWorkoutDate: ctx.lastWorkoutDate ?? undefined,
            },
          });

          // Prepend readiness status as first-message feedback
          if (ctx.readinessStatus) {
            greeting = `📊 **Your Status:** ${ctx.readinessStatus}\n\n${baseGreeting}`;
          } else {
            greeting = baseGreeting;
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[Coach] DualAI greeting failed, using fallback:', e);
        const greetings = [
          "What can I help you with today?",
          "Ready to crush it? What's on your mind?",
          "Ask me anything about your training.",
        ];
        greeting = `${getTimeGreeting()}! 💪 ${greetings[Math.floor(Math.random() * greetings.length)]}`;
      }

      // Load past conversation history BEFORE the greeting so they appear above it
      const initialMessages: ChatMessage[] = [];
      try {
        const history = await encryptedDB.getAIConversations('COACH', 5);
        if (history.length > 0) {
          for (const entry of history.reverse()) {
            initialMessages.push({
              id: `hist_user_${entry.created_at}`,
              role: 'user',
              text: entry.query,
              timestamp: new Date(entry.created_at),
            });
            initialMessages.push({
              id: `hist_coach_${entry.created_at}`,
              role: 'coach',
              text: entry.response,
              timestamp: new Date(entry.created_at),
            });
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[Coach] Failed to load conversation history:', e);
      }

      // Greeting appears AFTER history — it's the latest message the user sees
      initialMessages.push({
        id: 'greeting',
        role: 'coach',
        text: greeting,
        timestamp: new Date(),
      });

      setMessages(initialMessages);
    } catch (error) {
      if (__DEV__) console.error('[Coach] Failed to load context:', error);
      setMessages([{
        id: 'greeting',
        role: 'coach',
        text: "Hey! I'm your FitQuest coach. Ask me anything about training, nutrition, or recovery! 💪",
        timestamp: new Date(),
      }]);
      setCoachCtx({
        streak: 0, longestStreak: 0, totalWorkouts: 0, level: 1, totalXP: 0,
        fatigueHighMuscles: [], lastWorkoutDate: null, daysSinceLastWorkout: 999, goal: 'body_control',
        exerciseCount: 200, userName: 'Athlete', experience: 'intermediate',
        trainingDaysPerWeek: 3, sessionMinutes: 30, injuries: 'none', equipment: 'bodyweight',
      });
    }
  };

  // Build DualAI context snapshot from refs (never triggers re-creation of callbacks)
  const buildAIContext = useCallback((personality: 'COACH' | 'PROFESSOR' = 'COACH') => {
    const ctx = coachCtxRef.current;
    const msgs = messagesRef.current;
    const recentHistory = msgs
      .slice(-10)
      .map(m => ({
        role: (m.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.text,
      }));

    return {
      personality,
      conversationHistory: recentHistory,
      userProfile: ctx ? {
        name: ctx.userName,
        fitnessLevel: ctx.experience,
        goals: [ctx.goal],
        streakDays: ctx.streak,
        longestStreak: ctx.longestStreak,
        level: ctx.level,
        totalXP: ctx.totalXP,
        weight: ctx.weight,
        height: ctx.height,
        trainingDaysPerWeek: ctx.trainingDaysPerWeek,
        sessionMinutes: ctx.sessionMinutes,
        injuries: ctx.injuries,
        equipment: ctx.equipment,
        bodyCraftPlan: ctx.bodyCraftPlan,
      } : undefined,
      workoutContext: ctx ? {
        fatigueLevel: ctx.fatigueHighMuscles.length > 0 ? 75 : 30,
        lastWorkoutDate: ctx.lastWorkoutDate ?? undefined,
      } : undefined,
      memory: cachedMemoryRef.current || undefined,
      totalWorkouts: ctx?.totalWorkouts || 0,
      exerciseCount: ctx?.exerciseCount || 200,
      language: languageRef.current.language,
      languageName: languageRef.current.languageName,
      location: ctx?.location,
    };
  }, []); // stable — reads from refs, no deps

  // ── Streaming typewriter — writes to decoupled `streamingText` state ──
  // The FlatList never re-renders during streaming; only StreamingBubble updates.
  const streamResponseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamResponse = useCallback((fullText: string, onDone: () => void, modelLabel?: string, responseTimeMs?: number) => {
    // Cancel any in-flight stream
    if (streamResponseRef.current) clearTimeout(streamResponseRef.current);
    stopRequestedRef.current = false;

    const FIRST_CHUNK = 60;      // chars shown instantly
    const CHUNK_SIZE = 35;       // chars per tick
    const TICK_MS = 14;          // ~70fps feel

    let cursor = Math.min(FIRST_CHUNK, fullText.length);
    setStreamingText(fullText.slice(0, cursor));
    setIsTyping(false);
    setTypingModelName(undefined);
    scrollToBottom();

    const commitMessage = (text: string) => {
      setStreamingText(null);
      setMessages(prev => [...prev, {
        id: `coach_${Date.now()}`,
        role: 'coach' as const,
        text,
        timestamp: new Date(),
        modelLabel,
        responseTimeMs,
      }]);
      haptic('setComplete');
      scrollToBottom();
      onDone();
    };

    if (cursor >= fullText.length) {
      commitMessage(fullText);
      return;
    }

    const tick = () => {
      // Check if stop was requested
      if (stopRequestedRef.current) {
        streamResponseRef.current = null;
        commitMessage(fullText.slice(0, cursor) + '...');
        return;
      }

      cursor = Math.min(cursor + CHUNK_SIZE, fullText.length);
      setStreamingText(fullText.slice(0, cursor));
      if (cursor < fullText.length) {
        streamResponseRef.current = setTimeout(tick, TICK_MS);
      } else {
        streamResponseRef.current = null;
        commitMessage(fullText);
      }
    };
    streamResponseRef.current = setTimeout(tick, TICK_MS);
  }, [scrollToBottom]);

  // Cleanup streaming on unmount
  useEffect(() => () => { if (streamResponseRef.current) clearTimeout(streamResponseRef.current); }, []);

  // ── Unified message dispatch — INSTANT user message, async AI response ──
  const dispatchMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !coachCtxRef.current) return;

    // Track for regenerate
    lastUserInputRef.current = trimmed;
    haptic('buttonPress');

    // 1. Immediately show user message + clear input (ZERO delay)
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user' as const,
      text: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setActiveSuggestions([]);
    scrollToBottom();

    // 2. Generate AI response asynchronously (intent classification happens here, NOT blocking render)
    (async () => {
      const ctx = coachCtxRef.current!;
      let response: string;
      let aiSuggestions: string[] | undefined;

      // Intent classification happens AFTER the user message is rendered
      const classified = intentRouter.classify(trimmed);

      // Fast path: navigation intents
      if (classified.category === 'NAVIGATION' && classified.entities.screens.length > 0) {
        const screen = classified.entities.screens[0];
        response = `Sure! Let me take you to the ${screen} screen. Use the navigation tabs or menu to get there.`;
        setIsTyping(false);
        setTypingModelName(undefined);
        setMessages(prev => [...prev, { id: `coach_${Date.now()}`, role: 'coach' as const, text: response, timestamp: new Date() }]);
        encryptedDB.storeAIConversation('COACH', trimmed, response).catch(() => {});
        scrollToBottom();
        return;
      }

      // Show which model is being queried
      const currentModel = aiProvider.activeModel;
      setTypingModelName(aiProvider.autoRoute ? undefined : currentModel?.displayName);

      // Resolve personality
      const personality = classified.category === 'PROFESSOR' && classified.confidence > 0.5
        ? 'PROFESSOR' as const : 'COACH' as const;

      // Check if this is a workout creation request
      const isWorkoutRequest = isWorkoutCreationIntent(trimmed);

      let modelLabel: string | undefined;
      let responseTimeMs: number | undefined;
      try {
        if (isWorkoutRequest) {
          // Build workout-aware context for the AI
          const workoutParams = extractWorkoutParams(trimmed);
          const workoutContext = await buildAIWorkoutContext(workoutParams);
          const aiCtx = buildAIContext(personality);
          // Inject workout context as an extra system-level instruction
          aiCtx.conversationHistory = [
            ...(aiCtx.conversationHistory || []),
            { role: 'user' as const, content: workoutContext },
          ];

          const aiResp = await aiProvider.generateResponse(trimmed, aiCtx);
          responseTimeMs = aiResp.processingTimeMs;
          response = aiResp.message;
          aiSuggestions = aiResp.suggestions;
          modelLabel = aiResp.model && aiResp.tier ? `${aiResp.tier} · ${aiResp.model}` : aiResp.model;

          // Try to parse the AI response as a structured workout
          let workoutResult = await parseAIWorkoutResponse(aiResp.message);
          // Fallback: if AI didn't return valid JSON, create workout directly from DB
          if (!workoutResult) {
            workoutResult = await createDirectWorkout(workoutParams);
          }
          setLastWorkoutResult(workoutResult);
          const exerciseLines = workoutResult.exercises
            .map((e, i) => `${i + 1}. **${e.name}** — ${e.sets}×${e.reps}`)
            .join('\n');
          response = `💪 **${workoutResult.name}** created!\n\n${exerciseLines}\n\n⏱ ~${workoutResult.durationEstimate} min · ${workoutResult.exerciseCount} exercises`;
        } else {
          const aiResp = await aiProvider.generateResponse(trimmed, buildAIContext(personality));
          responseTimeMs = aiResp.processingTimeMs;
          response = aiResp.message;
          aiSuggestions = aiResp.suggestions;
          modelLabel = aiResp.model && aiResp.tier ? `${aiResp.tier} · ${aiResp.model}` : aiResp.model;
        }
      } catch (e) {
        if (__DEV__) console.warn('[Coach] AI provider failed:', e);
        if (isWorkoutRequest) {
          // Even if AI failed, create workout directly from DB
          try {
            const workoutParams = extractWorkoutParams(trimmed);
            const workoutResult = await createDirectWorkout(workoutParams);
            setLastWorkoutResult(workoutResult);
            const exerciseLines = workoutResult.exercises
              .map((ex, i) => `${i + 1}. **${ex.name}** — ${ex.sets}×${ex.reps}`)
              .join('\n');
            response = `💪 **${workoutResult.name}** created!\n\n${exerciseLines}\n\n⏱ ~${workoutResult.durationEstimate} min · ${workoutResult.exerciseCount} exercises`;
          } catch {
            response = "I couldn't create a workout right now. Try saying something like **Create an upper body workout** and I'll pull from the exercise library! 💪";
          }
        } else {
          response = "Hmm, let me try a different approach. Ask me again and I'll use my offline knowledge! 💪";
        }
      }

      // Stream the response — FlatList stays frozen, only StreamingBubble updates
      streamResponse(response, () => {
        setActiveSuggestions(aiSuggestions?.length ? aiSuggestions : dualAI.getSmartSuggestions(buildAIContext(), trimmed));
      }, modelLabel, responseTimeMs);
    })();
  }, [buildAIContext, streamResponse, scrollToBottom]); // stable deps — no messages/coachCtx

  const sendMessage = useCallback(() => {
    dispatchMessage(input);
  }, [input, dispatchMessage]);

  const handleSuggestion = useCallback((text: string) => {
    dispatchMessage(text);
  }, [dispatchMessage]);

  // ── Stop generation ──
  const handleStopGeneration = useCallback(() => {
    stopRequestedRef.current = true;
    haptic('buttonPress');
  }, []);

  // ── Long-press message actions ──
  const handleLongPress = useCallback((msg: ChatMessage) => {
    setActionMessage(msg);
    setShowActions(true);
  }, []);

  const handleCopyMessage = useCallback(async () => {
    if (!actionMessage) return;
    await Clipboard.setStringAsync(actionMessage.text);
    haptic('setComplete');
  }, [actionMessage]);

  const handleShareMessage = useCallback(async () => {
    if (!actionMessage) return;
    try {
      await Share.share({ message: actionMessage.text });
    } catch { /* user cancelled */ }
  }, [actionMessage]);

  // ── Regenerate last response ──
  const handleRegenerate = useCallback(() => {
    const lastInput = lastUserInputRef.current;
    if (!lastInput || !coachCtxRef.current) return;

    // Remove the last coach message
    setMessages(prev => {
      const lastCoachIdx = prev.findLastIndex(m => m.role === 'coach');
      if (lastCoachIdx > 0) return [...prev.slice(0, lastCoachIdx)];
      return prev;
    });

    // Re-dispatch with the same input
    setIsTyping(true);
    setActiveSuggestions([]);
    haptic('buttonPress');

    (async () => {
      let response: string;
      let aiSuggestions: string[] | undefined;
      let modelLabel: string | undefined;
      let responseTimeMs: number | undefined;

      try {
        const aiResp = await aiProvider.generateResponse(lastInput, buildAIContext('COACH'));
        responseTimeMs = aiResp.processingTimeMs;
        response = aiResp.message;
        aiSuggestions = aiResp.suggestions;
        modelLabel = aiResp.model && aiResp.tier ? `${aiResp.tier} · ${aiResp.model}` : aiResp.model;
      } catch {
        response = "Let me try that again... 💪";
      }

      streamResponse(response, () => {
        setActiveSuggestions(aiSuggestions?.length ? aiSuggestions : dualAI.getSmartSuggestions(buildAIContext(), lastInput));
      }, modelLabel, responseTimeMs);
    })();
  }, [buildAIContext, streamResponse]);

  // ── Message reactions ──
  const handleReaction = useCallback((msgId: string, reaction: 'up' | 'down') => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      // Toggle: tap same reaction removes it
      return { ...m, reaction: m.reaction === reaction ? null : reaction };
    }));
  }, []);

  // ── Edit sent message ──
  const inputRef = useRef<TextInput>(null);
  const editingMsgIdRef = useRef<string | null>(null);

  const handleEditMessage = useCallback((msg: ChatMessage) => {
    if (msg.role !== 'user') return;
    // Remove the user message and all subsequent messages (including coach response)
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msg.id);
      if (idx < 0) return prev;
      return prev.slice(0, idx);
    });
    editingMsgIdRef.current = msg.id;
    setInput(msg.text);
    setActiveSuggestions([]);
    haptic('buttonPress');
    // Focus the input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── New chat ──
  const handleNewChat = useCallback(() => {
    if (streamResponseRef.current) clearTimeout(streamResponseRef.current);
    setStreamingText(null);
    setIsTyping(false);
    setActiveSuggestions([]);
    setLastWorkoutResult(null);
    // Clear cached conversation memory so DualAI doesn't carry over
    cachedMemoryRef.current = null;
    // Reset messages to fresh greeting
    setMessages([{
      id: 'greeting',
      role: 'coach',
      text: `${getTimeGreeting()}! Fresh conversation started. What would you like to work on? 💪`,
      timestamp: new Date(),
    }]);
    haptic('exerciseComplete');
  }, []);

  // ── Model selection ──
  const handleSelectModel = useCallback((modelId: string) => {
    aiProvider.setModel(modelId);
    haptic('buttonPress');
  }, []);

  const handleAutoRoute = useCallback(() => {
    aiProvider.enableAutoRoute();
    haptic('buttonPress');
  }, []);

  // ── Scroll-to-bottom tracking ──
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distanceFromBottom > 150);
  }, []);

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const quickSuggestions = [
    { text: "Design a workout for me", icon: 'dumbbell' as const },
    { text: "I'm tired today", icon: 'emoticon-sad-outline' as const },
    { text: "How's my progress?", icon: 'chart-line' as const },
    { text: "Help me eat better", icon: 'food-apple-outline' as const },
    { text: "Recovery tips", icon: 'medical-bag' as const },
    { text: "Quick meal prep ideas", icon: 'food-variant' as const },
    { text: "Warm-up routine", icon: 'fire' as const },
    { text: "How often should I train?", icon: 'calendar-clock' as const },
  ];

  const suggestionColors = [theme.colors.indigo, theme.colors.skyBlue, theme.colors.error, theme.colors.accent, theme.colors.error, theme.colors.warning, theme.colors.purple, theme.colors.pink, theme.colors.orange, theme.colors.blue, theme.colors.accent, theme.colors.purple, theme.colors.skyBlue, theme.colors.pink];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── HEADER ── */}
        <Animated.View entering={FadeInDown.duration(150)}>
          <LinearGradient
            colors={theme.isDark
              ? [`${theme.colors.indigo}33`, `${theme.colors.indigo}0D`, 'transparent'] as [string, string, string]
              : [`${theme.colors.indigo}1A`, `${theme.colors.indigo}05`, 'transparent'] as [string, string, string]}
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              {router.canGoBack() && (
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.headerBackBtn, {
                  backgroundColor: theme.colors.surfaceVariant,
                }]}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('coach.title')}</Text>
                    <View style={{ backgroundColor: theme.colors.warning + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: theme.colors.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{t('common.beta')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowModelPicker(true)} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel="Change AI model">
                    <View style={styles.headerStatusRow}>
                      <PulseDot color={aiProvider.cloudAvailable ? theme.colors.accent : theme.colors.warning} size={6} />
                      <Text style={[styles.headerStatus, { color: aiProvider.cloudAvailable ? theme.colors.accent : theme.colors.warning }]}>
                        {aiProvider.cloudAvailable
                          ? `☁️ ${aiProvider.autoRoute ? 'Auto' : aiProvider.activeModel.displayName} · ${aiProvider.getAvailableModels().length} models`
                          : '📱 Offline mode'}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={14} color={aiProvider.cloudAvailable ? theme.colors.accent : theme.colors.warning} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ width: 36 }} />
            </View>

            {/* New chat button row */}
            <View style={styles.headerActionsRow}>
              <TouchableOpacity
                onPress={() => setShowModelPicker(true)}
                style={[styles.headerActionBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="AI model settings"
              >
                <MaterialCommunityIcons name="tune-variant" size={16} color={theme.colors.text} />
                <Text style={{ color: theme.colors.text, fontSize: 11, fontWeight: '600' }}>
                  {aiProvider.autoRoute ? 'Auto' : aiProvider.activeModel?.displayName}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNewChat}
                style={[styles.headerActionBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Start new chat"
              >
                <MaterialCommunityIcons name="chat-plus-outline" size={16} color={theme.colors.accent} />
                <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '600' }}>New chat</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
        >
          {/* ── MESSAGES ── */}
          <FlatList
            ref={scrollRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} onLongPress={handleLongPress} onReact={handleReaction} onEdit={handleEditMessage} />
            )}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            ListHeaderComponent={
              <Animated.View entering={FadeIn.delay(200)} style={styles.dateBadgeWrap}>
                <View style={[styles.dateBadge, {
                  backgroundColor: theme.colors.surfaceVariant,
                }]}>
                  <Text style={[styles.dateBadgeText, { color: theme.colors.textMuted }]}>
                    {t('common.today')}
                  </Text>
                </View>
              </Animated.View>
            }
            ListFooterComponent={
              <>
                {/* Streaming bubble — decoupled from FlatList, only this updates during typewriting */}
                {streamingText !== null && <StreamingBubble text={streamingText} />}

                {isTyping && <TypingIndicator modelName={typingModelName} />}

                {/* Quick Suggestions (show only after greeting) */}
                {messages.length <= 1 && !isTyping && (
                  <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.suggestionsWrap}>
                    <Text style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                      {t('coach.tapToStart')}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                      {quickSuggestions.map((suggestion, idx) => (
                        <Animated.View
                          key={suggestion.text}
                          entering={FadeInDown.delay(180 + idx * 30).duration(150)}
                        >
                          <TouchableOpacity
                            style={[styles.suggestionChip, {
                              backgroundColor: theme.colors.surfaceVariant,
                              borderColor: theme.colors.border,
                            }]}
                            activeOpacity={0.7}
                            onPress={() => handleSuggestion(suggestion.text)}
                          >
                            <View style={[styles.suggestionIcon, { backgroundColor: suggestionColors[idx % suggestionColors.length] + '20' }]}>
                              <MaterialCommunityIcons
                                name={suggestion.icon}
                                size={14}
                                color={suggestionColors[idx % suggestionColors.length]}
                              />
                            </View>
                            <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
                              {suggestion.text}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      ))}
                    </ScrollView>
                  </Animated.View>
                )}

                {/* Workout result card — tap to navigate to the workout */}
                {lastWorkoutResult && !isTyping && (
                  <Animated.View entering={FadeInUp.delay(100).duration(200)} style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 16 }}>
                    <View style={{
                      borderRadius: 16,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: theme.colors.accent + '40',
                    }}>
                      <LinearGradient
                        colors={[theme.colors.accent + '20', theme.colors.indigo + '15'] as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ padding: 18 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <MaterialCommunityIcons name="dumbbell" size={18} color={theme.colors.accent} />
                          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                            {lastWorkoutResult.name}
                          </Text>
                        </View>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 14 }}>
                          {lastWorkoutResult.exerciseCount} exercises · ~{lastWorkoutResult.durationEstimate} min
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            router.push({ pathname: '/workout', params: { sessionId: lastWorkoutResult.sessionId } });
                            setLastWorkoutResult(null);
                          }}
                        >
                          <LinearGradient
                            colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingVertical: 12,
                              paddingHorizontal: 20,
                              borderRadius: 12,
                              alignItems: 'center',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              gap: 8,
                            }}
                          >
                            <MaterialCommunityIcons name="arrow-right-circle" size={18} color={theme.colors.onAccent} />
                            <Text style={{ color: theme.colors.onAccent, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 }}>
                              Take me there
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  </Animated.View>
                )}

                {/* Follow-up suggestions after a response */}
                {activeSuggestions.length > 0 && messages.length > 1 && !isTyping && (
                  <Animated.View entering={FadeInUp.delay(100).duration(150)} style={styles.followUpWrap}>
                    <Text style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                      {t('coach.relatedTopics')}
                    </Text>
                    <View style={styles.followUpRow}>
                      {activeSuggestions.map((s, idx) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.followUpChip, {
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: theme.colors.border,
                          }]}
                          activeOpacity={0.7}
                          onPress={() => handleSuggestion(s)}
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
          {showScrollBtn && !isTyping && streamingText === null && (
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={styles.scrollFabWrap}>
              <TouchableOpacity
                style={[styles.scrollFab, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={scrollToBottom}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chevron-double-down" size={20} color={theme.colors.accent} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── INPUT BAR ── */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(150)}
            style={[styles.inputBarWrap, {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
              paddingBottom: Math.max(12, insets.bottom + 72),
            }]}
          >
            <View style={[styles.inputRow, {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.border,
            }]}>
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: theme.colors.text, maxHeight: 100 }]}
                placeholder={t('coach.placeholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline
                blurOnSubmit
              />
              <Animated.View style={sendAnimatedStyle}>
                {(streamingText !== null || isTyping) ? (
                  <TouchableOpacity
                    onPress={handleStopGeneration}
                    onPressIn={() => { inputScale.value = withTiming(0.92, { duration: 120 }); }}
                    onPressOut={() => { inputScale.value = withTiming(1, { duration: 120 }); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sendButton, { backgroundColor: theme.colors.text, justifyContent: 'center', alignItems: 'center' }]}>
                      <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.background }} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={sendMessage}
                    disabled={!input.trim()}
                    onPressIn={() => { inputScale.value = withTiming(0.92, { duration: 120 }); }}
                    onPressOut={() => { inputScale.value = withTiming(1, { duration: 120 }); }}
                    activeOpacity={1}
                  >
                    <LinearGradient
                      colors={input.trim()
                        ? [theme.colors.accent, theme.colors.indigo] as [string, string]
                        : [theme.colors.surfaceVariant, theme.colors.surface] as [string, string]
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
        message={actionMessage}
        visible={showActions}
        onClose={() => setShowActions(false)}
        onCopy={handleCopyMessage}
        onRegenerate={() => { setShowActions(false); handleRegenerate(); }}
        onShare={handleShareMessage}
      />

      {/* ── MODEL PICKER ── */}
      <ModelPickerSheet
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        onSelectModel={handleSelectModel}
        onEnableAutoRoute={handleAutoRoute}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
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
    gap: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  headerStatus: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  dateBadgeWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '88%',
    marginBottom: 14,
  },
  coachBubble: {
    alignSelf: 'flex-start',
    padding: 16,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  coachAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  coachAvatarIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  userBubbleGradient: {
    padding: 14,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '400',
  },
  timestamp: {
    fontSize: 10,
  },

  // Bubble footer (timestamp + reactions)
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reactionBtn: {
    padding: 4,
    borderRadius: 8,
  },

  // Header actions
  headerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },

  // Suggestions
  suggestionsWrap: {
    marginTop: 12,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  suggestionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Follow-up suggestions
  followUpWrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  followUpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  followUpChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  followUpText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Input
  inputBarWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 24,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 38,
    height: 38,
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  actionSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionSheetLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Scroll-to-bottom FAB
  scrollFabWrap: {
    position: 'absolute',
    right: 16,
    bottom: 80,
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

  // Model picker
  modelPickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '60%',
  },
  modelTierLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    marginBottom: 2,
  },
  modelName: {
    fontSize: 14,
    fontWeight: '600',
  },
  modelDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  modelLabelBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});

export default function CoachScreen() {
  const router = useRouter();
  const handleBack = () => router.canGoBack() ? router.back() : router.replace('/dashboard');
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
