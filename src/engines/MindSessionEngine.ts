/**
 * MindSessionEngine
 * 
 * Generates guided meditation timelines for focus/mindfulness exercises.
 * Each mind exercise gets a structured timeline of phases:
 *   intro → guided → silence → guided → closing
 * 
 * Unlike physical exercises (reps, sets, rest), mind exercises use:
 *   - Timed narration blocks (TTS speaks guidance)
 *   - Silence periods (the actual practice)
 *   - Bell cues (transition markers)
 *   - Breathing guides (visual pacing)
 * 
 * The engine determines:
 *   1. How long each phase lasts
 *   2. What narration text to speak
 *   3. When to ring bells vs stay silent
 *   4. What breathing pattern to display (if any)
 */

// ============================================
// TYPES
// ============================================

export type MindPhaseType = 'intro' | 'guided' | 'silence' | 'breathing' | 'closing';

export interface BreathingPattern {
  /** Name for display */
  name: string;
  /** Inhale duration in seconds */
  inhale: number;
  /** Hold after inhale in seconds (0 = no hold) */
  holdIn: number;
  /** Exhale duration in seconds */
  exhale: number;
  /** Hold after exhale in seconds (0 = no hold) */
  holdOut: number;
  /** Number of cycles (0 = continuous for duration) */
  cycles: number;
}

export interface MindPhase {
  type: MindPhaseType;
  /** Duration of this phase in seconds */
  duration: number;
  /** Narration text for TTS (null = silence) */
  narration: string | null;
  /** Play a bell/chime at the start of this phase */
  bellAtStart: boolean;
  /** Play a bell/chime at the end of this phase */
  bellAtEnd: boolean;
  /** Breathing pattern to display during this phase (null = no visual guide) */
  breathing: BreathingPattern | null;
  /** Label shown on screen during this phase */
  label: string;
}

export interface MindTimeline {
  /** Total session duration in seconds */
  totalDuration: number;
  /** Ordered list of phases */
  phases: MindPhase[];
  /** Exercise archetype for UI styling */
  archetype: MindArchetype;
  /** Short description shown at session start */
  intention: string;
}

export type MindArchetype = 
  | 'breathing'      // Box, 4-7-8, 5-5-5, diaphragmatic, alternate nostril, extended exhale
  | 'meditation'     // Seated, walking, loving-kindness, gratitude, visualization
  | 'body_awareness' // Body scan, PMR, yoga nidra, mindful movement
  | 'grounding';     // Grounding 5-4-3-2-1, bilateral tapping, tension shake, cold exposure

// ============================================
// BREATHING PRESETS
// ============================================

const BREATHING_PATTERNS: Record<string, BreathingPattern> = {
  box:        { name: 'Box Breathing',   inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, cycles: 0 },
  '4-7-8':    { name: '4-7-8 Breathing', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0, cycles: 0 },
  '5-5-5':    { name: '5-5-5 Breathing', inhale: 5, holdIn: 5, exhale: 5, holdOut: 0, cycles: 0 },
  diaphragm:  { name: 'Belly Breathing', inhale: 4, holdIn: 0, exhale: 6, holdOut: 0, cycles: 0 },
  extended:   { name: 'Extended Exhale', inhale: 3, holdIn: 0, exhale: 7, holdOut: 0, cycles: 0 },
  alternate:  { name: 'Alternate Nostril', inhale: 4, holdIn: 4, exhale: 4, holdOut: 0, cycles: 0 },
  natural:    { name: 'Natural Breath',  inhale: 4, holdIn: 0, exhale: 4, holdOut: 0, cycles: 0 },
  settling:   { name: 'Settling Breath', inhale: 4, holdIn: 2, exhale: 6, holdOut: 0, cycles: 3 },
  power:      { name: 'Power Breath',    inhale: 2, holdIn: 0, exhale: 2, holdOut: 0, cycles: 0 },
};

// ============================================
// EXERCISE → ARCHETYPE MAPPING
// ============================================

function getArchetype(exerciseName: string): MindArchetype {
  const name = exerciseName.toLowerCase();
  
  if (name.includes('breathing') || name.includes('breath') || name.includes('nostril') || name.includes('exhale')) {
    return 'breathing';
  }
  if (name.includes('body scan') || name.includes('yoga nidra') || name.includes('progressive muscle') || name.includes('mindful movement')) {
    return 'body_awareness';
  }
  if (name.includes('grounding') || name.includes('tapping') || name.includes('shake') || name.includes('cold exposure')) {
    return 'grounding';
  }
  return 'meditation';
}

// ============================================
// TIMELINE GENERATORS
// ============================================

