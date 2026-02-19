/**
 * FitQuest Timer Service
 * Unified timer control for workout sessions
 * 
 * Timer is the authority - UI and Audio subscribe to events.
 * This prevents desync bugs.
 * 
 * Three timer types:
 * - Exercise Timer: Active work tracking
 * - Rest Timer: Auto-starts after set completion
 * - Session Timer: Total workout duration (analytics only)
 */

import { audioService } from './audioService';

// ============================================
// TYPES
// ============================================

export type TimerType = 'exercise' | 'rest' | 'session';

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerEvent {
  type: 'start' | 'tick' | 'finalCountdown' | 'complete' | 'pause' | 'resume';
  timerType: TimerType;
  remainingSeconds: number;
  totalSeconds: number;
  elapsedSeconds: number;
}

type TimerEventListener = (event: TimerEvent) => void;

// ============================================
// TIMER CONFIG
// ============================================

const FINAL_COUNTDOWN_START = 10; // Start countdown cues at 10 seconds
const COUNTDOWN_INTERVALS = [10, 5, 4, 3, 2, 1]; // When to speak

// ============================================
// TIMER CLASS
// ============================================

class Timer {
  private type: TimerType;
  private state: TimerState = 'idle';
  private totalSeconds: number = 0;
  private elapsedSeconds: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Set<TimerEventListener> = new Set();
  private countdownSpoken: Set<number> = new Set();

  constructor(type: TimerType) {
    this.type = type;
  }

