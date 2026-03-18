/**
 * FitQuest Rank Display Component
 * Shows current rank badge, tier, and progress to next milestone
 * Uses glass-morphism design consistent with app theme
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import type { ThemeMode } from '../design/theme-system';
import { getUserRankInfo, getLevelQuote, type UserRankInfo, type RankMilestone } from '../services/rankingService';
import { GlassCard, ProgressRing } from './ui/GlassUI';

/** 
 * Get theme-aware color — replaces green with gold in blackGold mode 
 */
function getThemedColor(color: string, themeMode: ThemeMode): string {
  if (themeMode !== 'blackGold') return color;
  // Map green variants to gold in blackGold theme
  const greenToGoldMap: Record<string, string> = {
    '#10B981': '#C9A84C', // emerald green → champagne gold
    '#3D9E6F': '#C9A84C', // muted green → gold
    '#059669': '#C9A84C', // darker green → gold
  };
  return greenToGoldMap[color.toUpperCase()] || greenToGoldMap[color] || color;
}

interface RankBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Compact rank badge — shows icon + rank name + level
 */
export function RankBadge({ level, size = 'md' }: RankBadgeProps) {
  const { theme, mode } = useTheme();
  const rankInfo = getUserRankInfo(level);
  const { currentRank } = rankInfo;
  const rankColor = getThemedColor(currentRank.color, mode);

  const sizes = {
    sm: { icon: 14, font: 10, pad: 6, height: 26 },
    md: { icon: 18, font: 12, pad: 8, height: 32 },
    lg: { icon: 22, font: 14, pad: 10, height: 38 },
  };
  const s = sizes[size];

  return (
    <View style={[styles.badge, {
      backgroundColor: rankColor + '20',
      borderColor: rankColor + '40',
      paddingHorizontal: s.pad,
      height: s.height,
    }]}>
      <MaterialCommunityIcons
        name={currentRank.icon as any}
        size={s.icon}
        color={rankColor}
      />
      <Text style={[styles.badgeText, {
        color: rankColor,
        fontSize: s.font,
      }]}>
        {currentRank.rank}
      </Text>
      <Text style={[styles.badgeLevel, {
        color: theme.colors.textMuted,
        fontSize: s.font - 1,
      }]}>
        Lv.{level}
      </Text>
    </View>
  );
}

interface RankCardProps {
  level: number;
  totalXP: number;
  showQuote?: boolean;
}

/**
 * Full rank card — shows rank, tier, progress ring, next milestone
 */