/** Generate timeline for breathing exercises (box, 4-7-8, 5-5-5, etc.) */
function generateBreathingTimeline(exerciseName: string, totalSeconds: number): MindTimeline {
  const name = exerciseName.toLowerCase();
  
  // Pick the right breathing pattern
  let pattern: BreathingPattern;
  if (name.includes('box'))              pattern = BREATHING_PATTERNS.box!;
  else if (name.includes('4-7-8'))       pattern = BREATHING_PATTERNS['4-7-8']!;
  else if (name.includes('5-5-5'))       pattern = BREATHING_PATTERNS['5-5-5']!;
  else if (name.includes('diaphragm'))   pattern = BREATHING_PATTERNS.diaphragm!;
  else if (name.includes('extended'))    pattern = BREATHING_PATTERNS.extended!;
  else if (name.includes('alternate'))   pattern = BREATHING_PATTERNS.alternate!;
  else if (name.includes('power'))       pattern = BREATHING_PATTERNS.power!;
  else                                   pattern = BREATHING_PATTERNS.natural!;

  const cycleTime = pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut;
  const introDuration = Math.min(15, Math.floor(totalSeconds * 0.12));
  const closingDuration = Math.min(12, Math.floor(totalSeconds * 0.1));
  const coreDuration = totalSeconds - introDuration - closingDuration;

  // Calculate how many cycles fit in the core
  const fullCycles = Math.floor(coreDuration / cycleTime);

  const intention = getBreathingIntention(exerciseName);

  const phases: MindPhase[] = [
    // Intro: position + explain
    {
      type: 'intro',
      duration: introDuration,
      narration: `${exerciseName}. ${intention} Find a comfortable position. Let your body settle.`,
      bellAtStart: true,
      bellAtEnd: false,
      breathing: null,
      label: 'Prepare',
    },
    // Core: guided breathing with visual
    {
      type: 'breathing',
      duration: coreDuration,
      narration: generateBreathingNarration(pattern, fullCycles),
      bellAtStart: false,
      bellAtEnd: false,
      breathing: { ...pattern, cycles: fullCycles },
      label: pattern.name,
    },
    // Closing: return to natural breath
    {
      type: 'closing',
      duration: closingDuration,
      narration: 'Return to your natural breathing. Notice how you feel. Well done.',
      bellAtStart: false,
      bellAtEnd: true,
      breathing: null,
      label: 'Complete',
    },
  ];

  return { totalDuration: totalSeconds, phases, archetype: 'breathing', intention };
}

/** Generate timeline for meditation exercises (seated, loving-kindness, visualization, etc.) */
function generateMeditationTimeline(exerciseName: string, totalSeconds: number): MindTimeline {
  const name = exerciseName.toLowerCase();
  const introDuration = Math.min(20, Math.floor(totalSeconds * 0.15));
  const closingDuration = Math.min(15, Math.floor(totalSeconds * 0.12));
  const coreDuration = totalSeconds - introDuration - closingDuration;

  // Split core into guided + silence blocks
  // For short sessions: 60/40 guided/silence
  // For long sessions: 40/60 guided/silence (more silence = deeper practice)
  const silenceRatio = totalSeconds >= 180 ? 0.55 : 0.35;
  const silenceDuration = Math.floor(coreDuration * silenceRatio);
  const guidedDuration = coreDuration - silenceDuration;

  const intention = getMeditationIntention(exerciseName);
  const guidance = getMeditationGuidance(exerciseName);

  const phases: MindPhase[] = [
    {
      type: 'intro',
      duration: introDuration,
      narration: `${exerciseName}. ${intention} Sit comfortably. Close your eyes when ready.`,
      bellAtStart: true,
      bellAtEnd: false,
      breathing: BREATHING_PATTERNS.settling ?? null,
      label: 'Settle In',
    },
    {
      type: 'guided',
      duration: guidedDuration,
      narration: guidance,
      bellAtStart: false,
      bellAtEnd: false,
      breathing: BREATHING_PATTERNS.natural ?? null,
      label: 'Guided Practice',
    },
    {
      type: 'silence',
      duration: silenceDuration,
      narration: null,
      bellAtStart: true,
      bellAtEnd: true,
      breathing: null,
      label: 'Silent Practice',
    },
    {
      type: 'closing',
      duration: closingDuration,
      narration: 'Gently deepen your breath. Wiggle your fingers and toes. When you are ready, slowly open your eyes. Carry this stillness with you.',
      bellAtStart: true,
      bellAtEnd: true,
      breathing: null,
      label: 'Return',
    },
  ];

  return { totalDuration: totalSeconds, phases, archetype: 'meditation', intention };
}

