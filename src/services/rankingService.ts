/**
 * FitQuest Ranking & Incentive System
 *
 * Research-backed naming inspired by martial arts belt systems, military ranks,
 * and fitness progression philosophy (body + mind unity).
 *
 * Milestone levels: 10, 20, 50, 100, 150, 230, 340, 400, 500, 550, 600, 650, 700, 850, 900, 999
 *
 * Naming philosophy:
 * - Levels 1-50: "Foundation" phase (beginner → awareness → discipline)
 * - Levels 50-150: "Growth" phase (practitioner → warrior → athlete)
 * - Levels 150-400: "Mastery" phase (master → sage → champion)
 * - Levels 400-700: "Transcendence" phase (titan → legend → immortal)
 * - Levels 700-999: "Ascendancy" phase (demigod → mythic → eternal)
 *
 * Each rank includes: title, subtitle (body+mind theme), icon, color accent,
 * XP multiplier (reward for consistency), and motivational quote.
 */

// ============================================
// TYPES
// ============================================

export interface RankMilestone {
  level: number;
  rank: string;
  title: string;
  subtitle: string;
  icon: string; // MaterialCommunityIcons name
  color: string; // Accent color for UI
  xpMultiplier: number; // 1.0 = base, higher = bonus
  quote: string;
  badge: string; // Short badge text
}

export interface RankTier {
  name: string;
  levelRange: [number, number];
  description: string;
  color: string;
}

export interface UserRankInfo {
  currentRank: RankMilestone;
  nextRank: RankMilestone | null;
  tier: RankTier;
  progressToNext: number; // 0-1
  levelsToNext: number;
  totalMilestones: number;
  milestonesAchieved: number;
  allRanks: RankMilestone[];
}

// ============================================
// RANK TIERS
// ============================================

export const RANK_TIERS: RankTier[] = [
  {
    name: 'Foundation',
    levelRange: [1, 49],
    description: 'Building the base — every rep shapes the foundation of a stronger you.',
    color: '#6B7280', // gray
  },
  {
    name: 'Growth',
    levelRange: [50, 149],
    description: 'Momentum builds. Your body adapts, your mind sharpens.',
    color: '#10B981', // green
  },
  {
    name: 'Mastery',
    levelRange: [150, 399],
    description: "Discipline becomes identity. You don't just train — you are the training.",
    color: '#3B82F6', // blue
  },
  {
    name: 'Transcendence',
    levelRange: [400, 699],
    description: 'Beyond limits. Where body and mind merge into one unstoppable force.',
    color: '#8B5CF6', // purple
  },
  {
    name: 'Ascendancy',
    levelRange: [700, 999],
    description: 'The pinnacle. Fewer than 0.1% ever reach this domain.',
    color: '#F59E0B', // gold
  },
];

// ============================================
// MILESTONE DEFINITIONS
// ============================================

