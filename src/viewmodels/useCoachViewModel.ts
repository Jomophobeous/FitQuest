/**
 * useCoachViewModel — AI Coach screen ViewModel
 *
 * Owns: context loading, AI dispatch, streaming, message state,
 * conversation history, workout creation, all handlers.
 *
 * The screen component owns only: UI components, styles, JSX layout.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CoachStatusData } from '../components/coach/CoachStatusCard';
import { FlatList, Keyboard, Platform, Share, BackHandler } from 'react-native';
import type { TextInput, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { createViewModel } from './createViewModel';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getUserProgress,
  getStreak,
  getMuscleFatigue,
  getUserProfile,
  getExercises,
  getAppState,
  getUserInjuries,
  getUserEquipment,
} from '../database/service';
import { getActiveBodyCraftAlgorithm } from '../database/bodyCraftService';
import { getXPData } from '../services/xpService';
import { getCachedReadiness, formatStatusForAI } from '../engines/ReadinessEngine';
import { intentRouter } from '../engines/IntentRouter';
import { dualAI, type ConversationMemory } from '../engines/DualAIEngine';
import { encryptedDB } from '../security/EncryptedDatabase';
import { aiProvider, TIER_LABELS, type ModelTier } from '../services/aiProvider';
import {
  isWorkoutCreationIntent,
  extractWorkoutParams,
  buildAIWorkoutContext,
  parseAIWorkoutResponse,
  createDirectWorkout,
  type AIWorkoutResult,
} from '../services/aiWorkoutService';
import { haptic } from '../utils/haptics';

// ============================================
// TYPES (exported for screen)
// ============================================

export interface ChatMessage {
  id: string;
  role: 'coach' | 'user';
  text: string;
  timestamp: Date;
  modelLabel?: string;
  reaction?: 'up' | 'down' | null;
  responseTimeMs?: number;
}

export interface CoachContext {
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

export { TIER_LABELS, type ModelTier };

// ============================================
// HELPERS
// ============================================

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ============================================
// VIEW MODEL
// ============================================

export const useCoachViewModel = createViewModel(() => {
  const { isReady: dbReady } = useDatabase();
  const { language, languageName } = useLanguage();
  const router = useRouter();

  // ── Refs ──
  const scrollRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const coachCtxRef = useRef<CoachContext | null>(null);
  const cachedMemoryRef = useRef<ConversationMemory | null>(null);
  const languageRef = useRef({ language, languageName });
  const stopRequestedRef = useRef(false);
  const lastUserInputRef = useRef<string>('');
  const editingMsgIdRef = useRef<string | null>(null);
  const coachStatusDataRef = useRef<CoachStatusData | null>(null);
  const streamResponseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [coachCtx, setCoachCtx] = useState<CoachContext | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [typingModelName, setTypingModelName] = useState<string | undefined>();
  const [lastWorkoutResult, setLastWorkoutResult] = useState<AIWorkoutResult | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // ── Keep refs in sync ──
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    coachCtxRef.current = coachCtx;
  }, [coachCtx]);
  useEffect(() => {
    languageRef.current = { language, languageName };
  }, [language, languageName]);

  // ── Keyboard tracking ──
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── Scroll helper ──
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Auto-scroll when keyboard opens
  useEffect(() => {
    if (keyboardVisible) setTimeout(scrollToBottom, 100);
  }, [keyboardVisible, scrollToBottom]);

  // ── Android back button ──
  useEffect(() => {
    const backAction = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/dashboard');
      }
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [router]);

  // ── Load context on DB ready ──
  useEffect(() => {
    if (dbReady) loadCoachContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady]);

  // ── Cleanup streaming on unmount ──
  useEffect(
    () => () => {
      if (streamResponseRef.current) clearTimeout(streamResponseRef.current);
    },
    [],
  );

  // ── Load coach context + greeting + history ──
  const loadCoachContext = async () => {
    try {
      const [
        progress,
        streak,
        fatigue,
        xp,
        profile,
        exercises,
        readinessSnap,
        displayName,
        injuries,
        equipment,
        bodyCraftAlgo,
      ] = await Promise.all([
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

      const fatigueHigh = fatigue.filter((f) => f.fatigue_level > 60).map((f) => f.muscle.replace(/_/g, ' '));
      const daysSince = progress.last_workout_date
        ? Math.floor((Date.now() - new Date(progress.last_workout_date).getTime()) / 86400000)
        : 999;
      const readinessStatus = readinessSnap ? formatStatusForAI(readinessSnap) : undefined;
      const userName = displayName || 'Athlete';
      const injuryStr =
        injuries.length > 0 ? injuries.map((i) => `${i.muscle.replace(/_/g, ' ')} (${i.severity})`).join(', ') : 'none';
      const equipmentStr = equipment.length > 0 ? equipment.join(', ') : 'bodyweight';

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

      // Location service removed — skip location context\n\n      setCoachCtx(ctx);

      // Pre-cache conversation memory
      try {
        const memory = await dualAI.loadConversationMemory('COACH', 5);
        cachedMemoryRef.current = memory;
      } catch {
        /* continue */
      }

      // Generate greeting
      let greeting: string;
      try {
        const lastWorkoutRaw = await getAppState('last_completed_workout');
        const lastWorkout = lastWorkoutRaw ? JSON.parse(lastWorkoutRaw) : null;
        const isRecentWorkout = lastWorkout && Date.now() - lastWorkout.completedAt < 30 * 60 * 1000;

        const greetingCtx = {
          personality: 'COACH' as const,
          conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
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
          language,
          languageName,
          memory: cachedMemoryRef.current ?? undefined,
        };

        if (isRecentWorkout) {
          if (language !== 'en') {
            try {
              const durationMin = Math.round(lastWorkout.durationSeconds / 60);
              const resp = await aiProvider.generateResponse(
                `I just finished a workout: ${lastWorkout.completedCount}/${lastWorkout.totalCount} exercises in ${durationMin} minutes, earned ${lastWorkout.xpEarned} XP, ${lastWorkout.streakDays}-day streak. Give a brief celebratory coach message (2-3 sentences, use emojis).`,
                greetingCtx,
              );
              greeting = resp.message;
            } catch {
              greeting = dualAI.getPostWorkoutGreeting(lastWorkout);
            }
          } else {
            greeting = dualAI.getPostWorkoutGreeting(lastWorkout);
          }
        } else {
          let baseGreeting: string;
          if (language !== 'en') {
            try {
              const resp = await aiProvider.generateResponse(
                'Give me a brief, motivational fitness coach greeting (2-3 sentences max). Mention my streak if I have one. Use emojis.',
                greetingCtx,
              );
              baseGreeting = resp.message;
            } catch {
              baseGreeting = await dualAI.getGreeting(greetingCtx);
            }
          } else {
            baseGreeting = await dualAI.getGreeting(greetingCtx);
          }

          if (ctx.readinessStatus) {
            const parsed = parseReadinessStatus(ctx.readinessStatus);
            if (parsed) coachStatusDataRef.current = parsed;
          }
          greeting = baseGreeting;
        }
      } catch (e) {
        if (__DEV__) console.warn('[Coach] Greeting generation failed, using fallback:', e);
        const greetings = [
          'What can I help you with today?',
          "Ready to crush it? What's on your mind?",
          'Ask me anything about your training.',
        ];
        greeting = `${getTimeGreeting()}! 💪 ${greetings[Math.floor(Math.random() * greetings.length)]}`;
      }

      // Load past conversation history
      const initialMessages: ChatMessage[] = [];
      try {
        await encryptedDB.cleanupOldConversations('COACH');
        const history = await encryptedDB.getAIConversations('COACH', 5);
        if (history.length > 0) {
          for (const entry of history.reverse()) {
            let responseText = entry.response;
            if (responseText.trimStart().startsWith('{') && responseText.includes('"exercises"')) {
              try {
                const raw = JSON.parse(responseText.match(/\{[\s\S]*"exercises"[\s\S]*\}/)?.[0] || responseText);
                if (raw?.exercises?.length) {
                  const lines = raw.exercises
                    .map((e: any, i: number) => `${i + 1}. **${e.name}** — ${e.sets}×${e.reps}`)
                    .join('\n');
                  responseText = `💪 **${raw.name || 'Your Workout'}**\n\n${lines}`;
                }
              } catch {
                /* not valid JSON */
              }
            }
            initialMessages.push({
              id: `hist_user_${entry.created_at}`,
              role: 'user',
              text: entry.query,
              timestamp: new Date(entry.created_at),
            });
            initialMessages.push({
              id: `hist_coach_${entry.created_at}`,
              role: 'coach',
              text: responseText,
              timestamp: new Date(entry.created_at),
            });
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[Coach] Failed to load conversation history:', e);
      }

      initialMessages.push({
        id: 'greeting',
        role: 'coach',
        text: greeting,
        timestamp: new Date(),
      });

      setMessages(initialMessages);
    } catch (error) {
      if (__DEV__) console.error('[Coach] Failed to load context:', error);
      setMessages([
        {
          id: 'greeting',
          role: 'coach',
          text: "Hey! I'm your FitQuest coach. Ask me anything about training, nutrition, or recovery! 💪",
          timestamp: new Date(),
        },
      ]);
      setCoachCtx({
        streak: 0,
        longestStreak: 0,
        totalWorkouts: 0,
        level: 1,
        totalXP: 0,
        fatigueHighMuscles: [],
        lastWorkoutDate: null,
        daysSinceLastWorkout: 999,
        goal: 'body_control',
        exerciseCount: 200,
        userName: 'Athlete',
        experience: 'intermediate',
        trainingDaysPerWeek: 3,
        sessionMinutes: 30,
        injuries: 'none',
        equipment: 'bodyweight',
      });
    }
  };

  // ── Build AI context from refs (stable, no deps) ──
  const buildAIContext = useCallback((personality: 'COACH' | 'PROFESSOR' = 'COACH') => {
    const ctx = coachCtxRef.current;
    const msgs = messagesRef.current;
    const recentHistory = msgs.slice(-10).map((m) => ({
      role: (m.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.text,
    }));

    return {
      personality,
      conversationHistory: recentHistory,
      userProfile: ctx
        ? {
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
          }
        : undefined,
      workoutContext: ctx
        ? {
            fatigueLevel: ctx.fatigueHighMuscles.length > 0 ? 75 : 30,
            fatigueHighMuscles: ctx.fatigueHighMuscles,
            lastWorkoutDate: ctx.lastWorkoutDate ?? undefined,
            daysSinceLastWorkout: ctx.daysSinceLastWorkout,
            readinessStatus: ctx.readinessStatus,
          }
        : undefined,
      memory: cachedMemoryRef.current || undefined,
      totalWorkouts: ctx?.totalWorkouts || 0,
      exerciseCount: ctx?.exerciseCount || 200,
      language: languageRef.current.language,
      languageName: languageRef.current.languageName,
      location: ctx?.location,
    };
  }, []);

  // ── Streaming typewriter ──
  const streamResponse = useCallback(
    (fullText: string, onDone: () => void, modelLabel?: string, responseTimeMs?: number) => {
      if (streamResponseRef.current) clearTimeout(streamResponseRef.current);
      stopRequestedRef.current = false;

      const FIRST_CHUNK = 60;
      const CHUNK_SIZE = 35;
      const TICK_MS = 14;

      let cursor = Math.min(FIRST_CHUNK, fullText.length);
      setStreamingText(fullText.slice(0, cursor));
      setIsTyping(false);
      setTypingModelName(undefined);
      scrollToBottom();

      const commitMessage = (text: string) => {
        setStreamingText(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `coach_${Date.now()}`,
            role: 'coach' as const,
            text,
            timestamp: new Date(),
            modelLabel,
            responseTimeMs,
          },
        ]);
        haptic('setComplete');
        scrollToBottom();
        onDone();
      };

      if (cursor >= fullText.length) {
        commitMessage(fullText);
        return;
      }

      const tick = () => {
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
    },
    [scrollToBottom],
  );

  // ── Unified message dispatch ──
  const dispatchMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !coachCtxRef.current) return;

      lastUserInputRef.current = trimmed;
      haptic('buttonPress');

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user' as const,
        text: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);
      setActiveSuggestions([]);
      scrollToBottom();

      (async () => {
        const _ctx = coachCtxRef.current!;
        let response: string;
        let aiSuggestions: string[] | undefined;

        const classified = intentRouter.classify(trimmed);

        // Fast path: navigation intents
        if (classified.category === 'NAVIGATION' && classified.entities.screens.length > 0) {
          const screen = classified.entities.screens[0];
          response = `Sure! Let me take you to the ${screen} screen. Use the navigation tabs or menu to get there.`;
          setIsTyping(false);
          setTypingModelName(undefined);
          setMessages((prev) => [
            ...prev,
            { id: `coach_${Date.now()}`, role: 'coach' as const, text: response, timestamp: new Date() },
          ]);
          encryptedDB.storeAIConversation('COACH', trimmed, response).catch(() => {});
          scrollToBottom();
          return;
        }

        const currentModel = aiProvider.activeModel;
        setTypingModelName(aiProvider.autoRoute ? undefined : currentModel?.displayName);

        const personality = 'COACH' as const;
        const isWorkoutRequest = isWorkoutCreationIntent(trimmed);

        let modelLabel: string | undefined;
        let responseTimeMs: number | undefined;
        try {
          if (isWorkoutRequest) {
            const workoutParams = extractWorkoutParams(trimmed);
            const workoutContext = await buildAIWorkoutContext(workoutParams);
            const aiCtx = buildAIContext(personality);
            aiCtx.conversationHistory = [
              ...(aiCtx.conversationHistory || []),
              { role: 'user' as const, content: workoutContext },
            ];

            const aiResp = await aiProvider.generateResponse(trimmed, aiCtx);
            responseTimeMs = aiResp.processingTimeMs;
            response = aiResp.message;
            aiSuggestions = aiResp.suggestions;
            modelLabel = aiResp.model && aiResp.tier ? `${aiResp.tier} · ${aiResp.model}` : aiResp.model;

            let workoutResult = await parseAIWorkoutResponse(aiResp.message);
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
            try {
              const workoutParams = extractWorkoutParams(trimmed);
              const workoutResult = await createDirectWorkout(workoutParams);
              setLastWorkoutResult(workoutResult);
              const exerciseLines = workoutResult.exercises
                .map((ex, i) => `${i + 1}. **${ex.name}** — ${ex.sets}×${ex.reps}`)
                .join('\n');
              response = `💪 **${workoutResult.name}** created!\n\n${exerciseLines}\n\n⏱ ~${workoutResult.durationEstimate} min · ${workoutResult.exerciseCount} exercises`;
            } catch {
              response =
                "I couldn't create a workout right now. Try saying something like **Create an upper body workout** and I'll pull from the exercise library! 💪";
            }
          } else {
            response = "Hmm, let me try a different approach. Ask me again and I'll use my offline knowledge! 💪";
          }
        }

        // Safety: format raw JSON workout responses
        if (response.trimStart().startsWith('{') && response.includes('"exercises"')) {
          try {
            const raw = JSON.parse(response.match(/\{[\s\S]*"exercises"[\s\S]*\}/)?.[0] || response);
            if (raw?.exercises?.length) {
              const lines = raw.exercises
                .map((e: any, i: number) => `${i + 1}. **${e.name}** — ${e.sets}×${e.reps}`)
                .join('\n');
              response = `💪 **${raw.name || 'Your Workout'}**\n\n${lines}`;
            }
          } catch {
            /* not valid JSON */
          }
        }

        encryptedDB.storeAIConversation('COACH', trimmed, response).catch(() => {});

        streamResponse(
          response,
          () => {
            setActiveSuggestions(
              aiSuggestions?.length ? aiSuggestions : dualAI.getSmartSuggestions(buildAIContext(), trimmed),
            );
          },
          modelLabel,
          responseTimeMs,
        );
      })();
    },
    [buildAIContext, streamResponse, scrollToBottom],
  );

  const sendMessage = useCallback(() => {
    dispatchMessage(input);
  }, [input, dispatchMessage]);

  const handleSuggestion = useCallback(
    (text: string) => {
      haptic('buttonPress');
      dispatchMessage(text);
    },
    [dispatchMessage],
  );

  const handleStopGeneration = useCallback(() => {
    stopRequestedRef.current = true;
    haptic('buttonPress');
  }, []);

  // ── Long-press actions ──
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
    } catch {
      /* cancelled */
    }
  }, [actionMessage]);

  const closeActions = useCallback(() => setShowActions(false), []);

  // ── Regenerate ──
  const handleRegenerate = useCallback(() => {
    const lastInput = lastUserInputRef.current;
    if (!lastInput || !coachCtxRef.current) return;

    setMessages((prev) => {
      const lastCoachIdx = prev.findLastIndex((m) => m.role === 'coach');
      if (lastCoachIdx > 0) return [...prev.slice(0, lastCoachIdx)];
      return prev;
    });

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
        response = 'Let me try that again... 💪';
      }

      if (response.trimStart().startsWith('{') && response.includes('"exercises"')) {
        try {
          const raw = JSON.parse(response.match(/\{[\s\S]*"exercises"[\s\S]*\}/)?.[0] || response);
          if (raw?.exercises?.length) {
            const lines = raw.exercises
              .map((e: any, i: number) => `${i + 1}. **${e.name}** — ${e.sets}×${e.reps}`)
              .join('\n');
            response = `💪 **${raw.name || 'Your Workout'}**\n\n${lines}`;
          }
        } catch {
          /* not valid JSON */
        }
      }

      streamResponse(
        response,
        () => {
          setActiveSuggestions(
            aiSuggestions?.length ? aiSuggestions : dualAI.getSmartSuggestions(buildAIContext(), lastInput),
          );
        },
        modelLabel,
        responseTimeMs,
      );
    })();
  }, [buildAIContext, streamResponse]);

  // ── Reactions ──
  const handleReaction = useCallback((msgId: string, reaction: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        return { ...m, reaction: m.reaction === reaction ? null : reaction };
      }),
    );
  }, []);

  // ── Edit message ──
  const handleEditMessage = useCallback((msg: ChatMessage) => {
    if (msg.role !== 'user') return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx < 0) return prev;
      return prev.slice(0, idx);
    });
    editingMsgIdRef.current = msg.id;
    setInput(msg.text);
    setActiveSuggestions([]);
    haptic('buttonPress');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── New chat ──
  const handleNewChat = useCallback(() => {
    if (streamResponseRef.current) clearTimeout(streamResponseRef.current);
    setStreamingText(null);
    setIsTyping(false);
    setActiveSuggestions([]);
    setLastWorkoutResult(null);
    cachedMemoryRef.current = null;
    setMessages([
      {
        id: 'greeting',
        role: 'coach',
        text: `${getTimeGreeting()}! Fresh conversation started. What would you like to work on? 💪`,
        timestamp: new Date(),
      },
    ]);
    haptic('exerciseComplete');
  }, []);

  // ── Scroll tracking ──
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distanceFromBottom > 150);
  }, []);

  // ── Navigate to workout ──
  const navigateToWorkout = useCallback(
    (sessionId: string) => {
      router.push({ pathname: '/workout', params: { sessionId } });
      setLastWorkoutResult(null);
    },
    [router],
  );

  // ── Cloud status (reactive — resolves after provider init) ──
  const [cloudAvailable, setCloudAvailable] = useState(aiProvider.cloudAvailable);
  useEffect(() => {
    let cancelled = false;
    aiProvider.checkCloudAvailable().then((available) => {
      if (!cancelled) setCloudAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    // Refs (for component to attach to UI elements)
    scrollRef,
    inputRef,
    // State
    messages,
    input,
    setInput,
    coachCtx,
    isTyping,
    streamingText,
    activeSuggestions,
    typingModelName,
    lastWorkoutResult,
    keyboardVisible,
    actionMessage,
    showActions,
    showScrollBtn,
    cloudAvailable,
    // Actions
    sendMessage,
    handleSuggestion,
    handleStopGeneration,
    handleLongPress,
    handleCopyMessage,
    handleShareMessage,
    handleRegenerate,
    handleReaction,
    handleEditMessage,
    handleNewChat,
    handleScroll,
    scrollToBottom,
    closeActions,
    navigateToWorkout,
    coachStatusData: coachStatusDataRef.current,
  };
});

function parseReadinessStatus(status: string): CoachStatusData | null {
  try {
    const readinessMatch = status.match(/Readiness:\s*(\d+)\/100/);
    const lastWorkoutMatch = status.match(/Last workout:\s*([^.]+)\./);
    const fatigueMatch = status.match(/Fatigue:\s*(\d+)%/);
    const musclesMatch = status.match(/\((\d+)\s*fresh,\s*(\d+)\s*fatigued\)/);
    const intensityMatch = status.match(/Recommended intensity:\s*(\w+)/);

    return {
      readiness: readinessMatch ? parseInt(readinessMatch[1]!, 10) : 50,
      lastWorkout: lastWorkoutMatch ? lastWorkoutMatch[1]!.trim() : null,
      fatiguePercent: fatigueMatch ? parseInt(fatigueMatch[1]!, 10) : 0,
      freshMuscles: musclesMatch ? parseInt(musclesMatch[1]!, 10) : 0,
      fatiguedMuscles: musclesMatch ? parseInt(musclesMatch[2]!, 10) : 0,
      recommendedIntensity: intensityMatch ? intensityMatch[1]! : 'moderate',
    };
  } catch {
    return null;
  }
}

export type CoachViewModel = ReturnType<typeof useCoachViewModel>;
