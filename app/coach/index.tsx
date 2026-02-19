/**
 * FitQuest AI Coach Screen
 * Premium glass-morphism chat interface with conversational coaching
 * Uses a rule-based coaching engine (no external API needed for offline-first)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Dimensions,
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
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { getUserProgress, getStreak, getMuscleFatigue, getUserProfile, getExercises } from '../../src/database/service';
import { getXPData } from '../../src/services/xpService';
import { PulseDot } from '../../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { intentRouter } from '../../src/engines/IntentRouter';
import { dualAI } from '../../src/fitmind/DualAIEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  id: string;
  role: 'coach' | 'user';
  text: string;
  timestamp: Date;
}

interface CoachContext {
  streak: number;
  totalWorkouts: number;
  level: number;
  totalXP: number;
  fatigueHighMuscles: string[];
  lastWorkoutDate: string | null;
  daysSinceLastWorkout: number;
  goal: string;
  exerciseCount: number;
}

// ============================================
// COACHING ENGINE (Offline rule-based)
// ============================================

const GREETING_PROMPTS = [
  "Hey champion! 💪 What can I help you with today?",
  "Welcome back! Ready to crush it? What's on your mind?",
  "Your coach is here! Ask me anything about your training.",
];

const TOPIC_RESPONSES: Record<string, (ctx: CoachContext) => string> = {
  // Motivation
  'motivation|tired|don\'t feel|lazy|skip': (ctx) => {
    if (ctx.streak > 0) {
      return `You've got a ${ctx.streak}-day streak going! 🔥 Even a light 10-minute session counts. Think about how far you've come — ${ctx.totalWorkouts} workouts completed. Your future self will thank you!`;
    }
    return "Every champion started from zero. A short 10-minute workout is infinitely better than skipping. Start small — just warm up and see how you feel. You might surprise yourself! 💪";
  },

  // Recovery
  'sore|recovery|rest|pain|hurt': (ctx) => {
    const fatigued = ctx.fatigueHighMuscles;
    if (fatigued.length > 0) {
      return `Your ${fatigued.slice(0, 3).join(', ')} muscles have high fatigue right now. Focus on other muscle groups or do a gentle mobility session. Foam rolling, light stretching, and good sleep will help recovery. Remember: muscles grow during rest! 🧘`;
    }
    return "Rest is part of the process! Active recovery like walking, stretching, or yoga can help. Make sure you're sleeping 7-9 hours and staying hydrated. If pain is sharp or persists, consider seeing a professional.";
  },

  // Form advice
  'form|technique|how to|proper|correct': (ctx) => {
    return "Great question! Here are key form principles:\n\n1️⃣ **Breathe**: Exhale on effort, inhale on return\n2️⃣ **Tempo**: 2-3 seconds down, 1-2 seconds up\n3️⃣ **Core**: Keep your core braced on every exercise\n4️⃣ **Range**: Full range of motion > heavy resistance\n5️⃣ **Pain**: Muscle burn is OK, joint pain is NOT\n\nAsk about any specific exercise and I'll give you tips!";
  },

  // Nutrition
  'eat|food|nutrition|diet|protein|calorie': (ctx) => {
    return "For bodyweight training:\n\n🥩 **Protein**: 1.6-2.2g per kg bodyweight daily\n🥗 **Meals**: Eat within 2 hours post-workout\n💧 **Water**: 2-3 litres daily, more on training days\n🍌 **Pre-workout**: Light carbs 30-60 min before\n😴 **Don't skimp on sleep** — it affects muscle recovery more than supplements\n\nConsistency in nutrition > perfection!";
  },

  // Progress
  'progress|results|improve|plateau|stuck': (ctx) => {
    if (ctx.totalWorkouts < 10) {
      return `You've done ${ctx.totalWorkouts} workouts — you're building the foundation! 🏗️ Real visible changes typically show after 4-6 weeks of consistent training. Focus on getting stronger each week rather than looking for overnight changes. Take progress photos monthly!`;
    }
    if (ctx.totalWorkouts >= 30) {
      return `With ${ctx.totalWorkouts} workouts under your belt, you're serious! To break through plateaus:\n\n1. Increase difficulty (harder variations)\n2. Add volume (more sets)\n3. Slow down tempo (3-4 second negatives)\n4. Take a deload week\n5. Check sleep & nutrition\n\nThe engine will auto-progress you when ready!`;
    }
    return `${ctx.totalWorkouts} workouts in! Great progress! Key tips:\n\n• Progressive overload is king\n• Track your reps — beat last week's numbers\n• Sleep 7-9 hours (that's when muscles grow)\n• Be patient — transformation takes 8-12 weeks`;
  },

  // Stretching & flexibility
  'stretch|flexible|mobility|stiff|tight': (ctx) => {
    return "For better flexibility:\n\n🧘 **Daily**: 5-10 min morning mobility routine\n⏱️ **Hold**: Each stretch for 30-60 seconds\n🌡️ **Warm first**: Stretch after exercise, not cold\n📈 **Progressive**: Go slightly further each week\n🎯 **Focus areas**: Hips, hamstrings, thoracic spine\n\nThe Flexibility category in your Library has great routines!";
  },

  // Sleep
  'sleep|insomnia|tired|rest|bedtime': (ctx) => {
    return "Sleep is your #1 recovery tool! 😴\n\n🌙 **7-9 hours** minimum for muscle recovery\n📱 **No screens** 30 min before bed\n🌡️ **Cool room** (18-20°C / 64-68°F)\n⏰ **Consistent schedule** — same time daily\n🧘 **Wind-down routine**: stretching, deep breathing\n\nPoor sleep = poor recovery = slower gains";
  },

  // Workout frequency
  'how often|frequency|days|schedule|routine': (ctx) => {
    return `Based on your profile (${ctx.goal}):\n\n📅 **Beginner**: 3 days/week (full body)\n📅 **Intermediate**: 4 days/week (upper/lower split)\n📅 **Advanced**: 5-6 days/week (push/pull/legs)\n\n⚠️ Always take at least 1 full rest day!\n\nThe Train tab auto-generates workouts optimized for your recovery state. Trust the system! 🤖`;
  },

  // Recommended exercises
  'recommend|suggest exercise|what exercise|which exercise|workout idea|exercise for': (ctx) => {
    const fatigued = ctx.fatigueHighMuscles;
    if (fatigued.length > 0) {
      const avoid = fatigued.slice(0, 3).join(', ');
      return `Based on your recovery state, avoid ${avoid} today.\n\nI recommend:\n\n✅ **Upper body** (if legs are fatigued): Push-ups, Dips, Pike Push-ups\n✅ **Lower body** (if upper is fatigued): Squats, Lunges, Calf Raises\n✅ **Core & Flexibility**: Planks, Dead Bugs, Yoga Flow\n\n💡 Tip: Use the "Create Workout" in the menu to build a custom session with these exercises. The Exercise Library has ${ctx.exerciseCount || 200}+ exercises to choose from!`;
    }
    if (ctx.goal === 'strength') {
      return `For muscle building, I recommend a push/pull/legs split:\n\n💪 **Push Day**: Push-ups → Diamond Push-ups → Pike Push-ups → Dips\n💪 **Pull Day**: Pull-ups → Chin-ups → Inverted Rows → Dead Hangs\n💪 **Legs**: Pistol Squats → Bulgarian Split Squats → Calf Raises → Glute Bridges\n\n🔥 Aim for 3-4 sets of 8-12 reps each. Progressive overload is key!`;
    }
    if (ctx.goal === 'mobility') {
      return `For flexibility, try this daily routine:\n\n🧘 **Morning Flow** (15 min):\n1. Cat-Cow Stretch (2 min)\n2. World's Greatest Stretch (2 min each side)\n3. Pike Stretch Hold (60s)\n4. Frog Stretch (90s)\n5. Pigeon Pose (60s each side)\n6. Shoulder Dislocates (2 min)\n\nHold each stretch 30-60 seconds. Breathe deeply!`;
    }
    return `Here are my top recommendations based on your level:\n\n🌟 **Essential Compound Moves**:\n1. Push-ups (chest, triceps, shoulders)\n2. Pull-ups or Inverted Rows (back, biceps)\n3. Squats (quads, glutes)\n4. Plank Hold (core stability)\n5. Lunges (legs, balance)\n\n📊 You've completed ${ctx.totalWorkouts} workouts. Check the Library for ${ctx.exerciseCount || 200}+ exercises across all categories!`;
  },

  // Meal prep & nutrition planning
  'meal prep|meal plan|cook|recipe|what to eat|breakfast|lunch|dinner|snack': (ctx) => {
    return `Here's a simple meal prep framework for training days:\n\n🍳 **Breakfast** (30 min post-wake):\n• Oats + banana + peanut butter + protein\n• OR Eggs (3-4) + toast + avocado\n\n🥗 **Lunch** (high protein):\n• Grilled chicken/fish + rice + vegetables\n• OR Lentil bowl + sweet potato + greens\n\n🍗 **Dinner** (recovery meal):\n• Lean protein + complex carbs + healthy fats\n• Examples: Salmon + quinoa, Chicken stir-fry + brown rice\n\n🥤 **Pre-workout snack** (30-60 min before):\n• Banana + handful of nuts\n• OR Rice cakes + honey\n\n🥛 **Post-workout** (within 30 min):\n• Protein shake + fruit\n• OR Greek yoghurt + granola\n\n📝 **Weekly prep tip**: Cook proteins & carbs in bulk on Sunday. Store in containers for the week!`;
  },

  // Calorie & macro guidance
  'macro|how much protein|how many calories|calorie count|tdee|bulk|cut': (ctx) => {
    return `Quick macro guidelines for fitness athletes:\n\n📊 **Maintenance**: ~2,200-2,800 cal/day (varies by size)\n📊 **Muscle gain**: Add 300-500 cal above maintenance\n📊 **Fat loss**: Subtract 300-500 cal below maintenance\n\n🥩 **Protein**: 1.6-2.2g per kg bodyweight\n🍚 **Carbs**: 3-5g per kg (training days), 2-3g (rest days)\n🥑 **Fats**: 0.8-1.2g per kg\n\n💧 **Water**: Body weight (kg) × 0.033 = litres/day\n\n⚠️ These are estimates — adjust based on results over 2-3 weeks. Track your weight weekly and adjust accordingly!`;
  },

  // Body transformation
  'body|transform|physique|look|appearance|aesthetic|craft my body': (ctx) => {
    return `For body transformation, I recommend using Craft My Body! 🎨\n\n` +
      `It will analyze your current stats and create a personalized algorithm for your workout generator.\n\n` +
      `Here's the quick version:\n` +
      `• **Muscle Building**: Focus on compound movements, progressive overload, 4-5x/week\n` +
      `• **Fat Loss**: Create a calorie deficit (-300 to -500), high protein, add cardio\n` +
      `• **Lean Look**: Balance of strength training + HIIT, moderate calories\n\n` +
      `Go to Profile → Craft My Body to get your personalized plan!`;
  },

  // Warm-up & cool-down
  'warm up|warmup|cool down|cooldown|before workout|after workout': (ctx) => {
    return `Essential warm-up & cool-down guide:\n\n` +
      `🔥 **Warm-Up** (5-10 min):\n` +
      `1. Light cardio (jumping jacks, high knees) — 2 min\n` +
      `2. Dynamic stretching — 3 min\n` +
      `3. Movement-specific prep — 2 min\n` +
      `Example: Arm circles → Hip circles → Bodyweight squats → Push-up walkouts\n\n` +
      `❄️ **Cool-Down** (5-10 min):\n` +
      `1. Easy walk or light movement — 2 min\n` +
      `2. Static stretching (30-60s holds) — 5 min\n` +
      `3. Deep breathing — 2 min\n\n` +
      `⚠️ Never skip warm-up! Cold muscles = higher injury risk.`;
  },

  // Injury prevention
  'injury|prevent|safe|joint|knee|shoulder|back pain|wrist': (ctx) => {
    return `Injury prevention is KEY for long-term progress! 🛡️\n\n` +
      `**General rules:**\n` +
      `1. Always warm up properly (5-10 min)\n` +
      `2. Learn proper form BEFORE adding difficulty\n` +
      `3. Progress gradually (10% rule per week)\n` +
      `4. Listen to your body — sharp pain = STOP\n\n` +
      `**Common trouble spots:**\n` +
      `🦵 **Knees**: Don't let knees cave inward during squats\n` +
      `💪 **Shoulders**: Warm up rotator cuff before pressing\n` +
      `🤚 **Wrists**: Wrist circles + stretches before push exercises\n` +
      `🔙 **Lower back**: Brace core on EVERY exercise\n\n` +
      `**When to rest vs push through:**\n` +
      `✅ Muscle soreness (DOMS) = OK to train\n` +
      `❌ Joint pain, sharp pain, numbness = REST`;
  },

  // Supplements
  'supplement|creatine|protein powder|bcaa|pre workout|vitamin': (ctx) => {
    return `Supplement guide for fitness athletes:\n\n` +
      `**Tier 1 (Recommended):**\n` +
      `💊 **Creatine Monohydrate** — 5g/day, proven muscle & strength benefit\n` +
      `🥤 **Protein Powder** — Only if you can't hit protein goals from food\n` +
      `☀️ **Vitamin D** — If you don't get enough sun\n` +
      `🐟 **Omega-3 (Fish Oil)** — For joint health & recovery\n\n` +
      `**Tier 2 (Optional):**\n` +
      `☕ **Caffeine** — 200mg 30min pre-workout for energy\n` +
      `🧂 **Electrolytes** — During long/sweaty sessions\n\n` +
      `**Skip these:**\n` +
      `❌ BCAAs (if you eat enough protein)\n` +
      `❌ Fat burners (waste of money)\n` +
      `❌ Testosterone boosters (don't work)\n\n` +
      `⚠️ Real food > supplements. Always.`;
  },

  // Mental health & mindset
  'mental|stress|anxiety|confidence|discipline|habit|mindset|focus': (ctx) => {
    return `Exercise is one of the BEST tools for mental health! 🧠\n\n` +
      `**How exercise helps your mind:**\n` +
      `• Releases endorphins (natural mood boost)\n` +
      `• Reduces cortisol (stress hormone)\n` +
      `• Improves sleep quality\n` +
      `• Builds discipline & confidence\n\n` +
      `**Building the habit:**\n` +
      `1. Start with just 10 min/day (lower the barrier)\n` +
      `2. Same time every day (routine = consistency)\n` +
      `3. Track your streak (momentum matters)\n` +
      `4. Celebrate small wins\n\n` +
      `**When stressed:**\n` +
      `🧘 Try the Mental Clarity exercises in your Library\n` +
      `🌬️ Box breathing: 4s in → 4s hold → 4s out → 4s hold\n` +
      `🚶 Even a 10-minute walk makes a difference\n\n` +
      `Your streak is ${ctx.streak} days. Every day you show up is a win! 💪`;
  },

  // Water & hydration
  'water|hydration|drink|dehydrated|thirsty': (ctx) => {
    return `Hydration is crucial for performance! 💧\n\n` +
      `**How much water:**\n` +
      `• Baseline: 30-35ml per kg bodyweight\n` +
      `• Training days: Add 500ml-1L extra\n` +
      `• Hot weather: Add another 500ml\n\n` +
      `**Hydration schedule:**\n` +
      `☀️ Morning: 500ml within 30 min of waking\n` +
      `🏋️ Pre-workout: 250ml, 30 min before\n` +
      `💪 During: Sip every 15-20 min\n` +
      `🌙 Evening: Taper off 2h before bed\n\n` +
      `**Signs of dehydration:**\n` +
      `• Dark yellow urine\n` +
      `• Fatigue & headaches\n` +
      `• Decreased performance\n` +
      `• Muscle cramps\n\n` +
      `Pro tip: Keep a water bottle visible at all times!`;
  },

  // Weight management
  'weight|lose weight|gain weight|fat|skinny|overweight|bmi|body fat': (ctx) => {
    return `Weight management fundamentals:\n\n` +
      `**To lose fat:**\n` +
      `📉 Calorie deficit of 300-500 cal/day\n` +
      `🥩 Keep protein HIGH (2g/kg) to preserve muscle\n` +
      `🏃 Add 2-3 cardio sessions/week\n` +
      `⏰ Be patient — 0.5-1kg/week is healthy\n\n` +
      `**To gain muscle:**\n` +
      `📈 Calorie surplus of 300-500 cal/day\n` +
      `🥩 Protein at 1.8-2.2g/kg\n` +
      `🏋️ Progressive overload in training\n` +
      `😴 Sleep 8+ hours for recovery\n\n` +
      `**Body recomposition** (lose fat + gain muscle):\n` +
      `• Eat at maintenance or slight deficit\n` +
      `• High protein (2g/kg)\n` +
      `• Strength train 3-4x/week\n` +
      `• Slower but sustainable results\n\n` +
      `💡 Track weekly averages, not daily fluctuations. Weight varies 1-2kg daily!`;
  },
};

function detectTopic(input: string): string | null {
  const lower = input.toLowerCase();
  const topicMap: Record<string, string[]> = {
    nutrition: ['eat', 'food', 'nutrition', 'diet', 'protein', 'calorie', 'meal prep', 'meal plan', 'cook', 'recipe', 'breakfast', 'lunch', 'dinner', 'snack', 'macro', 'how much protein', 'how many calories', 'calorie count', 'tdee', 'bulk', 'cut'],
    recovery: ['sore', 'recovery', 'rest', 'pain', 'hurt', 'sleep', 'insomnia', 'tired', 'bedtime'],
    progress: ['progress', 'results', 'improve', 'plateau', 'stuck'],
    motivation: ['motivation', 'tired', "don't feel", 'lazy', 'skip'],
    form: ['form', 'technique', 'how to', 'proper', 'correct'],
    body: ['body', 'transform', 'physique', 'look', 'appearance', 'aesthetic', 'craft my body', 'weight', 'lose weight', 'gain weight', 'fat', 'skinny', 'overweight', 'bmi', 'body fat'],
    warmup: ['warm up', 'warmup', 'cool down', 'cooldown', 'before workout', 'after workout'],
    injury: ['injury', 'prevent', 'safe', 'joint', 'knee', 'shoulder', 'back pain', 'wrist'],
    supplements: ['supplement', 'creatine', 'protein powder', 'bcaa', 'pre workout', 'vitamin'],
    mental: ['mental', 'stress', 'anxiety', 'confidence', 'discipline', 'habit', 'mindset', 'focus'],
    hydration: ['water', 'hydration', 'drink', 'dehydrated', 'thirsty'],
  };
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(kw => lower.includes(kw))) return topic;
  }
  return null;
}

function getFollowUpSuggestions(lastTopic: string): string[] {
  const followUps: Record<string, string[]> = {
    nutrition: ['Meal prep ideas', 'Macro calculator', 'Pre-workout snack'],
    recovery: ['Active recovery workout', 'Sleep tips', 'Foam rolling'],
    progress: ['Change difficulty', 'New exercises', 'Craft My Body'],
    motivation: ['Start workout', 'Set a goal', 'View streak'],
    form: ['Watch form tips', 'Beginner variations', 'Advanced moves'],
    body: ['Craft My Body', 'Macro targets', 'Training split'],
    warmup: ['Injury prevention', 'Stretching routine', 'Recommend exercises'],
    injury: ['Warm-up routine', 'Recovery tips', 'When to see a doctor'],
    supplements: ['Nutrition tips', 'Meal prep ideas', 'Hydration tips'],
    mental: ['Start workout', 'Stretching routine', 'Sleep tips'],
    hydration: ['Nutrition tips', 'Supplements guide', 'Recovery tips'],
  };
  return followUps[lastTopic] || [];
}

function generateCoachResponse(input: string, ctx: CoachContext): string {
  const lower = input.toLowerCase();

  for (const [pattern, responseFn] of Object.entries(TOPIC_RESPONSES)) {
    const keywords = pattern.split('|');
    if (keywords.some(kw => lower.includes(kw))) {
      return responseFn(ctx);
    }
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return GREETING_PROMPTS[Math.floor(Math.random() * GREETING_PROMPTS.length)];
  }

  if (lower.includes('thanks') || lower.includes('thank you')) {
    return "You're welcome! That's what I'm here for. Keep pushing — you're doing amazing! 🌟";
  }

  return `Great question! Here's what I can help with:\n\n💪 **Motivation** — "I don't feel like working out"\n🏋️ **Form** — "How do I do push-ups properly?"\n🍎 **Nutrition** — "What should I eat?"\n😴 **Recovery** — "I'm sore, should I rest?"\n📈 **Progress** — "Am I improving?"\n🧘 **Flexibility** — "How to get more flexible?"\n\nJust ask naturally and I'll help!`;
}

// ============================================
// TYPING INDICATOR COMPONENT
// ============================================

function TypingIndicator() {
  const { theme } = useTheme();
  // Static typing indicator - no idle animations
  const dotStyle = { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent, marginHorizontal: 3 };

  return (
    <Animated.View entering={FadeIn.duration(150)} style={[styles.messageBubble, styles.coachBubble, {
      backgroundColor: theme.colors.surfaceVariant,
      borderColor: theme.colors.border,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
    }]}>
      <View style={[dotStyle, { opacity: 0.4 }]} />
      <View style={[dotStyle, { opacity: 0.6 }]} />
      <View style={[dotStyle, { opacity: 0.8 }]} />
    </Animated.View>
  );
}

// ============================================
// MESSAGE BUBBLE COMPONENT
// ============================================

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isCoach = message.role === 'coach';

  return (
    <Animated.View
      entering={isCoach
        ? FadeInDown.delay(index * 30).duration(150)
        : FadeInRight.delay(30).duration(150)
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
            <MaterialCommunityIcons name="robot-happy" size={12} color="#fff" />
          </LinearGradient>
          <Text style={[styles.coachLabel, { color: theme.colors.accent }]}>{t('coach.coachLabel')}</Text>
        </View>
      )}
      {isCoach ? (
        <View>
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
      <Text style={[styles.timestamp, { color: theme.colors.textMuted }]}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </Animated.View>
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
  const scrollRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [coachCtx, setCoachCtx] = useState<CoachContext | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [lastTopic, setLastTopic] = useState<string | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputScale = useSharedValue(1);

  useEffect(() => { loadCoachContext(); }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const nextHeight = event?.endCoordinates?.height ?? 0;
      setKeyboardHeight(nextHeight);
      console.log('[Coach] Keyboard show', { height: nextHeight });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      console.log('[Coach] Keyboard hide');
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadCoachContext = async () => {
    try {
      const [progress, streak, fatigue, xp, profile, exercises] = await Promise.all([
        getUserProgress(),
        getStreak('user_local_001'),
        getMuscleFatigue('user_local_001'),
        getXPData(),
        getUserProfile('user_local_001'),
        getExercises(),
      ]);

      const fatigueHigh = fatigue
        .filter(f => f.fatigue_level > 60)
        .map(f => f.muscle.replace(/_/g, ' '));

      const daysSince = progress.last_workout_date
        ? Math.floor((Date.now() - new Date(progress.last_workout_date).getTime()) / 86400000)
        : 999;

      const ctx: CoachContext = {
        streak: streak.current,
        totalWorkouts: progress.total_workouts,
        level: xp.level,
        totalXP: xp.totalXP,
        fatigueHighMuscles: fatigueHigh,
        lastWorkoutDate: progress.last_workout_date,
        daysSinceLastWorkout: daysSince,
        goal: profile?.goal || 'body_control',
        exerciseCount: exercises.length,
      };

      setCoachCtx(ctx);

      let greeting = GREETING_PROMPTS[Math.floor(Math.random() * GREETING_PROMPTS.length)];
      if (ctx.streak >= 3) {
        greeting = `Amazing — ${ctx.streak}-day streak! 🔥 ${greeting}`;
      } else if (ctx.daysSinceLastWorkout > 3) {
        greeting = `Welcome back! It's been ${ctx.daysSinceLastWorkout} days. No judgment — let's get back on track! 💪`;
      }

      setMessages([{
        id: 'greeting',
        role: 'coach',
        text: greeting,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('[Coach] Failed to load context:', error);
      setMessages([{
        id: 'greeting',
        role: 'coach',
        text: "Hey! I'm your FitQuest coach. Ask me anything about training, nutrition, or recovery! 💪",
        timestamp: new Date(),
      }]);
      setCoachCtx({
        streak: 0, totalWorkouts: 0, level: 1, totalXP: 0,
        fatigueHighMuscles: [], lastWorkoutDate: null, daysSinceLastWorkout: 999, goal: 'body_control',
        exerciseCount: 200,
      });
    }
  };

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !coachCtx) return;
    console.log('[Coach] sendMessage', { chars: text.length });

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const topic = detectTopic(text);

    // Use IntentRouter for smarter classification
    const classified = intentRouter.classify(text);

    const handleResponse = async () => {
      let response: string;

      // For PROFESSOR and HEALTH intents with high confidence, use DualAI
      if (classified.category === 'PROFESSOR' && classified.confidence > 0.5) {
        try {
          const aiResp = await dualAI.query(text, {
            personality: 'PROFESSOR',
            conversationHistory: [],
          });
          response = aiResp.message;
        } catch {
          response = generateCoachResponse(text, coachCtx);
        }
      } else if (classified.category === 'NAVIGATION' && classified.entities.screens.length > 0) {
        const screen = classified.entities.screens[0];
        response = `Sure! Let me take you to the ${screen} screen. Use the navigation tabs or menu to get there.`;
      } else {
        response = generateCoachResponse(text, coachCtx);
      }

      const coachMsg: ChatMessage = {
        id: `coach_${Date.now()}`,
        role: 'coach',
        text: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, coachMsg]);
      setIsTyping(false);

      if (topic) {
        setLastTopic(topic);
        setActiveSuggestions(getFollowUpSuggestions(topic));
      }

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    };

    setTimeout(() => {
      handleResponse();
    }, 800 + Math.random() * 600);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, coachCtx]);

  const handleSuggestion = (text: string) => {
    console.log('[Coach] suggestion', { text });
    setInput(text);
    setTimeout(() => {
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      const topic = detectTopic(text);

      setTimeout(() => {
        const response = generateCoachResponse(text, coachCtx ?? {
          streak: 0, totalWorkouts: 0, level: 1, totalXP: 0,
          fatigueHighMuscles: [], lastWorkoutDate: null,
          daysSinceLastWorkout: 0, goal: 'body_control', exerciseCount: 0,
        });
        setMessages(prev => [...prev, {
          id: `coach_${Date.now()}`,
          role: 'coach',
          text: response,
          timestamp: new Date(),
        }]);
        setIsTyping(false);
        setInput('');

        if (topic) {
          setLastTopic(topic);
          setActiveSuggestions(getFollowUpSuggestions(topic));
        }

        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }, 800 + Math.random() * 600);

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 50);
  };

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const quickSuggestions = [
    { text: "Recommend exercises for me", icon: 'dumbbell' as const },
    { text: "Meal prep ideas", icon: 'food-variant' as const },
    { text: "I'm feeling tired today", icon: 'emoticon-sad-outline' as const },
    { text: "How's my progress?", icon: 'chart-line' as const },
    { text: "I'm sore, should I rest?", icon: 'medical-bag' as const },
    { text: "Nutrition tips", icon: 'food-apple-outline' as const },
    { text: "How often should I train?", icon: 'calendar-clock' as const },
    { text: "Craft My Body", icon: 'human-edit' as const },
    { text: "Warm-up routine", icon: 'fire' as const },
    { text: "Injury prevention", icon: 'shield-check' as const },
    { text: "Supplements guide", icon: 'pill' as const },
    { text: "Mental health", icon: 'head-heart' as const },
    { text: "Hydration tips", icon: 'water' as const },
    { text: "Weight management", icon: 'scale-bathroom' as const },
  ];

  const suggestionColors = [theme.colors.indigo, '#4ECDC4', '#FF6B6B', theme.colors.accent, theme.colors.error, theme.colors.warning, theme.colors.purple, theme.colors.pink, '#F97316', theme.colors.blue, '#14B8A6', '#A855F7', '#06B6D4', '#E11D48'];

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
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.headerBackBtn, {
                  backgroundColor: theme.colors.surfaceVariant,
                }]}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <LinearGradient
                  colors={[theme.colors.accent, theme.colors.purple] as [string, string]}
                  style={styles.headerAvatar}
                >
                  <MaterialCommunityIcons name="robot-happy" size={22} color="#fff" />
                </LinearGradient>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('coach.title')}</Text>
                    <View style={{ backgroundColor: theme.colors.warning + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: theme.colors.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{t('common.beta')}</Text>
                    </View>
                  </View>
                  <View style={styles.headerStatusRow}>
                    <PulseDot color={theme.colors.accent} size={6} />
                    <Text style={[styles.headerStatus, { color: theme.colors.accent }]}>{t('coach.online')}</Text>
                  </View>
                </View>
              </View>

              <View style={{ width: 36 }} />
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
            ref={scrollRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <MessageBubble key={item.id} message={item} index={index} />
            )}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={7}
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
                {isTyping && <TypingIndicator />}

                {/* Quick Suggestions (show only after greeting) */}
                {messages.length <= 1 && !isTyping && (
                  <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.suggestionsWrap}>
                    <Text style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                      {t('coach.tapToStart')}
                    </Text>
                    <View style={styles.suggestionsGrid}>
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
                                size={16}
                                color={suggestionColors[idx % suggestionColors.length]}
                              />
                            </View>
                            <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
                              {suggestion.text}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      ))}
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

          {/* ── INPUT BAR ── */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(150)}
            style={[styles.inputBarWrap, {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
              paddingBottom: Math.max(12, insets.bottom + 8),
              marginBottom: Platform.OS === 'android' ? Math.max(0, keyboardHeight - 10) : 0,
            }]}
          >
            <View style={[styles.inputRow, {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.border,
            }]}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder={t('coach.placeholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline={false}
              />
              <Animated.View style={sendAnimatedStyle}>
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
                    <MaterialCommunityIcons name="send" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    maxWidth: '85%',
    marginBottom: 12,
  },
  coachBubble: {
    alignSelf: 'flex-start',
    padding: 14,
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
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  // Suggestions
  suggestionsWrap: {
    marginTop: 8,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  suggestionsGrid: {
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  suggestionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 13.5,
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
});

export default function CoachScreen() {
  const router = useRouter();
  return (
    <ScreenErrorBoundary screenName="AI Coach" onGoBack={() => router.back()}>
      <CoachScreenInner />
    </ScreenErrorBoundary>
  );
}