/** Generate timeline for body awareness exercises (body scan, PMR, yoga nidra) */
function generateBodyAwarenessTimeline(exerciseName: string, totalSeconds: number): MindTimeline {
  const name = exerciseName.toLowerCase();
  const introDuration = Math.min(20, Math.floor(totalSeconds * 0.12));
  const closingDuration = Math.min(15, Math.floor(totalSeconds * 0.1));
  const coreDuration = totalSeconds - introDuration - closingDuration;

  const intention = getBodyAwarenessIntention(exerciseName);

  // Body awareness exercises are mostly guided with short silence intervals
  const guidedDuration = Math.floor(coreDuration * 0.7);
  const silenceDuration = coreDuration - guidedDuration;

  const guidance = getBodyAwarenessGuidance(exerciseName, guidedDuration);

  const phases: MindPhase[] = [
    {
      type: 'intro',
      duration: introDuration,
      narration: `${exerciseName}. ${intention} Lie on your back. Arms at your sides, palms up. Let your body be fully supported.`,
      bellAtStart: true,
      bellAtEnd: false,
      breathing: BREATHING_PATTERNS.settling ?? null,
      label: 'Prepare',
    },
    {
      type: 'guided',
      duration: guidedDuration,
      narration: guidance,
      bellAtStart: false,
      bellAtEnd: false,
      breathing: null,
      label: 'Guided Awareness',
    },
    {
      type: 'silence',
      duration: silenceDuration,
      narration: null,
      bellAtStart: true,
      bellAtEnd: true,
      breathing: null,
      label: 'Integration',
    },
    {
      type: 'closing',
      duration: closingDuration,
      narration: 'Begin to deepen your breath. Gently press your fingers and toes. When ready, slowly roll to one side and press yourself up. Notice how your body feels.',
      bellAtStart: false,
      bellAtEnd: true,
      breathing: null,
      label: 'Awaken',
    },
  ];

  return { totalDuration: totalSeconds, phases, archetype: 'body_awareness', intention };
}

/** Generate timeline for grounding exercises (5-4-3-2-1, tapping, shake, cold exposure) */
function generateGroundingTimeline(exerciseName: string, totalSeconds: number): MindTimeline {
  const introDuration = Math.min(12, Math.floor(totalSeconds * 0.12));
  const closingDuration = Math.min(10, Math.floor(totalSeconds * 0.1));
  const coreDuration = totalSeconds - introDuration - closingDuration;

  const intention = getGroundingIntention(exerciseName);
  const guidance = getGroundingGuidance(exerciseName);

  // Grounding is mostly guided — minimal silence
  const phases: MindPhase[] = [
    {
      type: 'intro',
      duration: introDuration,
      narration: `${exerciseName}. ${intention}`,
      bellAtStart: true,
      bellAtEnd: false,
      breathing: null,
      label: 'Begin',
    },
    {
      type: 'guided',
      duration: coreDuration,
      narration: guidance,
      bellAtStart: false,
      bellAtEnd: false,
      breathing: null,
      label: 'Practice',
    },
    {
      type: 'closing',
      duration: closingDuration,
      narration: 'Take a deep breath. Notice how you feel. You are grounded.',
      bellAtStart: false,
      bellAtEnd: true,
      breathing: null,
      label: 'Complete',
    },
  ];

  return { totalDuration: totalSeconds, phases, archetype: 'grounding', intention };
}

// ============================================
// NARRATION TEXT GENERATORS
// ============================================

function generateBreathingNarration(pattern: BreathingPattern, cycles: number): string {
  const parts: string[] = [];
  
  parts.push(`Let us begin. Follow the rhythm on screen.`);
  
  // First cycle is always narrated for guidance
  parts.push(`Inhale ${inWords(pattern.inhale)}.`);
  if (pattern.holdIn > 0) parts.push(`Hold ${inWords(pattern.holdIn)}.`);
  parts.push(`Exhale ${inWords(pattern.exhale)}.`);
  if (pattern.holdOut > 0) parts.push(`Hold ${inWords(pattern.holdOut)}.`);
  
  // Middle cycles: let the visual guide take over
  if (cycles > 3) {
    parts.push('Continue following the guide. Let your breathing become effortless.');
  }
  
  // Final cycle reminder
  if (cycles > 1) {
    parts.push('Last cycle now. Deep inhale. And release.');
  }
  
  return parts.join(' ');
}

function inWords(seconds: number): string {
  const counts: Record<number, string> = {
    2: 'for 2 counts',
    3: 'for 3 counts',
    4: 'for 4 counts',
    5: 'for 5 counts',
    6: 'for 6 counts',
    7: 'for 7 counts',
    8: 'for 8 counts',
  };
  return counts[seconds] || `for ${seconds} seconds`;
}

