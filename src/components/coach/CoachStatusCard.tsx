/**
 * CoachStatusCard — Visual readiness dashboard replacing text-dump status
 */
import React, { memo } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { GlassCard } from '../ui/GlassCard';
import ThemedText from '../ThemedText';
import { spacing, typography } from '../../design/theme-system';

export interface CoachStatusData {
  readiness: number;
  lastWorkout: string | null;
  fatiguePercent: number;
  freshMuscles: number;
  fatiguedMuscles: number;
  recommendedIntensity: string;
}

function getReadinessColor(score: number, colors: any) {
  if (score >= 70) return colors.success;
  if (score >= 40) return colors.warning;
  return colors.error;
}

function getIntensityIcon(intensity: string): string {
  switch (intensity.toLowerCase()) {
    case 'high': return 'fire';
    case 'moderate': return 'speedometer-medium';
    case 'low': return 'leaf';
    default: return 'speedometer-medium';
  }
}

export const CoachStatusCard = memo(function CoachStatusCard({ data }: { data: CoachStatusData }) {
  const { theme } = useTheme();
  const readinessColor = getReadinessColor(data.readiness, theme.colors);

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <GlassCard variant="card" style={{ marginHorizontal: spacing[4], marginBottom: spacing[3] }}>
        {/* Top row: Readiness score + intensity */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: readinessColor + '20',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <ThemedText style={{ fontSize: 18, fontWeight: '700', color: readinessColor }}>
                {data.readiness}
              </ThemedText>
            </View>
            <View>
              <ThemedText style={{ fontSize: typography.sizes.caption, color: theme.colors.textMuted }}>
                Readiness
              </ThemedText>
              <ThemedText style={{ fontSize: typography.sizes.body, fontWeight: '600', color: theme.colors.text }}>
                {data.readiness >= 70 ? 'Ready' : data.readiness >= 40 ? 'Moderate' : 'Rest'}
              </ThemedText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
            <MaterialCommunityIcons
              name={getIntensityIcon(data.recommendedIntensity) as any}
              size={18}
              color={theme.colors.accent}
            />
            <ThemedText style={{ fontSize: typography.sizes.caption, color: theme.colors.accent, fontWeight: '600', textTransform: 'capitalize' }}>
              {data.recommendedIntensity}
            </ThemedText>
          </View>
        </View>

        {/* Bottom row: 3 mini stats */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.textMuted} />
            <ThemedText style={{ fontSize: typography.sizes.caption, color: theme.colors.textMuted, marginTop: 2 }}>
              Last workout
            </ThemedText>
            <ThemedText style={{ fontSize: typography.sizes.body, fontWeight: '600', color: theme.colors.text }}>
              {data.lastWorkout ?? 'None'}
            </ThemedText>
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color={theme.colors.textMuted} />
            <ThemedText style={{ fontSize: typography.sizes.caption, color: theme.colors.textMuted, marginTop: 2 }}>
              Fatigue
            </ThemedText>
            <ThemedText style={{ fontSize: typography.sizes.body, fontWeight: '600', color: theme.colors.text }}>
              {data.fatiguePercent}%
            </ThemedText>
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <MaterialCommunityIcons name="arm-flex" size={16} color={theme.colors.textMuted} />
            <ThemedText style={{ fontSize: typography.sizes.caption, color: theme.colors.textMuted, marginTop: 2 }}>
              Muscles
            </ThemedText>
            <ThemedText style={{ fontSize: typography.sizes.body, fontWeight: '600', color: theme.colors.text }}>
              {data.freshMuscles} fresh
            </ThemedText>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});
