/**
 * Profile header: avatar, name editing, goal badge, XP bar.
 * Extracted from profile.tsx.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import ThemedText from '../ThemedText';
import { typography, spacing, radius } from '../../design/theme-system';
import type { ProfileData, StatsData } from '../../viewmodels/useProfileViewModel';

interface ProfileHeaderProps {
  profile: ProfileData | null;
  stats: StatsData | null;
  xpProgress: number;
  goalInfo: { icon: string; color: string };
  goalLabel: string;
  profilePicUri: string | null;
  isEditingName: boolean;
  editNameValue: string;
  setEditNameValue: (v: string) => void;
  setIsEditingName: (v: boolean) => void;
  onSaveName: () => void;
  onPickPhoto: () => void;
}

export function ProfileHeader({
  profile,
  stats,
  xpProgress,
  goalInfo,
  goalLabel,
  profilePicUri,
  isEditingName,
  editNameValue,
  setEditNameValue,
  setIsEditingName,
  onSaveName,
  onPickPhoto,
}: ProfileHeaderProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <LinearGradient
        colors={
          theme.isDark
            ? ([`${theme.colors.indigo}40`, `${theme.colors.purple}1A`, 'transparent'] as [string, string, string])
            : ([`${theme.colors.indigo}1F`, `${theme.colors.purple}0D`, 'transparent'] as [string, string, string])
        }
        style={s.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={s.headerContent}>
            {/* Avatar */}
            <TouchableOpacity
              style={s.avatarGlowWrap}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              onPress={onPickPhoto}
            >
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.purple, theme.colors.pink] as [string, string, string]}
                style={s.avatarRing}
              >
                <View style={[s.avatarInner, { backgroundColor: theme.colors.background }]}>
                  {profilePicUri ? (
                    <Image source={{ uri: profilePicUri }} style={s.avatarGradient} />
                  ) : (
                    <LinearGradient
                      colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                      style={s.avatarGradient}
                    >
                      <ThemedText style={[s.avatarInitials, { color: theme.colors.text }]}>
                        {(profile?.name || 'A').charAt(0).toUpperCase()}
                      </ThemedText>
                    </LinearGradient>
                  )}
                </View>
              </LinearGradient>
              <View style={[s.cameraOverlay, { backgroundColor: theme.colors.accent }]}>
                <MaterialCommunityIcons name="camera" size={14} color={theme.colors.onAccent} />
              </View>
            </TouchableOpacity>

            {/* Editable Name */}
            <Animated.View entering={FadeInDown.delay(50).duration(150)}>
              {isEditingName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <TextInput
                    style={[
                      s.profileName,
                      {
                        color: theme.colors.text,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.accent,
                        minWidth: 120,
                        textAlign: 'center',
                        paddingBottom: spacing[0.5],
                      },
                    ]}
                    value={editNameValue}
                    onChangeText={setEditNameValue}
                    autoFocus
                    maxLength={24}
                    accessibilityLabel="Profile name"
                    accessibilityHint="Edit your display name, up to 24 characters"
                    onBlur={onSaveName}
                    onSubmitEditing={onSaveName}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setEditNameValue(profile?.name || 'Athlete');
                    setIsEditingName(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile name"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <ThemedText style={[s.profileName, { color: theme.colors.text }]}>
                      {profile?.name || 'Athlete'}
                    </ThemedText>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Goal badge */}
            <Animated.View entering={FadeInDown.delay(80).duration(150)}>
              <View style={[s.goalBadge, { backgroundColor: goalInfo.color + '20' }]}>
                <MaterialCommunityIcons name={goalInfo.icon as any} size={14} color={goalInfo.color} />
                <ThemedText style={[s.goalBadgeText, { color: goalInfo.color }]}>{goalLabel}</ThemedText>
              </View>
            </Animated.View>

            {/* Level & XP bar */}
            <Animated.View entering={FadeInDown.delay(100).duration(150)} style={s.xpWrap}>
              <View style={s.xpRow}>
                <View
                  style={[s.levelBadge, { backgroundColor: theme.colors.accent + '25' }]}
                  accessibilityLabel={`Level ${stats?.level || 1}`}
                >
                  <ThemedText style={[s.levelText, { color: theme.colors.accent }]}>LVL {stats?.level || 1}</ThemedText>
                </View>
                <ThemedText style={[s.xpLabel, { color: theme.colors.textMuted }]}>
                  {stats?.currentLevelXP || 0} / {stats?.xpForNext || 100} XP
                </ThemedText>
              </View>
              <View style={[s.xpBarBg, { backgroundColor: theme.colors.surfaceVariant }]}>
                <LinearGradient
                  colors={[theme.colors.accent, theme.colors.purple] as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.xpBarFill, { width: `${Math.min(xpProgress * 100, 100)}%` as any }]}
                />
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  headerGradient: { paddingBottom: spacing[6] },
  headerContent: {
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingHorizontal: spacing[6],
  },
  avatarGlowWrap: { marginBottom: spacing[4], position: 'relative' },
  avatarRing: { width: 96, height: 96, borderRadius: radius.full, padding: spacing[0.75] },
  avatarInner: { flex: 1, borderRadius: radius.full, padding: spacing[0.75], overflow: 'hidden' },
  avatarGradient: {
    flex: 1,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  avatarInitials: { fontSize: typography.sizes.h1, fontWeight: '700', letterSpacing: 1 },
  profileName: {
    fontSize: typography.sizes.h2,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: spacing[2],
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
    marginBottom: spacing[4],
    maxWidth: '80%',
  },
  goalBadgeText: { fontSize: typography.sizes.caption, fontWeight: '600', letterSpacing: 0.3, flexShrink: 1 },
  xpWrap: { width: '100%', maxWidth: 280 },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1.5],
  },
  levelBadge: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[0.75], borderRadius: radius.md },
  levelText: { fontSize: typography.sizes.captionSm, fontWeight: '700', letterSpacing: 0.5 },
  xpLabel: { fontSize: typography.sizes.captionSm, fontWeight: '500' },
  xpBarBg: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: radius.sm },
});
