/**
 * AI Provider — Multi-Tier Intelligence
 *
 * FitQuest AI coach powered by Groq (primary, fastest) + 2 OpenRouter free fallbacks.
 *
 *   TIERS:
 *     Elite  (crown)  — 70B: Llama 70B (OpenRouter fallback)
 *     Strong (muscle)  — 8-70B: Groq Llama 70B, Qwen QwQ 32B, Mixtral 8x7B, Mistral 24B
 *     Fast   (bolt)   — 3-8B: Groq Llama 8B/3B
 *
 *   ROUTING:
 *     "hey" → Fast tier (3B model, instant reply)
 *     "design me a 4-week periodization plan" → Elite tier (405B model)
 *     Auto-mode analyzes every query; manual mode locks a specific model.
 *
 *   FAILOVER:
 *     Active model → same-tier alternatives → lower tier → DualAI templates
 *     Rate-limited (429)? Next model in chain. All exhausted? Offline fallback.
 *
 * Zero cost, zero local models, minimal memory footprint.
 * Model IDs verified against OpenRouter API — July 2025.
 */

import { dualAI, AIContext, AIResponse } from '../engines/DualAIEngine';
import { encryptedDB } from '../security/EncryptedDatabase';
import { rateLimiter, RATE_LIMITS } from '../utils/rateLimiter';
import { tamperEngine } from './security/tamperEngine';
import { degradation } from './security/degradation';
import {
  sentinelRecordAIAccess,
  sentinelRecordNetworkCall,
  sentinelVerifyEngine,
  sentinelRecordConnectivity,
  microCheckTiming,
} from './security/sentinel';
import { queueReconciliationBatch } from './security/securityBridge';
import { requestAI } from './authorityClient';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

// ============================================
// AI PROXY CONFIGURATION
// ============================================

/**
 * Production: all AI calls route through the Cloudflare Worker proxy.
 * API keys never leave the server. The client sends only a shared app-key.
 *
 * Dev mode: falls back to direct provider calls if EXPO_PUBLIC keys exist
 * (for local development without deploying the proxy).
 */
const PROXY_ENDPOINT = process.env.EXPO_PUBLIC_AI_PROXY_URL || '';
const PROXY_APP_KEY = process.env.EXPO_PUBLIC_AI_PROXY_APP_KEY || '';

/** Whether the proxy is configured and should be used */
function isProxyEnabled(): boolean {
  return !!(PROXY_ENDPOINT && PROXY_APP_KEY && PROXY_ENDPOINT.startsWith('https://'));
}

/** Stable device identifier for proxy rate limiting */
const DEVICE_ID_KEY = 'fitquest_device_id';
let _deviceId: string | null = null;
async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  try {
    // Try SecureStore-persisted UUID first (survives app updates)
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      _deviceId = stored;
      return stored;
    }
    // Generate a cryptographically random UUID for this installation
    const id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    _deviceId = id;
  } catch {
    _deviceId = 'unknown';
  }
  return _deviceId ?? 'unknown';
}

// ============================================
// SECURE KEY MANAGEMENT (dev-mode fallback)
// ============================================

/**
 * Dev-mode only: load API keys from SecureStore for direct provider calls.
 * In production, the proxy holds the keys — these are unused.
 */
const SECURE_KEY_PREFIX = 'fitquest_ai_key_';
let _secureKeysLoaded = false;
const _secureKeys: Record<AIProviderName, string> = { groq: '', grok: '', openrouter: '' };

async function loadSecureKeys(): Promise<void> {
  if (_secureKeysLoaded) return;
  // Skip key loading entirely when proxy is enabled — keys aren't needed
  if (isProxyEnabled()) {
    _secureKeysLoaded = true;
    return;
  }
  for (const provider of ['groq', 'grok', 'openrouter'] as AIProviderName[]) {
    const storeKey = `${SECURE_KEY_PREFIX}${provider}`;
    let key = await SecureStore.getItemAsync(storeKey);
    if (!key) {
      // First launch: migrate from env vars into SecureStore
      const envKey =
        provider === 'groq'
          ? process.env.EXPO_PUBLIC_GROQ_API_KEY
          : provider === 'grok'
            ? process.env.EXPO_PUBLIC_GROK_API_KEY
            : process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
      if (envKey && envKey.length > 10) {
        await SecureStore.setItemAsync(storeKey, envKey);
        key = envKey;
      }
    }
    _secureKeys[provider] = key || '';
  }
  _secureKeysLoaded = true;
}

function getSecureKey(provider: AIProviderName): string {
  return _secureKeys[provider] || '';
}

// ============================================
// TYPES
// ============================================

export type AIProviderName = 'groq' | 'grok' | 'openrouter';
export type ModelTier = 'elite' | 'strong' | 'fast' | 'free';
export type QueryComplexity = 'simple' | 'moderate' | 'complex' | 'expert';