  /**
   * Subscribe to timer events
   */
  subscribe(listener: TimerEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(eventType: TimerEvent['type']): void {
    const event: TimerEvent = {
      type: eventType,
      timerType: this.type,
      remainingSeconds: Math.max(0, this.totalSeconds - this.elapsedSeconds),
      totalSeconds: this.totalSeconds,
      elapsedSeconds: this.elapsedSeconds,
    };
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Start the timer
   */
  start(durationSeconds: number): void {
    if (this.state === 'running') return;

    this.totalSeconds = durationSeconds;
    this.elapsedSeconds = 0;
    this.state = 'running';
    this.countdownSpoken.clear();
    
    this.emit('start');

    this.intervalId = setInterval(() => {
      this.elapsedSeconds++;
      this.emit('tick');

      const remaining = this.totalSeconds - this.elapsedSeconds;

      // Handle final countdown
      if (remaining <= FINAL_COUNTDOWN_START && remaining > 0) {
        if (COUNTDOWN_INTERVALS.includes(remaining) && !this.countdownSpoken.has(remaining)) {
          this.countdownSpoken.add(remaining);
          this.emit('finalCountdown');
          
          // Trigger audio countdown
          if (this.type !== 'session') {
            audioService.playCountdown(remaining);
          }
        }
      }

      // Timer complete
      if (remaining <= 0) {
        this.complete();
      }
    }, 1000);
  }

  /**
   * Pause the timer
   */
  pause(): void {
    if (this.state !== 'running') return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state = 'paused';
    this.emit('pause');
  }

  /**
   * Resume the timer
   */
  resume(): void {
    if (this.state !== 'paused') return;

    this.state = 'running';
    this.emit('resume');

    this.intervalId = setInterval(() => {
      this.elapsedSeconds++;
      this.emit('tick');

      const remaining = this.totalSeconds - this.elapsedSeconds;

      if (remaining <= FINAL_COUNTDOWN_START && remaining > 0) {
        if (COUNTDOWN_INTERVALS.includes(remaining) && !this.countdownSpoken.has(remaining)) {
          this.countdownSpoken.add(remaining);
          this.emit('finalCountdown');
          
          if (this.type !== 'session') {
            audioService.playCountdown(remaining);
          }
        }
      }

      if (remaining <= 0) {
        this.complete();
      }
    }, 1000);
  }

  /**
   * Complete the timer
   */
  private complete(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state = 'completed';
    this.emit('complete');
  }

  /**
   * Stop and reset the timer
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state = 'idle';
    this.totalSeconds = 0;
    this.elapsedSeconds = 0;
    this.countdownSpoken.clear();
  }

  /**
   * Add time to a running or paused timer
   */
  addTime(seconds: number): void {
    if (this.state !== 'running' && this.state !== 'paused') return;
    this.totalSeconds += seconds;
    this.emit('tick'); // re-emit so listeners pick up the new total
  }

  /**
   * Skip to completion
   */
  skip(): void {
    this.complete();
  }

  /**
   * Get current state
   */
  getState(): { state: TimerState; remaining: number; elapsed: number; total: number } {
    return {
      state: this.state,
      remaining: Math.max(0, this.totalSeconds - this.elapsedSeconds),
      elapsed: this.elapsedSeconds,
      total: this.totalSeconds,
    };
  }

  /**
   * Check if timer is running
   */
  isRunning(): boolean {
    return this.state === 'running';
  }

  /**
   * Check if timer is paused
   */
  isPaused(): boolean {
    return this.state === 'paused';
  }
}

// ============================================
// TIMER SERVICE CLASS
// ============================================

class TimerService {
  private exerciseTimer: Timer;
  private restTimer: Timer;
  private sessionTimer: Timer;
  private isWorkoutActive: boolean = false;

  constructor() {
    this.exerciseTimer = new Timer('exercise');
    this.restTimer = new Timer('rest');
    this.sessionTimer = new Timer('session');
  }

  /**
   * Get exercise timer
   */
  getExerciseTimer(): Timer {
    return this.exerciseTimer;
  }

  /**
   * Get rest timer
   */
  getRestTimer(): Timer {
    return this.restTimer;
  }

  /**
   * Get session timer
   */
  getSessionTimer(): Timer {
    return this.sessionTimer;
  }

  /**
   * Start a workout session
   */
  startSession(maxDurationMinutes: number = 60): void {
    this.isWorkoutActive = true;
    this.sessionTimer.start(maxDurationMinutes * 60);
  }

  /**
   * End the workout session
   */
  endSession(): { totalMinutes: number } {
    this.isWorkoutActive = false;
    const state = this.sessionTimer.getState();
    const totalMinutes = Math.ceil(state.elapsed / 60);
    
    this.exerciseTimer.stop();
    this.restTimer.stop();
    this.sessionTimer.stop();

    return { totalMinutes };
  }

  /**
   * Start exercise with timer
   */
  startExercise(durationSeconds: number): void {
    this.restTimer.stop(); // Stop any rest timer
    this.exerciseTimer.start(durationSeconds);
  }

  /**
   * Complete exercise and start rest
   */
  completeExerciseAndRest(restSeconds: number): void {
    this.exerciseTimer.stop();
    this.restTimer.start(restSeconds);
  }

  /**
   * Skip rest period
   */
  skipRest(): void {
    this.restTimer.skip();
  }

  /**
   * Extend rest period by adding seconds
   */
  extendRest(seconds: number): void {
    this.restTimer.addTime(seconds);
  }

  /**
   * Pause all timers (e.g., screen lock)
   */
  pauseAll(): void {
    this.exerciseTimer.pause();
    this.restTimer.pause();
    // Session timer keeps running for analytics accuracy
  }

  /**
   * Resume all timers
   */
  resumeAll(): void {
    if (this.exerciseTimer.isPaused()) {
      this.exerciseTimer.resume();
    }
    if (this.restTimer.isPaused()) {
      this.restTimer.resume();
    }
  }

  /**
   * Stop everything
   */
  stopAll(): void {
    this.exerciseTimer.stop();
    this.restTimer.stop();
    this.sessionTimer.stop();
    this.isWorkoutActive = false;
  }

  /**
   * Check if workout is active
   */
  isActive(): boolean {
    return this.isWorkoutActive;
  }

  /**
   * Get all timer states
   */
  getAllStates(): {
    exercise: ReturnType<Timer['getState']>;
    rest: ReturnType<Timer['getState']>;
    session: ReturnType<Timer['getState']>;
  } {
    return {
      exercise: this.exerciseTimer.getState(),
      rest: this.restTimer.getState(),
      session: this.sessionTimer.getState(),
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const timerService = new TimerService();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to human readable
 */
export function formatTimeHuman(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) {
    return `${mins} min`;
  }
  return `${mins}m ${secs}s`;
}
