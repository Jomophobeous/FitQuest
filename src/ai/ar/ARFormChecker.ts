/**
 * ARFormChecker — Pose Estimation & Exercise Form Analysis
 *
 * v3: Loads exercise form rules from bundled model for 8 exercises.
 * Analyzes body pose from camera frames to detect form issues.
 *
 * Architecture:
 *   1. Pose estimation: MoveNet-compatible keypoint detection
 *   2. Joint angle computation from keypoints
 *   3. Exercise-specific form rules (from v3 model or built-in)
 *   4. Real-time feedback generation
 *
 * Uses pre-processed keypoint data (actual pose detection runs via
 * TFLite/CoreML native module — this module handles the analysis).
 */

import { loadBundledModelWithFallback, safeRequire } from '../ModelLoader';

// ============================================
// TYPES
// ============================================

/** MoveNet-compatible 17-keypoint format */
export interface Keypoint {
  x: number;      // 0-1 normalized
  y: number;      // 0-1 normalized
  score: number;  // confidence 0-1
  name: string;
}

export interface Pose {
  keypoints: Keypoint[];
  score: number;  // overall confidence
  timestamp: number;
}

export type ExerciseType =
  | 'squat' | 'deadlift' | 'bench_press' | 'push_up'
  | 'plank' | 'lunge' | 'row' | 'overhead_press';

export interface FormFeedback {
  overallScore: number;         // 0-100
  issues: FormIssue[];
  phase: ExercisePhase;
  repCount: number;
  currentAngles: Record<string, number>;
  timestamp: number;
}

export interface FormIssue {
  severity: 'info' | 'warning' | 'critical';
  bodyPart: string;
  message: string;
  angle: number;
  idealRange: [number, number];
  correction: string;
}

export type ExercisePhase = 'setup' | 'eccentric' | 'bottom' | 'concentric' | 'lockout' | 'hold';

// Keypoint indices (MoveNet/COCO format)
const KP = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

// ============================================
// FORM RULES PER EXERCISE
// ============================================

interface FormRule {
  bodyPart: string;
  jointIndices: [number, number, number]; // vertex in the middle
  idealRange: [number, number];           // degrees
  message: string;
  correction: string;
  severity: 'warning' | 'critical';
  phases: ExercisePhase[];
}

