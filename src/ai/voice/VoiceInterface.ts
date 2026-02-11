/**
 * VoiceInterface — Hands-Free Voice Coaching
 *
 * Provides voice-activated workout coaching:
 *   - STT (Speech-to-Text): via expo-speech-recognition or native APIs
 *   - VAD (Voice Activity Detection): energy + zero-crossing based
 *   - TTS (Text-to-Speech): via expo-speech
 *   - Command parsing: wake word detection + intent extraction
 *
 * Architecture:
 *   1. VAD detects speech segments from audio stream
 *   2. Speech recognition converts to text (platform native or Whisper)
 *   3. Intent router processes command
 *   4. TTS speaks response
 *
 * Fallback: Text-only interface when voice is unavailable.
 */

import * as Speech from 'expo-speech';
import { loadBundledModelWithFallback, safeRequire } from '../ModelLoader';

// ============================================
// TYPES
// ============================================

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'ERROR';

export interface VoiceCommand {
  transcript: string;
  confidence: number;
  intent: string;
  entities: Record<string, string>;
  timestamp: number;
}

export interface VoiceConfig {
  wakeWord?: string;          // default: "hey coach"
  language?: string;          // default: "en-US"
  continuousListening?: boolean;
  speechRate?: number;        // TTS speed 0.5-2.0
  voicePitch?: number;        // TTS pitch 0.5-2.0
  vadSensitivity?: number;    // 0-1
  commandTimeout?: number;    // ms before giving up
}

export interface VoiceEventHandlers {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onCommand?: (command: VoiceCommand) => void;
  onError?: (error: string) => void;
}

// ============================================
// COMMAND PATTERNS
// ============================================