/** A single model in the unified registry */
export interface ModelInfo {
  id: string;
  provider: AIProviderName;
  displayName: string;
  tier: ModelTier;
  qualityScore: number; // 1-5
  speedScore: number; // 1-5
  contextWindow: number;
  description: string;
  maxTokens: number;
}

/** Provider-level config (auth + endpoint) */
export interface ProviderConfig {
  name: AIProviderName;
  displayName: string;
  apiKey: string;
  endpoint: string;
  timeoutMs: number;
  enabled: boolean;
}

/** Full status exposed to UI */
export interface AIProviderStatus {
  activeModel: ModelInfo;
  autoRoute: boolean;
  cloudAvailable: boolean;
  models: ModelInfo[];
  providers: Array<{
    name: AIProviderName;
    displayName: string;
    enabled: boolean;
  }>;
  tierLabels: Record<ModelTier, { label: string; badge: string }>;
}

interface CloudResponse {
  text: string;
  suggestions: string[];
}

// ============================================
// TIER LABELS — UI display
// ============================================

export const TIER_LABELS: Record<ModelTier, { label: string; badge: string; color: string }> = {
  elite: { label: 'Elite', badge: '\uD83D\uDC51', color: '#FFD700' }, // crown
  strong: { label: 'Strong', badge: '\uD83D\uDCAA', color: '#10B981' }, // muscle
  fast: { label: 'Fast', badge: '\u26A1', color: '#3B82F6' }, // bolt
  free: { label: 'Free', badge: '\uD83C\uDD93', color: '#A855F7' }, // gift (legacy, kept for type compatibility)
};

// ============================================
// MODEL REGISTRY — Every model FitQuest can talk to
// ============================================

const MODEL_REGISTRY: ModelInfo[] = [
  // ────────────────────────────────────────
  // GROQ — Ultra-fast inference (needs key)
  // ────────────────────────────────────────
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    displayName: 'Llama 3.3 70B',
    tier: 'strong',
    qualityScore: 5,
    speedScore: 5,
    contextWindow: 32768,
    description: 'Best overall — fast + smart',
    maxTokens: 500,
  },
  {
    id: 'qwen-qwq-32b',
    provider: 'groq',
    displayName: 'Qwen QwQ 32B',
    tier: 'strong',
    qualityScore: 4,
    speedScore: 4,
    contextWindow: 32768,
    description: 'Deep reasoning model',
    maxTokens: 500,
  },
  {
    id: 'llama-3.3-70b-specdec',
    provider: 'groq',
    displayName: 'Llama 3.3 70B SpecDec',
    tier: 'strong',
    qualityScore: 4,
    speedScore: 5,
    contextWindow: 8192,
    description: 'Speculative decoding — very fast',
    maxTokens: 500,
  },
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    displayName: 'Llama 3.1 8B',
    tier: 'fast',
    qualityScore: 3,
    speedScore: 5,
    contextWindow: 8192,
    description: 'Ultra-fast responses',
    maxTokens: 400,
  },

  // ────────────────────────────────────────
  // OPENROUTER — FREE TIER (last-resort fallback)
  // Primary providers: Groq + Grok. OpenRouter only if both are down.
  // ────────────────────────────────────────
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    provider: 'openrouter',
    displayName: 'Llama 3.3 70B',
    tier: 'elite',
    qualityScore: 5,
    speedScore: 3,
    contextWindow: 131072,
    description: "Meta's best open model (free fallback)",
    maxTokens: 500,
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    provider: 'openrouter',
    displayName: 'Mistral Small 3.1',
    tier: 'strong',
    qualityScore: 4,
    speedScore: 4,
    contextWindow: 32768,
    description: 'Mistral — free fallback',
    maxTokens: 400,
  },
];

// ============================================
// QUERY COMPLEXITY ANALYZER
// ============================================

const COMPLEX_PATTERNS =
  /\b(plan|program|schedule|design|create|build|compare|analyze|calculat|breakdown|periodiz|macro|split|cycle|deload|progressive|superset|meal\s?plan|routine for|body\s?composition|transformation|what should i eat|weekly|monthly)\b/i;
const EXPERT_PATTERNS =
  /\b(why does|how does|explain the science|research|evidence|difference between|mechanism|biomechanic|kinesiolog|metabol|peer.?review|study shows|optimal|hypertrophy vs|progressive overload theory)\b/i;
const SIMPLE_PATTERNS =
  /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|cool|nice|great|got it|yes|no|nah|yep|bye|gm|good morning|good evening|lol|haha|what's up|how are you)\b/i;
const MODERATE_PATTERNS = /\b(how to|form for|tips for|what is|should i|can i|best for|good for|recommend|suggest)\b/i;