function getBreathingIntention(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('box'))            return 'This technique calms the nervous system and sharpens focus.';
  if (n.includes('4-7-8'))         return 'This pattern activates deep relaxation. Perfect before sleep.';
  if (n.includes('5-5-5'))         return 'Balanced breathing to centre your mind.';
  if (n.includes('diaphragm'))     return 'Belly breathing strengthens your diaphragm and reduces stress.';
  if (n.includes('extended'))      return 'Longer exhales activate the parasympathetic nervous system.';
  if (n.includes('alternate'))     return 'Balancing breath between nostrils harmonises the mind.';
  if (n.includes('cold') || n.includes('power')) return 'Controlled hyperventilation followed by breath holds builds mental resilience.';
  return 'Conscious breathing resets your autonomic nervous system.';
}

function getMeditationIntention(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('loving') || n.includes('kindness')) return 'Cultivate compassion for yourself and others.';
  if (n.includes('gratitude'))     return 'Training the mind to notice what is already good.';
  if (n.includes('visualization') || n.includes('visuali')) return 'The mind cannot distinguish a vivid image from reality. Use this power.';
  if (n.includes('walking'))       return 'Bringing full awareness to every single step.';
  if (n.includes('laughing'))      return 'Laughter releases endorphins and shifts your state instantly.';
  return 'Simply being present. No goal, no effort. Just awareness.';
}

function getMeditationGuidance(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('loving') || n.includes('kindness')) {
    return 'Silently repeat these phrases. May I be happy. May I be healthy. May I be safe. Now extend these wishes to someone you love. May they be happy. May they be healthy. May they be safe. Now extend this warmth to all beings everywhere.';
  }
  if (n.includes('gratitude')) {
    return 'Think of three things you are grateful for right now. They can be simple. Feel the gratitude in your chest. Let it grow with each breath. Hold each one in your heart for a moment.';
  }
  if (n.includes('visualization')) {
    return 'Imagine a place of complete peace. See the colours around you. Hear the sounds. Feel the temperature on your skin. Let every sense engage. You are fully present in this place of calm.';
  }
  if (n.includes('walking')) {
    return 'Begin walking very slowly. Feel your heel touch the ground. The ball of your foot. Your toes press gently. Lift. Move forward. Place heel again. Each step is complete awareness.';
  }
  return 'Focus on the natural rhythm of your breath. Notice the air entering your nostrils. The rise and fall of your chest. When your mind wanders — and it will — simply notice, and gently return to the breath. No judgment. Just coming back.';
}

function getBodyAwarenessIntention(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('body scan'))     return 'Scanning your body from toes to crown, releasing tension layer by layer.';
  if (n.includes('yoga nidra'))    return 'Yoga Nidra — the yoga of conscious sleep. Deep restoration while awake.';
  if (n.includes('progressive'))   return 'Tense and release each muscle group to find true relaxation.';
  if (n.includes('mindful move')) return 'Moving with total awareness. Every sensation noticed.';
  return 'Bringing awareness to the body exactly as it is right now.';
}

function getBodyAwarenessGuidance(name: string, durationSecs: number): string {
  const n = name.toLowerCase();
  if (n.includes('body scan')) {
    return 'Bring your awareness to your toes. Notice any sensations. No need to change anything, just notice. As you exhale, release any tension. Now move to your feet. Your ankles. Your calves. Notice without judgment. Moving up through your thighs, your hips. Feel the weight of your body. Continue up through your belly, your chest. Each breath bringing deeper awareness. Your shoulders, your arms, your hands. Your neck, your jaw. Let your face soften. The crown of your head. Now feel your whole body as one field of awareness.';
  }
  if (n.includes('yoga nidra')) {
    return 'Set a personal intention — a resolve in the present tense. Hold it clearly. Now we rotate awareness through the body. Feel your right hand. Your right arm. Your right shoulder. Your right hip. Your right leg. Your right foot. Now the left hand. Left arm. Left shoulder. Left hip. Left leg. Left foot. Feel your back against the surface. Your chest. Your whole body as the witness. Imagine golden light filling your entire being.';
  }
  if (n.includes('progressive')) {
    return 'Tense your feet hard for 5 seconds. Now release. Feel the contrast. Tense your calves. Hold. Release. Your thighs. Squeeze. Release. Your abdomen. Hold tight. Let go. Make fists with your hands. Squeeze. Release. Tense your shoulders up to your ears. Hold. Drop them. Scrunch your face tightly. Release. Feel complete relaxation flowing through your body.';
  }
  if (n.includes('mindful move')) {
    return 'Stand tall with feet hip-width apart. Very slowly raise your arms out to the sides. Notice every sensation in your muscles. The weight of your arms. The stretch across your chest. Pause at the top. Now lower with equal attention. Feel gravity guiding you down. Repeat, discovering new sensations each time.';
  }
  return 'Bring awareness to each part of your body, one region at a time. Notice without judgment. Release tension with each exhale.';
}