interface CommandPattern {
  intent: string;
  patterns: RegExp[];
  entityExtractors?: Record<string, RegExp>;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    intent: 'START_WORKOUT',
    patterns: [
      /start\s+(?:a\s+)?(?:new\s+)?workout/i,
      /let'?s?\s+(?:go|work\s*out|begin|start)/i,
      /begin\s+(?:a\s+)?(?:new\s+)?(?:workout|session|training)/i,
    ],
  },
  {
    intent: 'NEXT_EXERCISE',
    patterns: [
      /next\s+(?:exercise|one|move)/i,
      /skip/i,
      /move\s+on/i,
      /what'?s?\s+next/i,
    ],
  },
  {
    intent: 'PAUSE',
    patterns: [
      /pause/i,
      /hold\s+on/i,
      /wait/i,
      /take\s+a\s+break/i,
      /stop\s+(?:for\s+)?(?:a\s+)?(?:moment|second|bit)/i,
    ],
  },
  {
    intent: 'RESUME',
    patterns: [
      /resume/i,
      /continue/i,
      /keep\s+going/i,
      /let'?s?\s+continue/i,
      /I'?m?\s+ready/i,
    ],
  },
  {
    intent: 'STOP_WORKOUT',
    patterns: [
      /stop\s+(?:the\s+)?workout/i,
      /end\s+(?:the\s+)?(?:workout|session)/i,
      /finish/i,
      /I'?m?\s+done/i,
      /that'?s?\s+enough/i,
    ],
  },
  {
    intent: 'SET_COMPLETE',
    patterns: [
      /done/i,
      /finished\s+(?:the\s+)?set/i,
      /set\s+(?:complete|done|finished)/i,
      /completed/i,
    ],
  },
  {
    intent: 'FORM_CHECK',
    patterns: [
      /(?:check|how'?s?)\s+(?:my\s+)?form/i,
      /am\s+I\s+doing\s+(?:it|this)\s+(?:right|correctly)/i,
      /(?:correct|proper)\s+form/i,
    ],
  },
  {
    intent: 'REP_COUNT',
    patterns: [
      /how\s+many\s+(?:reps?|repetitions?)/i,
      /(?:rep|repetition)\s+count/i,
      /count\s+(?:my\s+)?reps/i,
    ],
    entityExtractors: {
      count: /(\d+)\s+(?:reps?|repetitions?)/i,
    },
  },
  {
    intent: 'ADJUST_WEIGHT',
    patterns: [
      /(?:increase|decrease|change|adjust)\s+(?:the\s+)?weight/i,
      /(?:more|less)\s+weight/i,
      /(?:heavier|lighter)/i,
    ],
    entityExtractors: {
      direction: /(increase|more|heavier|decrease|less|lighter)/i,
      amount: /(\d+)\s*(?:kg|lbs?|pounds?|kilos?)/i,
    },
  },
  {
    intent: 'REST_TIMER',
    patterns: [
      /(?:set|start)\s+(?:a\s+)?(?:rest\s+)?timer/i,
      /(?:how\s+(?:much|long)\s+)?rest/i,
      /timer\s+for\s+(\d+)/i,
    ],
    entityExtractors: {
      seconds: /(\d+)\s*(?:seconds?|sec|s\b)/i,
      minutes: /(\d+)\s*(?:minutes?|min|m\b)/i,
    },
  },
  {
    intent: 'STATS',
    patterns: [
      /(?:show|tell|give)\s+(?:me\s+)?(?:my\s+)?(?:stats|progress|status)/i,
      /how\s+(?:am\s+I|I'?m?)\s+doing/i,
      /(?:what|how)\s+(?:is|are)\s+(?:my\s+)?(?:stats|numbers)/i,
    ],
  },
  {
    intent: 'ENCOURAGEMENT',
    patterns: [
      /(?:motivate|encourage|cheer)\s+me/i,
      /I\s+(?:can'?t?|need\s+(?:help|motivation))/i,
      /this\s+is\s+(?:hard|tough|difficult)/i,
    ],
  },
];

// ============================================
// TTS COACHING RESPONSES
// ============================================

const COACHING_RESPONSES: Record<string, string[]> = {
  START_WORKOUT: [
    "Let's get it! Your workout is ready. Starting now!",
    "Time to work! First exercise coming up.",
    "Alright, let's crush this workout!",
  ],
  NEXT_EXERCISE: [
    "Moving on to the next exercise.",
    "Great work! Next one up.",
    "Alright, switching to the next exercise.",
  ],
  PAUSE: [
    "Paused. Take your time.",
    "Rest up. Say 'resume' when you're ready.",
    "Taking a break. I'll be here.",
  ],
  RESUME: [
    "Let's go! Picking up where we left off.",
    "Welcome back! Continuing the workout.",
    "Ready to go!",
  ],
  STOP_WORKOUT: [
    "Great workout! You crushed it!",
    "Workout complete. Nice effort today!",
    "That's a wrap! Well done!",
  ],
  SET_COMPLETE: [
    "Set complete! Rest up.",
    "Nice set! Take your rest.",
    "Done! Great form on that one.",
  ],
  ENCOURAGEMENT: [
    "You've got this! Push through!",
    "Almost there, keep going! You're stronger than you think!",
    "Every rep counts. You're making progress!",
    "Pain is temporary, gains are forever! Let's go!",
  ],
};

// ============================================
// VOICE INTERFACE
// ============================================

export class VoiceInterface {
  private static instance: VoiceInterface | null = null;

  private state: VoiceState = 'IDLE';
  private config: Required<VoiceConfig>;
  private handlers: VoiceEventHandlers = {};
  private commandHistory: VoiceCommand[] = [];
  private isSpeaking = false;
  private commandQueue: string[] = [];
  private isLoaded = false;
  private commandModel: any = null;

  // Wake word detection
  private isListeningForWakeWord = false;
  private lastWakeWordTime = 0;
  private readonly WAKE_WORD_WINDOW = 10000; // 10s after wake word

  private constructor() {
    this.config = {
      wakeWord: 'hey coach',
      language: 'en-US',
      continuousListening: false,
      speechRate: 1.0,
      voicePitch: 1.0,
      vadSensitivity: 0.5,
      commandTimeout: 10000,
    };
  }

  static getInstance(): VoiceInterface {
    if (!VoiceInterface.instance) {
      VoiceInterface.instance = new VoiceInterface();
    }
    return VoiceInterface.instance;
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Initialize with v3 command parser model (optional — works without).
   */
  async initialize(): Promise<boolean> {
    try {
      const modelData = await loadBundledModelWithFallback<any>(
        safeRequire(() => require('../../../assets/models/voice_v3.model')),
        'voice_v3.model'
      );
      if (modelData) {
        this.commandModel = modelData;
        console.log(
          `[VoiceInterface] v3 command parser loaded: ${Object.keys(modelData.commands || {}).length} commands`
        );
      }
      this.isLoaded = true;
      return true;
    } catch (error) {
      console.warn('[VoiceInterface] Model load failed (non-critical):', error);
      this.isLoaded = true; // Still functional without model
      return true;
    }
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  configure(config: VoiceConfig): void {
    this.config = { ...this.config, ...config };
  }

  setHandlers(handlers: VoiceEventHandlers): void {
    this.handlers = handlers;
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  private setState(newState: VoiceState): void {
    this.state = newState;
    this.handlers.onStateChange?.(newState);
  }

  getState(): VoiceState {
    return this.state;
  }

  // ============================================
  // TEXT-TO-SPEECH
  // ============================================

  /**
   * Speak a text response using TTS.
   */
  async speak(text: string, options?: { rate?: number; pitch?: number }): Promise<void> {
    if (this.isSpeaking) {
      this.commandQueue.push(text);
      return;
    }

    this.isSpeaking = true;
    this.setState('SPEAKING');

    return new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: this.config.language,
        rate: options?.rate ?? this.config.speechRate,
        pitch: options?.pitch ?? this.config.voicePitch,
        onDone: () => {
          this.isSpeaking = false;
          this.setState('IDLE');
          resolve();

          // Process queue
          if (this.commandQueue.length > 0) {
            const next = this.commandQueue.shift()!;
            this.speak(next);
          }
        },
        onError: () => {
          this.isSpeaking = false;
          this.setState('ERROR');
          resolve();
        },
      });
    });
  }

  /**
   * Stop TTS playback.
   */
  stopSpeaking(): void {
    Speech.stop();
    this.isSpeaking = false;
    this.commandQueue = [];
    this.setState('IDLE');
  }

  /**
   * Speak a coaching response for an intent.
   */
  async speakCoachingResponse(intent: string, customText?: string): Promise<void> {
    const text = customText ?? this.getRandomResponse(intent);
    if (text) {
      await this.speak(text);
    }
  }

  private getRandomResponse(intent: string): string | null {
    const responses = COACHING_RESPONSES[intent];
    if (!responses || responses.length === 0) return null;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ============================================
  // SPEECH-TO-TEXT (processing text input)
  // ============================================

  /**
   * Process a text transcript (from any STT source).
   * Parses commands and routes to appropriate handlers.
   */
  processTranscript(transcript: string): VoiceCommand | null {
    const trimmed = transcript.trim().toLowerCase();
    if (!trimmed) return null;

    this.handlers.onTranscript?.(transcript, true);

    // Check for wake word
    if (this.detectWakeWord(trimmed)) {
      this.lastWakeWordTime = Date.now();
      this.isListeningForWakeWord = true;
      return null;
    }

    // Parse command
    const command = this.parseCommand(trimmed);
    if (command) {
      this.commandHistory.push(command);
      this.handlers.onCommand?.(command);
      return command;
    }

    return null;
  }

  /**
   * Check if the transcript contains the wake word.
   */
  private detectWakeWord(text: string): boolean {
    const wakeWord = this.config.wakeWord.toLowerCase();
    return text.includes(wakeWord);
  }

  /**
   * Parse a voice command from text.
   */
  private parseCommand(text: string): VoiceCommand | null {
    // Check if within wake word window (or continuous mode)
    const isActive = this.config.continuousListening ||
      (Date.now() - this.lastWakeWordTime) < this.WAKE_WORD_WINDOW;

    // Remove wake word from text
    const cleanText = text.replace(
      new RegExp(this.config.wakeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      ''
    ).trim();

    if (!cleanText) return null;

    // Match against patterns
    for (const { intent, patterns, entityExtractors } of COMMAND_PATTERNS) {
      for (const pattern of patterns) {
        const match = cleanText.match(pattern);
        if (match) {
          // Extract entities
          const entities: Record<string, string> = {};
          if (entityExtractors) {
            for (const [key, extractor] of Object.entries(entityExtractors)) {
              const entityMatch = cleanText.match(extractor);
              if (entityMatch) {
                entities[key] = entityMatch[1];
              }
            }
          }

          return {
            transcript: cleanText,
            confidence: isActive ? 0.9 : 0.5,
            intent,
            entities,
            timestamp: Date.now(),
          };
        }
      }
    }

    // No pattern match — return as generic command
    return {
      transcript: cleanText,
      confidence: 0.3,
      intent: 'UNKNOWN',
      entities: {},
      timestamp: Date.now(),
    };
  }

  // ============================================
  // VAD (Voice Activity Detection)
  // ============================================

  /**
   * Simple energy-based VAD for audio samples.
   * Returns true if speech is detected in the audio frame.
   *
   * @param samples - PCM audio samples (normalized -1 to 1)
   * @param sampleRate - Sample rate in Hz
   */
  detectVoiceActivity(samples: Float32Array, sampleRate: number): boolean {
    if (samples.length === 0) return false;

    // Frame energy
    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
      energy += samples[i] * samples[i];
    }
    energy /= samples.length;

    // Zero-crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] > 0 && samples[i - 1] <= 0) ||
          (samples[i] <= 0 && samples[i - 1] > 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / samples.length;

    // Spectral centroid (rough estimate)
    const frameSize = samples.length;
    let weightedSum = 0;
    let totalMag = 0;
    // Simple DFT for a few bins
    const numBins = Math.min(32, Math.floor(frameSize / 2));
    for (let k = 1; k < numBins; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < frameSize; n++) {
        const angle = (2 * Math.PI * k * n) / frameSize;
        real += samples[n] * Math.cos(angle);
        imag -= samples[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(real * real + imag * imag);
      const freq = (k * sampleRate) / frameSize;
      weightedSum += freq * mag;
      totalMag += mag;
    }
    const spectralCentroid = totalMag > 0 ? weightedSum / totalMag : 0;

    // Thresholds (adjusted by sensitivity)
    const sensitivity = this.config.vadSensitivity;
    const energyThreshold = 0.001 * (1 - sensitivity * 0.8);
    const zcrRange = zcr > 0.05 && zcr < 0.3; // speech ZCR range
    const freqRange = spectralCentroid > 300 && spectralCentroid < 3400; // speech band

    return energy > energyThreshold && zcrRange && freqRange;
  }

  // ============================================
  // WORKOUT COACHING
  // ============================================

  /**
   * Announce an exercise (name, sets, reps).
   */
  async announceExercise(
    name: string,
    sets: number,
    reps: number,
    restSeconds: number
  ): Promise<void> {
    const text = `Next exercise: ${name}. ` +
      `${sets} sets of ${reps} reps. ` +
      `${restSeconds} seconds rest between sets.`;
    await this.speak(text);
  }

  /**
   * Announce rest timer countdown.
   */
  async announceRest(seconds: number): Promise<void> {
    if (seconds > 10) {
      await this.speak(`Rest for ${seconds} seconds.`);
    } else if (seconds === 10) {
      await this.speak('Ten seconds!');
    } else if (seconds === 5) {
      await this.speak('Five seconds!');
    } else if (seconds <= 3 && seconds > 0) {
      await this.speak(`${seconds}`);
    } else if (seconds === 0) {
      await this.speak("Time! Let's go!");
    }
  }

  /**
   * Give workout progress update.
   */
  async announceProgress(
    currentExercise: number,
    totalExercises: number,
    currentSet: number,
    totalSets: number
  ): Promise<void> {
    const text = `Exercise ${currentExercise} of ${totalExercises}. ` +
      `Set ${currentSet} of ${totalSets}.`;
    await this.speak(text);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  get isAvailable(): boolean {
    return true; // TTS always available via expo-speech
  }

  getCommandHistory(): VoiceCommand[] {
    return [...this.commandHistory];
  }

  clearHistory(): void {
    this.commandHistory = [];
  }

  getInfo() {
    return {
      state: this.state,
      isSpeaking: this.isSpeaking,
      wakeWord: this.config.wakeWord,
      language: this.config.language,
      commandsProcessed: this.commandHistory.length,
      continuousListening: this.config.continuousListening,
      queueSize: this.commandQueue.length,
    };
  }
}

export const voiceInterface = VoiceInterface.getInstance();
