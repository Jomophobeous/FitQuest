/**
 * Pattern Extraction & Scoring Engine
 * 
 * Converts raw API results into structured UI patterns.
 * Source-aware: photo sources (Pexels, Openverse) extract mood/color/atmosphere.
 * Design sources (Dribbble) extract UI components/layouts.
 * Scores on: relevance, minimalism, dark-mode, React Native scalability.
 */

// ─── FITNESS DOMAIN KEYWORDS (expanded) ───
const FITNESS_KEYWORDS = [
  // activities
  'fitness', 'workout', 'exercise', 'health', 'training', 'gym',
  'sport', 'run', 'jog', 'yoga', 'stretch', 'muscle', 'body',
  'weight', 'cardio', 'strength', 'endurance', 'pilates', 'hiit',
  'crossfit', 'calisthenics', 'boxing', 'martial', 'swimming',
  // body
  'athletic', 'physique', 'abs', 'core', 'bicep', 'tricep', 'leg',
  'squat', 'push-up', 'pull-up', 'plank', 'lunge', 'deadlift',
  // tracking
  'progress', 'tracker', 'dashboard', 'stats', 'analytics', 'chart',
  'metric', 'goal', 'step', 'calorie', 'heart rate', 'sleep',
  // equipment
  'dumbbell', 'barbell', 'kettlebell', 'mat', 'treadmill', 'bike',
  'resistance band', 'jump rope',
  // context
  'wellness', 'recovery', 'mobility', 'flexibility', 'posture',
  'warm-up', 'cool-down', 'rep', 'set',
];

const DARK_MODE_INDICATORS = [
  'dark', 'night', 'black', 'midnight', 'slate', 'charcoal',
  'deep', 'shadow', 'noir', 'matte', 'dim', 'moody', 'low light',
  'silhouette', 'backlit',
];

const MINIMAL_INDICATORS = [
  'minimal', 'clean', 'simple', 'modern', 'flat', 'sleek',
  'elegant', 'lightweight', 'sparse', 'whitespace', 'uncluttered',
  'subtle', 'monochrome', 'geometric',
];

const MOBILE_INDICATORS = [
  'mobile', 'app', 'ios', 'android', 'phone', 'responsive',
  'touch', 'swipe', 'scroll', 'tab', 'bottom nav', 'smartphone',
  'screen', 'interface', 'ui', 'ux',
];

// Source type classification
const PHOTO_SOURCES = ['pexels', 'openverse'];
const DESIGN_SOURCES = ['dribbble'];

// ─── COLOR ANALYSIS ───

/**
 * Check if a hex color is dark (luminance < 0.3)
 */
function isDarkColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substr(0, 2), 16) / 255;
  const g = parseInt(clean.substr(2, 2), 16) / 255;
  const b = parseInt(clean.substr(4, 2), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.3;
}

/**
 * Detect layout type from title/description
 */
function detectLayout(text) {
  const t = text.toLowerCase();
  if (t.includes('grid')) return 'grid';
  if (t.includes('list')) return 'list';
  if (t.includes('card')) return 'card-based';
  if (t.includes('tab')) return 'tabbed';
  if (t.includes('dashboard')) return 'dashboard';
  if (t.includes('onboarding') || t.includes('wizard')) return 'wizard';
  if (t.includes('profile')) return 'profile';
  if (t.includes('detail')) return 'detail';
  return 'single-screen';
}

/**
 * Detect UI components from text
 */
function detectComponents(text) {
  const t = text.toLowerCase();
  const components = [];
  const checks = [
    ['stat card', 'stat cards'],
    ['progress bar', 'progress bars'],
    ['chart', 'charts'],
    ['graph', 'graphs'],
    ['button', 'buttons'],
    ['avatar', 'avatars'],
    ['icon', 'icons'],
    ['navigation', 'navigation'],
    ['tab bar', 'tab bar'],
    ['modal', 'modals'],
    ['input', 'inputs'],
    ['toggle', 'toggles'],
    ['slider', 'sliders'],
    ['calendar', 'calendar'],
    ['timer', 'timer'],
    ['ring', 'progress rings'],
    ['badge', 'badges'],
    ['notification', 'notifications'],
  ];
  for (const [keyword, label] of checks) {
    if (t.includes(keyword)) components.push(label);
  }
  return components.length > 0 ? components : ['general UI'];
}

