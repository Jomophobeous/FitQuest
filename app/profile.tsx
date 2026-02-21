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
import { useDatabase } from '../src/context/DatabaseContext';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { getUserProgress, getStreak, getUserProfile, updateUserProfile, getAppState, setAppState, getUserEquipment, setUserEquipment } from '../src/database/service';
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
  getHealthAdapter,
  initializeHealthIntegration,
  isHealthIntegrationAvailable,
  syncHealthData,
} from '../src/services/healthAdapters';
import { captureHealthError, errorTelemetry, type ErrorEvent } from '../src/services/errorTelemetry';
import {
  disableDailyWorkoutReminder,
  enableDailyWorkoutReminder,
  formatReminderHourLabel,
  getNotificationReliabilitySettings,
  setNotificationReminderHour,
  scheduleDailyWorkoutReminder,
  type NotificationReliabilitySettings,
} from '../src/services/notificationReliabilityService';
import { BiometricAuthService } from '../src/security/BiometricAuth';
const bioAuth = BiometricAuthService.getInstance();

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
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
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
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.border,
                  }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onClose();
                    onSelect(opt.value);
                  }}
                >
                  <Text style={[modalStyles.optionText, {
                    color: isDestructive ? theme.colors.error : theme.colors.text,
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
              backgroundColor: theme.colors.surfaceVariant,
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
  body_control: { icon: 'human-handsup', color: '#5F63FF' },
  posture: { icon: 'human-male-height', color: '#10B981' },
  speed: { icon: 'lightning-bolt', color: '#F4A427' },
  mobility: { icon: 'yoga', color: '#EC4899' },
  focus: { icon: 'head-snowflake', color: '#8B5CF6' },
  strength: { icon: 'weight-lifter', color: '#EF4444' },
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
    <Animated.View entering={FadeInRight.delay(delay).duration(150)}>
     <Animated.View style={animStyle}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 120 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
        style={[styles.menuItem, {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.border,
        }]}
      >
        <View style={[styles.menuIconWrap, { backgroundColor: color + '18' }]}>
          <MaterialCommunityIcons name={icon as any} size={18} color={color} />
        </View>
        <View style={styles.menuTextWrap}>
          <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{label}</Text>
          {!!sublabel && (
            <Text numberOfLines={3} style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>{sublabel}</Text>
          )}
        </View>
        {rightContent || (
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>
     </Animated.View>
    </Animated.View>
  );
}

// ============================================
// SCREEN
// ============================================

export default function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const { t, languageName } = useLanguage();
  const { refreshProfile } = useDatabase();
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
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [mealRegionOverride, setMealRegionOverride] = useState<MealRegionValue>('AUTO');
  const [notificationSettings, setNotificationSettings] = useState<NotificationReliabilitySettings>({
    enabled: false,
    reminderHour: 20,
    permission: 'unknown',
    lastScheduledAt: null,
    lastPromptAt: null,
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [healthProviderCode, setHealthProviderCode] = useState<'health_connect' | 'healthkit' | 'google_fit' | 'none' | 'unknown' | 'unavailable'>('none');
  const [healthIntegrationReady, setHealthIntegrationReady] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthSyncErrors, setHealthSyncErrors] = useState<ErrorEvent[]>([]);
  const [equipmentLevel, setEquipmentLevel] = useState<'none' | 'minimal' | 'playground'>('none');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [expandedAdaptive, setExpandedAdaptive] = useState<string | null>(null);

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

  const healthProviderLabel = useCallback((value: typeof healthProviderCode) => {
    return t(`profile.healthProvider.${value}`);
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
        console.log('[Profile] Update training days', { value: d });
        await updateUserProfile('user_local_001', { training_days_per_week: d });
        setProfile(prev => prev ? { ...prev, trainingDays: d } : prev);
        await refreshProfile();
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
        console.log('[Profile] Update session length', { value: m });
        await updateUserProfile('user_local_001', { time_per_session_minutes: m });
        setProfile(prev => prev ? { ...prev, sessionMinutes: m } : prev);
        await refreshProfile();
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
        console.log('[Profile] Update experience', { value: val });
        await updateUserProfile('user_local_001', { experience: val as any });
        setProfile(prev => prev ? { ...prev, experience: val } : prev);
        await refreshProfile();
      },
    });
  };

  const handleGoalChange = () => {
    setPickerModal({
      visible: true,
      title: t('profile.goalModalTitle'),
      subtitle: t('profile.goalModalSub'),
      options: [
        { label: t('profile.goal.body_control'), value: 'body_control' },
        { label: t('profile.goal.posture'), value: 'posture' },
        { label: t('profile.goal.speed'), value: 'speed' },
        { label: t('profile.goal.mobility'), value: 'mobility' },
        { label: t('profile.goal.focus'), value: 'focus' },
        { label: t('profile.goal.strength'), value: 'strength' },
      ],
      onSelect: async (val) => {
        console.log('[Profile] Update goal', { value: val });
        await updateUserProfile('user_local_001', { goal: val as any });
        setProfile(prev => prev ? { ...prev, goal: val } : prev);
        await refreshProfile();
      },
    });
  };

  const handleEquipmentLevel = () => {
    setPickerModal({
      visible: true,
      title: t('profile.equipmentLevel'),
      subtitle: t('profile.equipmentLevelSub'),
      options: [
        { label: `🏠 ${t('profile.equipment.none')}`, value: 'none' },
        { label: `🎒 ${t('profile.equipment.minimal')}`, value: 'minimal' },
        { label: `🏋️ ${t('profile.equipment.playground')}`, value: 'playground' },
      ],
      onSelect: async (val) => {
        const level = val as 'none' | 'minimal' | 'playground';
        console.log('[Profile] Update equipment level', { value: level });
        await setAppState('user.equipment_level', level);
        setEquipmentLevel(level);
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

  const refreshHealthIntegrationStatus = useCallback(async () => {
    try {
      const available = await isHealthIntegrationAvailable();
      if (!available) {
        setHealthProviderCode('none');
        setHealthIntegrationReady(false);
        return;
      }

      const adapter = await getHealthAdapter();
      if (!adapter) {
        setHealthProviderCode('none');
        setHealthIntegrationReady(false);
        return;
      }

      const status = await adapter.getStatus();
      setHealthProviderCode((status.provider || 'unknown') as typeof healthProviderCode);
      setHealthIntegrationReady(status.available && status.initialized);
    } catch {
      setHealthProviderCode('unavailable');
      setHealthIntegrationReady(false);
    }
  }, []);

  const refreshHealthSyncErrors = useCallback(() => {
    const recentErrors = errorTelemetry.getRecentErrors({
      category: 'health_sync',
      unresolvedOnly: true,
      limit: 5,
    });
    setHealthSyncErrors(recentErrors);
  }, []);

  const getHealthTelemetryProvider = useCallback(async (): Promise<'health_connect' | 'healthkit' | 'google_fit'> => {
    try {
      const adapter = await getHealthAdapter();
      if (adapter?.provider === 'health_connect' || adapter?.provider === 'healthkit' || adapter?.provider === 'google_fit') {
        return adapter.provider;
      }
    } catch {
      // fall through
    }
    return 'health_connect';
  }, []);

  const handleConnectHealth = useCallback(async () => {
    if (healthBusy) return;
    setHealthBusy(true);
    try {
      const result = await initializeHealthIntegration();
      await refreshHealthIntegrationStatus();
      if (!result.success) {
        Alert.alert(
          t('profile.healthConnect'),
          result.error || t('profile.healthConnectFailed')
        );
      } else {
        Alert.alert(
          t('profile.healthConnect'),
          t('profile.healthConnectSuccess')
        );
      }
    } catch (error) {
      const provider = await getHealthTelemetryProvider();
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'auth',
      });
      Alert.alert(
        t('profile.healthConnect'),
        t('profile.healthConnectFailed')
      );
    } finally {
      setHealthBusy(false);
    }
  }, [getHealthTelemetryProvider, healthBusy, refreshHealthIntegrationStatus, t]);

  const handleSyncHealth = useCallback(async () => {
    if (healthBusy) return;
    setHealthBusy(true);
    try {
      const result = await syncHealthData({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        categories: ['steps', 'calories', 'heart_rate', 'sleep', 'workout'],
      });
      await refreshHealthIntegrationStatus();
      Alert.alert(
        t('profile.healthSync'),
        `${t('profile.healthSyncSummary')}: ${result.synced}\n${t('profile.healthSyncErrors')}: ${result.errors}`
      );
    } catch (error) {
      const provider = await getHealthTelemetryProvider();
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'sync',
      });
      Alert.alert(
        t('profile.healthSync'),
        t('profile.healthSyncFailed')
      );
    } finally {
      setHealthBusy(false);
    }
  }, [getHealthTelemetryProvider, healthBusy, refreshHealthIntegrationStatus, t]);

  useEffect(() => {
    void runReplayIfDue({ reason: 'profile_load', cooldownMs: 45 * 1000 });
    loadData();
    void refreshHealthIntegrationStatus();
    refreshHealthSyncErrors();
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

      const [userProfile, progress, streak, xp, adaptive, social, savedMealRegion, consentRecord, notifications, savedEquipmentLevel] = await Promise.all([
        getUserProfile('user_local_001'),
        getUserProgress(),
        getStreak('user_local_001'),
        getXPData(),
        getAdaptiveTrainingProfile('user_local_001'),
        getSocialLayerSettings('user_local_001'),
        getAppState('meal.region_override'),
        getConsentRecord(),
        getNotificationReliabilitySettings(),
        getAppState('user.equipment_level'),
      ]);

      const eqLevel = (['none', 'minimal', 'playground'].includes(savedEquipmentLevel || '') ? savedEquipmentLevel : 'none') as 'none' | 'minimal' | 'playground';
      setEquipmentLevel(eqLevel);

      setProfile({
        name: 'Athlete',
        goal: userProfile?.goal || 'body_control',
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
          goal: userProfile?.goal || 'body_control',
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

      // Check biometric availability
      try {
        const capability = await bioAuth.initialize();
        setBiometricAvailable(capability.isAvailable);
        const sessionValid = await bioAuth.isSessionValid();
        setBiometricEnabled(sessionValid);
      } catch { /* biometric detection optional */ }
    } catch (err) {
      console.error('[Profile] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const goalInfo = GOAL_LABELS[profile?.goal || 'body_control'] ?? GOAL_LABELS.body_control;
  const goalLabel = t(`profile.goal.${profile?.goal || 'body_control'}`);
  const xpProgress = stats && stats.xpForNext > 0 ? stats.currentLevelXP / stats.xpForNext : 0;

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
              ? [`${theme.colors.indigo}40`, `${theme.colors.purple}1A`, 'transparent'] as [string, string, string]
              : [`${theme.colors.indigo}1F`, `${theme.colors.purple}0D`, 'transparent'] as [string, string, string]}
            style={styles.headerGradient}
          >
            <SafeAreaView edges={['top']}>
              <View style={styles.headerContent}>
                {/* Avatar with static ring (no glow animation) */}
                <View style={styles.avatarGlowWrap}>
                  <LinearGradient
                    colors={[theme.colors.accent, theme.colors.purple, theme.colors.pink] as [string, string, string]}
                    style={styles.avatarRing}
                  >
                    <View style={[styles.avatarInner, { backgroundColor: theme.colors.background }]}>
                      <LinearGradient
                        colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
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
                    backgroundColor: theme.colors.surfaceVariant,
                  }]}>
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

        {/* ── STATS ROW ── */}
        <View style={styles.statsRow}>
          <StatChip icon="fire" label={t('dashboard.streak')} value={`${stats?.streak || 0}d`} color={theme.colors.warning} delay={200} />
          <StatChip icon="dumbbell" label={t('dashboard.workouts')} value={`${stats?.totalWorkouts || 0}`} color={theme.colors.accent} delay={300} />
          <StatChip icon="lightning-bolt" label={t('dashboard.xp')} value={`${stats?.totalXP || 0}`} color={theme.colors.purple} delay={400} />
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
                <ProgressRing progress={Math.min((stats?.longestStreak || 0) / 30, 1)} size={56} strokeWidth={4} color={theme.colors.warning}>
                  <MaterialCommunityIcons name="fire" size={20} color={theme.colors.warning} />
                </ProgressRing>
                <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                  {stats?.longestStreak || 0}/30
                </Text>
                <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>{t('profile.bestStreak')}</Text>
              </View>
              <View style={styles.achievementItem}>
                <ProgressRing progress={Math.min((stats?.level || 1) / 20, 1)} size={56} strokeWidth={4} color={theme.colors.accent}>
                  <MaterialCommunityIcons name="star" size={20} color={theme.colors.accent} />
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
        </View>

        {/* ── ADAPTIVE PROFILE ── */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.adaptiveTraining')} delay={530} />
          <GlassCard delay={560}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              {t('profile.adaptiveExplanation')}
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpandedAdaptive(expandedAdaptive === 'fatigue' ? null : 'fatigue')}
            >
              <View style={styles.adaptiveRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="heart-pulse" size={16} color={theme.colors.error} />
                  <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>{t('profile.fatigueSensitivity')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                    {adaptiveProfile ? adaptiveProfile.fatigueSensitivity.toFixed(2) : '1.00'}
                  </Text>
                  <MaterialCommunityIcons name={expandedAdaptive === 'fatigue' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textMuted} />
                </View>
              </View>
            </TouchableOpacity>
            {expandedAdaptive === 'fatigue' && (
              <Animated.View entering={FadeInDown.duration(150)} style={{ paddingLeft: 24, paddingBottom: 8 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                  {t('profile.fatigueSensitivityDesc')}
                </Text>
              </Animated.View>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpandedAdaptive(expandedAdaptive === 'progression' ? null : 'progression')}
            >
              <View style={styles.adaptiveRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="trending-up" size={16} color={theme.colors.accent} />
                  <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>{t('profile.progressionPace')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                    {adaptiveProfile ? adaptiveProfile.progressionAggressiveness.toFixed(2) : '1.00'}
                  </Text>
                  <MaterialCommunityIcons name={expandedAdaptive === 'progression' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textMuted} />
                </View>
              </View>
            </TouchableOpacity>
            {expandedAdaptive === 'progression' && (
              <Animated.View entering={FadeInDown.duration(150)} style={{ paddingLeft: 24, paddingBottom: 8 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                  {t('profile.progressionPaceDesc')}
                </Text>
              </Animated.View>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpandedAdaptive(expandedAdaptive === 'volume' ? null : 'volume')}
            >
              <View style={styles.adaptiveRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="weight-lifter" size={16} color={theme.colors.warning} />
                  <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>{t('profile.volumeTolerance')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                    {adaptiveProfile ? adaptiveProfile.volumeTolerance.toFixed(2) : '1.00'}
                  </Text>
                  <MaterialCommunityIcons name={expandedAdaptive === 'volume' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textMuted} />
                </View>
              </View>
            </TouchableOpacity>
            {expandedAdaptive === 'volume' && (
              <Animated.View entering={FadeInDown.duration(150)} style={{ paddingLeft: 24, paddingBottom: 8 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                  {t('profile.volumeToleranceDesc')}
                </Text>
              </Animated.View>
            )}

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
              />
            }
          />
          <MenuItem
            icon={mode === 'blackGold' ? 'crown' : mode === 'dark' ? 'weather-night' : 'weather-sunny'}
            label="Theme"
            sublabel={mode === 'blackGold' ? 'Black & Gold' : mode === 'dark' ? 'Dark' : 'Light'}
            color={mode === 'blackGold' ? '#D4AF37' : theme.colors.purple}
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
            sublabel={`${notificationSettings.enabled ? t('profile.notificationsStatus.enabled') : t('profile.notificationsStatus.disabled')} · ${formatReminderHourLabel(notificationSettings.reminderHour)}`}
            color={theme.colors.pink}
            delay={600}
            onPress={handleNotifications}
          />
          <MenuItem
            icon="heart-pulse"
            label={t('profile.healthConnect')}
            sublabel={`${healthIntegrationReady ? t('profile.statusConnected') : t('profile.statusNotConnected')} · ${healthProviderLabel(healthProviderCode)}`}
            color={theme.colors.accent}
            delay={605}
            onPress={() => {
              void handleConnectHealth();
            }}
          />
          <MenuItem
            icon="sync"
            label={t('profile.healthSync')}
            sublabel={healthBusy ? t('profile.syncInProgress') : t('profile.healthSyncSub')}
            color={theme.colors.blue}
            delay={608}
            onPress={() => {
              void handleSyncHealth();
            }}
          />

          {/* Compact Health Sync Errors */}
          {healthSyncErrors.length > 0 && (
            <Animated.View entering={FadeInDown.delay(612).duration(200)} style={[styles.healthErrorsContainer, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.error + '40' }]}>
              <View style={styles.healthErrorsHeader}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} />
                <Text style={[styles.healthErrorsTitle, { color: theme.colors.error }]}>
                  {t('profile.healthSyncIssues') || 'Recent Sync Issues'}
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    for (const err of healthSyncErrors) {
                      await errorTelemetry.resolveError(err.id);
                    }
                    refreshHealthSyncErrors();
                  }}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Text style={[styles.healthErrorsDismiss, { color: theme.colors.textMuted }]}>
                    {t('common.dismiss') || 'Dismiss'}
                  </Text>
                </TouchableOpacity>
              </View>
              {healthSyncErrors.slice(0, 3).map((err) => (
                <Text key={err.id} numberOfLines={1} style={[styles.healthErrorItem, { color: theme.colors.textSecondary }]}>
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
            label={t('profile.security') || 'Security'}
            sublabel={biometricAvailable
              ? (biometricEnabled ? (t('profile.biometricActive') || 'Biometric lock active') : (t('profile.biometricAvailable') || 'Biometric lock available'))
              : (t('profile.biometricUnavailable') || 'Biometric not available on this device')}
            color={theme.colors.indigo}
            delay={610}
            onPress={async () => {
              if (!biometricAvailable) {
                Alert.alert(t('profile.security') || 'Security', t('profile.biometricUnavailable') || 'Biometric authentication is not available on this device.');
                return;
              }
              try {
                const result = await bioAuth.authenticate();
                if (result.success) {
                  setBiometricEnabled(true);
                  Alert.alert(t('profile.security') || 'Security', t('profile.biometricVerified') || 'Biometric authentication verified successfully.');
                } else {
                  Alert.alert(t('profile.security') || 'Security', result.error || 'Authentication failed.');
                }
              } catch (e) {
                console.warn('[Profile] Biometric test failed:', e);
              }
            }}
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
            label={t('profile.recordConsent')}
            sublabel={consentTimestamp
              ? `${t('profile.saved')} ${new Date(consentTimestamp).toLocaleString()} · ${t('profile.version')} ${consentVersion || '-'} · ${t(`profile.consentSource.${consentSource || 'local'}`)}`
              : t('profile.recordConsentSub')}
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

      {/* Theme Picker Modal */}
      <ThemedPickerModal
        visible={showThemePicker}
        title="Choose Theme"
        subtitle="Select your preferred app appearance"
        options={[
          { label: '🌙  Dark', value: 'dark' },
          { label: '☀️  Light', value: 'light' },
          { label: '👑  Black & Gold', value: 'blackGold' },
        ]}
        onSelect={(value) => setMode(value as 'dark' | 'light' | 'blackGold')}
        onClose={() => setShowThemePicker(false)}
      />

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

      {/* Help & Support Modal */}
      <Modal visible={showHelpModal} transparent animationType="fade" onRequestClose={() => setShowHelpModal(false)}>
        <Pressable style={modalStyles.overlay} onPress={() => setShowHelpModal(false)}>
          <Pressable
            style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.warning + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <MaterialCommunityIcons name="help-circle-outline" size={28} color={theme.colors.warning} />
              </View>
              <Text style={[modalStyles.title, { color: theme.colors.text }]}>{t('profile.helpSupport')}</Text>
            </View>

            <View style={{ gap: 12, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="frequently-asked-questions" size={20} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>{t('help.faqTitle')}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>{t('help.faqDesc')}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.accent2} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>{t('help.contactTitle')}</Text>
                  <Text style={{ color: theme.colors.accent, fontSize: 12, marginTop: 2 }}>support@fitquest.app</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="bug-outline" size={20} color={theme.colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>{t('help.bugTitle')}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>{t('help.bugDesc')}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="lightbulb-outline" size={20} color={theme.colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>{t('help.featureTitle')}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>{t('help.featureDesc')}</Text>
                </View>
              </View>
            </View>

            <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 12 }}>{t('help.responseTime')}</Text>

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
      <Modal visible={showAboutModal} transparent animationType="fade" onRequestClose={() => setShowAboutModal(false)}>
        <Pressable style={modalStyles.overlay} onPress={() => setShowAboutModal(false)}>
          <Pressable
            style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                style={{ width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
              >
                <MaterialCommunityIcons name="lightning-bolt" size={32} color="#fff" />
              </LinearGradient>
              <Text style={[modalStyles.title, { color: theme.colors.text }]}>FitQuest 2.0</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 2 }}>{t('profile.version')} 1.0.0</Text>
            </View>

            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
              {t('about.description')}
            </Text>

            <View style={{ gap: 8, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{t('about.platform')}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>React Native / Expo</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{t('about.dataStorage')}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>{t('about.onDevice')}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{t('about.encryption')}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>AES-256-GCM</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{t('about.security')}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>{t('about.biometric')}</Text>
              </View>
            </View>

            <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 12 }}>
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
    marginBottom: 12,
  },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
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
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  menuSublabel: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
    lineHeight: 18,
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

  // Health Sync Errors
  healthErrorsContainer: {
    marginHorizontal: 0,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  healthErrorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  healthErrorsTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  healthErrorsDismiss: {
    fontSize: 11,
    fontWeight: '500',
  },
  healthErrorItem: {
    fontSize: 11,
    marginBottom: 2,
  },
  healthErrorMore: {
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
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