export const RANK_MILESTONES: RankMilestone[] = [
  // ── FOUNDATION PHASE ──
  {
    level: 1,
    rank: 'Novice',
    title: 'The First Step',
    subtitle: 'Every journey begins with a single rep',
    icon: 'shoe-print',
    color: '#9CA3AF',
    xpMultiplier: 1.0,
    quote: '"The secret of getting ahead is getting started." — Mark Twain',
    badge: 'NOV',
  },
  {
    level: 10,
    rank: 'Initiate',
    title: 'Spark Ignited',
    subtitle: 'The flame of discipline has been lit',
    icon: 'fire',
    color: '#F97316',
    xpMultiplier: 1.05,
    quote: '"We are what we repeatedly do. Excellence is not an act, but a habit." — Aristotle',
    badge: 'INI',
  },
  {
    level: 20,
    rank: 'Apprentice',
    title: 'Mind Awakened',
    subtitle: 'Awareness transforms movement into purpose',
    icon: 'brain',
    color: '#06B6D4',
    xpMultiplier: 1.1,
    quote: '"The body achieves what the mind believes." — Napoleon Hill',
    badge: 'APR',
  },
  {
    level: 50,
    rank: 'Practitioner',
    title: 'Iron Will',
    subtitle: 'Consistency has forged unbreakable resolve',
    icon: 'shield-check',
    color: '#10B981',
    xpMultiplier: 1.15,
    quote: '"Strength does not come from the body. It comes from the will." — Gandhi',
    badge: 'PRC',
  },

  // ── GROWTH PHASE ──
  {
    level: 100,
    rank: 'Warrior',
    title: 'Century Strong',
    subtitle: 'One hundred levels of proof that you never quit',
    icon: 'sword-cross',
    color: '#EF4444',
    xpMultiplier: 1.2,
    quote: '"A warrior is not about perfection. It\'s about absolute vulnerability." — Brené Brown',
    badge: 'WAR',
  },
  {
    level: 150,
    rank: 'Vanguard',
    title: 'Elite Pioneer',
    subtitle: 'Leading from the front — body and mind in perfect sync',
    icon: 'flag-variant',
    color: '#3B82F6',
    xpMultiplier: 1.25,
    quote: '"The only person you are destined to become is the one you decide to be." — Emerson',
    badge: 'VAN',
  },

  // ── MASTERY PHASE ──
  {
    level: 230,
    rank: 'Sentinel',
    title: 'Guardian of Discipline',
    subtitle: 'Your consistency guards against every obstacle',
    icon: 'shield-star',
    color: '#6366F1',
    xpMultiplier: 1.3,
    quote: '"Mastery is not a function of genius but of time and intense focus." — Robert Greene',
    badge: 'SEN',
  },
  {
    level: 340,
    rank: 'Sage',
    title: 'Wisdom in Motion',
    subtitle: 'Knowledge of body mechanics meets philosophical depth',
    icon: 'book-open-page-variant',
    color: '#8B5CF6',
    xpMultiplier: 1.35,
    quote: '"No man is free who is not master of himself." — Epictetus',
    badge: 'SAG',
  },

  // ── TRANSCENDENCE PHASE ──
  {
    level: 400,
    rank: 'Champion',
    title: 'Apex Athlete',
    subtitle: 'Where raw power meets refined technique',
    icon: 'trophy',
    color: '#F59E0B',
    xpMultiplier: 1.4,
    quote: '"Champions aren\'t made in gyms. They are made from something deep inside." — Muhammad Ali',
    badge: 'CHP',
  },
  {
    level: 500,
    rank: 'Titan',
    title: 'Unshakeable Force',
    subtitle: 'An immovable pillar of strength and resilience',
    icon: 'diamond-stone',
    color: '#EC4899',
    xpMultiplier: 1.45,
    quote: '"The iron never lies. Two hundred pounds will always be two hundred pounds." — Henry Rollins',
    badge: 'TIT',
  },
  {
    level: 550,
    rank: 'Paragon',
    title: 'Perfect Standard',
    subtitle: 'The living definition of peak human potential',
    icon: 'star-circle',
    color: '#14B8A6',
    xpMultiplier: 1.5,
    quote: '"What we face may look insurmountable. But what I learned is that we are always stronger." — Arnold',
    badge: 'PAR',
  },
  {
    level: 600,
    rank: 'Legend',
    title: 'Beyond Mortal',
    subtitle: 'Stories will be told of this level of dedication',
    icon: 'crown',
    color: '#D97706',
    xpMultiplier: 1.55,
    quote: '"Legends are not born. They are built — one day, one set, one choice at a time."',
    badge: 'LEG',
  },
  {
    level: 650,
    rank: 'Overlord',
    title: 'Sovereign of Self',
    subtitle: 'Complete dominion over body, mind, and spirit',
    icon: 'chess-king',
    color: '#7C3AED',
    xpMultiplier: 1.6,
    quote: '"He who conquers himself is the mightiest warrior." — Confucius',
    badge: 'OVR',
  },

  // ── ASCENDANCY PHASE ──
  {
    level: 700,
    rank: 'Mythic',
    title: 'Realm of Myths',
    subtitle: 'Where human potential enters the domain of legend',
    icon: 'lightning-bolt',
    color: '#F43F5E',
    xpMultiplier: 1.7,
    quote:
      '"I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times." — Bruce Lee',
    badge: 'MYT',
  },
  {
    level: 850,
    rank: 'Immortal',
    title: 'Timeless Discipline',
    subtitle: 'Your commitment transcends the boundaries of ordinary existence',
    icon: 'infinity',
    color: '#C084FC',
    xpMultiplier: 1.8,
    quote: '"The ultimate aim of martial arts is not having to use them." — Miyamoto Musashi',
    badge: 'IMM',
  },
  {
    level: 900,
    rank: 'Eternal',
    title: 'Infinite Horizon',
    subtitle: 'The journey has no end — only deeper mastery',
    icon: 'atom-variant',
    color: '#60A5FA',
    xpMultiplier: 1.9,
    quote: '"There is no finish line." — Nike',
    badge: 'ETR',
  },
  {
    level: 999,
    rank: 'Transcendent',
    title: 'The Absolute',
    subtitle: 'Body and mind unified — the ultimate human expression',
    icon: 'star-four-points',
    color: '#FBBF24',
    xpMultiplier: 2.0,
    quote: '"What is the meaning of life? To be the best version of yourself, at every given moment."',
    badge: 'TRN',
  },
];

// ============================================
// RANK CALCULATION
// ============================================

/**
 * Get the current rank for a given level
 */
export function getCurrentRank(level: number): RankMilestone {
  let currentRank = RANK_MILESTONES[0]!;
  for (const milestone of RANK_MILESTONES) {
    if (level >= milestone.level) {
      currentRank = milestone;
    } else {
      break;
    }
  }
  return currentRank;
}

