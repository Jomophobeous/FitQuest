/**
 * FitQuest Audio Instruction Service
 * Client-side TTS for hands-free workout guidance
 *
 * Uses native TTS (expo-speech):
 * - Android: TextToSpeech API
 * - iOS: AVSpeechSynthesizer
 *
 * Characteristics:
 * - Offline capable
 * - Zero cost
 * - Battery-safe
 * - Predictable latency
 */

import * as Speech from 'expo-speech';
import { Vibration, Platform } from 'react-native';
import { createAudioSettingsRow, getAudioSettingsRow, updateAudioSettingsRow } from '../database/service';

// ============================================
// TYPES
// ============================================

export interface AudioSettings {
  voiceEnabled: boolean;
  speechRate: 0.8 | 1.0 | 1.2;
  countdownCuesEnabled: boolean;
  /** BCP-47 locale for TTS (runtime-only, not persisted to DB) */
  language: string;
}

export interface ExerciseAudio {
  intro: string; // "Next exercise: Push-ups"
  setup: string; // "Hands under shoulders. Body straight."
  execution: string; // "Lower under control. Push explosively."
  transition: string; // "Rest for 30 seconds."
}

type AudioEventType = 'intro' | 'setup' | 'execution' | 'transition' | 'countdown' | 'complete';

type AudioEventListener = (event: AudioEventType, text?: string) => void;

/** Translation function signature — injected from React context */
type TranslatorFn = (key: string, vars?: Record<string, string | number>) => string;

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_SETTINGS: AudioSettings = {
  voiceEnabled: true,
  speechRate: 1.0,
  countdownCuesEnabled: true,
  language: 'en-US',
};

/**
 * Maps app language codes to BCP-47 TTS locale codes.
 * expo-speech uses these to select the correct voice.
 */
const APP_LANG_TO_TTS_LOCALE: Record<string, string> = {
  en: 'en-US',
  af: 'af-ZA',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  st: 'st-ZA',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar-SA',
  hi: 'hi-IN',
  sw: 'sw-KE',
};

/**
 * Pitch tuning by audio event type.
 * Slight variation makes narration feel more dynamic and human-like.
 * - Intros/transitions: warm, slightly lower → authoritative coach
 * - Execution: neutral, clear → instructional
 * - Completion/countdown: energetic, slightly higher → celebratory
 */
const PITCH_BY_EVENT: Record<AudioEventType, number> = {
  intro: 0.95,
  setup: 1.0,
  execution: 1.0,
  transition: 0.95,
  countdown: 1.05,
  complete: 1.1,
};

/**
 * Pre-process text for more natural TTS prosody.
 * Since expo-speech has no SSML, we use punctuation and spacing tricks
 * to coax the speech engine into more natural pauses and rhythm.
 */
function preprocessForNaturalSpeech(text: string, type: AudioEventType): string {
  let processed = text;

  // Ensure sentences end with proper punctuation for clear pauses
  processed = processed.replace(/([a-zA-Z\u00C0-\u024F])(\s+)([A-Z\u00C0-\u024F])/g, '$1. $3');

  // Add micro-pauses after colons (e.g. "Next exercise: Push-ups")
  processed = processed.replace(/:\s*/g, ':... ');

  // Add breathing pause before "and" in long sentences
  processed = processed.replace(/,\s*and\s/gi, ', ... and ');

  // Numbers read better with slight pause before them
  processed = processed.replace(/(\s)(\d+)\s*(seconds|reps|sets|minutes)/gi, '$1... $2 $3');

  // Exclamation marks → brief dramatic pause before enthusiastic phrases
  processed = processed.replace(/!\s+/g, '! ... ');

  // Ellipsis normalization (ensure exactly 3 dots with surrounding spaces)
  processed = processed.replace(/\.{2,}/g, '...');
  processed = processed.replace(/\s*\.\.\.\s*/g, ' ... ');

  // For completion events, add an extra beat at the start for dramatic effect
  if (type === 'complete') {
    processed = '... ' + processed;
  }

  // Clean up multiple spaces
  processed = processed.replace(/\s{2,}/g, ' ').trim();

  return processed;
}

