/**
 * FitQuest Profile Screen
 * Premium glass-morphism profile with live stats, settings, and theme toggle
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  Switch,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Layout,
} from 'react-native-reanimated';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { getUserProgress, getStreak, getUserProfile, updateUserProfile, getAppState, setAppState } from '../src/database/service';
import { useRouter } from 'expo-router';
import { getXPData, XPData } from '../src/services/xpService';
import { GlassCard, GradientButton, ProgressRing, StatChip, SectionHeader } from '../src/components/ui/GlassUI';
import { useAuth } from '../src/context/AuthContext';
import { deleteMyUserData, exportMyUserData } from '../src/services/authApi';
import { getAdaptiveTrainingProfile, type AdaptiveTrainingProfile } from '../src/services/adaptiveTrainingService';
import { getSocialLayerSettings, setSocialLayerEnabled, type SocialLayerSettings } from '../src/services/socialLayerService';
import { acceptCurrentPolicies, getConsentRecord } from '../src/services/legalService';
import { getCached, setCached } from '../src/services/cacheStoreService';
import { runReplayIfDue } from '../src/services/replayOrchestrator';
import {
  disableDailyWorkoutReminder,
  enableDailyWorkoutReminder,
  formatReminderHourLabel,
  getNotificationReliabilitySettings,
  setNotificationReminderHour,
  scheduleDailyWorkoutReminder,
  type NotificationReliabilitySettings,
} from '../src/services/notificationReliabilityService';

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

function ThemedPickerModal({ visible, title, subtitle, options, onSelect, onClose, destructiveIndex }: ThemedPickerModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable
          style={[modalStyles.content, {
            backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF',
            borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[modalStyles.title, { color: theme.colors.text }]}>{title}</Text>
          {!!subtitle && (
            <Text style={[modalStyles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
          )}

          <View style={modalStyles.optionsList}>
            {options.map((opt, i) => {
              const isDestructive = destructiveIndex === i;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[modalStyles.optionItem, {
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onClose();
                    onSelect(opt.value);
                  }}
                >
                  <Text style={[modalStyles.optionText, {
                    color: isDestructive ? '#EF4444' : theme.colors.text,
                    fontWeight: isDestructive ? '600' : '500',
                  }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[modalStyles.cancelBtn, {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            }]}
            onPress={onClose}
            activeOpacity={0.7}
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
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  optionsList: {
    gap: 6,
    marginBottom: 12,
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

// ============================================
// TYPES
// ============================================

interface ProfileData {
  name: string;
  goal: string;
  experience: string;
  trainingDays: number;
  sessionMinutes: number;
}

interface StatsData {
  totalWorkouts: number;
  totalCalories: number;
  streak: number;
  longestStreak: number;
  level: number;
  totalXP: number;
  xpForNext: number;
  currentLevelXP: number;
}

interface ProfileCacheSnapshot {
  profile: ProfileData;
  stats: StatsData;
  adaptiveProfile: AdaptiveTrainingProfile | null;
  socialSettings: SocialLayerSettings | null;
  mealRegionOverride: MealRegionValue;
  consentTimestamp: number | null;
  consentVersion: string | null;
  consentSource: 'remote' | 'local' | null;
  notifications: NotificationReliabilitySettings;
}

const GOAL_LABELS: Record<string, { icon: string; color: string }> = {
  calisthenics: { icon: 'human-handsup', color: '#5F63FF' },
  getting_taller: { icon: 'human-male-height', color: '#10B981' },
  faster: { icon: 'lightning-bolt', color: '#F4A427' },
  flexible: { icon: 'yoga', color: '#EC4899' },
  mental_clarity: { icon: 'head-snowflake', color: '#8B5CF6' },
  building_muscle: { icon: 'weight-lifter', color: '#EF4444' },
};

const MEAL_REGION_VALUES = ['AUTO', 'ZA', 'US', 'GB', 'IN', 'BR', 'AU'] as const;
type MealRegionValue = (typeof MEAL_REGION_VALUES)[number];

// ============================================
// MENU ITEM COMPONENT
// ============================================

function MenuItem({ icon, label, sublabel, color, onPress, delay = 0, rightContent }: {
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
    <Animated.View entering={FadeInRight.delay(delay).duration(150)} style={animStyle}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 120 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
        style={[styles.menuItem, {
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        }]}
      >
        <View style={[styles.menuIconWrap, { backgroundColor: color + '18' }]}>
          <MaterialCommunityIcons name={icon as any} size={18} color={color} />
        </View>
        <View style={styles.menuTextWrap}>
          <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{label}</Text>
          {!!sublabel && (
            <Text style={[styles.menuSublabel, { color: theme.colors.textMuted }]}>{sublabel}</Text>
          )}
        </View>
        {rightContent || (
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================
// SCREEN
// ============================================

export default function ProfileScreen() {
  const { theme, toggleTheme } = useTheme();
  const { t, languageName } = useLanguage();
  const { signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<number | null>(null);
  const [consentVersion, setConsentVersion] = useState<string | null>(null);
  const [consentSource, setConsentSource] = useState<'remote' | 'local' | null>(null);
  const [adaptiveProfile, setAdaptiveProfile] = useState<AdaptiveTrainingProfile | null>(null);
  const [socialSettings, setSocialSettings] = useState<SocialLayerSettings | null>(null);
  const [socialBusy, setSocialBusy] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [mealRegionOverride, setMealRegionOverride] = useState<MealRegionValue>('AUTO');
  const [notificationSettings, setNotificationSettings] = useState<NotificationReliabilitySettings>({
    enabled: false,
    reminderHour: 20,
    permission: 'unknown',
    lastScheduledAt: null,
    lastPromptAt: null,
  });

  // Themed modal state
  const [pickerModal, setPickerModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    options: PickerOption[];
    onSelect: (value: string) => void;
    destructiveIndex?: number;
  }>({ visible: false, title: '', options: [], onSelect: () => {} });

  const closePicker = () => setPickerModal(prev => ({ ...prev, visible: false }));

  const mealRegionLabel = useCallback((value: MealRegionValue) => {
    const key = `profile.mealRegion.${value.toLowerCase()}`;
    return t(key);
  }, [t]);

  const handleTrainingDays = () => {
    setPickerModal({
      visible: true,
      title: t('profile.trainingDaysModalTitle'),
      subtitle: t('profile.trainingDaysModalSub'),
      options: [1, 2, 3, 4, 5, 6, 7].map(d => ({
        label: `${d} ${d > 1 ? t('common.days') : t('common.day')}`,
        value: String(d),
      })),
      onSelect: async (val) => {
        const d = Number(val);
        await updateUserProfile('user_local_001', { training_days_per_week: d });
        setProfile(prev => prev ? { ...prev, trainingDays: d } : prev);
      },
    });
  };

  const handleSessionLength = () => {
    setPickerModal({
      visible: true,
      title: t('profile.sessionLengthModalTitle'),
      subtitle: t('profile.sessionLengthModalSub'),
      options: [15, 20, 30, 45, 60, 90].map(m => ({
        label: `${m} ${t('common.minutes')}`,
        value: String(m),
      })),
      onSelect: async (val) => {
        const m = Number(val);
        await updateUserProfile('user_local_001', { time_per_session_minutes: m });
        setProfile(prev => prev ? { ...prev, sessionMinutes: m } : prev);
      },
    });
  };

  const handleExperience = () => {
    setPickerModal({
      visible: true,
      title: t('profile.experienceModalTitle'),
      subtitle: t('profile.experienceModalSub'),
      options: [
        { label: t('profile.level.beginner'), value: 'beginner' },
        { label: t('profile.level.intermediate'), value: 'intermediate' },
        { label: t('profile.level.advanced'), value: 'advanced' },
      ],
      onSelect: async (val) => {
        await updateUserProfile('user_local_001', { experience: val as any });
        setProfile(prev => prev ? { ...prev, experience: val } : prev);
      },
    });
  };

  const handleGoalChange = () => {
    setPickerModal({
      visible: true,
      title: t('profile.goalModalTitle'),
      subtitle: t('profile.goalModalSub'),
      options: [
        { label: t('profile.goal.calisthenics'), value: 'calisthenics' },
        { label: t('profile.goal.getting_taller'), value: 'getting_taller' },
        { label: t('profile.goal.faster'), value: 'faster' },
        { label: t('profile.goal.flexible'), value: 'flexible' },
        { label: t('profile.goal.mental_clarity'), value: 'mental_clarity' },
        { label: t('profile.goal.building_muscle'), value: 'building_muscle' },
      ],
      onSelect: async (val) => {
        await updateUserProfile('user_local_001', { goal: val as any });
        setProfile(prev => prev ? { ...prev, goal: val } : prev);
      },
    });
  };

  const handleMealRegion = () => {
    setPickerModal({
      visible: true,
      title: t('profile.mealRegion.title'),
      subtitle: t('profile.mealRegion.subtitle'),
      options: MEAL_REGION_VALUES.map((value) => ({
        label: mealRegionLabel(value),
        value,
      })),
      onSelect: async (val) => {
        const next = (MEAL_REGION_VALUES.includes(val as MealRegionValue)
          ? (val as MealRegionValue)
          : 'AUTO');
        await setAppState('meal.region_override', next);
        setMealRegionOverride(next);
      },
    });
  };

  const handleNotifications = () => {
    setPickerModal({
      visible: true,
      title: t('profile.notifications'),
      subtitle: t('profile.notificationsSub'),
      options: [
        { label: t('profile.notificationsAction.enable'), value: 'enable' },
        { label: t('profile.notificationsAction.disable'), value: 'disable' },
        { label: t('profile.notificationsAction.setReminderTime'), value: 'set_hour' },
      ],
      onSelect: async (value) => {
        if (value === 'enable') {
          await enableDailyWorkoutReminder(notificationSettings.reminderHour, 'profile');
        } else if (value === 'disable') {
          await disableDailyWorkoutReminder('profile');
        } else if (value === 'set_hour') {
          setPickerModal({
            visible: true,
            title: t('profile.notificationsAction.setReminderTime'),
            subtitle: t('profile.notificationsAction.pickHour'),
            options: Array.from({ length: 24 }, (_, i) => ({
              label: formatReminderHourLabel(i),
              value: String(i),
            })),
            onSelect: async (hourValue) => {
              const hour = Number(hourValue);
              if (Number.isFinite(hour)) {
                await setNotificationReminderHour(hour);
                const current = await getNotificationReliabilitySettings();
                if (current.enabled) {
                  await scheduleDailyWorkoutReminder(hour, 'profile');
                }
              }
              const refreshed = await getNotificationReliabilitySettings();
              setNotificationSettings(refreshed);
            },
          });
          return;
        }

        const refreshed = await getNotificationReliabilitySettings();
        setNotificationSettings(refreshed);
      },
    });
  };

  useEffect(() => {
    void runReplayIfDue({ reason: 'profile_load', cooldownMs: 45 * 1000 });
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const cached = await getCached<ProfileCacheSnapshot>('profile', 'main');
      if (cached.value) {
        setProfile(cached.value.profile);
        setStats(cached.value.stats);
        setAdaptiveProfile(cached.value.adaptiveProfile);
        setSocialSettings(cached.value.socialSettings);
        setMealRegionOverride(cached.value.mealRegionOverride);
        setConsentTimestamp(cached.value.consentTimestamp);
        setConsentVersion(cached.value.consentVersion);
        setConsentSource(cached.value.consentSource);
        setNotificationSettings(cached.value.notifications);
      }

      const [userProfile, progress, streak, xp, adaptive, social, savedMealRegion, consentRecord, notifications] = await Promise.all([
        getUserProfile('user_local_001'),
        getUserProgress(),
        getStreak('user_local_001'),
        getXPData(),
        getAdaptiveTrainingProfile('user_local_001'),
        getSocialLayerSettings('user_local_001'),
        getAppState('meal.region_override'),
        getConsentRecord(),
        getNotificationReliabilitySettings(),
      ]);

      setProfile({
        name: 'Athlete',
        goal: userProfile?.goal || 'calisthenics',
        experience: userProfile?.experience || 'beginner',
        trainingDays: userProfile?.training_days_per_week || 3,
        sessionMinutes: userProfile?.time_per_session_minutes || 30,
      });

      setStats({
        totalWorkouts: progress.total_workouts,
        totalCalories: progress.total_workouts * 280,
        streak: streak.current,
        longestStreak: streak.longest,
        level: xp.level,
        totalXP: xp.totalXP,
        xpForNext: xp.xpToNextLevel,
        currentLevelXP: xp.currentLevelXP,
      });

      setAdaptiveProfile(adaptive);
      setSocialSettings(social);
      const normalizedMealRegion = MEAL_REGION_VALUES.includes((savedMealRegion || 'AUTO') as MealRegionValue)
        ? ((savedMealRegion || 'AUTO') as MealRegionValue)
        : 'AUTO';
      setMealRegionOverride(normalizedMealRegion);
      setConsentTimestamp(consentRecord.timestamp);
      setConsentVersion(consentRecord.version);
      setConsentSource(consentRecord.source);
      setNotificationSettings(notifications);

      await setCached('profile', 'main', {
        profile: {
          name: 'Athlete',
          goal: userProfile?.goal || 'calisthenics',
          experience: userProfile?.experience || 'beginner',
          trainingDays: userProfile?.training_days_per_week || 3,
          sessionMinutes: userProfile?.time_per_session_minutes || 30,
        },
        stats: {
          totalWorkouts: progress.total_workouts,
          totalCalories: progress.total_workouts * 280,
          streak: streak.current,
          longestStreak: streak.longest,
          level: xp.level,
          totalXP: xp.totalXP,
          xpForNext: xp.xpToNextLevel,
          currentLevelXP: xp.currentLevelXP,
        },
        adaptiveProfile: adaptive,
        socialSettings: social,
        mealRegionOverride: normalizedMealRegion,
        consentTimestamp: consentRecord.timestamp,
        consentVersion: consentRecord.version,
        consentSource: consentRecord.source,
        notifications,
      } satisfies ProfileCacheSnapshot);
    } catch (err) {
      console.error('[Profile] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const goalInfo = GOAL_LABELS[profile?.goal || 'calisthenics'];
  const goalLabel = t(`profile.goal.${profile?.goal || 'calisthenics'}`);
  const xpProgress = stats ? stats.currentLevelXP / stats.xpForNext : 0;

  const handleLogout = () => {
    setPickerModal({
      visible: true,
      title: t('profile.logout'),
      subtitle: t('profile.logoutConfirm'),
      options: [
        { label: t('profile.logout'), value: 'logout' },
      ],
      destructiveIndex: 0,
      onSelect: async () => {
        await signOut();
        router.replace('/login');
      },
    });
  };

  const handleRecordConsent = useCallback(async () => {
    if (privacyBusy) return;
    setPrivacyBusy(true);
    try {
      const result = await acceptCurrentPolicies();
      setConsentTimestamp(result.timestamp);
      setConsentVersion(result.version);
      setConsentSource(result.source);
      Alert.alert(
        t('profile.alert.consentRecordedTitle'),
        `${t('profile.alert.consentRecordedBody')}\n${t('profile.version')}: ${result.version}`,
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('profile.alert.consentFailed'));
    } finally {
      setPrivacyBusy(false);
    }
  }, [privacyBusy, t]);

  const handleExportData = useCallback(async () => {
    if (privacyBusy) return;
    setPrivacyBusy(true);
    try {
      const payload = await exportMyUserData();
      const exportDir = `${FileSystem.documentDirectory}exports/`;
      const dirInfo = await FileSystem.getInfoAsync(exportDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
      }

      const outUri = `${exportDir}fitquest_user_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(outUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      Alert.alert(t('profile.alert.exportCompleteTitle'), `${t('profile.alert.savedTo')}\n${outUri}`);
    } catch (e: any) {
      Alert.alert(t('profile.alert.exportFailedTitle'), e?.message ?? t('profile.alert.exportFailedBody'));
    } finally {
      setPrivacyBusy(false);
    }
  }, [privacyBusy, t]);

  const handleDeleteCloudData = useCallback(() => {
    if (privacyBusy) return;
    setPickerModal({
      visible: true,
      title: t('profile.menu.deleteCloudData'),
      subtitle: t('profile.menu.deleteCloudDataConfirm'),
      options: [{ label: t('profile.menu.deletePermanently'), value: 'delete' }],
      destructiveIndex: 0,
      onSelect: async () => {
        setPrivacyBusy(true);
        try {
          await deleteMyUserData();
          await signOut();
          router.replace('/login');
        } catch (e: any) {
          Alert.alert(t('profile.alert.deleteFailedTitle'), e?.message ?? t('profile.alert.deleteFailedBody'));
        } finally {
          setPrivacyBusy(false);
        }
      },
    });
  }, [privacyBusy, signOut, router, t]);

  const handleSocialToggle = useCallback(async (enabled: boolean) => {
    if (socialBusy) return;
    setSocialBusy(true);
    try {
      const next = await setSocialLayerEnabled('user_local_001', enabled);
      setSocialSettings(next);
    } catch (e: any) {
      Alert.alert(t('profile.alert.updateFailedTitle'), e?.message ?? t('profile.alert.updateSocialFailedBody'));
    } finally {
      setSocialBusy(false);
    }
  }, [socialBusy, t]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View entering={ZoomIn}>
          <MaterialCommunityIcons name="account-circle" size={48} color={theme.colors.accent} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── PROFILE HEADER ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <LinearGradient
            colors={theme.isDark
              ? ['rgba(95,99,255,0.25)', 'rgba(139,92,246,0.10)', 'transparent'] as [string, string, string]
              : ['rgba(95,99,255,0.12)', 'rgba(139,92,246,0.05)', 'transparent'] as [string, string, string]}
            style={styles.headerGradient}
          >
            <SafeAreaView edges={['top']}>
              <View style={styles.headerContent}>
                {/* Avatar with static ring (no glow animation) */}
                <View style={styles.avatarGlowWrap}>
                  <LinearGradient
                    colors={[theme.colors.accent, '#8B5CF6', '#EC4899'] as [string, string, string]}
                    style={styles.avatarRing}
                  >
                    <View style={[styles.avatarInner, { backgroundColor: theme.colors.background }]}>
                      <LinearGradient
                        colors={[theme.colors.accent, '#4338CA'] as [string, string]}
                        style={styles.avatarGradient}
                      >
                        <Text style={[styles.avatarInitials, { color: theme.colors.text }]}>
                          {(profile?.name || 'A').charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    </View>
                  </LinearGradient>
                </View>

                {/* Name & goal */}
                <Animated.View entering={FadeInDown.delay(50).duration(150)}>
                  <Text style={[styles.profileName, { color: theme.colors.text }]}>
                    {profile?.name || 'Athlete'}
                  </Text>
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
                    <View style={[styles.levelBadge, { backgroundColor: theme.colors.accent + '25' }]}>
                      <Text style={[styles.levelText, { color: theme.colors.accent }]}>
                        LVL {stats?.level || 1}
                      </Text>
                    </View>
                    <Text style={[styles.xpLabel, { color: theme.colors.textMuted }]}>
                      {stats?.currentLevelXP || 0} / {stats?.xpForNext || 100} XP
                    </Text>
                  </View>
                  <View style={[styles.xpBarBg, {
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  }]}>
                    <LinearGradient
                      colors={[theme.colors.accent, '#8B5CF6'] as [string, string]}
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

        {/* ── STATS ROW ── */}
        <View style={styles.statsRow}>
          <StatChip icon="fire" label={t('dashboard.streak')} value={`${stats?.streak || 0}d`} color="#F4A427" delay={200} />
          <StatChip icon="dumbbell" label={t('dashboard.workouts')} value={`${stats?.totalWorkouts || 0}`} color={theme.colors.accent} delay={300} />
          <StatChip icon="lightning-bolt" label={t('dashboard.xp')} value={`${stats?.totalXP || 0}`} color="#8B5CF6" delay={400} />
        </View>

        {/* ── ACHIEVEMENTS CARD ── */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.achievements')} delay={300} />
          <GlassCard gradient delay={350}>
            <View style={styles.achievementRow}>
              <View style={styles.achievementItem}>
                <ProgressRing progress={Math.min((stats?.totalWorkouts || 0) / 50, 1)} size={56} strokeWidth={4} color={theme.colors.accent}>
                  <MaterialCommunityIcons name="trophy" size={20} color={theme.colors.accent} />
                </ProgressRing>
                <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                  {stats?.totalWorkouts || 0}/50
                </Text>
                <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>{t('dashboard.workouts')}</Text>
              </View>
              <View style={styles.achievementItem}>
                <ProgressRing progress={Math.min((stats?.longestStreak || 0) / 30, 1)} size={56} strokeWidth={4} color="#F4A427">
                  <MaterialCommunityIcons name="fire" size={20} color="#F4A427" />
                </ProgressRing>
                <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                  {stats?.longestStreak || 0}/30
                </Text>
                <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>{t('profile.bestStreak')}</Text>
              </View>
              <View style={styles.achievementItem}>
                <ProgressRing progress={Math.min((stats?.level || 1) / 20, 1)} size={56} strokeWidth={4} color="#10B981">
                  <MaterialCommunityIcons name="star" size={20} color="#10B981" />
                </ProgressRing>
                <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                  LVL {stats?.level || 1}
                </Text>
                <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>{t('dashboard.level')}</Text>
              </View>
            </View>
          </GlassCard>
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
            color="#5F63FF"
            delay={460}
            onPress={handleTrainingDays}
          />
          <MenuItem
            icon="clock-outline"
            label={t('profile.sessionLength')}
            sublabel={`${profile?.sessionMinutes || 30} ${t('common.minutes')} — ${t('profile.sessionLengthSub')}`}
            color="#10B981"
            delay={480}
            onPress={handleSessionLength}
          />
          <MenuItem
            icon="signal-cellular-3"
            label={t('profile.experience')}
            sublabel={`${(profile?.experience || 'beginner').charAt(0).toUpperCase() + (profile?.experience || 'beginner').slice(1)} — ${t('profile.experienceSub')}`}
            color="#F4A427"
            delay={500}
            onPress={handleExperience}
          />
          <MenuItem
            icon="human-edit"
            label={t('profile.craftMyBody')}
            sublabel={t('profile.craftMyBodySub')}
            color="#EC4899"
            delay={520}
            onPress={() => router.push('/craft-my-body')}
          />
        </View>

        {/* ── ADAPTIVE PROFILE ── */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.adaptiveTraining')} delay={530} />
          <GlassCard delay={560}>
            <View style={styles.adaptiveRow}>
              <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>{t('profile.fatigueSensitivity')}</Text>
              <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                {adaptiveProfile ? adaptiveProfile.fatigueSensitivity.toFixed(2) : '1.00'}
              </Text>
            </View>
            <View style={styles.adaptiveRow}>
              <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>{t('profile.progressionPace')}</Text>
              <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                {adaptiveProfile ? adaptiveProfile.progressionAggressiveness.toFixed(2) : '1.00'}
              </Text>
            </View>
            <View style={styles.adaptiveRow}>
              <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>{t('profile.volumeTolerance')}</Text>
              <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                {adaptiveProfile ? adaptiveProfile.volumeTolerance.toFixed(2) : '1.00'}
              </Text>
            </View>

            <View style={[styles.adaptiveConfidenceTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
              <View
                style={[
                  styles.adaptiveConfidenceFill,
                  {
                    width: `${Math.round(((adaptiveProfile?.confidence ?? 0) * 100))}%` as any,
                    backgroundColor: theme.colors.accent,
                  },
                ]}
              />
            </View>
            <Text style={[styles.adaptiveConfidenceText, { color: theme.colors.textMuted }]}>
              {t('profile.confidence')}: {Math.round((adaptiveProfile?.confidence ?? 0) * 100)}% · {t('profile.samples')}: {adaptiveProfile?.samples ?? 0}
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
            sublabel={socialSettings?.enabled
              ? t('profile.socialLayerOn')
              : t('profile.socialLayerOff')}
            color="#3B82F6"
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
                trackColor={{ false: '#ddd', true: '#3B82F660' }}
                thumbColor={(socialSettings?.enabled ?? false) ? '#3B82F6' : '#f4f3f4'}
              />
            }
          />
          <MenuItem
            icon={theme.isDark ? 'weather-night' : 'weather-sunny'}
            label={t('profile.darkMode')}
            sublabel={theme.isDark ? t('profile.darkModeOn') : t('profile.darkModeOff')}
            color="#8B5CF6"
            delay={550}
            onPress={toggleTheme}
            rightContent={
              <Switch
                value={theme.isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#ddd', true: theme.colors.accent + '60' }}
                thumbColor={theme.isDark ? theme.colors.accent : '#f4f3f4'}
              />
            }
          />
          <MenuItem
            icon="translate"
            label={t('profile.language')}
            sublabel={languageName}
            color="#3B82F6"
            delay={575}
            onPress={() => setShowLanguageSelector(true)}
          />
          <MenuItem
            icon="map-marker-radius-outline"
            label={t('profile.mealRegion.title')}
            sublabel={mealRegionLabel(mealRegionOverride)}
            color="#10B981"
            delay={590}
            onPress={handleMealRegion}
          />
          <MenuItem
            icon="bell-outline"
            label={t('profile.notifications')}
            sublabel={`${notificationSettings.enabled ? t('profile.notificationsStatus.enabled') : t('profile.notificationsStatus.disabled')} · ${t('profile.notificationsStatus.permission')}: ${t(`profile.notificationsPermission.${notificationSettings.permission}`)} · ${formatReminderHourLabel(notificationSettings.reminderHour)}`}
            color="#EC4899"
            delay={600}
            onPress={handleNotifications}
          />
        </View>

        {/* ── PRIVACY & LEGAL ── */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.privacyLegal')} delay={620} />
          <MenuItem
            icon="book-open-page-variant-outline"
            label={t('profile.legalCenter')}
            sublabel={t('profile.legalCenterSub')}
            color="#3B82F6"
            delay={630}
            onPress={() => router.push('/legal-center')}
          />
          <MenuItem
            icon="shield-check-outline"
            label={t('profile.privacySecurity')}
            sublabel={t('profile.privacySecuritySub')}
            color="#10B981"
            delay={640}
          />
          <MenuItem
            icon="check-decagram-outline"
            label={t('profile.recordConsent')}
            sublabel={consentTimestamp
              ? `${t('profile.saved')} ${new Date(consentTimestamp).toLocaleString()} · ${t('profile.version')} ${consentVersion || '-'} · ${t(`profile.consentSource.${consentSource || 'local'}`)}`
              : t('profile.recordConsentSub')}
            color="#10B981"
            delay={650}
            onPress={() => {
              void handleRecordConsent();
            }}
          />
          <MenuItem
            icon="file-export-outline"
            label={t('profile.exportData')}
            sublabel={t('profile.exportDataSub')}
            color="#5F63FF"
            delay={660}
            onPress={() => {
              void handleExportData();
            }}
          />
          <MenuItem
            icon="trash-can-outline"
            label={t('profile.menu.deleteCloudData')}
            sublabel={t('profile.deleteCloudDataSub')}
            color="#EF4444"
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
            color="#F4A427"
            delay={700}
          />
          <MenuItem
            icon="information-outline"
            label={t('profile.about')}
            sublabel={`${t('profile.version')} 1.0.0`}
            color="#5F63FF"
            delay={720}
          />
        </View>

        {/* ── LOGOUT ── */}
        <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.logoutSection}>
          <TouchableOpacity
            style={[styles.logoutBtn, {
              backgroundColor: theme.colors.error + '10',
            }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="logout" size={18} color={theme.colors.error} />
            <Text style={[styles.logoutText, { color: theme.colors.error }]}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Language Selector Modal */}
      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
      />

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
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // Header
  headerGradient: {
    paddingBottom: 24,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  avatarGlowWrap: {
    marginBottom: 16,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 32,
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 30,
    padding: 3,
  },
  avatarGradient: {
    flex: 1,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
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
    marginBottom: 6,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  xpLabel: {
    fontSize: 11,
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

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -8,
    marginBottom: 8,
  },

  // Achievements
  achievementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  achievementItem: {
    alignItems: 'center',
    gap: 6,
  },
  achievementLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  achievementSub: {
    fontSize: 11,
    fontWeight: '400',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  menuSublabel: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 16,
  },

  adaptiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adaptiveLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  adaptiveValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  adaptiveConfidenceTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  adaptiveConfidenceFill: {
    height: '100%',
    borderRadius: 999,
  },
  adaptiveConfidenceText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  adaptiveReason: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
  },

  // Logout
  logoutSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