function getGroundingIntention(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('5-4-3-2-1') || n.includes('grounding')) return 'Anchoring to the present moment through your five senses.';
  if (n.includes('tapping'))       return 'Bilateral stimulation calms the amygdala and reduces anxiety.';
  if (n.includes('shake'))         return 'Shaking releases stored stress from the body, like animals do in the wild.';
  if (n.includes('cold'))          return 'Mental fortitude through controlled breathing under challenge.';
  return 'Coming back to the here and now.';
}

function getGroundingGuidance(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('5-4-3-2-1') || n.includes('grounding')) {
    return 'Take a deep breath. Now notice 5 things you can see. Name them quietly. Notice 4 things you can touch. Feel them. 3 things you can hear. Listen. 2 things you can smell. And 1 thing you can taste. You are here. You are present. You are safe.';
  }
  if (n.includes('tapping')) {
    return 'Cross your arms over your chest. Begin tapping your left shoulder with your right hand, then your right shoulder with your left hand. Find a steady rhythm like a heartbeat. Close your eyes. Let the bilateral stimulation calm your mind. Continue at this gentle pace.';
  }
  if (n.includes('shake')) {
    return 'Start shaking your hands. Now your arms. Let the shaking spread to your shoulders. Your torso. Your legs are bouncing now. Shake your entire body vigorously. Let go of everything. Keep shaking. And now, suddenly stop. Stand completely still. Notice the tingling energy throughout your body. This is aliveness.';
  }
  if (n.includes('cold')) {
    return 'Take 30 deep power breaths. Fully in, let go. Again. And again. Keep going. On the last exhale, hold your breath as long as you comfortably can. Do not strain. When you need to breathe, inhale deeply and hold for 15 seconds. Release. Take a recovery breath. You just showed your body who is in charge.';
  }
  return 'Ground yourself in the present moment. Feel your feet on the floor. The weight of your body. The air around you.';
}

// ============================================
// PUBLIC API
// ============================================

/** Check if an exercise is a mind exercise based on its category */
export function isMindExercise(category: string): boolean {
  return category === 'focus';
}

/**
 * Generate a guided meditation timeline for a mind exercise.
 * 
 * @param exerciseName - The exercise name (e.g., "Box Breathing", "Body Scan Meditation")
 * @param category - Exercise category (should be 'focus')
 * @param durationSeconds - Total session duration 
 * @returns MindTimeline with phases, narration, bells, and breathing patterns
 */
export function generateMindTimeline(
  exerciseName: string,
  category: string,
  durationSeconds: number,
): MindTimeline {
  // Ensure minimum duration for meaningful practice
  const duration = Math.max(60, durationSeconds);
  
  const archetype = getArchetype(exerciseName);
  
  switch (archetype) {
    case 'breathing':
      return generateBreathingTimeline(exerciseName, duration);
    case 'meditation':
      return generateMeditationTimeline(exerciseName, duration);
    case 'body_awareness':
      return generateBodyAwarenessTimeline(exerciseName, duration);
    case 'grounding':
      return generateGroundingTimeline(exerciseName, duration);
  }
}

/**
 * Get the recommended session duration for a mind exercise.
 * Mind exercises don't use reps/sets — they use time.
 */
export function getMindDuration(
  exerciseName: string,
  experience: 'beginner' | 'intermediate' | 'advanced',
): number {
  const archetype = getArchetype(exerciseName);
  
  const durations: Record<MindArchetype, Record<string, number>> = {
    breathing: {
      beginner: 120,     // 2 min
      intermediate: 180, // 3 min
      advanced: 300,     // 5 min
    },
    meditation: {
      beginner: 180,     // 3 min
      intermediate: 300, // 5 min
      advanced: 600,     // 10 min
    },
    body_awareness: {
      beginner: 180,     // 3 min
      intermediate: 300, // 5 min
      advanced: 600,     // 10 min
    },
    grounding: {
      beginner: 90,      // 1.5 min
      intermediate: 120, // 2 min
      advanced: 180,     // 3 min
    },
  };

  return durations[archetype][experience] || 180;
}

/** Format duration as human-readable (e.g., "3 min", "1:30") */
export function formatMindDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins} min`;
}