// ============================================
// AUDIO SERVICE CLASS
// ============================================

class AudioService {
  private settings: AudioSettings = DEFAULT_SETTINGS;
  private isSpeaking: boolean = false;
  private isProcessingQueue: boolean = false;
  private queue: { text: string; type: AudioEventType }[] = [];
  private listeners: Set<AudioEventListener> = new Set();
  private isInitialized: boolean = false;
  private translator: TranslatorFn | null = null;
  /** Cached enhanced voice ID for current locale */
  private preferredVoiceId: string | undefined;
  /** Circuit breaker: consecutive TTS failures */
  private consecutiveSpeechFailures: number = 0;
  private static readonly MAX_SPEECH_FAILURES = 3;

  /**
   * Inject the translation function from React context.
   * Called by useAudio hook whenever language changes.
   */
  setTranslator(t: TranslatorFn): void {
    this.translator = t;
  }

  /** Translate a key, falling back to the key itself if no translator is set */
  private t(key: string, vars?: Record<string, string | number>): string {
    if (this.translator) return this.translator(key, vars);
    // Fallback: return key (will be the English default from calling code)
    return key;
  }

  /**
   * Initialize audio service with user settings
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      let result: any = null;
      try {
        result = await getAudioSettingsRow(userId);
      } catch {
        // DB not ready yet — use defaults, will retry on next call
      }

      if (result) {
        this.settings = {
          voiceEnabled: result.voice_enabled === 1,
          speechRate: result.speech_rate as 0.8 | 1.0 | 1.2,
          countdownCuesEnabled: result.countdown_cues_enabled === 1,
          language: DEFAULT_SETTINGS.language,
        };
      } else {
        // Create default settings (ignore errors if DB isn't ready)
        try {
          await createAudioSettingsRow({
            userId,
            voiceEnabled: true,
            speechRate: 1.0,
            countdownCuesEnabled: true,
          });
        } catch {
          // DB not available — will create on next init
        }
      }

      this.isInitialized = true;
      this.consecutiveSpeechFailures = 0; // Reset circuit breaker on init

      // Pre-warm TTS engine to eliminate cold-start latency
      // Speaking an empty space primes the native TTS synthesizer
      if (this.settings.voiceEnabled) {
        Speech.speak(' ', {
          rate: this.settings.speechRate,
          language: this.settings.language,
          volume: 0,
        });
      }
    } catch (error) {
      if (__DEV__) console.error('[AudioService] Initialization failed:', error);
      // Use defaults on failure
    }
  }

  /**
   * Update audio settings
   */
  async updateSettings(userId: string, settings: Partial<AudioSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };

    try {
      await updateAudioSettingsRow({
        userId,
        voiceEnabled: this.settings.voiceEnabled,
        speechRate: this.settings.speechRate,
        countdownCuesEnabled: this.settings.countdownCuesEnabled,
      });
    } catch (error) {
      if (__DEV__) console.error('[AudioService] Failed to save settings:', error);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Set TTS language from app language code.
   * Call this whenever the app language changes.
   * Also selects the best quality voice for the locale and resets the
   * circuit breaker so TTS gets a fresh chance in the new language.
   */
  setLanguage(appLangCode: string): void {
    this.settings.language = APP_LANG_TO_TTS_LOCALE[appLangCode] ?? 'en-US';
    this.preferredVoiceId = undefined; // reset — will be picked on next speak
    this.consecutiveSpeechFailures = 0; // reset circuit breaker on language change
    this.selectBestVoice();
  }

  /**
   * Select the highest quality voice available for the current locale.
   * Uses a scoring system: exact locale match (3pts) > lang prefix (1pt),
   * Enhanced quality (+5pts), network voices deprioritized (-2pts).
   * Caches result per locale to avoid re-scanning.
   */
  private async selectBestVoice(): Promise<void> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (!voices || voices.length === 0) return;

      const locale = this.settings.language;
      const langPrefix = locale.split('-')[0]!; // e.g. 'en' from 'en-US'

      // Find voices matching our locale
      const matching = voices.filter((v) => v.language === locale || v.language?.startsWith(langPrefix));
      if (matching.length === 0) return;

      // Score each matching voice
      let bestScore = -Infinity;
      let bestVoice: string | undefined;

      for (const v of matching) {
        let score = 0;

        // Exact locale match is far better than just language prefix
        if (v.language === locale) score += 3;
        else score += 1;

        // Quality tiers
        const quality = (v as any).quality;
        if (quality === 'Enhanced') score += 5;
        else if (quality === 'Default') score += 2;

        // Network/online voices may have latency — deprioritize
        if ((v as any).networkConnectionRequired) score -= 2;

        if (score > bestScore) {
          bestScore = score;
          bestVoice = v.identifier;
        }
      }

      if (bestVoice) {
        this.preferredVoiceId = bestVoice;
      }
    } catch {
      // Voice selection is best-effort — default works fine
    }
  }

  /**
   * Subscribe to audio events
   */
  subscribe(listener: AudioEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: AudioEventType, text?: string): void {
    this.listeners.forEach((listener) => listener(event, text));
  }

  /**
   * Check if device is in silent mode (best effort)
   */
  async checkAudioAvailability(): Promise<boolean> {
    // expo-speech handles this internally
    // Return true as we'll fallback to visual if speech fails
    return true;
  }

  /**
   * Speak text with TTS — uses pitch variation and prosody preprocessing
   * for more natural, coach-like narration.
   */
  private async speak(text: string, type: AudioEventType): Promise<void> {
    if (!this.settings.voiceEnabled || !text) {
      this.emit(type, text);
      return;
    }

    // Circuit breaker: stop trying TTS after repeated failures
    if (this.consecutiveSpeechFailures >= AudioService.MAX_SPEECH_FAILURES) {
      this.emit(type, text);
      return;
    }

    return new Promise((resolve) => {
      this.isSpeaking = true;
      this.emit(type, text);

      // Apply natural speech preprocessing (punctuation-based prosody)
      const processedText = preprocessForNaturalSpeech(text, type);

      // Narration types benefit from a slightly slower, more natural pace
      const isNarration = type === 'intro' || type === 'setup' || type === 'execution' || type === 'transition';
      const rate = isNarration
        ? Math.max(0.75, this.settings.speechRate * 0.97) // 3% slower for narration
        : this.settings.speechRate;

      // Context-aware pitch for dynamic, human-like voice
      const pitch = PITCH_BY_EVENT[type] ?? 1.0;

      Speech.speak(processedText, {
        rate,
        pitch,
        language: this.settings.language,
        voice: this.preferredVoiceId,
        onDone: () => {
          this.isSpeaking = false;
          this.consecutiveSpeechFailures = 0; // Reset on success
          resolve();
        },
        onError: (_error: { message?: string }) => {
          this.consecutiveSpeechFailures += 1;
          if (this.consecutiveSpeechFailures === AudioService.MAX_SPEECH_FAILURES && __DEV__) {
            console.warn(`[AudioService] TTS failed ${AudioService.MAX_SPEECH_FAILURES}x — disabling until next init`);
          }
          this.isSpeaking = false;
          resolve();
        },
        onStopped: () => {
          this.isSpeaking = false;
          resolve();
        },
      });
    });
  }

  /**
   * Queue text for speaking (prevents overlap)
   */
  private async queueSpeak(text: string, type: AudioEventType): Promise<void> {
    this.queue.push({ text, type });
    await this.processQueue();
  }

  /**
   * Process speech queue sequentially (mutex-protected)
   */
  private async processQueue(): Promise<void> {
    // Mutex guard: prevent concurrent processing
    if (this.isProcessingQueue || this.isSpeaking || this.queue.length === 0) return;

    this.isProcessingQueue = true;
    try {
      const item = this.queue.shift();
      if (item) {
        await this.speak(item.text, item.type);
      }
    } finally {
      this.isProcessingQueue = false;
    }

    // Continue processing remaining items
    await this.processQueue();
  }

  /**
   * Play exercise intro
   */
  async playIntro(audio: ExerciseAudio): Promise<void> {
    await this.queueSpeak(audio.intro, 'intro');
  }

  /**
   * Speak narration text (for mind exercises)
   */
  async speakNarration(text: string): Promise<void> {
    await this.queueSpeak(text, 'intro');
  }

  /**
   * Play setup instructions
   */
  async playSetup(audio: ExerciseAudio): Promise<void> {
    await this.queueSpeak(audio.setup, 'setup');
  }

  /**
   * Play execution cue
   */
  async playExecution(audio: ExerciseAudio): Promise<void> {
    await this.queueSpeak(audio.execution, 'execution');
  }

  /**
   * Play transition/rest cue
   */
  async playTransition(audio: ExerciseAudio): Promise<void> {
    await this.queueSpeak(audio.transition, 'transition');
  }

  /**
   * Play countdown cue (e.g., "5 seconds")
   */
  async playCountdown(seconds: number): Promise<void> {
    if (!this.settings.countdownCuesEnabled) return;

    const text = seconds === 1 ? this.t('audio.countdown.one') : `${seconds}`;
    await this.queueSpeak(text, 'countdown');
  }

  /**
   * Play completion cue
   */
  async playComplete(): Promise<void> {
    await this.queueSpeak(this.t('audio.exerciseComplete'), 'complete');
  }

  /**
   * Play bell/notification sound when exercise or timer stops
   * Uses vibration + verbal cue as audio bell
   */
  async playBell(): Promise<void> {
    // Vibrate pattern: short burst (like a bell ring)
    if (Platform.OS === 'ios') {
      Vibration.vibrate();
    } else {
      // Android: double vibration pattern
      Vibration.vibrate([0, 100, 50, 100]);
    }

    // Verbal bell cue if voice is enabled (queued to prevent overlap)
    if (this.settings.voiceEnabled) {
      await this.queueSpeak(this.t('audio.bell'), 'complete');
    }
  }

  /**
   * Play exercise finished sound (bell + verbal)
   */
  async playExerciseFinished(nextExerciseName?: string): Promise<void> {
    // Vibrate
    if (Platform.OS === 'ios') {
      Vibration.vibrate();
    } else {
      Vibration.vibrate([0, 150, 100, 150]);
    }

    // Say "done" or transition to next
    const message = nextExerciseName
      ? this.t('audio.doneNext', { name: nextExerciseName })
      : this.t('audio.exerciseDone');
    await this.queueSpeak(message, 'complete');
  }

  /**
   * Play workout complete celebration
   */
  async playWorkoutComplete(): Promise<void> {
    // Triple vibration
    Vibration.vibrate([0, 100, 80, 100, 80, 200]);
    await this.queueSpeak(this.t('audio.workoutComplete'), 'complete');
  }

  /**
   * Play a context-aware workout completion compliment.
   * Uses completion data to generate personalized praise.
   */
  async playWorkoutCompliment(data: {
    completedCount: number;
    totalCount: number;
    durationSeconds: number;
    streakDays: number;
    xpEarned: number;
    levelUp: boolean;
    newLevel?: number;
    progressions: number;
    exerciseNames: string[];
  }): Promise<void> {
    Vibration.vibrate([0, 100, 80, 100, 80, 200]);

    const compliment = generateCompletionCompliment(data, this.translator || undefined);
    await this.queueSpeak(compliment, 'complete');
  }

  /**
   * Full exercise audio sequence
   * Integrates with Timer Service events
   */
  async playExerciseSequence(audio: ExerciseAudio): Promise<void> {
    await this.playIntro(audio);
    await this.playSetup(audio);
    // 1-second pause handled by caller
    // Timer starts, then:
    await this.playExecution(audio);
    // Timer ticks silently until final countdown
    // Countdown cues handled by timer events
    // Transition played at end
  }

  /**
   * Announce a workout phase transition.
   * Called once when transitioning between warmup → main → cooldown.
   */
  async playPhaseTransition(
    fromPhase: 'warmup' | 'main' | 'cooldown' | null,
    toPhase: 'warmup' | 'main' | 'cooldown',
  ): Promise<void> {
    const transitionKeys: Record<string, string> = {
      'null→warmup': 'audio.warmup.start',
      'null→main': 'audio.main.start',
      'null→cooldown': 'audio.cooldown.start',
      'warmup→main': 'audio.warmup.toMain',
      'warmup→cooldown': 'audio.warmup.toCooldown',
      'main→cooldown': 'audio.main.toCooldown',
      'main→warmup': 'audio.main.toWarmup',
      'cooldown→main': 'audio.cooldown.toMain',
    };
    const key = `${fromPhase ?? 'null'}→${toPhase}`;
    const translationKey = transitionKeys[key];
    const message = translationKey
      ? this.t(translationKey)
      : this.t('audio.phase.fallback', { phase: toPhase.replace('_', ' ') });

    // Brief vibration to mark the transition
    Vibration.vibrate(Platform.OS === 'ios' ? [0, 40] : [0, 40, 30, 40]);
    await this.queueSpeak(message, 'transition');
  }

  /**
   * Stop all audio immediately
   */
  stop(): void {
    Speech.stop();
    this.queue = [];
    this.isSpeaking = false;
    this.isProcessingQueue = false;
  }

  /**
   * Pause audio (for screen lock, headphone disconnect)
   */
  pause(): void {
    // expo-speech doesn't have pause, so we stop and clear queue
    Speech.stop();
    this.queue = [];
    this.isSpeaking = false;
    this.isProcessingQueue = false;
  }

  /**
   * Check if currently speaking
   */
  isPlaying(): boolean {
    return this.isSpeaking;
  }

  /**
   * Generate fallback text for visual display
   * Used when audio fails or is disabled
   */
  getFallbackText(audio: ExerciseAudio, phase: 'intro' | 'setup' | 'execution' | 'transition'): string {
    return audio[phase] || '';
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const audioService = new AudioService();

// ============================================
// COMPLETION COMPLIMENT GENERATOR
// ============================================

function generateCompletionCompliment(
  data: {
    completedCount: number;
    totalCount: number;
    durationSeconds: number;
    streakDays: number;
    xpEarned: number;
    levelUp: boolean;
    newLevel?: number;
    progressions: number;
    exerciseNames: string[];
  },
  t?: TranslatorFn,
): string {
  const tr = (key: string, vars?: Record<string, string | number>): string => {
    if (t) return t(key, vars);
    // Fallback English defaults
    const fallbacks: Record<string, string> = {
      'audio.compliment.1': 'Workout complete! You showed up and gave it your all.',
      'audio.compliment.2': 'That was incredible! Your body is getting stronger every session.',
      'audio.compliment.3': 'Another one in the books! Consistency is your superpower.',
      'audio.compliment.4': 'You just proved that hard work pays off. Well done!',
      'audio.compliment.5': "Amazing effort! Most people skip today. You didn't.",
      'audio.perfect.1': "Perfect session! Every single exercise completed. That's elite dedication.",
      'audio.perfect.2': "Flawless workout! You didn't skip a single exercise. Unstoppable!",
      'audio.perfect.3': 'One hundred percent completion. You are on another level!',
      'audio.levelUp.1': 'And you levelled up! Welcome to level {{level}}!',
      'audio.levelUp.2': 'Level {{level}} unlocked! Your hard work is paying off big time!',
      'audio.streak.7': "A whole week of training! You're building a real habit.",
      'audio.streak.14': 'Two weeks strong! Your discipline is inspiring.',
      'audio.streak.30': "Thirty-day streak! You're in the top tier of consistency.",
      'audio.streak.60': 'Sixty days! Most people dream about this kind of dedication.',
      'audio.streak.90': "Ninety-day streak! You're absolutely legendary.",
      'audio.minutes': '{{minutes}} minutes of pure effort.',
      'audio.xpEarned': 'Plus {{xp}} XP earned.',
    };
    let result = fallbacks[key] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
    return result;
  };

  const parts: string[] = [];

  // Base compliment
  const complimentKeys = [
    'audio.compliment.1',
    'audio.compliment.2',
    'audio.compliment.3',
    'audio.compliment.4',
    'audio.compliment.5',
  ];
  const perfectKeys = ['audio.perfect.1', 'audio.perfect.2', 'audio.perfect.3'];

  if (data.completedCount === data.totalCount && data.totalCount > 0) {
    parts.push(tr(perfectKeys[Math.floor(Math.random() * perfectKeys.length)]!)); // non-security
  } else {
    parts.push(tr(complimentKeys[Math.floor(Math.random() * complimentKeys.length)]!)); // non-security
  }

  // Duration callout
  const mins = Math.round(data.durationSeconds / 60);
  if (mins >= 30) {
    parts.push(tr('audio.minutes', { minutes: mins }));
  }

  // Progression callout
  if (data.progressions > 0) {
    const progKey = 'audio.progressions';
    const progText = tr(progKey, { count: data.progressions });
    // Handle plural form (split by |)
    if (progText.includes('|')) {
      const forms = progText.split('|');
      parts.push(data.progressions === 1 ? forms[0]! : forms[1]!);
    } else {
      parts.push(progText);
    }
  }

  // Level up
  if (data.levelUp && data.newLevel) {
    const levelUpKeys = ['audio.levelUp.1', 'audio.levelUp.2'];
    parts.push(tr(levelUpKeys[Math.floor(Math.random() * levelUpKeys.length)]!, { level: data.newLevel })); // non-security
  }

  // Streak milestone
  const milestone = [90, 60, 30, 14, 7].find((m) => data.streakDays === m);
  if (milestone) {
    parts.push(tr(`audio.streak.${milestone}`));
  }

  // XP earned
  parts.push(tr('audio.xpEarned', { xp: data.xpEarned }));

  return parts.join(' ');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate default audio instructions from exercise name
 * Used when exercise doesn't have custom audio
 */
export function generateDefaultAudio(exerciseName: string, restSeconds: number = 30, t?: TranslatorFn): ExerciseAudio {
  const tr = (key: string, vars?: Record<string, string | number>): string => {
    if (t) return t(key, vars);
    const fb: Record<string, string> = {
      'audio.nextExercise': 'Next exercise: {{name}}.',
      'audio.getIntoPosition': 'Get into position',
      'audio.beginMovement': 'Begin the movement',
      'audio.restFor': 'Rest for {{seconds}} seconds.',
    };
    let r = fb[key] || key;
    if (vars) for (const [k, v] of Object.entries(vars)) r = r.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    return r;
  };
  return {
    intro: tr('audio.nextExercise', { name: exerciseName }),
    setup: tr('audio.getIntoPosition'),
    execution: tr('audio.beginMovement'),
    transition: tr('audio.restFor', { seconds: restSeconds }),
  };
}

/**
 * Generate rich, detailed audio narration from exercise data.
 * Builds TTS-optimized narration from the exercise's instruction array,
 * muscle targets, and metadata — replacing the generic "Get into position".
 * Uses conversational phrasing with prosody cues (ellipses, commas)
 * to produce natural-sounding coach narration.
 */
export function generateRichAudio(
  exercise: {
    name: string;
    category?: string;
    instructions: string[];
    primaryMuscles?: string[];
    restSeconds?: number;
  },
  nextExerciseName?: string,
  t?: TranslatorFn,
): ExerciseAudio {
  const tr = (key: string, vars?: Record<string, string | number>): string => {
    if (t) return t(key, vars);
    const fb: Record<string, string> = {
      'audio.nextExercise': 'Next exercise... {{name}}.',
      'audio.targets': 'This one targets your {{muscles}}.',
      'audio.categoryLabel': 'A {{category}} exercise.',
      'audio.getInPosition': 'Get into position... for {{name}}.',
      'audio.focusControl': 'Focus on controlled movement... nice and steady.',
      'audio.performControl': 'Perform {{name}}... with controlled form. Breathe steadily, throughout.',
      'audio.wellDone': 'Well done!',
      'audio.restFor': 'Rest for {{seconds}} seconds... breathe.',
      'audio.upNext': 'Up next... {{name}}.',
      'audio.shakeItOut': 'Shake it out... and get ready for the next one.',
    };
    let r = fb[key] || key;
    if (vars) for (const [k, v] of Object.entries(vars)) r = r.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    return r;
  };

  const { name, category, instructions, primaryMuscles, restSeconds = 30 } = exercise;

  // ── INTRO: Name + what it targets ──
  let intro = tr('audio.nextExercise', { name });
  if (primaryMuscles && primaryMuscles.length > 0) {
    const muscleList = primaryMuscles
      .slice(0, 3)
      .map((m) => m.replace(/_/g, ' '))
      .join(', ');
    intro += ` ${tr('audio.targets', { muscles: muscleList })}`;
  } else if (category) {
    const catLabel = category.replace(/_/g, ' ');
    intro += ` ${tr('audio.categoryLabel', { category: catLabel })}`;
  }

  // ── SETUP: First 1-2 instructions (typically positioning) ──
  let setup: string;
  if (instructions.length >= 2) {
    setup = instructions.slice(0, 2).join('... ') + '.';
  } else if (instructions.length === 1) {
    setup = instructions[0] + '.';
  } else {
    setup = tr('audio.getInPosition', { name });
  }
  setup = setup.replace(/\.+/g, '.').replace(/\.\s*\./g, '.');

  // ── EXECUTION: Remaining instructions (movement cues) ──
  let execution: string;
  if (instructions.length > 2) {
    const execSteps = instructions.slice(2);
    execution = execSteps.join('... ') + '.';
  } else if (instructions.length === 2) {
    execution = instructions[1] + `. ${tr('audio.focusControl')}`;
  } else {
    execution = tr('audio.performControl', { name });
  }
  execution = execution.replace(/\.+/g, '.').replace(/\.\s*\./g, '.');

  // ── TRANSITION: Encouragement + rest + next exercise teaser ──
  let transition = tr('audio.wellDone');
  if (restSeconds > 0) {
    transition += ` ${tr('audio.restFor', { seconds: restSeconds })}`;
  }
  if (nextExerciseName) {
    transition += ` ${tr('audio.upNext', { name: nextExerciseName })}`;
  } else {
    transition += ` ${tr('audio.shakeItOut')}`;
  }

  return { intro, setup, execution, transition };
}

/**
 * Validate audio content meets TTS requirements
 * Relaxed limits for rich narration — TTS handles long text well
 */
export function validateAudioContent(text: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (text.length > 500) {
    issues.push('Text very long (max 500 chars for optimal TTS)');
  }

  const sentences = text.split(/[.!?]+/).filter(Boolean);
  if (sentences.length > 8) {
    issues.push('Many sentences — consider breaking into phases');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
