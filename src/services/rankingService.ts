/**
 * Ranking Service Stub
 * Provides rank info, level quotes, and XP multipliers for the gamification system.
 * Stubbed after core extraction — will be rebuilt from FitQ backup.
 */

export interface RankMilestone {
  level: number;
  rank: string;
  name: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  description: string;
  xpMultiplier: number;
}

export interface RankTier {
  name: string;
  color: string;
}

const DEFAULT_RANKS: RankMilestone[] = [
  {
    level: 1,
    rank: 'Recruit',
    name: 'Recruit',
    title: 'Fresh Start',
    subtitle: 'Every journey begins with a single step',
    icon: 'shoe-print',
    color: '#6B7280',
    description: 'Just getting started',
    xpMultiplier: 1.0,
  },
  {
    level: 5,
    rank: 'Apprentice',
    name: 'Apprentice',
    title: 'Foundation Builder',
    subtitle: 'Building the habits that last',
    icon: 'arm-flex',
    color: '#3B82F6',
    description: 'Building foundations',
    xpMultiplier: 1.1,
  },
  {
    level: 10,
    rank: 'Warrior',
    name: 'Warrior',
    title: 'Consistent Fighter',
    subtitle: 'Discipline defines you',
    icon: 'sword-cross',
    color: '#10B981',
    description: 'Consistent fighter',
    xpMultiplier: 1.2,
  },
  {
    level: 20,
    rank: 'Champion',
    name: 'Champion',
    title: 'Dedicated Athlete',
    subtitle: 'Others look up to you',
    icon: 'trophy',
    color: '#F59E0B',
    description: 'Dedicated athlete',
    xpMultiplier: 1.4,
  },
  {
    level: 35,
    rank: 'Elite',
    name: 'Elite',
    title: 'Peak Performer',
    subtitle: 'The top tier of discipline',
    icon: 'fire',
    color: '#EF4444',
    description: 'Peak performance',
    xpMultiplier: 1.7,
  },
  {
    level: 50,
    rank: 'Legend',
    name: 'Legend',
    title: 'Unstoppable Force',
    subtitle: 'You are the standard',
    icon: 'crown',
    color: '#8B5CF6',
    description: 'Unstoppable force',
    xpMultiplier: 2.0,
  },
];

const TIERS: RankTier[] = [
  { name: 'Bronze', color: '#CD7F32' },
  { name: 'Silver', color: '#C0C0C0' },
  { name: 'Gold', color: '#FFD700' },
  { name: 'Platinum', color: '#E5E4E2' },
];

export interface RankInfo {
  currentRank: RankMilestone;
  nextRank: RankMilestone | null;
  allRanks: RankMilestone[];
  progress: number;
  tier: RankTier;
  progressToNext: number;
  levelsToNext: number;
  milestonesAchieved: number;
  totalMilestones: number;
}

const FALLBACK_RANK: RankMilestone = DEFAULT_RANKS[0]!;

export function getUserRankInfo(level: number): RankInfo {
  let currentRank: RankMilestone = FALLBACK_RANK;
  let nextRank: RankMilestone | null = DEFAULT_RANKS[1] ?? null;
  let milestonesAchieved = 0;

  for (let i = DEFAULT_RANKS.length - 1; i >= 0; i--) {
    const rank = DEFAULT_RANKS[i];
    if (rank && level >= rank.level) {
      currentRank = rank;
      nextRank = DEFAULT_RANKS[i + 1] ?? null;
      milestonesAchieved = i + 1;
      break;
    }
  }

  const progressToNext = nextRank ? (level - currentRank.level) / (nextRank.level - currentRank.level) : 1;

  const levelsToNext = nextRank ? nextRank.level - level : 0;

  // Determine tier based on milestones
  const tierIndex = Math.min(Math.floor(milestonesAchieved / 2), TIERS.length - 1);
  const tier = TIERS[tierIndex] ?? TIERS[0]!;

  return {
    currentRank,
    nextRank,
    allRanks: DEFAULT_RANKS,
    progress: progressToNext,
    tier,
    progressToNext,
    levelsToNext,
    milestonesAchieved,
    totalMilestones: DEFAULT_RANKS.length,
  };
}

const QUOTES = [
  'Every rep counts.',
  'Stay consistent.',
  'Discipline beats motivation.',
  'Your body adapts. Push further.',
  'Champions are made in the dark.',
  'Progress, not perfection.',
];

export function getLevelQuote(level: number): string {
  return QUOTES[level % QUOTES.length] ?? 'Every rep counts.';
}

export function getXPMultiplier(level: number): number {
  if (level >= 50) return 2.0;
  if (level >= 35) return 1.7;
  if (level >= 20) return 1.4;
  if (level >= 10) return 1.2;
  return 1.0;
}