/**
 * Detect use case mapping to FitQuest screens
 */
function detectUseCase(text) {
  const t = text.toLowerCase();
  if (t.includes('onboarding') || t.includes('welcome') || t.includes('splash')) return 'FitQuest onboarding';
  if (t.includes('dashboard') || t.includes('home')) return 'FitQuest home screen';
  if (t.includes('workout') || t.includes('exercise') || t.includes('training')) return 'FitQuest workout screen';
  if (t.includes('profile') || t.includes('settings')) return 'FitQuest profile';
  if (t.includes('progress') || t.includes('stats') || t.includes('analytics')) return 'FitQuest progress tracker';
  if (t.includes('health') || t.includes('heart') || t.includes('sleep')) return 'FitQuest health dashboard';
  if (t.includes('nutrition') || t.includes('meal') || t.includes('food')) return 'FitQuest nutrition tracker';
  if (t.includes('read') || t.includes('library') || t.includes('book')) return 'FitMind reader';
  return 'FitQuest general';
}

// ─── SCORING (source-aware) ───

/**
 * Count keyword matches in text (handles multi-word keywords)
 */
function countMatches(text, keywords) {
  let count = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) count++;
  }
  return count;
}

/**
 * Score a result on 4 dimensions (0-25 each, total 0-100)
 * Photo sources scored differently from design sources
 */
