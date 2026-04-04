/**
 * Profile stats grid and achievements card.
 * Extracted from profile.tsx.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemedText from '../ThemedText';
import { GlassCard, ProgressRing, SectionHeader } from '../ui/GlassUI';
import { typography, spacing } from '../../design/theme-system';
import type { StatsData } from '../../viewmodels/useProfileViewModel';

interface StatsGridProps {
  stats: StatsData | null;
  totalSteps: number;
  totalDistance: number;
  recentDistance: number;
}

export function StatsGrid({ stats, totalSteps, totalDistance, recentDistance }: StatsGridProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(200)} style={s.statsContainer}>
      <GlassCard gradient glowColor={theme.colors.accent} style={s.statsCard}>
        {/* Primary Stats Row */}
        <View style={s.primaryStatsRow}>
          <View style={s.primaryStat}>
            <LinearGradient
              colors={[theme.colors.warning + '25', theme.colors.warning + '08'] as [string, string]}
              style={s.statIconCircle}
            >
              <MaterialCommunityIcons name="fire" size={20} color={theme.colors.warning} />
            </LinearGradient>
            <ThemedText style={[s.statValue, { color: theme.colors.text }]}>{stats?.streak || 0}</ThemedText>
            <ThemedText style={[s.statUnit, { color: theme.colors.textMuted }]}>{t('dashboard.streak')}</ThemedText>
          </View>
          <View style={[s.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={s.primaryStat}>
            <LinearGradient
              colors={[theme.colors.accent + '25', theme.colors.accent + '08'] as [string, string]}
              style={s.statIconCircle}
            >
              <MaterialCommunityIcons name="dumbbell" size={20} color={theme.colors.accent} />
            </LinearGradient>
            <ThemedText style={[s.statValue, { color: theme.colors.text }]}>{stats?.totalWorkouts || 0}</ThemedText>
            <ThemedText style={[s.statUnit, { color: theme.colors.textMuted }]}>{t('dashboard.workouts')}</ThemedText>
          </View>
          <View style={[s.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={s.primaryStat}>
            <LinearGradient
              colors={[theme.colors.purple + '25', theme.colors.purple + '08'] as [string, string]}
              style={s.statIconCircle}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={20} color={theme.colors.purple} />
            </LinearGradient>
            <ThemedText style={[s.statValue, { color: theme.colors.text }]}>{stats?.totalXP || 0}</ThemedText>
            <ThemedText style={[s.statUnit, { color: theme.colors.textMuted }]}>{t('dashboard.xp')}</ThemedText>
          </View>
        </View>

        <View style={[s.statsFullDivider, { backgroundColor: theme.colors.border }]} />

        {/* Secondary Stats Row */}
        <View style={s.secondaryStatsRow}>
          <View style={s.secondaryStat}>
            <MaterialCommunityIcons name="shoe-print" size={16} color={theme.colors.blue} />
            <ThemedText style={[s.secondaryValue, { color: theme.colors.text }]}>
              {totalSteps > 1000 ? `${(totalSteps / 1000).toFixed(1)}k` : `${totalSteps}`}
            </ThemedText>
            <ThemedText style={[s.secondaryLabel, { color: theme.colors.textMuted }]}>
              {t('profile.totalSteps') || 'Steps'}
            </ThemedText>
          </View>
          <View style={s.secondaryStat}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color={theme.colors.skyBlue} />
            <ThemedText style={[s.secondaryValue, { color: theme.colors.text }]}>{totalDistance}km</ThemedText>
            <ThemedText style={[s.secondaryLabel, { color: theme.colors.textMuted }]}>
              {t('profile.totalDistance') || 'Distance'}
            </ThemedText>
          </View>
          <View style={s.secondaryStat}>
            <MaterialCommunityIcons name="run" size={16} color={theme.colors.orange} />
            <ThemedText style={[s.secondaryValue, { color: theme.colors.text }]}>{recentDistance}km</ThemedText>
            <ThemedText style={[s.secondaryLabel, { color: theme.colors.textMuted }]}>
              {t('profile.bestRun') || 'Best Run'}
            </ThemedText>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

interface AchievementsCardProps {
  stats: StatsData | null;
}

export function AchievementsCard({ stats }: AchievementsCardProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={s.section}>
      <SectionHeader title={t('profile.achievements')} delay={300} />
      <GlassCard gradient delay={350}>
        <View style={s.achievementRow}>
          <View style={s.achievementItem}>
            <ProgressRing
              progress={Math.min((stats?.totalWorkouts || 0) / 50, 1)}
              size={56}
              strokeWidth={4}
              color={theme.colors.accent}
            >
              <MaterialCommunityIcons name="trophy" size={20} color={theme.colors.accent} />
            </ProgressRing>
            <ThemedText style={[s.achievementLabel, { color: theme.colors.text }]}>
              {stats?.totalWorkouts || 0}/50
            </ThemedText>
            <ThemedText style={[s.achievementSub, { color: theme.colors.textMuted }]}>
              {t('dashboard.workouts')}
            </ThemedText>
          </View>
          <View style={s.achievementItem}>
            <ProgressRing
              progress={Math.min((stats?.longestStreak || 0) / 30, 1)}
              size={56}
              strokeWidth={4}
              color={theme.colors.warning}
            >
              <MaterialCommunityIcons name="fire" size={20} color={theme.colors.warning} />
            </ProgressRing>
            <ThemedText style={[s.achievementLabel, { color: theme.colors.text }]}>
              {stats?.longestStreak || 0}/30
            </ThemedText>
            <ThemedText style={[s.achievementSub, { color: theme.colors.textMuted }]}>
              {t('profile.bestStreak')}
            </ThemedText>
          </View>
          <View style={s.achievementItem}>
            <ProgressRing
              progress={Math.min((stats?.level || 1) / 20, 1)}
              size={56}
              strokeWidth={4}
              color={theme.colors.accent}
            >
              <MaterialCommunityIcons name="star" size={20} color={theme.colors.accent} />
            </ProgressRing>
            <ThemedText style={[s.achievementLabel, { color: theme.colors.text }]}>LVL {stats?.level || 1}</ThemedText>
            <ThemedText style={[s.achievementSub, { color: theme.colors.textMuted }]}>
              {t('dashboard.level')}
            </ThemedText>
          </View>
        </View>
      </GlassCard>
    </View>
  );
}

const s = StyleSheet.create({
  statsContainer: {
    paddingHorizontal: spacing[4],
    marginTop: -8,
    marginBottom: spacing[3],
  },
  statsCard: { paddingVertical: spacing[5], paddingHorizontal: spacing[4] },
  primaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  primaryStat: { alignItems: 'center', flex: 1 },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  statValue: { fontSize: typography.sizes.h3, fontWeight: '800', letterSpacing: -0.5 },
  statUnit: { fontSize: typography.sizes.captionSm, fontWeight: '600', marginTop: spacing[0.5] },
  statDivider: { width: 1, height: 50, opacity: 0.5 },
  statsFullDivider: {
    height: 1,
    marginVertical: spacing[4],
    marginHorizontal: spacing[2.5],
    opacity: 0.4,
  },
  secondaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  secondaryStat: { alignItems: 'center', flex: 1, gap: spacing[1] },
  secondaryValue: { fontSize: typography.sizes.body, fontWeight: '700' },
  secondaryLabel: { fontSize: typography.sizes.xs, fontWeight: '600' },
  section: { paddingHorizontal: spacing[4], marginBottom: spacing[3] },
  achievementRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing[2] },
  achievementItem: { alignItems: 'center', gap: spacing[1.5] },
  achievementLabel: { fontSize: typography.sizes.bodySmall, fontWeight: '700' },
  achievementSub: { fontSize: typography.sizes.captionSm, fontWeight: '400' },
});