/**
 * Get the next rank milestone to achieve
 */
export function getNextRank(level: number): RankMilestone | null {
  for (const milestone of RANK_MILESTONES) {
    if (milestone.level > level) {
      return milestone;
    }
  }
  return null; // Already at max
}

/**
 * Get the tier for a given level
 */
export function getTier(level: number): RankTier {
  for (const tier of RANK_TIERS) {
    if (level >= tier.levelRange[0] && level <= tier.levelRange[1]) {
      return tier;
    }
  }
  return RANK_TIERS[RANK_TIERS.length - 1]!; // Default to highest tier
}

/**
 * Get comprehensive rank info for a user level
 */
export function getUserRankInfo(level: number): UserRankInfo {
  const currentRank = getCurrentRank(level);
  const nextRank = getNextRank(level);
  const tier = getTier(level);

  const milestonesAchieved = RANK_MILESTONES.filter((m) => level >= m.level).length;

  // Progress to next milestone
  let progressToNext = 0;
  let levelsToNext = 0;
  if (nextRank) {
    levelsToNext = nextRank.level - level;
    const rangeTotal = nextRank.level - currentRank.level;
    const rangeDone = level - currentRank.level;
    progressToNext = rangeTotal > 0 ? rangeDone / rangeTotal : 0;
  } else {
    progressToNext = 1; // Maxed out
  }

  return {
    currentRank,
    nextRank,
    tier,
    progressToNext,
    levelsToNext,
    totalMilestones: RANK_MILESTONES.length,
    milestonesAchieved,
    allRanks: RANK_MILESTONES,
  };
}

// ============================================
// LEVEL-UP QUOTES — unique quote for every level
// ============================================