function scoreResult(item) {
  const text = `${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
  const isPhoto = PHOTO_SOURCES.includes(item.source);

  // 1. Relevance to fitness (0-25)
  let relevance = 0;
  const fitnessHits = countMatches(text, FITNESS_KEYWORDS);
  if (isPhoto) {
    // Photos: generous scoring — each hit worth 5pts (photos have less metadata)
    relevance = fitnessHits * 5;
  } else {
    // Design: standard scoring — each hit worth 3pts
    relevance = fitnessHits * 3;
  }
  relevance = Math.min(relevance, 25);

  // 2. Minimalism (0-25)
  let minimalism = 5; // base score
  const minimalHits = countMatches(text, MINIMAL_INDICATORS);
  minimalism += minimalHits * 4;
  // Photo bonus: low text content implies minimalism
  if (isPhoto && text.length < 80) minimalism += 5;
  minimalism = Math.min(minimalism, 25);

  // 3. Dark-mode compatibility (0-25)
  let darkMode = 0;
  const darkHits = countMatches(text, DARK_MODE_INDICATORS);
  darkMode += darkHits * 5;
  if (item.avg_color && isDarkColor(item.avg_color)) darkMode += 12;
  darkMode = Math.min(darkMode, 25);

  // 4. Scalability to React Native / mobile (0-25)
  let scalability = 0;
  const mobileHits = countMatches(text, MOBILE_INDICATORS);
  scalability += mobileHits * 4;
  // Portrait orientation = mobile-friendly
  if (item.width && item.height && item.height > item.width) scalability += 8;
  // Photo-specific: smartphone or screen in description
  if (isPhoto && (text.includes('smartphone') || text.includes('phone') || text.includes('screen') || text.includes('app'))) {
    scalability += 6;
  }
  scalability = Math.min(scalability, 25);

  const total = relevance + minimalism + darkMode + scalability;

  return {
    total,
    breakdown: { relevance, minimalism, darkMode, scalability },
  };
}

// ─── EXTRACTION (source-aware) ───

/**
 * Extract a structured pattern from a raw API result
 * Photo sources → mood board (color palette, atmosphere, visual direction)
 * Design sources → UI pattern (layout, components, interactions)
 */
function extractPattern(item) {
  const text = `${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`;
  const score = scoreResult(item);
  const isPhoto = PHOTO_SOURCES.includes(item.source);

  if (isPhoto) {
    return extractPhotoPattern(item, text, score);
  }
  return extractDesignPattern(item, text, score);
}

/**
 * Photo sources → mood/color/atmosphere extraction
 */
function extractPhotoPattern(item, text, score) {
  const t = text.toLowerCase();
  const mood = detectMood(t);
  const fitnessContext = detectFitnessContext(t);
  const colorPalette = extractColors(item);

  return {
    source: item.source,
    id: item.id,
    type: 'mood_reference',
    pattern: fitnessContext.pattern || mood.pattern,
    layout: detectLayout(text),
    mood: mood.mood,
    atmosphere: mood.atmosphere,
    colors: colorPalette,
    components: inferComponentsFromPhoto(t, fitnessContext),
    use_case: fitnessContext.use_case || detectUseCase(text),
    image_ref: item.thumbnail || item.image_url,
    title: item.title || '',
    creator: item.creator || 'Unknown',
    attribution: item.attribution || `${item.source} — ${item.creator || 'Unknown'}`,
    score: score.total,
    score_breakdown: score.breakdown,
    license: item.license || 'See source',
  };
}

/**
 * Design sources → UI component/layout extraction
 */
function extractDesignPattern(item, text, score) {
  return {
    source: item.source,
    id: item.id,
    type: 'ui_pattern',
    pattern: detectPatternType(text),
    layout: detectLayout(text),
    colors: extractColors(item),
    components: detectComponents(text),
    use_case: detectUseCase(text),
    image_ref: item.thumbnail || item.image_url,
    title: item.title || '',
    creator: item.creator || 'Unknown',
    attribution: item.attribution || `${item.source} — ${item.creator || 'Unknown'}`,
    score: score.total,
    score_breakdown: score.breakdown,
    license: item.license || 'See source',
  };
}

/**
 * Detect mood / atmosphere from photo description
 */
function detectMood(text) {
  if (text.includes('dark') || text.includes('night') || text.includes('shadow') || text.includes('silhouette')) {
    return { mood: 'dark-intense', atmosphere: 'dramatic', pattern: 'dark atmospheric reference' };
  }
  if (text.includes('sunrise') || text.includes('sunset') || text.includes('golden')) {
    return { mood: 'warm-energetic', atmosphere: 'motivational', pattern: 'warm energy reference' };
  }
  if (text.includes('clean') || text.includes('white') || text.includes('bright') || text.includes('minimal')) {
    return { mood: 'clean-minimal', atmosphere: 'fresh', pattern: 'minimal clean reference' };
  }
  if (text.includes('urban') || text.includes('city') || text.includes('street')) {
    return { mood: 'urban-gritty', atmosphere: 'street', pattern: 'urban mood reference' };
  }
  if (text.includes('nature') || text.includes('outdoor') || text.includes('mountain') || text.includes('forest')) {
    return { mood: 'natural-calm', atmosphere: 'organic', pattern: 'natural environment reference' };
  }
  return { mood: 'neutral', atmosphere: 'ambient', pattern: 'visual mood reference' };
}

/**
 * Detect fitness context from photo description
 */
function detectFitnessContext(text) {
  if (text.includes('gym') || text.includes('weight') || text.includes('dumbbell') || text.includes('barbell')) {
    return { pattern: 'gym/strength training reference', use_case: 'FitQuest workout screen', context: 'strength' };
  }
  if (text.includes('yoga') || text.includes('stretch') || text.includes('flexibility') || text.includes('mat')) {
    return { pattern: 'yoga/mobility reference', use_case: 'FitQuest workout screen', context: 'mobility' };
  }
  if (text.includes('run') || text.includes('jog') || text.includes('sprint') || text.includes('treadmill')) {
    return { pattern: 'cardio/running reference', use_case: 'FitQuest move screen', context: 'cardio' };
  }
  if (text.includes('smartphone') || text.includes('phone') || text.includes('app') || text.includes('screen')) {
    return { pattern: 'mobile app context reference', use_case: 'FitQuest onboarding', context: 'app' };
  }
  if (text.includes('food') || text.includes('meal') || text.includes('nutrition') || text.includes('healthy eating')) {
    return { pattern: 'nutrition visual reference', use_case: 'FitQuest nutrition tracker', context: 'nutrition' };
  }
  if (text.includes('sleep') || text.includes('rest') || text.includes('recovery')) {
    return { pattern: 'recovery/wellness reference', use_case: 'FitQuest health dashboard', context: 'recovery' };
  }
  if (text.includes('exercise') || text.includes('workout') || text.includes('training') || text.includes('fitness')) {
    return { pattern: 'general fitness reference', use_case: 'FitQuest workout screen', context: 'fitness' };
  }
  return {};
}

/**
 * Infer UI components from photo context
 * Photos don't show UI, but the fitness context suggests appropriate components
 */
function inferComponentsFromPhoto(text, fitnessCtx) {
  const components = [];

  // Infer from fitness context
  switch (fitnessCtx.context) {
    case 'strength':
      components.push('exercise card', 'rep counter', 'progress bar', 'muscle map');
      break;
    case 'mobility':
      components.push('timer display', 'pose guide', 'stretch indicator');
      break;
    case 'cardio':
      components.push('pace display', 'distance tracker', 'route map', 'heart rate');
      break;
    case 'app':
      components.push('onboarding carousel', 'CTA button', 'feature highlights');
      break;
    case 'nutrition':
      components.push('macro rings', 'meal card', 'calorie counter');
      break;
    case 'recovery':
      components.push('sleep score ring', 'recovery meter', 'rest timer');
      break;
    case 'fitness':
      components.push('workout card', 'exercise list', 'timer');
      break;
  }

  // Infer from photo content
  if (text.includes('timer') || text.includes('clock') || text.includes('stopwatch')) components.push('timer');
  if (text.includes('chart') || text.includes('graph') || text.includes('data')) components.push('chart');
  if (text.includes('notification') || text.includes('alert')) components.push('notification badge');

  return components.length > 0 ? [...new Set(components)] : ['mood reference — no direct UI'];
}

/**
 * Detect pattern type from text
 */
function detectPatternType(text) {
  const t = text.toLowerCase();
  if (t.includes('dashboard')) return 'card-based dashboard';
  if (t.includes('onboarding')) return 'onboarding flow';
  if (t.includes('login') || t.includes('sign in')) return 'authentication screen';
  if (t.includes('profile')) return 'profile layout';
  if (t.includes('chart') || t.includes('graph') || t.includes('analytics')) return 'data visualization';
  if (t.includes('workout') || t.includes('exercise')) return 'workout interface';
  if (t.includes('card')) return 'card-based layout';
  if (t.includes('list')) return 'list layout';
  return 'general UI pattern';
}

/**
 * Extract colors from result metadata
 */
function extractColors(item) {
  const colors = [];
  if (item.avg_color) colors.push(item.avg_color);

  // FitQuest theme colors as reference overlay
  colors.push('#0A0E17'); // dark background
  colors.push('#10B981'); // accent green

  return [...new Set(colors)];
}

// ─── SAFETY FILTERS ───

/**
 * Reject results that don't meet quality standards
 */
function applyFilters(patterns) {
  return patterns.filter((p) => {
    // Reject overly complex (too many components detected)
    if (p.components.length > 8) return false;

    // Reject non-mobile (landscape-only indicators)
    if (p.layout === 'desktop-only') return false;

    return true;
  });
}

// ─── MAIN PIPELINE ───

/**
 * Process raw results into scored, filtered, top-3 patterns
 * @param {Array} rawResults - Combined results from all sources
 * @param {number} topN - How many to keep (default 3)
 * @returns {Array} Top scored patterns
 */
function processResults(rawResults, topN = 3) {
  // Extract patterns
  const patterns = rawResults.map(extractPattern);

  // Apply safety filters
  const filtered = applyFilters(patterns);

  // Sort by score descending
  filtered.sort((a, b) => b.score - a.score);

  // Keep top N
  return filtered.slice(0, topN);
}

module.exports = {
  extractPattern,
  scoreResult,
  processResults,
  applyFilters,
  isDarkColor,
  detectLayout,
  detectComponents,
  detectUseCase,
  detectMood,
  detectFitnessContext,
  inferComponentsFromPhoto,
};