const EXERCISE_RULES: Record<ExerciseType, FormRule[]> = {
  squat: [
    {
      bodyPart: 'Knee',
      jointIndices: [KP.LEFT_HIP, KP.LEFT_KNEE, KP.LEFT_ANKLE],
      idealRange: [70, 110],
      message: 'Knee angle too shallow or too deep',
      correction: 'Aim for parallel — thighs parallel to ground at bottom',
      severity: 'warning',
      phases: ['bottom'],
    },
    {
      bodyPart: 'Back',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_KNEE],
      idealRange: [40, 80],
      message: 'Excessive forward lean',
      correction: 'Keep chest up and core braced. Think "proud chest".',
      severity: 'critical',
      phases: ['eccentric', 'bottom', 'concentric'],
    },
    {
      bodyPart: 'Knee Tracking',
      jointIndices: [KP.LEFT_HIP, KP.LEFT_KNEE, KP.LEFT_ANKLE],
      idealRange: [160, 180],
      message: 'Knees caving inward',
      correction: 'Push knees out over toes. Think "spread the floor".',
      severity: 'critical',
      phases: ['eccentric', 'bottom', 'concentric'],
    },
  ],
  deadlift: [
    {
      bodyPart: 'Back',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_KNEE],
      idealRange: [30, 60],
      message: 'Back rounding detected',
      correction: 'Maintain neutral spine. Brace core and pull shoulders back.',
      severity: 'critical',
      phases: ['eccentric', 'bottom', 'concentric'],
    },
    {
      bodyPart: 'Hip Hinge',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_ANKLE],
      idealRange: [60, 120],
      message: 'Not hinging at hips properly',
      correction: 'Push hips back like closing a car door with your butt.',
      severity: 'warning',
      phases: ['eccentric', 'bottom'],
    },
    {
      bodyPart: 'Lockout',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_KNEE],
      idealRange: [165, 180],
      message: 'Incomplete lockout',
      correction: 'Stand tall. Squeeze glutes at the top.',
      severity: 'warning',
      phases: ['lockout'],
    },
  ],
  bench_press: [
    {
      bodyPart: 'Elbow',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_ELBOW, KP.LEFT_WRIST],
      idealRange: [75, 100],
      message: 'Elbow flare too wide',
      correction: 'Tuck elbows to about 45-75 degrees from torso.',
      severity: 'warning',
      phases: ['eccentric', 'bottom'],
    },
    {
      bodyPart: 'Wrist',
      jointIndices: [KP.LEFT_ELBOW, KP.LEFT_WRIST, KP.LEFT_SHOULDER],
      idealRange: [160, 180],
      message: 'Wrist bending back',
      correction: 'Stack wrists directly over elbows. Grip tight.',
      severity: 'warning',
      phases: ['eccentric', 'bottom', 'concentric'],
    },
  ],
  push_up: [
    {
      bodyPart: 'Body Line',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_ANKLE],
      idealRange: [160, 180],
      message: 'Hips sagging or piking',
      correction: 'Keep body in a straight line from head to heels. Squeeze core.',
      severity: 'critical',
      phases: ['eccentric', 'bottom', 'concentric', 'lockout'],
    },
    {
      bodyPart: 'Elbow',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_ELBOW, KP.LEFT_WRIST],
      idealRange: [80, 100],
      message: 'Arms not reaching full depth',
      correction: 'Lower until chest nearly touches ground. Full range of motion.',
      severity: 'warning',
      phases: ['bottom'],
    },
  ],
  plank: [
    {
      bodyPart: 'Body Line',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_ANKLE],
      idealRange: [165, 180],
      message: 'Hips too high or too low',
      correction: 'Maintain a straight line. Imagine a glass of water on your back.',
      severity: 'critical',
      phases: ['hold'],
    },
    {
      bodyPart: 'Head Position',
      jointIndices: [KP.NOSE, KP.LEFT_SHOULDER, KP.LEFT_HIP],
      idealRange: [150, 180],
      message: 'Head dropping or looking up',
      correction: 'Look at the floor about a foot ahead. Neutral neck.',
      severity: 'warning',
      phases: ['hold'],
    },
  ],
  lunge: [
    {
      bodyPart: 'Front Knee',
      jointIndices: [KP.LEFT_HIP, KP.LEFT_KNEE, KP.LEFT_ANKLE],
      idealRange: [80, 100],
      message: 'Front knee past toes or too shallow',
      correction: 'Step far enough that knee stays over ankle at bottom.',
      severity: 'warning',
      phases: ['bottom'],
    },
    {
      bodyPart: 'Torso',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_KNEE],
      idealRange: [80, 100],
      message: 'Leaning forward too much',
      correction: 'Stay upright. Core braced, chest proud.',
      severity: 'warning',
      phases: ['eccentric', 'bottom', 'concentric'],
    },
  ],
  row: [
    {
      bodyPart: 'Back',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_KNEE],
      idealRange: [35, 55],
      message: 'Back angle incorrect',
      correction: 'Hinge at hips. Keep back flat at about 45 degrees.',
      severity: 'warning',
      phases: ['eccentric', 'concentric'],
    },
    {
      bodyPart: 'Elbow',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_ELBOW, KP.LEFT_WRIST],
      idealRange: [20, 50],
      message: 'Not pulling elbows back enough',
      correction: 'Drive elbows past torso. Squeeze shoulder blades together.',
      severity: 'warning',
      phases: ['concentric'],
    },
  ],
  overhead_press: [
    {
      bodyPart: 'Lockout',
      jointIndices: [KP.LEFT_ELBOW, KP.LEFT_SHOULDER, KP.LEFT_HIP],
      idealRange: [165, 180],
      message: 'Incomplete lockout overhead',
      correction: 'Press until arms are fully extended. Biceps by ears.',
      severity: 'warning',
      phases: ['lockout'],
    },
    {
      bodyPart: 'Core',
      jointIndices: [KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_ANKLE],
      idealRange: [170, 180],
      message: 'Excessive back arch',
      correction: 'Brace core hard. Squeeze glutes. No leaning back.',
      severity: 'critical',
      phases: ['eccentric', 'concentric', 'lockout'],
    },
  ],
};