const LEVEL_QUOTES: string[] = [
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"It does not matter how slowly you go as long as you do not stop." — Confucius',
  '"The body achieves what the mind believes." — Napoleon Hill',
  '"Strength does not come from the body. It comes from the will." — Gandhi',
  '"We are what we repeatedly do. Excellence is not an act, but a habit." — Aristotle',
  '"The only bad workout is the one that didn\'t happen."',
  '"Fall seven times, stand up eight." — Japanese proverb',
  '"Your body can stand almost anything. It\'s your mind you have to convince."',
  '"The pain you feel today will be the strength you feel tomorrow."',
  '"Discipline is choosing between what you want now and what you want most."',
  '"No matter how slow you go, you are still lapping everybody on the couch."',
  '"The only person you are destined to become is the person you decide to be." — Emerson',
  '"Don\'t count the days, make the days count." — Muhammad Ali',
  '"Success is not final, failure is not fatal: it is the courage to continue that counts." — Churchill',
  '"The harder the battle, the sweeter the victory." — Les Brown',
  '"You miss 100% of the shots you don\'t take." — Wayne Gretzky',
  '"Believe you can and you\'re halfway there." — Theodore Roosevelt',
  '"What seems impossible today will one day become your warm-up."',
  '"The greatest glory in living lies not in never falling, but in rising every time we fall." — Mandela',
  '"Sweat is fat crying."',
  '"Push yourself, because no one else is going to do it for you."',
  '"A champion is defined not by their wins but by how they recover when they fall."',
  '"The only limit is your mind."',
  '"Train insane or remain the same."',
  '"Success usually comes to those who are too busy to be looking for it." — Thoreau',
  '"If you want something you\'ve never had, you must be willing to do something you\'ve never done."',
  '"The difference between try and triumph is a little \'umph\'."',
  '"Energy and persistence conquer all things." — Benjamin Franklin',
  '"It always seems impossible until it\'s done." — Nelson Mandela',
  '"No citizen has a right to be an amateur in the matter of physical training." — Socrates',
  '"The iron never lies." — Henry Rollins',
  '"What hurts today makes you stronger tomorrow."',
  '"Action is the foundational key to all success." — Pablo Picasso',
  '"Do something today that your future self will thank you for."',
  '"Motivation is what gets you started. Habit is what keeps you going."',
  '"You don\'t have to be great to start, but you have to start to be great." — Zig Ziglar',
  '"The clock is ticking. Are you becoming the person you want to be?"',
  '"Strive for progress, not perfection."',
  '"The mind is the limit. As long as the mind can envision it, you can achieve it." — Arnold',
  '"Tough times don\'t last. Tough people do." — Robert Schuller',
  '"Champions aren\'t made in gyms. They are made from something deep inside." — Ali',
  '"I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times." — Bruce Lee',
  '"He who conquers himself is the mightiest warrior." — Confucius',
  '"Today I will do what others won\'t, so tomorrow I can accomplish what others can\'t."',
  '"Be stronger than your strongest excuse."',
  '"The last three or four reps is what makes the muscle grow." — Arnold Schwarzenegger',
  '"You are one workout away from a good mood."',
  '"The only way to define your limits is by going beyond them." — Arthur C. Clarke',
  '"Dead last finish is greater than did not finish, which trumps did not start."',
  '"Make yourself proud."',
  '"When you feel like quitting, think about why you started."',
  '"Your health is an investment, not an expense."',
  '"Endurance is not just the ability to bear a hard thing, but to turn it into glory." — William Barclay',
  '"If it doesn\'t challenge you, it won\'t change you."',
  '"Rise up, start fresh, see the bright opportunity in each new day."',
  '"Strength grows in the moments when you think you can\'t go on but you keep going."',
  '"The real workout starts when you want to stop."',
  '"Don\'t wish for it, work for it."',
  '"Your body is a reflection of your lifestyle."',
  '"The best project you\'ll ever work on is you."',
  '"A year from now you will wish you had started today."',
  '"Great things never come from comfort zones."',
  '"Sore today, strong tomorrow."',
  '"Excuses don\'t burn calories."',
  '"Small daily improvements over time lead to stunning results."',
  '"Every champion was once a contender that refused to give up." — Rocky Balboa',
  '"Fitness is not about being better than someone else. It\'s about being better than you used to be."',
  '"You\'re only one workout away from a good mood."',
  '"Wake up with determination. Go to bed with satisfaction."',
  '"The only impossible journey is the one you never begin." — Tony Robbins',
  '"One step at a time. One rep at a time. One day at a time."',
  '"Success is walking from failure to failure with no loss of enthusiasm." — Churchill',
  '"Your potential is endless. Go do what you were created to do."',
  '"If you\'re tired of starting over, stop giving up."',
  '"The will to win, the desire to succeed, the urge to reach your full potential."',
  '"Your future is created by what you do today, not tomorrow."',
  '"Don\'t stop until you\'re proud."',
  '"The pain of discipline is nothing like the pain of disappointment." — Justin Langer',
  '"Doubt kills more dreams than failure ever will."',
  '"It\'s not about having time, it\'s about making time."',
  '"Be the energy you want to attract."',
  '"You don\'t find willpower; you create it."',
  '"If you still look good after your workout, you didn\'t train hard enough."',
  '"Results happen over time, not overnight. Work hard, stay consistent, and be patient."',
  '"What we achieve inwardly will change outer reality." — Plutarch',
  '"Train like a beast, look like a beauty."',
  '"The only workout you\'ll regret is the one you didn\'t do."',
  '"Hard work beats talent when talent doesn\'t work hard."',
  '"Rome was not built in a day, but they worked on it every single day."',
  '"You are so much stronger than you think."',
  '"Dream big. Start small. Act now."',
  '"Be patient with yourself. Self-growth is tender."',
  '"Respect your body. It\'s the only one you get."',
  '"Don\'t limit your challenges. Challenge your limits."',
  '"Mind over matter. If you don\'t mind, it doesn\'t matter."',
  '"Once you learn to quit, it becomes a habit." — Vince Lombardi',
  '"Suffer the pain of discipline or suffer the pain of regret."',
  '"Nothing will work unless you do." — Maya Angelou',
  '"I hated every minute of training, but I said: Don\'t quit. Suffer now and live the rest of your life as a champion." — Ali',
  '"Persistence can change failure into extraordinary achievement." — Matt Biondi',
  '"The difference between a successful person and others is not a lack of strength or knowledge, but a lack of will." — Vince Lombardi',
];

/**
 * Get a deterministic motivational quote for any given level.
 * Returns a unique quote per level, cycling through the pool.
 */
export function getLevelQuote(level: number): string {
  return LEVEL_QUOTES[(level - 1) % LEVEL_QUOTES.length]!;
}

/**
 * Check if a level transition crosses a milestone boundary
 * Returns the new milestone if reached, null otherwise
 */
export function checkMilestoneReached(oldLevel: number, newLevel: number): RankMilestone | null {
  if (newLevel <= oldLevel) return null;

  for (const milestone of RANK_MILESTONES) {
    if (milestone.level > oldLevel && milestone.level <= newLevel) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get XP multiplier for current rank (rewards consistency)
 */
export function getXPMultiplier(level: number): number {
  const rank = getCurrentRank(level);
  return rank.xpMultiplier;
}

/**
 * Format rank display text
 */
export function formatRankDisplay(level: number): string {
  const rank = getCurrentRank(level);
  return `${rank.badge} Lv.${level} ${rank.rank}`;
}

/**
 * Calculate total XP needed to reach a specific milestone from level 1
 * Uses the XP formula: Level N needs N × 250 XP
 */
export function totalXPForMilestone(targetLevel: number): number {
  let total = 0;
  for (let l = 1; l < targetLevel; l++) {
    total += l * 250;
  }
  return total;
}
