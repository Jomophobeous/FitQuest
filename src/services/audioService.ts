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
import {
  createAudioSettingsRow,
  getAudioSettingsRow,
  updateAudioSettingsRow,
} from '../database/service';

// ============================================
// TYPES
// ============================================

export interface AudioSettings {
  voiceEnabled: boolean;
  speechRate: 0.8 | 1.0 | 1.2;
  countdownCuesEnabled: boolean;
}

export interface ExerciseAudio {
  intro: string;      // "Next exercise: Push-ups"
  setup: string;      // "Hands under shoulders. Body straight."
  execution: string;  // "Lower under control. Push explosively."
  transition: string; // "Rest for 30 seconds."
}

type AudioEventType = 
  | 'intro' 
  | 'setup' 
  | 'execution' 
  | 'transition' 
  | 'countdown' 
  | 'complete';

type AudioEventListener = (event: AudioEventType, text?: string) => void;

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_SETTINGS: AudioSettings = {
  voiceEnabled: true,
  speechRate: 1.0,
  countdownCuesEnabled: true,
};

// ============================================
// AUDIO SERVICE CLASS
// ============================================

class AudioService {
  private settings: AudioSettings = DEFAULT_SETTINGS;
  private isSpeaking: boolean = false;
  private queue: { text: string; type: AudioEventType }[] = [];
  private listeners: Set<AudioEventListener> = new Set();
  private isInitialized: boolean = false;

  /**
   * Initialize audio service with user settings
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      const result = await getAudioSettingsRow(userId);

      if (result) {
        this.settings = {
          voiceEnabled: result.voice_enabled === 1,
          speechRate: result.speech_rate as 0.8 | 1.0 | 1.2,
          countdownCuesEnabled: result.countdown_cues_enabled === 1,
        };
      } else {
        // Create default settings
        await createAudioSettingsRow({
          userId,
          voiceEnabled: true,
          speechRate: 1.0,
          countdownCuesEnabled: true,
        });
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('[AudioService] Initialization failed:', error);
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
      console.error('[AudioService] Failed to save settings:', error);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
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
    this.listeners.forEach(listener => listener(event, text));
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
   * Speak text with TTS
   */
  private async speak(text: string, type: AudioEventType): Promise<void> {
    if (!this.settings.voiceEnabled || !text) {
      this.emit(type, text);
      return;
    }

    return new Promise((resolve) => {
      this.isSpeaking = true;
      this.emit(type, text);

      Speech.speak(text, {
        rate: this.settings.speechRate,
        pitch: 1.0,
        language: 'en-US',
        onDone: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: (error: { message?: string }) => {
          console.warn('[AudioService] Speech error:', error);
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
   * Process speech queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isSpeaking || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (item) {
      await this.speak(item.text, item.type);
      await this.processQueue();
    }
  }

  /**
   * Play exercise intro
   */
  async playIntro(audio: ExerciseAudio): Promise<void> {
    await this.queueSpeak(audio.intro, 'intro');
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
    
    const text = seconds === 1 ? 'One' : `${seconds}`;
    await this.queueSpeak(text, 'countdown');
  }

  /**
   * Play completion cue
   */
  async playComplete(): Promise<void> {
    await this.queueSpeak('Exercise complete', 'complete');
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
      await this.queueSpeak('Ding!', 'complete');
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
      ? `Done! Up next: ${nextExerciseName}`
      : 'Exercise complete!';
    await this.queueSpeak(message, 'complete');
  }

  /**
   * Play workout complete celebration
   */
  async playWorkoutComplete(): Promise<void> {
    // Triple vibration
    Vibration.vibrate([0, 100, 80, 100, 80, 200]);
    await this.queueSpeak('Workout complete! Great job!', 'complete');
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
   * Stop all audio immediately
   */
  stop(): void {
    Speech.stop();
    this.queue = [];
    this.isSpeaking = false;
  }

  /**
   * Pause audio (for screen lock, headphone disconnect)
   */
  pause(): void {
    // expo-speech doesn't have pause, so we stop and clear queue
    Speech.stop();
    this.queue = [];
    this.isSpeaking = false;
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
// HELPER FUNCTIONS
// ============================================

/**
 * Generate default audio instructions from exercise name
 * Used when exercise doesn't have custom audio
 */
export function generateDefaultAudio(exerciseName: string, restSeconds: number = 30): ExerciseAudio {
  return {
    intro: `Next exercise: ${exerciseName}`,
    setup: 'Get into position',
    execution: 'Begin the movement',
    transition: `Rest for ${restSeconds} seconds`,
  };
}

/**
 * Validate audio content meets TTS requirements
 */
export function validateAudioContent(text: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (text.length > 100) {
    issues.push('Text too long (max 100 chars)');
  }
  
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  if (sentences.length > 2) {
    issues.push('More than 2 sentences');
  }
  
  if (text.includes(',') && text.split(',').length > 3) {
    issues.push('Too many commas (affects TTS cadence)');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
