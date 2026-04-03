/**
 * FitQuest Profile Screen
 * Premium glass-morphism profile with live stats, settings, and theme toggle
 *
 * Architecture: Pure UI — all data/service access via useProfileViewModel.
 */

import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  Pressable,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { GlassCard, GradientButton, ProgressRing, SectionHeader } from '../src/components/ui/GlassUI';
import { RankCard, RankBadge, MilestoneList } from '../src/components/RankDisplay';
import { useProfileViewModel, GOAL_LABELS, MEAL_REGION_VALUES, type MealRegionValue, type ProfileData, type StatsData } from '../src/viewmodels/useProfileViewModel';
import { typography, spacing } from '../src/design/theme-system';

// ============================================
// THEMED PICKER MODAL
// ============================================

interface PickerOption {
  label: string;
  value: string;
}

interface ThemedPickerModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
  destructiveIndex?: number;
}

function ThemedPickerModal({
  visible,
  title,
  subtitle,
  options,
  onSelect,
  onClose,
  destructiveIndex,
}: ThemedPickerModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={modalStyles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss dialog"
      >
        <Pressable
          style={[
            modalStyles.content,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[modalStyles.title, { color: theme.colors.text }]}>{title}</Text>
          {!!subtitle && <Text style={[modalStyles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>}

          <ScrollView style={modalStyles.optionsList} showsVerticalScrollIndicator={false} bounces={false}>
            {options.map((opt, i) => {
              const isDestructive = destructiveIndex === i;
              return (
                <TouchableOpacity
                  key={`${opt.value}-${i}`}
                  style={[
                    modalStyles.optionItem,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  onPress={() => {
                    onClose();
                    onSelect(opt.value);
                  }}
                >
                  <Text
                    style={[
                      modalStyles.optionText,
                      {
                        color: isDestructive ? theme.colors.error : theme.colors.text,
                        fontWeight: isDestructive ? '600' : '500',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[
              modalStyles.cancelBtn,
              {
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[modalStyles.cancelText, { color: theme.colors.accent }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  content: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: spacing[5],
    borderWidth: 1,
    maxHeight: '80%',
  },
  title: {
    fontSize: typography.sizes.h4, 
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[1],
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: typography.sizes.label, 
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  optionsList: {
    gap: spacing[1.5],
    marginBottom: spacing[3],
  },
  optionItem: {
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    fontSize: typography.sizes.bodyMid, 
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    paddingVertical: spacing[3.5],
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: typography.sizes.bodyMid, 
    fontWeight: '600',
  },
});

// ============================================
// MENU ITEM COMPONENT
// ============================================

function MenuItem({
  icon,
  label,
  sublabel,
  color,
  onPress,
  delay = 0,
  rightContent,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  color: string;
  onPress?: () => void;
  delay?: number;
  rightContent?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(150)}>
      <Animated.View style={animStyle}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          onPressIn={() => {
            scale.value = withTiming(0.97, { duration: 120 });
          }}
          onPressOut={() => {
            scale.value = withTiming(1, { duration: 120 });
          }}
          accessibilityRole="button"
          accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
          style={[
            styles.menuItem,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: color + '18' }]}>
            <MaterialCommunityIcons name={icon as any} size={18} color={color} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{label}</Text>
            {!!sublabel && (
              <Text numberOfLines={3} style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                {sublabel}
              </Text>
            )}
          </View>
          {rightContent || <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================
// HELPERS
// ============================================

/** Translate a 0–2 adaptive metric into a user-friendly label */
function adaptiveLabel(value: number): string {
  if (value <= 0.6) return 'Very Low';
  if (value <= 0.85) return 'Low';
  if (value <= 1.15) return 'Normal';
  if (value <= 1.4) return 'High';
  return 'Very High';
}

// ============================================
// SCREEN
// ============================================

export default function ProfileScreen() {
  const vm = useProfileViewModel();
  const {
    theme, mode, setMode, t, languageName, router, accessState,
    profile, stats, loading, loadError, adaptiveProfile, socialSettings, socialBusy,
    mealRegionOverride, notificationSettings, biometricAvailable, biometricEnabled,
    healthProviderCode, healthIntegrationReady, healthBusy, healthConnectEnabled,
    healthSyncErrors, equipmentLevel, profilePicUri, isEditingName, editNameValue,
    totalSteps, totalDistance, recentDistance, mindXP, professionSchedule,
    consentTimestamp, consentVersion, consentSource, privacyBusy,
    showLanguageSelector, setShowLanguageSelector, showThemePicker, setShowThemePicker,
    showAboutModal, setShowAboutModal, showHelpModal, setShowHelpModal,
    showScheduleModal, setShowScheduleModal, expandedAdaptive, setExpandedAdaptive,
    setIsEditingName, setEditNameValue, scheduleEdit, setScheduleEdit,
    pickerModal, closePicker,
    handleTrainingDays, handleSessionLength, handleWorkSchedule, handleExperience,
    handleGoalChange, handleEquipmentLevel, handleMealRegion, handleNotifications,
    handleHealthConnectSettings, handleSyncHealth, handleLogout, handleRecordConsent,
    handleExportData, handleDeleteCloudData, handleSocialToggle, handlePickPhoto,
    handleSaveName, handleSaveSchedule, handleBiometricTest, handleDismissHealthErrors,
    retryLoad,
    goalInfo, goalLabel, xpProgress, mealRegionLabel,
    healthConnectSublabel, healthSyncSublabel, notificationSublabel, biometricSublabel,
    scheduleLabel, subscriptionLabel, subscriptionSublabel, subscriptionIcon,
  } = vm;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Animated.View entering={ZoomIn} style={{ alignItems: 'center' }}>
          <MaterialCommunityIcons name="account-circle" size={48} color={theme.colors.accent} />
          <ThemedText variant="bodySmall" color="muted" style={{ marginTop: spacing[2] }}>
            {t('profile.loading') || 'Loading profile...'}
          </ThemedText>
        </Animated.View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
        ]}
      >
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>{loadError}</ThemedText>
        <GradientButton title="Retry" onPress={retryLoad} style={{ marginTop: spacing[4] }} />
      </View>
    );
  }

  return (
    <ScreenErrorBoundary
      screenName="Profile"
      onGoBack={() => (router.canGoBack() ? router.back() : router.replace('/dashboard' as any))}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScreenTutorial
          screenKey="profile"
          icon="account-circle"
          title="Your Profile"
          description="View and edit your fitness profile, track your stats, manage equipment preferences, and customize app settings."
        />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* ── PROFILE HEADER ── */}
          <Animated.View entering={FadeIn.duration(150)}>
            <LinearGradient
              colors={
                theme.isDark
                  ? ([`${theme.colors.indigo}40`, `${theme.colors.purple}1A`, 'transparent'] as [
                      string,
                      string,
                      string,
                    ])
                  : ([`${theme.colors.indigo}1F`, `${theme.colors.purple}0D`, 'transparent'] as [
                      string,
                      string,
                      string,
                    ])
              }
              style={styles.headerGradient}
            >
              <SafeAreaView edges={['top']}>
                <View style={styles.headerContent}>
                  {/* Avatar with tap-to-change photo */}
                  <TouchableOpacity
                    style={styles.avatarGlowWrap}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile photo"
                    onPress={handlePickPhoto}
                  >
                    <LinearGradient
                      colors={[theme.colors.accent, theme.colors.purple, theme.colors.pink] as [string, string, string]}
                      style={styles.avatarRing}
                    >
                      <View style={[styles.avatarInner, { backgroundColor: theme.colors.background }]}>
                        {profilePicUri ? (
                          <Image source={{ uri: profilePicUri }} style={styles.avatarGradient} />
                        ) : (
                          <LinearGradient
                            colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                            style={styles.avatarGradient}
                          >
                            <Text style={[styles.avatarInitials, { color: theme.colors.text }]}>
                              {(profile?.name || 'A').charAt(0).toUpperCase()}
                            </Text>
                          </LinearGradient>
                        )}
                      </View>
                    </LinearGradient>
                    <View style={[styles.cameraOverlay, { backgroundColor: theme.colors.accent }]}>
                      <MaterialCommunityIcons name="camera" size={14} color={theme.colors.onAccent} />
                    </View>
                  </TouchableOpacity>

                  {/* Editable Name & goal */}
                  <Animated.View entering={FadeInDown.delay(50).duration(150)}>
                    {isEditingName ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                        <TextInput
                          style={[
                            styles.profileName,
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
                          onBlur={handleSaveName}
                          onSubmitEditing={handleSaveName}
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
                          <Text style={[styles.profileName, { color: theme.colors.text }]}>
                            {profile?.name || 'Athlete'}
                          </Text>
                          <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.textMuted} />
                        </View>
                      </TouchableOpacity>
                    )}
                  </Animated.View>

                  <Animated.View entering={FadeInDown.delay(80).duration(150)}>
                    <View style={[styles.goalBadge, { backgroundColor: goalInfo.color + '20' }]}>
                      <MaterialCommunityIcons name={goalInfo.icon as any} size={14} color={goalInfo.color} />
                      <Text style={[styles.goalBadgeText, { color: goalInfo.color }]}>{goalLabel}</Text>
                    </View>
                  </Animated.View>

                  {/* Level & XP bar */}
                  <Animated.View entering={FadeInDown.delay(100).duration(150)} style={styles.xpWrap}>
                    <View style={styles.xpRow}>
                      <View
                        style={[styles.levelBadge, { backgroundColor: theme.colors.accent + '25' }]}
                        accessibilityLabel={`Level ${stats?.level || 1}`}
                      >
                        <Text style={[styles.levelText, { color: theme.colors.accent }]}>LVL {stats?.level || 1}</Text>
                      </View>
                      <Text style={[styles.xpLabel, { color: theme.colors.textMuted }]}>
                        {stats?.currentLevelXP || 0} / {stats?.xpForNext || 100} XP
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.xpBarBg,
                        {
                          backgroundColor: theme.colors.surfaceVariant,
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={[theme.colors.accent, theme.colors.purple] as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.xpBarFill, { width: `${Math.min(xpProgress * 100, 100)}%` as any }]}
                      />
                    </View>
                  </Animated.View>
                </View>
              </SafeAreaView>
            </LinearGradient>
          </Animated.View>

          {/* ── STATS GRID — Premium Overview ── */}
          <Animated.View entering={FadeInDown.delay(200).duration(200)} style={styles.statsContainer}>
            <GlassCard gradient glowColor={theme.colors.accent} style={styles.statsCard}>
              {/* Primary Stats Row */}
              <View style={styles.primaryStatsRow}>
                <View style={styles.primaryStat}>
                  <LinearGradient
                    colors={[theme.colors.warning + '25', theme.colors.warning + '08'] as [string, string]}
                    style={styles.statIconCircle}
                  >
                    <MaterialCommunityIcons name="fire" size={20} color={theme.colors.warning} />
                  </LinearGradient>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats?.streak || 0}</Text>
                  <Text style={[styles.statUnit, { color: theme.colors.textMuted }]}>{t('dashboard.streak')}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.primaryStat}>
                  <LinearGradient
                    colors={[theme.colors.accent + '25', theme.colors.accent + '08'] as [string, string]}
                    style={styles.statIconCircle}
                  >
                    <MaterialCommunityIcons name="dumbbell" size={20} color={theme.colors.accent} />
                  </LinearGradient>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats?.totalWorkouts || 0}</Text>
                  <Text style={[styles.statUnit, { color: theme.colors.textMuted }]}>{t('dashboard.workouts')}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.primaryStat}>
                  <LinearGradient
                    colors={[theme.colors.purple + '25', theme.colors.purple + '08'] as [string, string]}
                    style={styles.statIconCircle}
                  >
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color={theme.colors.purple} />
                  </LinearGradient>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats?.totalXP || 0}</Text>
                  <Text style={[styles.statUnit, { color: theme.colors.textMuted }]}>{t('dashboard.xp')}</Text>
                </View>
              </View>

              {/* Divider Line */}
              <View style={[styles.statsFullDivider, { backgroundColor: theme.colors.border }]} />

              {/* Secondary Stats Row */}
              <View style={styles.secondaryStatsRow}>
                <View style={styles.secondaryStat}>
                  <MaterialCommunityIcons name="shoe-print" size={16} color={theme.colors.blue} />
                  <Text style={[styles.secondaryValue, { color: theme.colors.text }]}>
                    {totalSteps > 1000 ? `${(totalSteps / 1000).toFixed(1)}k` : `${totalSteps}`}
                  </Text>
                  <Text style={[styles.secondaryLabel, { color: theme.colors.textMuted }]}>
                    {t('profile.totalSteps') || 'Steps'}
                  </Text>
                </View>
                <View style={styles.secondaryStat}>
                  <MaterialCommunityIcons name="map-marker-distance" size={16} color={theme.colors.skyBlue} />
                  <Text style={[styles.secondaryValue, { color: theme.colors.text }]}>{totalDistance}km</Text>
                  <Text style={[styles.secondaryLabel, { color: theme.colors.textMuted }]}>
                    {t('profile.totalDistance') || 'Distance'}
                  </Text>
                </View>
                <View style={styles.secondaryStat}>
                  <MaterialCommunityIcons name="run" size={16} color={theme.colors.orange} />
                  <Text style={[styles.secondaryValue, { color: theme.colors.text }]}>{recentDistance}km</Text>
                  <Text style={[styles.secondaryLabel, { color: theme.colors.textMuted }]}>
                    {t('profile.bestRun') || 'Best Run'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ── RANK & MILESTONES ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.rank') || 'Rank & Progress'} delay={250} />
            <RankCard level={stats?.level || 1} totalXP={stats?.totalXP || 0} showQuote={true} />
            <View style={{ marginTop: spacing[2] }}>
              <GlassCard style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
                <MilestoneList currentLevel={stats?.level || 1} maxVisible={5} />
              </GlassCard>
            </View>
          </View>

          {/* ── MIND XP ── */}
          <View style={styles.section}>
            <SectionHeader title={'Mind XP'} delay={275} />
            <GlassCard gradient delay={280}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
                <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.purple + '18' }]}>
                  <MaterialCommunityIcons name="head-lightbulb-outline" size={22} color={theme.colors.purple} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text style={[styles.menuLabel, { color: theme.colors.text, fontSize: typography.sizes.body }]}>Craft My Mind</Text>
                  <Text style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                    {mindXP?.total_mind_xp || 0} Mind XP
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: theme.colors.warning + '25',
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[0.75],
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: theme.colors.warning, fontSize: typography.sizes.xs, fontWeight: '700', letterSpacing: 0.5 }}>
                    COMING SOON
                  </Text>
                </View>
              </View>
              <View style={{ opacity: 0.5 }}>
                <View style={styles.achievementRow}>
                  <View style={styles.achievementItem}>
                    <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                      {mindXP?.pages_read_total || 0}
                    </Text>
                    <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>Pages Read</Text>
                  </View>
                  <View style={styles.achievementItem}>
                    <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                      {mindXP?.flashcards_reviewed_total || 0}
                    </Text>
                    <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>Cards Reviewed</Text>
                  </View>
                  <View style={styles.achievementItem}>
                    <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                      {mindXP?.documents_completed || 0}
                    </Text>
                    <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>Books Done</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* ── ACHIEVEMENTS CARD ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.achievements')} delay={300} />
            <GlassCard gradient delay={350}>
              <View style={styles.achievementRow}>
                <View style={styles.achievementItem}>
                  <ProgressRing
                    progress={Math.min((stats?.totalWorkouts || 0) / 50, 1)}
                    size={56}
                    strokeWidth={4}
                    color={theme.colors.accent}
                  >
                    <MaterialCommunityIcons name="trophy" size={20} color={theme.colors.accent} />
                  </ProgressRing>
                  <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                    {stats?.totalWorkouts || 0}/50
                  </Text>
                  <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>
                    {t('dashboard.workouts')}
                  </Text>
                </View>
                <View style={styles.achievementItem}>
                  <ProgressRing
                    progress={Math.min((stats?.longestStreak || 0) / 30, 1)}
                    size={56}
                    strokeWidth={4}
                    color={theme.colors.warning}
                  >
                    <MaterialCommunityIcons name="fire" size={20} color={theme.colors.warning} />
                  </ProgressRing>
                  <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                    {stats?.longestStreak || 0}/30
                  </Text>
                  <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>
                    {t('profile.bestStreak')}
                  </Text>
                </View>
                <View style={styles.achievementItem}>
                  <ProgressRing
                    progress={Math.min((stats?.level || 1) / 20, 1)}
                    size={56}
                    strokeWidth={4}
                    color={theme.colors.accent}
                  >
                    <MaterialCommunityIcons name="star" size={20} color={theme.colors.accent} />
                  </ProgressRing>
                  <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>LVL {stats?.level || 1}</Text>
                  <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>{t('dashboard.level')}</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* ── SUBSCRIPTION STATUS ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.subscription') || 'Subscription'} delay={350} />
            <MenuItem
              icon={subscriptionIcon}
              label={subscriptionLabel}
              sublabel={subscriptionSublabel}
              color={accessState === 'EXPIRED' ? theme.colors.error : theme.colors.accent}
              delay={370}
              onPress={accessState !== 'SUBSCRIBED' ? () => router.push('/paywall') : undefined}
            />
          </View>

          {/* ── TRAINING PROFILE ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.trainingProfile')} delay={400} />
            <MenuItem
              icon="target"
              label={t('profile.trainingGoal')}
              sublabel={`${goalLabel} — ${t('profile.trainingGoalSub')}`}
              color={goalInfo.color}
              delay={440}
              onPress={handleGoalChange}
            />
            <MenuItem
              icon="calendar-week"
              label={t('profile.trainingDays')}
              sublabel={`${profile?.trainingDays || 3} ${t('profile.daysPerWeek')} — ${t('profile.trainingDaysSub')}`}
              color={theme.colors.indigo}
              delay={460}
              onPress={handleTrainingDays}
            />
            <MenuItem
              icon="clock-outline"
              label={t('profile.sessionLength')}
              sublabel={`${profile?.sessionMinutes || 30} ${t('common.minutes')} — ${t('profile.sessionLengthSub')}`}
              color={theme.colors.accent}
              delay={480}
              onPress={handleSessionLength}
            />
            <MenuItem
              icon="signal-cellular-3"
              label={t('profile.experience')}
              sublabel={`${(profile?.experience || 'beginner').charAt(0).toUpperCase() + (profile?.experience || 'beginner').slice(1)} — ${t('profile.experienceSub')}`}
              color={theme.colors.warning}
              delay={500}
              onPress={handleExperience}
            />
            <MenuItem
              icon="dumbbell"
              label={t('profile.equipmentLevel')}
              sublabel={`${t(`profile.equipment.${equipmentLevel}`)} — ${t('profile.equipmentLevelSub')}`}
              color={theme.colors.accent2}
              delay={510}
              onPress={handleEquipmentLevel}
            />
            <MenuItem
              icon="human-edit"
              label={t('profile.craftMyBody')}
              sublabel={t('profile.craftMyBodySub')}
              color={theme.colors.pink}
              delay={520}
              onPress={() => router.push('/craft-my-body')}
            />
            <MenuItem
              icon="briefcase-clock-outline"
              label="Work Schedule"
              sublabel={scheduleLabel}
              color={theme.colors.blue}
              delay={530}
              onPress={handleWorkSchedule}
            />
          </View>

          {/* ── ADAPTIVE PROFILE ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.adaptiveTraining')} delay={530} />
            <GlassCard delay={560}>
              <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, marginBottom: spacing[3], lineHeight: 18 }}>
                {t('profile.adaptiveExplanation')}
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedAdaptive(expandedAdaptive === 'fatigue' ? null : 'fatigue')}
                accessibilityRole="button"
                accessibilityLabel={`Fatigue sensitivity${expandedAdaptive === 'fatigue' ? ', expanded' : ''}`}
              >
                <View style={styles.adaptiveRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <MaterialCommunityIcons name="heart-pulse" size={16} color={theme.colors.error} />
                    <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>
                      {t('profile.fatigueSensitivity')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                      {adaptiveLabel(adaptiveProfile ? adaptiveProfile.fatigueSensitivity : 1)}
                    </Text>
                    <MaterialCommunityIcons
                      name={expandedAdaptive === 'fatigue' ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              {expandedAdaptive === 'fatigue' && (
                <Animated.View entering={FadeInDown.duration(150)} style={{ paddingLeft: spacing[6], paddingBottom: spacing[2] }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, lineHeight: 18 }}>
                    {t('profile.fatigueSensitivityDesc')}
                  </Text>
                </Animated.View>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedAdaptive(expandedAdaptive === 'progression' ? null : 'progression')}
                accessibilityRole="button"
                accessibilityLabel={`Progression pace${expandedAdaptive === 'progression' ? ', expanded' : ''}`}
              >
                <View style={styles.adaptiveRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <MaterialCommunityIcons name="trending-up" size={16} color={theme.colors.accent} />
                    <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>
                      {t('profile.progressionPace')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                      {adaptiveLabel(adaptiveProfile ? adaptiveProfile.progressionAggressiveness : 1)}
                    </Text>
                    <MaterialCommunityIcons
                      name={expandedAdaptive === 'progression' ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              {expandedAdaptive === 'progression' && (
                <Animated.View entering={FadeInDown.duration(150)} style={{ paddingLeft: spacing[6], paddingBottom: spacing[2] }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, lineHeight: 18 }}>
                    {t('profile.progressionPaceDesc')}
                  </Text>
                </Animated.View>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedAdaptive(expandedAdaptive === 'volume' ? null : 'volume')}
                accessibilityRole="button"
                accessibilityLabel={`Volume tolerance${expandedAdaptive === 'volume' ? ', expanded' : ''}`}
              >
                <View style={styles.adaptiveRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <MaterialCommunityIcons name="weight-lifter" size={16} color={theme.colors.warning} />
                    <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>
                      {t('profile.volumeTolerance')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                      {adaptiveLabel(adaptiveProfile ? adaptiveProfile.volumeTolerance : 1)}
                    </Text>
                    <MaterialCommunityIcons
                      name={expandedAdaptive === 'volume' ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              {expandedAdaptive === 'volume' && (
                <Animated.View entering={FadeInDown.duration(150)} style={{ paddingLeft: spacing[6], paddingBottom: spacing[2] }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, lineHeight: 18 }}>
                    {t('profile.volumeToleranceDesc')}
                  </Text>
                </Animated.View>
              )}

              <View style={[styles.adaptiveConfidenceTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View
                  style={[
                    styles.adaptiveConfidenceFill,
                    {
                      width: `${Math.round((adaptiveProfile?.confidence ?? 0) * 100)}%` as any,
                      backgroundColor: theme.colors.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.adaptiveConfidenceText, { color: theme.colors.textMuted }]}>
                Learning your patterns ({adaptiveProfile?.samples ?? 0} workouts analyzed)
              </Text>

              {adaptiveProfile?.rationale?.map((line, index) => (
                <Text key={`${line}_${index}`} style={[styles.adaptiveReason, { color: theme.colors.textMuted }]}>
                  • {line}
                </Text>
              ))}
            </GlassCard>
          </View>

          {/* ── PREFERENCES ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.preferences')} delay={500} />
            <MenuItem
              icon="account-group-outline"
              label={t('profile.socialLayer')}
              sublabel={socialSettings?.enabled ? t('profile.socialLayerOn') : t('profile.socialLayerOff')}
              color={theme.colors.blue}
              delay={535}
              onPress={() => {
                void handleSocialToggle(!(socialSettings?.enabled ?? false));
              }}
              rightContent={
                <Switch
                  value={socialSettings?.enabled ?? false}
                  onValueChange={(next) => {
                    void handleSocialToggle(next);
                  }}
                  disabled={socialBusy}
                  trackColor={{ false: theme.colors.border, true: theme.colors.blue + '60' }}
                  thumbColor={(socialSettings?.enabled ?? false) ? theme.colors.blue : theme.colors.surface}
                  accessibilityRole="switch"
                  accessibilityLabel="Social layer"
                  accessibilityState={{ checked: socialSettings?.enabled ?? false }}
                />
              }
            />
            <MenuItem
              icon={mode === 'blackGold' ? 'crown' : mode === 'dark' ? 'weather-night' : 'weather-sunny'}
              label="Theme"
              sublabel={mode === 'blackGold' ? 'Premium' : mode === 'dark' ? 'Charcoal' : 'Light'}
              color={mode === 'blackGold' ? theme.colors.accent3 : theme.colors.purple}
              delay={550}
              onPress={() => setShowThemePicker(true)}
            />
            <MenuItem
              icon="translate"
              label={t('profile.language')}
              sublabel={languageName}
              color={theme.colors.blue}
              delay={575}
              onPress={() => setShowLanguageSelector(true)}
            />
            <MenuItem
              icon="map-marker-radius-outline"
              label={t('profile.mealRegion.title')}
              sublabel={mealRegionLabel(mealRegionOverride)}
              color={theme.colors.accent}
              delay={590}
              onPress={handleMealRegion}
            />
            <MenuItem
              icon="bell-outline"
              label={t('profile.notifications')}
              sublabel={notificationSublabel}
              color={theme.colors.pink}
              delay={600}
              onPress={handleNotifications}
            />
            <MenuItem
              icon="heart-pulse"
              label={t('profile.healthConnect')}
              sublabel={healthConnectSublabel}
              color={healthConnectEnabled ? theme.colors.accent : theme.colors.textMuted}
              delay={605}
              onPress={handleHealthConnectSettings}
            />
            <MenuItem
              icon="sync"
              label={t('profile.healthSync')}
              sublabel={healthSyncSublabel}
              color={theme.colors.blue}
              delay={608}
              onPress={() => {
                void handleSyncHealth();
              }}
            />

            {/* Compact Health Sync Errors */}
            {healthSyncErrors.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(612).duration(200)}
                style={[
                  styles.healthErrorsContainer,
                  { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.error + '40' },
                ]}
              >
                <View style={styles.healthErrorsHeader}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} />
                  <Text style={[styles.healthErrorsTitle, { color: theme.colors.error }]}>
                    {t('profile.healthSyncIssues') || 'Recent Sync Issues'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleDismissHealthErrors}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss sync errors"
                  >
                    <Text style={[styles.healthErrorsDismiss, { color: theme.colors.textMuted }]}>
                      {t('common.dismiss') || 'Dismiss'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {healthSyncErrors.slice(0, 3).map((err) => (
                  <Text
                    key={err.id}
                    numberOfLines={1}
                    style={[styles.healthErrorItem, { color: theme.colors.textSecondary }]}
                  >
                    • {err.message}
                  </Text>
                ))}
                {healthSyncErrors.length > 3 && (
                  <Text style={[styles.healthErrorMore, { color: theme.colors.textMuted }]}>
                    +{healthSyncErrors.length - 3} {t('common.more') || 'more'}
                  </Text>
                )}
              </Animated.View>
            )}

            <MenuItem
              icon="fingerprint"
              label={t('profile.biometricLock') || 'Biometric Lock'}
              sublabel={biometricSublabel}
              color={theme.colors.indigo}
              delay={610}
              onPress={handleBiometricTest}
            />
          </View>

          {/* ── PRIVACY & LEGAL ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.privacyLegal')} delay={620} />
            <MenuItem
              icon="book-open-page-variant-outline"
              label={t('profile.legalCenter')}
              sublabel={t('profile.legalCenterSub')}
              color={theme.colors.blue}
              delay={630}
              onPress={() => router.push('/legal-center')}
            />
            <MenuItem
              icon="shield-check-outline"
              label={t('profile.privacySecurity')}
              sublabel={t('profile.privacySecuritySub')}
              color={theme.colors.accent}
              delay={640}
              onPress={() => router.push('/privacy-policy')}
            />
            <MenuItem
              icon="check-decagram-outline"
              label={t('profile.recordConsent') || 'Data Consent'}
              sublabel={
                consentTimestamp
                  ? `${t('profile.consentAccepted') || 'Accepted'} ${new Date(consentTimestamp).toLocaleDateString()} · v${consentVersion || '-'}`
                  : t('profile.recordConsentSub') || 'Accept privacy policy & terms to use all features'
              }
              color={theme.colors.accent}
              delay={650}
              onPress={() => {
                void handleRecordConsent();
              }}
            />
            <MenuItem
              icon="file-export-outline"
              label={t('profile.exportData')}
              sublabel={t('profile.exportDataSub')}
              color={theme.colors.indigo}
              delay={660}
              onPress={() => {
                void handleExportData();
              }}
            />
            <MenuItem
              icon="trash-can-outline"
              label={t('profile.menu.deleteCloudData')}
              sublabel={t('profile.deleteCloudDataSub')}
              color={theme.colors.error}
              delay={670}
              onPress={handleDeleteCloudData}
            />
          </View>

          {/* ── APP INFO ── */}
          <View style={styles.section}>
            <SectionHeader title={t('profile.appSection')} delay={650} />
            <MenuItem
              icon="backup-restore"
              label={t('profile.backupRestore')}
              sublabel={t('profile.backupRestoreSub')}
              color={theme.colors.accent}
              delay={680}
              onPress={() => router.push('/backups')}
            />
            <MenuItem
              icon="help-circle-outline"
              label={t('profile.helpSupport')}
              sublabel={t('profile.helpSupportSub')}
              color={theme.colors.warning}
              delay={700}
              onPress={() => setShowHelpModal(true)}
            />
            <MenuItem
              icon="information-outline"
              label={t('profile.about')}
              sublabel={`${t('profile.version')} 1.0.0`}
              color={theme.colors.indigo}
              delay={720}
              onPress={() => setShowAboutModal(true)}
            />
            <MenuItem
              icon="sitemap"
              label="App Sitemap"
              sublabel="All screens & navigation"
              color={theme.colors.indigo}
              delay={740}
              onPress={() => router.push('/sitemap' as any)}
            />
          </View>

          {/* ── FEEDBACK & BUG REPORT ── */}
          <View style={styles.section}>
            <SectionHeader title="Feedback" delay={750} />
            <MenuItem
              icon="message-star-outline"
              label="Review & Bug Report"
              sublabel="Help us improve FitQuest"
              color={theme.colors.accent}
              delay={760}
              onPress={() => router.push('/feedback' as any)}
            />
          </View>

          {/* ── LOGOUT ── */}
          <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.logoutSection}>
            <TouchableOpacity
              style={[
                styles.logoutBtn,
                {
                  backgroundColor: theme.colors.error + '10',
                },
              ]}
              onPress={handleLogout}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <MaterialCommunityIcons name="logout" size={18} color={theme.colors.error} />
              <Text style={[styles.logoutText, { color: theme.colors.error }]}>{t('profile.logout')}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Theme Picker Modal */}
        <ThemedPickerModal
          visible={showThemePicker}
          title="Choose Theme"
          subtitle="Select your preferred app appearance"
          options={[
            { label: '🖤  Charcoal', value: 'dark' },
            { label: '☀️  Light', value: 'light' },
            { label: '👑  Premium', value: 'blackGold' },
          ]}
          onSelect={(value) => setMode(value as 'dark' | 'light' | 'blackGold')}
          onClose={() => setShowThemePicker(false)}
        />

        {/* Language Selector Modal */}
        <LanguageSelector visible={showLanguageSelector} onClose={() => setShowLanguageSelector(false)} />

        {/* Themed Picker Modal (replaces native Alert.alert) */}
        <ThemedPickerModal
          visible={pickerModal.visible}
          title={pickerModal.title}
          subtitle={pickerModal.subtitle}
          options={pickerModal.options}
          onSelect={pickerModal.onSelect}
          onClose={closePicker}
          destructiveIndex={pickerModal.destructiveIndex}
        />

        {/* Work Schedule Modal */}
        <Modal
          visible={showScheduleModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowScheduleModal(false)}
        >
          <Pressable style={modalStyles.overlay} onPress={() => setShowScheduleModal(false)}>
            <Pressable
              style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[modalStyles.title, { color: theme.colors.text }]}>Work Schedule</Text>
              <Text style={[modalStyles.subtitle, { color: theme.colors.textMuted }]}>
                Configure your work hours for optimal training suggestions
              </Text>

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false} bounces={false}>
                {/* Start Time */}
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: typography.sizes.caption, 
                    fontWeight: '600',
                    marginBottom: spacing[1.5],
                    marginTop: spacing[3],
                  }}
                >
                  START TIME
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
                  {Array.from({ length: 17 }, (_, i) => i + 5).map((h) => (
                    <TouchableOpacity
                      key={`start-${h}`}
                      onPress={() =>
                        setScheduleEdit((prev) => ({
                          ...prev,
                          startHour: h,
                          endHour: Math.max(prev.endHour, h + 1),
                        }))
                      }
                      style={{
                        paddingHorizontal: spacing[3.5],
                        paddingVertical: spacing[2],
                        borderRadius: 12,
                        marginRight: spacing[1.5],
                        backgroundColor:
                          scheduleEdit.startHour === h ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                        borderWidth: scheduleEdit.startHour === h ? 1 : 0,
                        borderColor: theme.colors.accent,
                      }}
                    >
                      <Text
                        style={{
                          color: scheduleEdit.startHour === h ? theme.colors.accent : theme.colors.text,
                          fontSize: typography.sizes.label, 
                          fontWeight: '600',
                        }}
                      >
                        {h.toString().padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* End Time */}
                <Text style={{ color: theme.colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '600', marginBottom: spacing[1.5] }}>
                  END TIME
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
                  {Array.from({ length: 17 }, (_, i) => i + 5)
                    .filter((h) => h > scheduleEdit.startHour)
                    .map((h) => (
                      <TouchableOpacity
                        key={`end-${h}`}
                        onPress={() => setScheduleEdit((prev) => ({ ...prev, endHour: h }))}
                        style={{
                          paddingHorizontal: spacing[3.5],
                          paddingVertical: spacing[2],
                          borderRadius: 12,
                          marginRight: spacing[1.5],
                          backgroundColor:
                            scheduleEdit.endHour === h ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                          borderWidth: scheduleEdit.endHour === h ? 1 : 0,
                          borderColor: theme.colors.accent,
                        }}
                      >
                        <Text
                          style={{
                            color: scheduleEdit.endHour === h ? theme.colors.accent : theme.colors.text,
                            fontSize: typography.sizes.label, 
                            fontWeight: '600',
                          }}
                        >
                          {h.toString().padStart(2, '0')}:00
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Shift Type */}
                <Text style={{ color: theme.colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '600', marginBottom: spacing[1.5] }}>
                  SHIFT TYPE
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] }}>
                  {(['day', 'night', 'rotating'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setScheduleEdit((prev) => ({ ...prev, shiftType: s }))}
                      style={{
                        flex: 1,
                        paddingVertical: spacing[2.5],
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor:
                          scheduleEdit.shiftType === s ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                        borderWidth: scheduleEdit.shiftType === s ? 1 : 0,
                        borderColor: theme.colors.accent,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={s === 'day' ? 'weather-sunny' : s === 'night' ? 'weather-night' : 'sync'}
                        size={18}
                        color={scheduleEdit.shiftType === s ? theme.colors.accent : theme.colors.textMuted}
                      />
                      <Text
                        style={{
                          color: scheduleEdit.shiftType === s ? theme.colors.accent : theme.colors.text,
                          fontSize: typography.sizes.caption, 
                          fontWeight: '600',
                          marginTop: spacing[1],
                        }}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Commute */}
                <Text style={{ color: theme.colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '600', marginBottom: spacing[1.5] }}>
                  COMMUTE (minutes)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[4] }}>
                  {[0, 10, 15, 20, 30, 45, 60, 90].map((m) => (
                    <TouchableOpacity
                      key={`com-${m}`}
                      onPress={() => setScheduleEdit((prev) => ({ ...prev, commute: m }))}
                      style={{
                        paddingHorizontal: spacing[3.5],
                        paddingVertical: spacing[2],
                        borderRadius: 12,
                        marginRight: spacing[1.5],
                        backgroundColor:
                          scheduleEdit.commute === m ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                        borderWidth: scheduleEdit.commute === m ? 1 : 0,
                        borderColor: theme.colors.accent,
                      }}
                    >
                      <Text
                        style={{
                          color: scheduleEdit.commute === m ? theme.colors.accent : theme.colors.text,
                          fontSize: typography.sizes.label, 
                          fontWeight: '600',
                        }}
                      >
                        {m === 0 ? 'None' : `${m} min`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </ScrollView>

              {/* Save Button */}
              <GradientButton
                title="Save Schedule"
                variant="primary"
                onPress={handleSaveSchedule}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Help & Support Modal */}
        <Modal visible={showHelpModal} transparent animationType="fade" onRequestClose={() => setShowHelpModal(false)}>
          <Pressable style={modalStyles.overlay} onPress={() => setShowHelpModal(false)}>
            <Pressable
              style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: theme.colors.warning + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[3],
                  }}
                >
                  <MaterialCommunityIcons name="help-circle-outline" size={28} color={theme.colors.warning} />
                </View>
                <Text style={[modalStyles.title, { color: theme.colors.text }]}>{t('profile.helpSupport')}</Text>
              </View>

              <View style={{ gap: spacing[3], marginBottom: spacing[4] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
                  <MaterialCommunityIcons name="frequently-asked-questions" size={20} color={theme.colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}>
                      {t('help.faqTitle')}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, marginTop: spacing[0.5] }}>
                      {t('help.faqDesc')}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
                  <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.accent2} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}>
                      {t('help.contactTitle')}
                    </Text>
                    <Text style={{ color: theme.colors.accent, fontSize: typography.sizes.caption, marginTop: spacing[0.5] }}>
                      fitquestsupp0rt@gmail.com
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
                  <MaterialCommunityIcons name="bug-outline" size={20} color={theme.colors.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}>
                      {t('help.bugTitle')}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, marginTop: spacing[0.5] }}>
                      {t('help.bugDesc')}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
                  <MaterialCommunityIcons name="lightbulb-outline" size={20} color={theme.colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}>
                      {t('help.featureTitle')}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, marginTop: spacing[0.5] }}>
                      {t('help.featureDesc')}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.captionSm, textAlign: 'center', marginBottom: spacing[3] }}>
                {t('help.responseTime')}
              </Text>

              <TouchableOpacity
                style={[modalStyles.cancelBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setShowHelpModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[modalStyles.cancelText, { color: theme.colors.accent }]}>{t('common.close')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* About FitQuest Modal */}
        <Modal
          visible={showAboutModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAboutModal(false)}
        >
          <Pressable style={modalStyles.overlay} onPress={() => setShowAboutModal(false)}>
            <Pressable
              style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
                <LinearGradient
                  colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[3],
                  }}
                >
                  <MaterialCommunityIcons name="lightning-bolt" size={32} color="#fff" />
                </LinearGradient>
                <Text style={[modalStyles.title, { color: theme.colors.text }]}>FitQuest 2.0</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.label, marginTop: spacing[0.5] }}>
                  {t('profile.version')} 1.0.0
                </Text>
              </View>

              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: typography.sizes.label, 
                  textAlign: 'center',
                  lineHeight: 20,
                  marginBottom: spacing[4],
                }}
              >
                {t('about.description')}
              </Text>

              <View style={{ gap: spacing[2], marginBottom: spacing[4] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>{t('about.platform')}</Text>
                  <Text style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>React Native / Expo</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>{t('about.dataStorage')}</Text>
                  <Text style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                    {t('about.onDevice')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>{t('about.encryption')}</Text>
                  <Text style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>AES-256-GCM</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>{t('about.security')}</Text>
                  <Text style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                    {t('about.biometric')}
                  </Text>
                </View>
              </View>

              <Text style={{ color: theme.colors.textMuted, fontSize: typography.sizes.captionSm, textAlign: 'center', marginBottom: spacing[3] }}>
                {t('about.madeWith')}
              </Text>

              <TouchableOpacity
                style={[modalStyles.cancelBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setShowAboutModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[modalStyles.cancelText, { color: theme.colors.accent }]}>{t('common.close')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing[25] },

  // Header
  headerGradient: {
    paddingBottom: spacing[6],
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingHorizontal: spacing[6],
  },
  avatarGlowWrap: {
    marginBottom: spacing[4],
    position: 'relative',
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 32,
    padding: spacing[0.75],
  },
  avatarInner: {
    flex: 1,
    borderRadius: 30,
    padding: spacing[0.75],
    overflow: 'hidden',
  },
  avatarGradient: {
    flex: 1,
    borderRadius: 28,
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
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  avatarInitials: {
    fontSize: typography.sizes.h1, 
    fontWeight: '700',
    letterSpacing: 1,
  },
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
    borderRadius: 9999,
    marginBottom: spacing[4],
    maxWidth: '80%',
  },
  goalBadgeText: {
    fontSize: typography.sizes.caption, 
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  // XP
  xpWrap: {
    width: '100%',
    maxWidth: 280,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1.5],
  },
  levelBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.75],
    borderRadius: 8,
  },
  levelText: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  xpLabel: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '500',
  },
  xpBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Stats — Premium Grid
  statsContainer: {
    paddingHorizontal: spacing[4],
    marginTop: -8,
    marginBottom: spacing[3],
  },
  statsCard: {
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
  },
  primaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  primaryStat: {
    alignItems: 'center',
    flex: 1,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  statValue: {
    fontSize: typography.sizes.h3, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '600',
    marginTop: spacing[0.5],
  },
  statDivider: {
    width: 1,
    height: 50,
    opacity: 0.5,
  },
  statsFullDivider: {
    height: 1,
    marginVertical: spacing[4],
    marginHorizontal: spacing[2.5],
    opacity: 0.4,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  secondaryStat: {
    alignItems: 'center',
    flex: 1,
    gap: spacing[1],
  },
  secondaryValue: {
    fontSize: typography.sizes.body, 
    fontWeight: '700',
  },
  secondaryLabel: {
    fontSize: typography.sizes.xs, 
    fontWeight: '600',
  },

  // Achievements
  achievementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing[2],
  },
  achievementItem: {
    alignItems: 'center',
    gap: spacing[1.5],
  },
  achievementLabel: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '700',
  },
  achievementSub: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '400',
  },

  // Sections
  section: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing[2.5],
    gap: spacing[3],
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuLabel: {
    fontSize: typography.sizes.bodyMid, 
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  menuSublabel: {
    fontSize: typography.sizes.label, 
    fontWeight: '400',
    marginTop: spacing[1],
    lineHeight: 18,
  },

  adaptiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  adaptiveLabel: {
    fontSize: typography.sizes.label, 
    fontWeight: '500',
  },
  adaptiveValue: {
    fontSize: typography.sizes.body, 
    fontWeight: '700',
  },
  adaptiveConfidenceTrack: {
    marginTop: spacing[1.5],
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  adaptiveConfidenceFill: {
    height: '100%',
    borderRadius: 999,
  },
  adaptiveConfidenceText: {
    marginTop: spacing[2],
    fontSize: typography.sizes.caption, 
    fontWeight: '500',
  },
  adaptiveReason: {
    marginTop: spacing[1.5],
    fontSize: typography.sizes.caption, 
    lineHeight: 16,
  },

  // Health Sync Errors
  healthErrorsContainer: {
    marginHorizontal: spacing[0],
    marginTop: spacing[2],
    padding: spacing[3],
    borderRadius: 12,
    borderWidth: 1,
  },
  healthErrorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[1.5],
  },
  healthErrorsTitle: {
    flex: 1,
    fontSize: typography.sizes.caption, 
    fontWeight: '600',
  },
  healthErrorsDismiss: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '500',
  },
  healthErrorItem: {
    fontSize: typography.sizes.captionSm, 
    marginBottom: spacing[0.5],
  },
  healthErrorMore: {
    fontSize: typography.sizes.xs, 
    marginTop: spacing[1],
    fontStyle: 'italic',
  },

  // Logout
  logoutSection: {
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: typography.sizes.bodyMid, 
    fontWeight: '500',
  },
});