// ============================================
// AR FORM CHECKER
// ============================================

export class ARFormChecker {
  private static instance: ARFormChecker | null = null;

  private currentExercise: ExerciseType | null = null;
  private poseHistory: Pose[] = [];
  private repCount = 0;
  private currentPhase: ExercisePhase = 'setup';
  private isLoaded = false;
  private formModel: any = null;

  // Phase detection state
  private lastKeyAngle = 180;
  private isDescending = false;
  private minAngleSeen = 180;

  // Smoothing
  private readonly POSE_HISTORY_SIZE = 10;

  private constructor() {}

  static getInstance(): ARFormChecker {
    if (!ARFormChecker.instance) {
      ARFormChecker.instance = new ARFormChecker();
    }
    return ARFormChecker.instance;
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Initialize with v3 form analysis model (optional — has built-in rules).
   */
  async initialize(): Promise<boolean> {
    try {
      const modelData = await loadBundledModelWithFallback<any>(
        safeRequire(() => require('../../../assets/models/ar_v3.model')),
        'ar_v3.model'
      );
      if (modelData) {
        this.formModel = modelData;
        const exerciseCount = Object.keys(modelData.exercises || {}).length;
        console.log(`[ARFormChecker] v3 form model loaded: ${exerciseCount} exercises`);
      }
      this.isLoaded = true;
      return true;
    } catch (error) {
      console.warn('[ARFormChecker] Model load failed (non-critical):', error);
      this.isLoaded = true; // Still functional with built-in rules
      return true;
    }
  }

  /**
   * Set the exercise being performed.
   */
  setExercise(exercise: ExerciseType): void {
    this.currentExercise = exercise;
    this.repCount = 0;
    this.currentPhase = 'setup';
    this.poseHistory = [];
    this.lastKeyAngle = 180;
    this.isDescending = false;
    this.minAngleSeen = 180;
  }

  /**
   * Analyze a pose frame and return form feedback.
   *
   * @param pose - Detected keypoints from pose estimation model
   */
  analyzePose(pose: Pose): FormFeedback {
    if (!this.currentExercise) {
      return this.emptyFeedback(pose.timestamp);
    }

    // Add to history
    this.poseHistory.push(pose);
    if (this.poseHistory.length > this.POSE_HISTORY_SIZE) {
      this.poseHistory.shift();
    }

    // Smooth keypoints
    const smoothed = this.smoothKeypoints(this.poseHistory);

    // Detect exercise phase
    this.detectPhase(smoothed);

    // Compute all joint angles
    const angles = this.computeAllAngles(smoothed);

    // Check form rules
    const rules = EXERCISE_RULES[this.currentExercise] ?? [];
    const issues: FormIssue[] = [];

    for (const rule of rules) {
      if (!rule.phases.includes(this.currentPhase)) continue;

      const [a, b, c] = rule.jointIndices;
      const kpA = smoothed.keypoints[a];
      const kpB = smoothed.keypoints[b];
      const kpC = smoothed.keypoints[c];

      // Skip if keypoints have low confidence
      if (!kpA || !kpB || !kpC) continue;
      if (kpA.score < 0.3 || kpB.score < 0.3 || kpC.score < 0.3) continue;

      const angle = this.computeAngle(kpA, kpB, kpC);
      const [minIdeal, maxIdeal] = rule.idealRange;

      if (angle < minIdeal || angle > maxIdeal) {
        issues.push({
          severity: rule.severity,
          bodyPart: rule.bodyPart,
          message: rule.message,
          angle: Math.round(angle),
          idealRange: rule.idealRange,
          correction: rule.correction,
        });
      }
    }

    // Compute overall score
    const overallScore = this.computeFormScore(issues, rules.length);

    return {
      overallScore,
      issues,
      phase: this.currentPhase,
      repCount: this.repCount,
      currentAngles: angles,
      timestamp: pose.timestamp,
    };
  }

  // ============================================
  // PHASE DETECTION
  // ============================================

  private detectPhase(pose: Pose): void {
    if (!this.currentExercise) return;

    // Use primary joint angle to detect phase
    const primaryRule = EXERCISE_RULES[this.currentExercise]?.[0];
    if (!primaryRule) return;

    const [a, b, c] = primaryRule.jointIndices;
    const kpA = pose.keypoints[a];
    const kpB = pose.keypoints[b];
    const kpC = pose.keypoints[c];

    if (!kpA || !kpB || !kpC) return;
    if (kpA.score < 0.3 || kpB.score < 0.3 || kpC.score < 0.3) return;

    const angle = this.computeAngle(kpA, kpB, kpC);

    // Plank is special — always "hold"
    if (this.currentExercise === 'plank') {
      this.currentPhase = 'hold';
      return;
    }

    // Phase state machine based on angle change
    const angleDelta = angle - this.lastKeyAngle;
    const threshold = 5; // degrees

    if (angleDelta < -threshold) {
      // Angle decreasing (e.g., bending knee in squat)
      if (!this.isDescending) {
        this.isDescending = true;
        this.currentPhase = 'eccentric';
      }
      this.minAngleSeen = Math.min(this.minAngleSeen, angle);
    } else if (angleDelta > threshold) {
      // Angle increasing (e.g., extending knee)
      if (this.isDescending) {
        this.isDescending = false;
        this.currentPhase = 'concentric';
      }
    }

    // Detect bottom position
    if (this.isDescending && Math.abs(angleDelta) < threshold / 2) {
      const [minIdeal] = primaryRule.idealRange;
      if (angle < minIdeal + 20) {
        this.currentPhase = 'bottom';
      }
    }

    // Detect lockout and count rep
    if (!this.isDescending && angle > 160) {
      if (this.currentPhase === 'concentric') {
        this.repCount++;
        this.currentPhase = 'lockout';
        this.minAngleSeen = 180;
      }
    }

    this.lastKeyAngle = angle;
  }

  // ============================================
  // ANGLE COMPUTATION
  // ============================================

  /**
   * Compute the angle at point B formed by points A-B-C.
   * Returns degrees (0-180).
   */
  private computeAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };

    const dot = ba.x * bc.x + ba.y * bc.y;
    const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
    const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);

    const cosAngle = dot / (magBA * magBC || 1e-6);
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    return (Math.acos(clampedCos) * 180) / Math.PI;
  }

  /**
   * Compute all named joint angles.
   */
  private computeAllAngles(pose: Pose): Record<string, number> {
    const kp = pose.keypoints;
    const angles: Record<string, number> = {};

    const tryAngle = (name: string, a: number, b: number, c: number) => {
      if (kp[a] && kp[b] && kp[c] &&
          kp[a].score > 0.3 && kp[b].score > 0.3 && kp[c].score > 0.3) {
        angles[name] = Math.round(this.computeAngle(kp[a], kp[b], kp[c]));
      }
    };

    tryAngle('leftElbow', KP.LEFT_SHOULDER, KP.LEFT_ELBOW, KP.LEFT_WRIST);
    tryAngle('rightElbow', KP.RIGHT_SHOULDER, KP.RIGHT_ELBOW, KP.RIGHT_WRIST);
    tryAngle('leftShoulder', KP.LEFT_ELBOW, KP.LEFT_SHOULDER, KP.LEFT_HIP);
    tryAngle('rightShoulder', KP.RIGHT_ELBOW, KP.RIGHT_SHOULDER, KP.RIGHT_HIP);
    tryAngle('leftHip', KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_KNEE);
    tryAngle('rightHip', KP.RIGHT_SHOULDER, KP.RIGHT_HIP, KP.RIGHT_KNEE);
    tryAngle('leftKnee', KP.LEFT_HIP, KP.LEFT_KNEE, KP.LEFT_ANKLE);
    tryAngle('rightKnee', KP.RIGHT_HIP, KP.RIGHT_KNEE, KP.RIGHT_ANKLE);
    tryAngle('torso', KP.LEFT_SHOULDER, KP.LEFT_HIP, KP.LEFT_ANKLE);

    return angles;
  }

  // ============================================
  // POSE SMOOTHING
  // ============================================

  /**
   * Temporal smoothing: average keypoints over recent frames.
   */
  private smoothKeypoints(history: Pose[]): Pose {
    if (history.length === 1) return history[0];

    const latest = history[history.length - 1];
    const numKeypoints = latest.keypoints.length;
    const smoothed: Keypoint[] = [];

    // Exponential moving average (more weight on recent frames)
    const alpha = 0.6; // weight for latest frame

    for (let k = 0; k < numKeypoints; k++) {
      let sx = 0, sy = 0, sc = 0, totalWeight = 0;

      for (let f = 0; f < history.length; f++) {
        const weight = Math.pow(alpha, history.length - 1 - f);
        const kp = history[f].keypoints[k];
        if (kp && kp.score > 0.1) {
          sx += kp.x * weight;
          sy += kp.y * weight;
          sc += kp.score * weight;
          totalWeight += weight;
        }
      }

      if (totalWeight > 0) {
        smoothed.push({
          x: sx / totalWeight,
          y: sy / totalWeight,
          score: sc / totalWeight,
          name: latest.keypoints[k]?.name ?? `kp_${k}`,
        });
      } else {
        smoothed.push(latest.keypoints[k] ?? { x: 0, y: 0, score: 0, name: `kp_${k}` });
      }
    }

    return {
      keypoints: smoothed,
      score: latest.score,
      timestamp: latest.timestamp,
    };
  }

  // ============================================
  // SCORING
  // ============================================

  private computeFormScore(issues: FormIssue[], totalRules: number): number {
    if (totalRules === 0) return 100;

    let deductions = 0;
    for (const issue of issues) {
      if (issue.severity === 'critical') {
        deductions += 25;
      } else if (issue.severity === 'warning') {
        deductions += 10;
      } else {
        deductions += 5;
      }
    }

    return Math.max(0, Math.min(100, 100 - deductions));
  }

  private emptyFeedback(timestamp: number): FormFeedback {
    return {
      overallScore: 0,
      issues: [],
      phase: 'setup',
      repCount: 0,
      currentAngles: {},
      timestamp,
    };
  }

  // ============================================
  // PUBLIC API
  // ============================================

  get exerciseType(): ExerciseType | null { return this.currentExercise; }
  get reps(): number { return this.repCount; }
  get phase(): ExercisePhase { return this.currentPhase; }

  getSupportedExercises(): ExerciseType[] {
    return Object.keys(EXERCISE_RULES) as ExerciseType[];
  }

  resetRepCount(): void {
    this.repCount = 0;
  }

  getInfo() {
    return {
      exercise: this.currentExercise,
      repCount: this.repCount,
      phase: this.currentPhase,
      poseHistorySize: this.poseHistory.length,
      supportedExercises: this.getSupportedExercises(),
    };
  }
}

export const arFormChecker = ARFormChecker.getInstance();