function analyzeComplexity(input: string): QueryComplexity {
  const wordCount = input.split(/\s+/).length;

  if (wordCount <= 4 && SIMPLE_PATTERNS.test(input)) return 'simple';
  if (wordCount > 50 || (COMPLEX_PATTERNS.test(input) && EXPERT_PATTERNS.test(input))) return 'expert';
  if (EXPERT_PATTERNS.test(input)) return 'complex';
  if (COMPLEX_PATTERNS.test(input) || wordCount > 30) return 'complex';
  if (MODERATE_PATTERNS.test(input) || wordCount > 8) return 'moderate';
  return wordCount <= 5 ? 'simple' : 'moderate';
}

function complexityToTier(c: QueryComplexity): ModelTier {
  switch (c) {
    case 'simple':
      return 'fast';
    case 'moderate':
      return 'strong';
    case 'complex':
      return 'elite';
    case 'expert':
      return 'elite';
  }
}

// ============================================
// SYSTEM PROMPT — Adaptive
// ============================================

const BASE_SYSTEM_PROMPT = `You are FitCoach, a concise and encouraging AI fitness coach inside a mobile workout app called FitQuest.

PERSONALITY:
- Warm, direct, action-oriented
- Use emojis sparingly (1-2 per message max)
- Never condescending, always supportive
- Sound like a knowledgeable friend, not a textbook
- Celebrate wins genuinely, address struggles with empathy

RESPONSE RULES:
- Keep responses under 150 words unless the user asks for detail
- Use markdown formatting: **bold** for emphasis, bullet lists for tips
- Use numbered lists for step-by-step instructions
- Use headers (##) to organize longer responses
- Give specific, actionable advice (not generic platitudes)
- When discussing exercises, include form cues and common mistakes
- Reference the user's stats when relevant (streak, workouts, goals)
- End with a natural follow-up question or actionable next step when appropriate
- If unsure about medical advice, recommend consulting a professional

EXERCISE PRESCRIPTION RULES (MANDATORY):
- ALWAYS give exact sets and reps — never say "a few sets" or "some reps"
- Format: **Exercise Name** — 3×10 (3 sets of 10 reps) or 3×30s (3 sets of 30 seconds)
- Adjust prescription to user's fitness level (beginner/intermediate/advanced)
- Include rest periods between sets (e.g., "Rest 60-90s between sets")
- For holds/isometrics: specify exact duration (e.g., "3×45s hold")
- For cardio: specify exact duration and intensity (e.g., "20 min at moderate pace, 6-7 RPE")
- When recommending multiple exercises, provide a complete mini-program with all sets/reps
- Base recommendations on user's fatigue state, injuries, and equipment

NUTRITION & DIET RULES:
- When giving diet advice, tailor recommendations to the user's LOCATION and local cuisine
- Recommend specific foods available in their region, using local food names
- Include realistic portions and macros (protein/carbs/fats in grams)
- Consider the user's goals (muscle building, fat loss, general health)
- For meal plans, provide specific meals with ingredients, not vague categories
- If the user is in South Africa: include foods like biltong, boerewors, pap, chakalaka, bunny chow, braai meats, rooibos
- If budget is a concern, suggest affordable local options

TOPICS YOU HANDLE:
- Workout advice, exercise form, programming, periodization
- Nutrition, meal prep, macros, hydration, supplements
- Recovery, sleep, stretching, mobility, injury prevention
- Motivation, habit building, mental health, accountability
- Progress tracking, plateaus, body transformation
- Warm-up/cool-down routines, flexibility work

CONVERSATION STYLE:
- Answer the actual question first, then expand if helpful
- Follow up naturally — if user said "tell me more", reference the previous topic
- Be conversational, not robotic
- Adapt tone to context (celebratory after workouts, gentle when user is struggling)
- If the user gives a short response (ok, thanks, cool), don't over-explain — acknowledge and offer to continue`;