export function RankCard({ level, totalXP, showQuote = true }: RankCardProps) {
  const { theme, mode } = useTheme();
  const rankInfo = getUserRankInfo(level);
  const { currentRank, nextRank, tier, progressToNext, levelsToNext, milestonesAchieved, totalMilestones } = rankInfo;
  const rankColor = getThemedColor(currentRank.color, mode);
  const tierColor = getThemedColor(tier.color, mode);

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(200)}>
      <GlassCard gradient glowColor={rankColor} style={styles.rankCard}>
        {/* Top: Rank icon + info */}
        <View style={styles.rankTop}>
          <Animated.View entering={ZoomIn.delay(200).duration(200)}>
            <LinearGradient
              colors={[rankColor + '30', rankColor + '08'] as [string, string]}
              style={styles.rankIconCircle}
            >
              <MaterialCommunityIcons
                name={currentRank.icon as any}
                size={36}
                color={rankColor}
              />
            </LinearGradient>
          </Animated.View>
          <View style={styles.rankInfo}>
            <Text style={[styles.rankName, { color: rankColor }]}>
              {currentRank.rank}
            </Text>
            <Text style={[styles.rankTitle, { color: theme.colors.text }]}>
              {currentRank.title}
            </Text>
            <Text style={[styles.rankSubtitle, { color: theme.colors.textMuted }]}>
              {currentRank.subtitle}
            </Text>
          </View>
        </View>

        {/* Tier badge */}
        <View style={[styles.tierBadge, { backgroundColor: tierColor + '15', borderColor: tierColor + '30' }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {tier.name} Tier
          </Text>
          <Text style={[styles.tierDesc, { color: theme.colors.textMuted }]}>
            {milestonesAchieved}/{totalMilestones} milestones
          </Text>
        </View>

        {/* Progress to next milestone */}
        {nextRank && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: theme.colors.textSecondary }]}>
                Next: {nextRank.rank} (Lv.{nextRank.level})
              </Text>
              <Text style={[styles.progressLevels, { color: theme.colors.textMuted }]}>
                {levelsToNext} levels away
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}>
              <View style={[styles.progressFill, {
                width: `${Math.round(progressToNext * 100)}%`,
                backgroundColor: rankColor,
              }]} />
            </View>
          </View>
        )}

        {/* Motivational quote — unique per level */}
        {showQuote && (
          <Text style={[styles.quote, { color: theme.colors.textMuted }]}>
            {getLevelQuote(level)}
          </Text>
        )}

        {/* XP + Level display */}
        <View style={[styles.statsRow, { borderTopColor: theme.colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {totalXP.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
              Total XP
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {level}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
              Level
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: currentRank.color }]}>
              ×{currentRank.xpMultiplier.toFixed(1)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
              XP Bonus
            </Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

interface MilestoneListProps {
  currentLevel: number;
  maxVisible?: number;
}

/**
 * Vertical milestone timeline — shows achieved + upcoming milestones
 */
export function MilestoneList({ currentLevel, maxVisible = 6 }: MilestoneListProps) {
  const { theme, mode } = useTheme();
  const rankInfo = getUserRankInfo(currentLevel);
  const { allRanks } = rankInfo;

  // Show milestones around current level (some achieved, some upcoming)
  const currentIndex = allRanks.findIndex(r => r.level > currentLevel);
  const startIndex = Math.max(0, (currentIndex === -1 ? allRanks.length : currentIndex) - 2);
  const visibleRanks = allRanks.slice(startIndex, startIndex + maxVisible);

  return (
    <View style={styles.milestoneList}>
      {visibleRanks.map((milestone, i) => {
        const achieved = currentLevel >= milestone.level;
        const isCurrent = getCurrentRankForMilestone(currentLevel, allRanks) === milestone;
        const milestoneColor = getThemedColor(milestone.color, mode);

        return (
          <Animated.View
            key={milestone.level}
            entering={FadeInDown.delay(i * 80).duration(150)}
          >
            <View style={styles.milestoneRow}>
              {/* Timeline line */}
              <View style={styles.timelineCol}>
                {i > 0 && (
                  <View style={[styles.timelineLine, {
                    backgroundColor: achieved ? milestoneColor + '60' : theme.colors.border,
                  }]} />
                )}
                <View style={[styles.timelineDot, {
                  backgroundColor: achieved ? milestoneColor : theme.colors.surfaceVariant,
                  borderColor: isCurrent ? milestoneColor : (achieved ? milestoneColor + '60' : theme.colors.border),
                  borderWidth: isCurrent ? 3 : 1,
                }]}>
                  {achieved && (
                    <MaterialCommunityIcons
                      name={milestone.icon as any}
                      size={14}
                      color="#fff"
                    />
                  )}
                </View>
                {i < visibleRanks.length - 1 && (
                  <View style={[styles.timelineLine, {
                    backgroundColor: achieved ? milestoneColor + '40' : theme.colors.border,
                  }]} />
                )}
              </View>

              {/* Milestone info */}
              <View style={[styles.milestoneInfo, {
                opacity: achieved ? 1 : 0.5,
              }]}>
                <View style={styles.milestoneHeader}>
                  <Text style={[styles.milestoneName, {
                    color: achieved ? milestoneColor : theme.colors.textMuted,
                  }]}>
                    {milestone.rank}
                  </Text>
                  <Text style={[styles.milestoneLevel, {
                    color: theme.colors.textMuted,
                  }]}>
                    Lv.{milestone.level}
                  </Text>
                </View>
                <Text style={[styles.milestoneTitle, {
                  color: achieved ? theme.colors.text : theme.colors.textMuted,
                }]}>
                  {milestone.title}
                </Text>
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// Helper
function getCurrentRankForMilestone(level: number, ranks: RankMilestone[]): RankMilestone | null {
  let current: RankMilestone | null = ranks[0] ?? null;
  for (const r of ranks) {
    if (level >= r.level) current = r;
    else break;
  }
  return current;
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: '700',
  },
  badgeLevel: {
    fontWeight: '600',
  },

  // Rank Card
  rankCard: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  rankTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  rankIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rankTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  rankSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // Tier
  tierBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  tierText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tierDesc: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Progress
  progressSection: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressLevels: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Quote
  quote: {
    fontSize: 11,
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // Milestone List
  milestoneList: {
    paddingVertical: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineCol: {
    width: 36,
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneInfo: {
    flex: 1,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '700',
  },
  milestoneLevel: {
    fontSize: 11,
    fontWeight: '500',
  },
  milestoneTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
});

export default RankBadge;