function buildAdaptiveSystemPrompt(context: AIContext, input: string): string {
  const parts = [BASE_SYSTEM_PROMPT];

  // ── Time & day awareness ──
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[now.getDay()];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  if (hour < 6) {
    parts.push(`\nCONTEXT: It's ${dayOfWeek}, very early morning — be gentle, the user might be tired.`);
  } else if (hour >= 6 && hour <= 9) {
    parts.push(`\nCONTEXT: ${dayOfWeek} morning — energize and motivate. Great time to set the tone.`);
  } else if (hour >= 12 && hour <= 14) {
    parts.push(`\nCONTEXT: ${dayOfWeek} midday — good for nutrition talk or midday workout tips.`);
  } else if (hour >= 17 && hour <= 19) {
    parts.push(`\nCONTEXT: ${dayOfWeek} evening — popular workout time. Be energetic and focused.`);
  } else if (hour >= 22) {
    parts.push(`\nCONTEXT: ${dayOfWeek} late night — focus on recovery, sleep prep, and tomorrow's plan.`);
  }
  if (isWeekend) {
    parts.push("It's the weekend — user may have more time for longer workouts or meal prep.");
  }

  // ── Conversation depth adaptation ──
  const historyLen = context.conversationHistory?.length || 0;
  if (historyLen === 0) {
    parts.push('This is the START of a conversation. Be welcoming but get to the point.');
  } else if (historyLen >= 8) {
    parts.push('This is a deep conversation. The user trusts you — be detailed and specific.');
  }

  // ── Query-topic modulation ──
  const lower = input.toLowerCase();
  if (/\b(hurt|pain|injur|sore|strain|torn|swollen)\b/.test(lower)) {
    parts.push('IMPORTANT: User may have an injury. Be cautious. Recommend professional help if serious.');
  } else if (/\b(depress|anxious|stress|mental|overwhelm|burnt?\s*out)\b/.test(lower)) {
    parts.push(
      'SENSITIVITY: Be extra supportive. Mental health is serious. Suggest professional help when appropriate.',
    );
  } else if (/\b(plateau|stuck|not\s*seeing|no\s*progress|frustrated)\b/.test(lower)) {
    parts.push('TONE: User is frustrated. Validate their feelings first, then provide actionable solutions.');
  }

  // ── User context ──
  const profile = context.userProfile;
  const workout = context.workoutContext;

  if (profile || workout) {
    parts.push('\nUSER CONTEXT (reference naturally, never recite as a list):');
    if (profile?.streakDays) {
      parts.push(`- Streak: ${profile.streakDays} days`);
      if (profile.streakDays >= 30) parts.push('  → Amazing consistency! Celebrate this milestone.');
      else if (profile.streakDays >= 7) parts.push('  → Solid streak going! Encourage them to keep it up.');
    }
    if (profile?.name && profile.name !== 'Athlete') parts.push(`- Name: ${profile.name}`);
    if (profile?.goals?.length) parts.push(`- Goal: ${profile.goals.join(', ')}`);
    if (profile?.fitnessLevel) parts.push(`- Experience: ${profile.fitnessLevel}`);
    if (profile?.level) parts.push(`- Level: ${profile.level} (${profile.totalXP || 0} XP)`);
    if (profile?.weight) parts.push(`- Weight: ${profile.weight} kg`);
    if (profile?.height) parts.push(`- Height: ${profile.height} cm`);
    if (profile?.trainingDaysPerWeek)
      parts.push(
        `- Training schedule: ${profile.trainingDaysPerWeek} days/week, ${profile.sessionMinutes || 30} min sessions`,
      );
    if (profile?.injuries && profile.injuries !== 'none')
      parts.push(`- Active injuries: ${profile.injuries}. Be careful recommending exercises that stress these areas.`);
    if (profile?.equipment && profile.equipment !== 'bodyweight')
      parts.push(`- Available equipment: ${profile.equipment}`);
    if ((profile as Record<string, unknown>)?.bodyCraftPlan)
      parts.push(`- Body transformation plan: ${(profile as Record<string, unknown>).bodyCraftPlan}`);
    if (context.totalWorkouts !== undefined) {
      parts.push(`- Workouts completed: ${context.totalWorkouts}`);
      if (context.totalWorkouts === 0) parts.push('  → Brand new user! Be extra welcoming and encouraging.');
      else if (context.totalWorkouts >= 50) parts.push('  → Experienced athlete. Give more advanced, nuanced advice.');
    }
    if (context.exerciseCount) parts.push(`- Exercise library: ${context.exerciseCount} exercises available`);
    if (workout?.fatigueLevel) {
      parts.push(`- Fatigue: ${workout.fatigueLevel}%`);
      if (workout.fatigueLevel > 80) parts.push('  → Very fatigued! Suggest recovery, light work, or rest day.');
    }
    if (workout?.currentExercise) parts.push(`- Currently doing: ${workout.currentExercise}`);
    if (workout?.muscleGroup) parts.push(`- Target muscle: ${workout.muscleGroup}`);
    if (workout?.lastWorkoutDate) {
      const daysSince = Math.floor((Date.now() - new Date(workout.lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 7)
        parts.push(`- Last workout: ${daysSince} days ago. Be encouraging about coming back, no judgment.`);
      else if (daysSince >= 3) parts.push(`- Last workout: ${daysSince} days ago (gently encourage comeback)`);
      else if (daysSince === 1) parts.push('- Worked out yesterday — could be slightly sore');
      else if (daysSince === 0) parts.push('- Worked out today — great commitment!');
    }
  }

  // ── Conversation memory ──
  if (context.memory) {
    const mem = context.memory;
    if (mem.recentTopics.length) parts.push(`- Recent topics: ${mem.recentTopics.join(', ')}`);
    if (mem.userPreferences.length) parts.push(`- Preferences: ${mem.userPreferences.join(', ')}`);
    if (mem.mentionedExercises.length)
      parts.push(`- Exercises discussed: ${mem.mentionedExercises.slice(0, 5).join(', ')}`);
    if (mem.conversationCount > 0) parts.push(`- Conversations so far: ${mem.conversationCount}`);
  }

  // ── Location context for diet/nutrition ──
  if (context.location) {
    const loc = context.location;
    const locationParts: string[] = [];
    if (loc.city) locationParts.push(loc.city);
    if (loc.region) locationParts.push(loc.region);
    if (loc.country) locationParts.push(loc.country);
    if (locationParts.length > 0) {
      parts.push(`\nLOCATION: User is in ${locationParts.join(', ')} (${loc.isoCountryCode || 'unknown'}).`);
      parts.push(
        'When discussing diet or nutrition, recommend foods and meals that are locally available and culturally relevant to this region. Use local food names and suggest dishes from nearby restaurants or markets when appropriate.',
      );
    }
  }

  // ── Language instruction ──
  if (context.language && context.language !== 'en') {
    const langLabel = context.languageName || context.language;
    parts.push(
      `\nLANGUAGE: The user's app is set to ${langLabel}. You MUST respond entirely in ${langLabel}. Use natural, conversational ${langLabel} — not machine-translated phrasing. Keep emoji, markdown formatting, and exercise names (proper nouns) as-is.`,
    );
  }

  return parts.join('\n');
}

// ============================================
// PROVIDER CONFIGS (auth only)
// ============================================

function createProviders(): Record<AIProviderName, ProviderConfig> {
  return {
    groq: {
      name: 'groq',
      displayName: 'Groq',
      apiKey: getSecureKey('groq'),
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      timeoutMs: 8000,
      enabled: false,
    },
    grok: {
      name: 'grok',
      displayName: 'Grok (xAI)',
      apiKey: getSecureKey('grok'),
      endpoint: 'https://api.x.ai/v1/chat/completions',
      timeoutMs: 12000,
      enabled: false,
    },
    openrouter: {
      name: 'openrouter',
      displayName: 'OpenRouter',
      apiKey: getSecureKey('openrouter'),
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      timeoutMs: 30000,
      enabled: false,
    },
  };
}

// ============================================
// AI PROVIDER — Multi-Tier Intelligence
// ============================================

class AIProvider {
  private providers: Record<AIProviderName, ProviderConfig>;
  private _activeModelId: string | null = null; // null = auto-route
  private _autoRoute = true;
  private modelFailures: Record<string, { count: number; lastAt: number }> = {};
  private static MAX_FAILURES = 3;
  private static COOLDOWN_MS = 60_000;
  private _initialized = false;

  constructor() {
    this.providers = createProviders();
    for (const p of Object.values(this.providers)) {
      p.enabled = !!(p.apiKey && p.apiKey.length > 10);
    }
  }

  /** Load keys from SecureStore and refresh provider enabled state */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    await loadSecureKeys();
    this.providers = createProviders();

    if (isProxyEnabled()) {
      // Proxy mode: all providers are available (keys live server-side)
      for (const p of Object.values(this.providers)) {
        p.enabled = true;
      }
    } else {
      // Direct mode (dev): enable only providers with local keys
      for (const p of Object.values(this.providers)) {
        p.enabled = !!(p.apiKey && p.apiKey.length > 10);
      }
    }
    this._initialized = true;
  }

  // ─── Registry Queries ───

  /** All models whose provider is enabled */
  getAvailableModels(): ModelInfo[] {
    return MODEL_REGISTRY.filter((m) => this.providers[m.provider].enabled);
  }

  /** Models for a specific tier (sorted by quality desc, speed desc) */
  getModelsForTier(tier: ModelTier): ModelInfo[] {
    return this.getAvailableModels()
      .filter((m) => m.tier === tier)
      .sort((a, b) => b.qualityScore + b.speedScore - (a.qualityScore + a.speedScore));
  }

  /** Models for a specific provider */
  getModelsForProvider(name: AIProviderName): ModelInfo[] {
    return MODEL_REGISTRY.filter((m) => m.provider === name);
  }

  /** Lookup a single model by its ID */
  getModel(id: string): ModelInfo | undefined {
    return MODEL_REGISTRY.find((m) => m.id === id);
  }

  /** Full registry (for settings UI) */
  get allModels(): ModelInfo[] {
    return MODEL_REGISTRY;
  }

  // ─── Active Model ───

  get autoRoute(): boolean {
    return this._autoRoute;
  }

  get activeModel(): ModelInfo {
    if (this._activeModelId) {
      const m = this.getModel(this._activeModelId);
      if (m && this.providers[m.provider].enabled) return m;
    }

    // Fallback: best available model
    const avail = this.getAvailableModels();
    const fallback = MODEL_REGISTRY[0];
    if (!fallback) {
      throw new Error('AI model registry is empty — no models available');
    }

    return avail[0] ?? fallback;
  }

  get cloudAvailable(): boolean {
    return this.getAvailableModels().length > 0;
  }

  // ─── Controls ───

  /** Lock a specific model (disables auto-routing) */
  setModel(modelId: string): boolean {
    const model = this.getModel(modelId);
    if (!model) return false;
    if (!this.providers[model.provider].enabled) return false;
    this._activeModelId = modelId;
    this._autoRoute = false;
    this.clearFailures(modelId);
    if (__DEV__) console.warn(`[AI] Locked → ${model.displayName} (${TIER_LABELS[model.tier].label})`);
    return true;
  }

  /** Enable auto-routing (picks best model per query complexity) */
  enableAutoRoute(): void {
    this._activeModelId = null;
    this._autoRoute = true;
    if (__DEV__) console.warn('[AI] Auto-route enabled');
  }

  /** Set API key for a provider */
  setApiKey(providerName: AIProviderName, key: string): void {
    const provider = this.providers[providerName];
    if (!provider) return;
    provider.apiKey = key;
    provider.enabled = !!(key && key.length > 10);
    // If no model is active and this provider just got enabled, auto-select
    if (provider.enabled && this._autoRoute) {
      if (__DEV__) console.warn(`[AI] ${provider.displayName} enabled`);
    }
  }

  /** Full status for UI */
  getStatus(): AIProviderStatus {
    return {
      activeModel: this.activeModel,
      autoRoute: this._autoRoute,
      cloudAvailable: this.cloudAvailable,
      models: this.getAvailableModels(),
      providers: Object.values(this.providers).map((p) => ({
        name: p.name,
        displayName: p.displayName,
        enabled: p.enabled,
      })),
      tierLabels: TIER_LABELS,
    };
  }

  // ─── Failure Tracking ───

  private isModelAvailable(modelId: string): boolean {
    const f = this.modelFailures[modelId];
    if (!f || f.count < AIProvider.MAX_FAILURES) return true;
    if (Date.now() - f.lastAt > AIProvider.COOLDOWN_MS) {
      this.clearFailures(modelId);
      return true;
    }
    return false;
  }

  private recordFailure(modelId: string): void {
    const f = this.modelFailures[modelId] || { count: 0, lastAt: 0 };
    f.count++;
    f.lastAt = Date.now();
    this.modelFailures[modelId] = f;
  }

  private clearFailures(modelId: string): void {
    delete this.modelFailures[modelId];
  }

  // ─── Smart Model Selection ───

  /** Build an ordered list of models to try for a given query */
  private buildModelChain(input: string): ModelInfo[] {
    const available = this.getAvailableModels().filter((m) => this.isModelAvailable(m.id));
    if (available.length === 0) return [];

    // If locked to a specific model, try it first then failover
    if (!this._autoRoute && this._activeModelId) {
      const locked = available.find((m) => m.id === this._activeModelId);
      const rest = available.filter((m) => m.id !== this._activeModelId);
      return locked ? [locked, ...rest] : rest;
    }

    // Auto-route: pick ideal tier, then sequence by quality
    const complexity = analyzeComplexity(input);
    const idealTier = complexityToTier(complexity);

    // Tier priority: ideal → adjacent → any
    const tierPriority: ModelTier[] = (() => {
      switch (idealTier) {
        case 'elite':
          return ['elite', 'strong', 'fast', 'free'];
        case 'strong':
          return ['strong', 'elite', 'fast', 'free'];
        case 'fast':
          return ['fast', 'strong', 'elite', 'free'];
        default:
          return ['strong', 'elite', 'fast', 'free'];
      }
    })();

    // Sort: tier priority first, then quality desc within tier
    const sorted = [...available].sort((a, b) => {
      const aTier = tierPriority.indexOf(a.tier);
      const bTier = tierPriority.indexOf(b.tier);
      if (aTier !== bTier) return aTier - bTier;
      return b.qualityScore + b.speedScore - (a.qualityScore + a.speedScore);
    });

    if (__DEV__) {
      console.warn(
        `[AI] Route: "${input.slice(0, 40)}..." → ${complexity} → ${idealTier} tier → trying ${sorted[0]?.displayName}`,
      );
    }

    return sorted;
  }

  // ─── Response Generation ───

  async generateResponse(
    input: string,
    context: AIContext,
  ): Promise<AIResponse & { fromCloud: boolean; provider?: string; model?: string; tier?: string; modelId?: string }> {
    // Ensure keys are loaded from SecureStore
    await this.initialize();

    // Record AI feature usage for tamper detection + sentinel
    tamperEngine.recordAIFeatureUsed();
    sentinelRecordAIAccess();

    // Phase 14: Sentinel verifies engine heartbeat is alive
    sentinelVerifyEngine(tamperEngine.getHeartbeatCounter());

    // Client-side rate limiting — prevents runaway loops and abuse
    const rl = rateLimiter.attempt('ai_query', RATE_LIMITS.AI_QUERY);
    if (!rl.allowed) {
      return {
        message: `⏳ Rate limit reached — please wait ${Math.ceil(rl.retryAfterMs / 1000)}s before asking again.`,
        suggestions: [],
        confidence: 0,
        processingTimeMs: 0,
        personality: context.personality || 'COACH',
        fromCloud: false,
        provider: 'RateLimited',
        model: 'none',
        tier: 'none',
      };
    }

    // Input sanitization — cap length to prevent prompt abuse
    const sanitizedInput = input.slice(0, 4000).trim();
    if (!sanitizedInput) {
      return {
        message: 'Please enter a question or request.',
        suggestions: [],
        confidence: 0,
        processingTimeMs: 0,
        personality: context.personality || 'COACH',
        fromCloud: false,
      };
    }

    const startTime = Date.now();

    // Phase 21: Backend authority gate — server must authorize every AI request.
    // null = offline (allow local templates only), restricted = show overlay, denied = 403
    try {
      const deviceId = await getDeviceId();
      const access = await requestAI('user_local_001', deviceId, sanitizedInput);

      if (access && !access.authorized) {
        // Server explicitly denied or restricted — client must respect this
        const reason = access.reason || 'AI features are currently restricted.';
        const retryHint = access.retryAfterMs ? ` Try again in ${Math.ceil(access.retryAfterMs / 1000)}s.` : '';
        return {
          message: `🔒 ${reason}${retryHint}`,
          suggestions: [],
          confidence: 0,
          processingTimeMs: Date.now() - startTime,
          personality: context.personality || 'COACH',
          fromCloud: false,
          provider: 'AuthorityDenied',
          model: 'none',
          tier: 'none',
        };
      }

      // access === null means offline — fall through to local templates at bottom
      // access.authorized === true — proceed to cloud AI chain below
    } catch (_e) {
      if (__DEV__) console.warn('[AI] Authority check failed, falling through:', _e);
      // Non-fatal: proceed to cloud chain (server may be unreachable)
    }

    const chain = this.buildModelChain(sanitizedInput);
    for (const model of chain) {
      const provider = this.providers[model.provider];
      try {
        tamperEngine.recordAIRequestSent();
        sentinelRecordNetworkCall();
        microCheckTiming('ai_request');
        const cloud = await this.queryCloud(provider, model, sanitizedInput, context);
        tamperEngine.recordAIResponseReceived();
        microCheckTiming('ai_response');
        this.clearFailures(model.id);

        // Phase 16: Successful AI round-trip proves online — upgrade confidence to HIGH
        tamperEngine.updateVerificationConfidence('high');
        tamperEngine.recordConnectivitySignal();
        sentinelRecordConnectivity(true);

        // Phase 17: Queue session metrics for future backend reconciliation
        const metrics = tamperEngine.getSessionMetrics();
        if (metrics.reconciliationPending) {
          queueReconciliationBatch({
            offlineSignals: [], // Signals already reconciled in updateVerificationConfidence
            shadowFlags: {},
            offlineDurationMs: metrics.offlineDurationMs,
            riskScore: metrics.riskScore,
            deviceContext: metrics.deviceContext,
            createdAt: Date.now(),
          });
        }

        // Phase 18: Opportunistic bridge verification on successful AI round-trip
        // Server can confirm contradictions and verify entitlement against RevenueCat API.
        // Fire-and-forget — non-blocking, throttled, null = no-op.
        tamperEngine.requestBridgeVerification();

        // Apply silent degradation based on tamper risk
        await degradation.applyAIDelay(tamperEngine.getRiskLevel());
        if (degradation.shouldDowngradeAI(tamperEngine.getRiskLevel())) {
          // Downgrade: skip cloud response, return generic fallback
          return {
            message: degradation.getFallbackResponse(),
            suggestions: [],
            confidence: 0.7,
            processingTimeMs: Date.now() - startTime,
            personality: context.personality || 'COACH',
            fromCloud: true,
            provider: provider.displayName,
            model: model.displayName,
            tier: TIER_LABELS[model.tier].label,
            modelId: model.id,
          };
        }

        // Phase 14: Silent failure injection — subtly degrade response quality
        const finalText = degradation.injectSubtleFailure(cloud.text);

        // Persist encrypted
        encryptedDB.storeAIConversation(context.personality || 'COACH', sanitizedInput, finalText).catch((e) => {
          if (__DEV__) console.warn('[AI] conversation storage failed', e);
        });

        return {
          message: finalText,
          suggestions: cloud.suggestions,
          confidence: 0.95,
          processingTimeMs: Date.now() - startTime,
          personality: context.personality || 'COACH',
          fromCloud: true,
          provider: provider.displayName,
          model: model.displayName,
          tier: TIER_LABELS[model.tier].label,
          modelId: model.id,
        };
      } catch (e) {
        this.recordFailure(model.id);
        // Phase 18: Record connectivity failure for network reliability tracking
        tamperEngine.recordConnectivityFailure();
        if (__DEV__) console.warn(`[AI] ${model.displayName} failed:`, e);
      }
    }

    // All cloud models exhausted — offline fallback (English-only templates)
    const templateResponse = await dualAI.query(sanitizedInput, context);
    // Flag non-English users that response is English due to offline mode
    if (context.language && context.language !== 'en') {
      templateResponse.message = `⚡ *Offline mode — English only*\n\n${templateResponse.message}`;
    }
    return {
      ...templateResponse,
      fromCloud: false,
      provider: 'Offline',
      model: 'DualAI Templates',
      tier: 'Offline',
    };
  }

  // ─── Cloud API Call ───

  private async queryCloud(
    provider: ProviderConfig,
    model: ModelInfo,
    input: string,
    context: AIContext,
  ): Promise<CloudResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: buildAdaptiveSystemPrompt(context, input) },
    ];

    // Conversation history — respect model context window
    if (context.conversationHistory?.length) {
      const maxHistory = model.contextWindow >= 32768 ? 14 : model.contextWindow >= 8192 ? 8 : 4;
      const history = context.conversationHistory;

      // If conversation is long, summarize older messages for context
      if (history.length > maxHistory) {
        const olderMessages = history.slice(0, -maxHistory);
        const topics = olderMessages
          .filter((m) => m.role === 'user')
          .map((m) => m.content.slice(0, 50))
          .slice(-3);
        if (topics.length > 0) {
          messages.push({
            role: 'system',
            content: `Earlier in this conversation, the user discussed: ${topics.join('; ')}. Continue naturally from the recent context.`,
          });
        }
      }

      for (const msg of history.slice(-maxHistory)) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    messages.push({ role: 'user', content: input });

    let response: Response;
    try {
      if (isProxyEnabled()) {
        // ── PROXY MODE: keys stay server-side ──
        const deviceId = await getDeviceId();
        response = await fetch(PROXY_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Key': PROXY_APP_KEY,
            'X-Device-Id': deviceId,
          },
          signal: controller.signal,
          body: JSON.stringify({
            provider: provider.name,
            model: model.id,
            messages,
            temperature: 0.7,
            max_tokens: model.maxTokens,
            top_p: 0.9,
          }),
        });
      } else {
        // ── DIRECT MODE (dev): keys from SecureStore ──
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        };
        if (provider.name === 'openrouter') {
          headers['HTTP-Referer'] = 'https://fitquest.app';
          headers['X-Title'] = 'FitQuest Coach';
        }

        response = await fetch(provider.endpoint, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: model.id,
            messages,
            temperature: 0.7,
            max_tokens: model.maxTokens,
            top_p: 0.9,
          }),
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const status = response.status;

      // Permanent failures (auth/billing) — higher penalty to skip faster
      if (status === 401 || status === 402 || status === 403) {
        // Record multiple failures to cool down this model quickly
        this.recordFailure(model.id);
        this.recordFailure(model.id);
      }

      // 400 — model doesn't support required features (e.g. system messages)
      if (status === 400) {
        this.recordFailure(model.id);
        this.recordFailure(model.id);
        this.recordFailure(model.id);
      }

      // 404 — invalid model ID, record permanent failure
      if (status === 404) {
        this.recordFailure(model.id);
        this.recordFailure(model.id);
        this.recordFailure(model.id);
      }

      // 429 — rate limited: retry once after backoff before failing
      if (status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 5000) : 2000;
        await new Promise((r) => setTimeout(r, waitMs));
        // Record extra failure to accelerate cooldown for this model
        this.recordFailure(model.id);
      }

      throw new Error(`${provider.displayName}/${model.displayName} ${status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`Empty response from ${model.displayName}`);

    const suggestions = dualAI.getSmartSuggestions(context, input);
    return { text, suggestions };
  }
}

// Singleton
export const aiProvider = new AIProvider();
