/**
 * useProfileViewModel — Profile screen ViewModel.
 *
 * Encapsulates ALL data loading, state management, derived computations,
 * and action handlers for the Profile screen. The screen component receives
 * ONLY this ViewModel's return value — no direct DB, service, or engine imports.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useDatabase } from '../context/DatabaseContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../purchases/SubscriptionContext';
import {
  getUserProgress,
  getStreak,
  getUserProfile,
  updateUserProfile,
  getAppState,
  setAppState,
  getUserEquipment,
  getRecentSessions,
  getMuscleFatigue,
  getStepHistory,
  getAllProgressRecords,
  getUserInjuries,
  getMindXP,
  deleteAllUserData,
  getJogTotals,
} from '../database/service';
import { getXPData } from '../services/xpService';
import { useDataSync } from '../services/dataSyncService';
import { getAdaptiveTrainingProfile, type AdaptiveTrainingProfile } from '../services/adaptiveTrainingService';
import {
  getSocialLayerSettings,
  setSocialLayerEnabled,
  type SocialLayerSettings,
} from '../services/socialLayerService';
import { acceptCurrentPolicies, getConsentRecord } from '../services/legalService';
import { getCached, setCached } from '../services/cacheStoreService';
import { runReplayIfDue } from '../services/replayOrchestrator';
import {
  getHealthAdapter,
  initializeHealthIntegration,
  isHealthIntegrationAvailable,
  syncHealthData,
} from '../services/healthAdapters';
import { captureHealthError, errorTelemetry, type ErrorEvent } from '../services/errorTelemetry';
import {
  disableDailyWorkoutReminder,
  enableDailyWorkoutReminder,
  formatReminderHourLabel,
  getNotificationReliabilitySettings,
  setNotificationReminderHour,
  scheduleDailyWorkoutReminder,
  type NotificationReliabilitySettings,
} from '../services/notificationReliabilityService';
import { BiometricAuthService } from '../security/BiometricAuth';
import { getProfessionSchedule, saveProfessionSchedule, type ProfessionSchedule } from '../engines/ReadinessEngine';
import { createViewModel } from './createViewModel';

const bioAuth = BiometricAuthService.getInstance();

// ── Types ──

export interface ProfileData {
  name: string;
  email: string;
  goal: string;
  experience: string;
  trainingDays: number;
  sessionMinutes: number;
}

export interface StatsData {
  totalWorkouts: number;
  totalCalories: number;
  streak: number;
  longestStreak: number;
  level: number;
  totalXP: number;
  xpForNext: number;
  currentLevelXP: number;
}

export interface ProfileCacheSnapshot {
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

export interface PickerOption {
  label: string;
  value: string;
}

export interface PickerModalState {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  destructiveIndex?: number;
}

export const GOAL_LABELS: Record<string, { icon: string; colorKey: string }> = {
  body_control: { icon: 'human-handsup', colorKey: 'indigo' },
  posture: { icon: 'human-male-height', colorKey: 'accent' },
  speed: { icon: 'lightning-bolt', colorKey: 'warning' },
  mobility: { icon: 'yoga', colorKey: 'pink' },
  focus: { icon: 'head-snowflake', colorKey: 'purple' },
  strength: { icon: 'weight-lifter', colorKey: 'error' },
};

export const MEAL_REGION_VALUES = ['AUTO', 'ZA', 'US', 'GB', 'IN', 'BR', 'AU'] as const;
export type MealRegionValue = (typeof MEAL_REGION_VALUES)[number];

export interface MindXPData {
  total_mind_xp: number;
  mind_level: number;
  pages_read_total: number;
  flashcards_reviewed_total: number;
  documents_completed: number;
}

// ── ViewModel ──

export const useProfileViewModel = createViewModel(() => {
  const { theme, mode, setMode } = useTheme();
  const { t, language, setLanguage, languageName } = useLanguage();
  const { showToast } = useToast();
  const { refreshProfile, isReady: dbReady } = useDatabase();
  const { signOut } = useAuth();
  const { accessState, trialDaysRemaining } = useSubscription();
  const router = useRouter();

  // ── State ──

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<number | null>(null);
  const [consentVersion, setConsentVersion] = useState<string | null>(null);
  const [consentSource, setConsentSource] = useState<'remote' | 'local' | null>(null);
  const [adaptiveProfile, setAdaptiveProfile] = useState<AdaptiveTrainingProfile | null>(null);
  const [socialSettings, setSocialSettings] = useState<SocialLayerSettings | null>(null);
  const [socialBusy, setSocialBusy] = useState(false);
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
  const [healthProviderCode, setHealthProviderCode] = useState<
    'health_connect' | 'healthkit' | 'google_fit' | 'none' | 'unknown' | 'unavailable'
  >('none');
  const [healthIntegrationReady, setHealthIntegrationReady] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthConnectEnabled, setHealthConnectEnabled] = useState(true);
  const [healthSyncErrors, setHealthSyncErrors] = useState<ErrorEvent[]>([]);
  const [equipmentLevel, setEquipmentLevel] = useState<'none' | 'minimal' | 'playground'>('none');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [expandedAdaptive, setExpandedAdaptive] = useState<string | null>(null);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [totalSteps, setTotalSteps] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [recentDistance, setRecentDistance] = useState(0);
  const [mindXP, setMindXP] = useState<MindXPData | null>(null);
  const [professionSchedule, setProfessionSchedule] = useState<ProfessionSchedule | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEdit, setScheduleEdit] = useState({
    startHour: 8,
    endHour: 17,
    shiftType: 'day' as 'day' | 'night' | 'rotating',
    commute: 30,
  });
  const [pickerModal, setPickerModal] = useState<PickerModalState>({
    visible: false,
    title: '',
    options: [],
    onSelect: () => {},
  });

  // ── Refs ──

  const isLoadingProfileRef = useRef(false);
  const mountedRef = useRef(true);
  const lastProfileLoadAt = useRef(0);
  const PROFILE_LOAD_COOLDOWN_MS = 2000;
  const profileLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Helpers ──

  const closePicker = () => setPickerModal((prev) => ({ ...prev, visible: false }));

  const mealRegionLabel = useCallback(
    (value: MealRegionValue) => {
      const key = `profile.mealRegion.${value.toLowerCase()}`;
      return t(key);
    },
    [t],
  );

  const healthProviderLabel = useCallback(
    (value: typeof healthProviderCode) => {
      return t(`profile.healthProvider.${value}`);
    },
    [t],
  );

  // ── Health Integration ──

  const refreshHealthIntegrationStatus = useCallback(async () => {
    try {
      const enabledFlag = await getAppState('healthconnect.enabled');
      const isEnabled = enabledFlag !== 'false';
      setHealthConnectEnabled(isEnabled);

      if (!isEnabled) {
        setHealthProviderCode('none');
        setHealthIntegrationReady(false);
        return;
      }

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
      if (
        adapter?.provider === 'health_connect' ||
        adapter?.provider === 'healthkit' ||
        adapter?.provider === 'google_fit'
      ) {
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
        showToast({ message: result.error || t('profile.healthConnectFailed'), type: 'error' });
      } else {
        showToast({ message: t('profile.healthConnectSuccess') || 'Health Connect linked', type: 'success' });
      }
    } catch (error: any) {
      const provider = await getHealthTelemetryProvider();
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'auth',
      });
      Alert.alert(t('profile.healthConnect'), t('profile.healthConnectFailed'));
    } finally {
      setHealthBusy(false);
    }
  }, [getHealthTelemetryProvider, healthBusy, refreshHealthIntegrationStatus, showToast, t]);

  const handleSyncHealth = useCallback(async () => {
    if (healthBusy) return;
    setHealthBusy(true);
    try {
      const result = await syncHealthData({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        categories: ['steps', 'calories', 'heart_rate', 'sleep', 'workout'],
      });
      await refreshHealthIntegrationStatus();
      showToast({
        message: `${t('profile.healthSyncSummary') || 'Synced'}: ${result.synced} | ${t('profile.healthSyncErrors') || 'Errors'}: ${result.errors}`,
        type: result.errors > 0 ? 'warning' : 'success',
      });
    } catch (error: any) {
      const provider = await getHealthTelemetryProvider();
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'sync',
      });
      Alert.alert(t('profile.healthSync'), t('profile.healthSyncFailed'));
    } finally {
      setHealthBusy(false);
    }
  }, [getHealthTelemetryProvider, healthBusy, refreshHealthIntegrationStatus, showToast, t]);

  const handleHealthConnectSettings = useCallback(() => {
    if (healthConnectEnabled && healthIntegrationReady) {
      setPickerModal({
        visible: true,
        title: t('profile.healthConnect'),
        subtitle: t('profile.healthConnectManage') || 'Manage Health Connect integration',
        options: [
          { label: t('profile.healthSyncNow') || 'Sync Now', value: 'sync' },
          { label: t('profile.healthReconnect') || 'Reconnect', value: 'reconnect' },
          { label: t('profile.healthDisconnect') || 'Disconnect', value: 'disconnect' },
        ],
        destructiveIndex: 2,
        onSelect: async (value: string) => {
          if (value === 'disconnect') {
            await setAppState('healthconnect.enabled', 'false');
            setHealthConnectEnabled(false);
            setHealthIntegrationReady(false);
            setHealthProviderCode('none');
          } else if (value === 'reconnect') {
            await setAppState('healthconnect.enabled', 'true');
            await setAppState('healthconnect.permissions_requested', '');
            setHealthConnectEnabled(true);
            void handleConnectHealth();
          } else if (value === 'sync') {
            void handleSyncHealth();
          }
        },
      });
    } else {
      void (async () => {
        await setAppState('healthconnect.enabled', 'true');
        setHealthConnectEnabled(true);
        await handleConnectHealth();
      })();
    }
  }, [healthConnectEnabled, healthIntegrationReady, handleConnectHealth, handleSyncHealth, t]);

  // ── Data Loading ──

  const loadData = useCallback(async () => {
    if (isLoadingProfileRef.current) {
      if (__DEV__) console.warn('[Profile] loadData:skipped (already loading)');
      return;
    }
    isLoadingProfileRef.current = true;
    lastProfileLoadAt.current = Date.now();
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

      const [
        userProfile,
        progress,
        streak,
        xp,
        adaptive,
        social,
        savedMealRegion,
        consentRecord,
        notifications,
        savedEquipmentLevel,
        savedName,
        savedProfilePic,
        scheduleData,
      ] = await Promise.all([
        getUserProfile('user_local_001').catch(() => null),
        getUserProgress().catch(() => ({ total_workouts: 0, completed_workouts: 0, weekly_xp: 0 })),
        getStreak('user_local_001').catch(() => ({ current: 0, longest: 0 })),
        getXPData().catch(() => ({ level: 1, totalXP: 0, xpToNextLevel: 500, currentLevelXP: 0 })),
        getAdaptiveTrainingProfile('user_local_001').catch(() => null),
        getSocialLayerSettings('user_local_001').catch(() => null),
        getAppState('meal.region_override').catch(() => null),
        getConsentRecord().catch(() => ({ timestamp: null, version: null, source: null as 'remote' | 'local' | null })),
        getNotificationReliabilitySettings().catch(() => ({
          enabled: false,
          reminderHour: 20,
          permission: 'unknown' as const,
          lastScheduledAt: null,
          lastPromptAt: null,
        })),
        getAppState('user.equipment_level').catch(() => null),
        getAppState('user.display_name').catch(() => null),
        getAppState('user.profile_pic').catch(() => null),
        getProfessionSchedule('user_local_001').catch(() => null),
      ]);

      const eqLevel = (
        ['none', 'minimal', 'playground'].includes(savedEquipmentLevel || '') ? savedEquipmentLevel : 'none'
      ) as 'none' | 'minimal' | 'playground';
      if (!mountedRef.current) return;
      setEquipmentLevel(eqLevel);
      if (scheduleData) setProfessionSchedule(scheduleData);

      const displayName = savedName || 'Athlete';
      if (savedProfilePic) setProfilePicUri(savedProfilePic);

      try {
        const stepsResult = await getStepHistory('user_local_001', 365);
        const totalS = stepsResult.reduce((sum, d) => sum + (d.steps || 0), 0);
        setTotalSteps(totalS);
      } catch {
        /* step data optional */
      }

      try {
        const jogResult = await getJogTotals('user_local_001');
        setTotalDistance(Math.round(((jogResult?.total || 0) / 1000) * 10) / 10);
        setRecentDistance(Math.round(((jogResult?.longest || 0) / 1000) * 10) / 10);
      } catch {
        /* jog data optional */
      }

      let estimatedCalories = 0;
      try {
        const sessions = await getRecentSessions('user_local_001', 100);
        estimatedCalories = sessions.reduce((sum, s) => sum + Math.round((s.duration_minutes || 0) * 6.5), 0);
      } catch {
        estimatedCalories = progress.total_workouts * 280;
      }

      setProfile((prev) => ({
        name: savedName || prev?.name || 'Athlete',
        email: '',
        goal: userProfile?.goal || 'body_control',
        experience: userProfile?.experience || 'beginner',
        trainingDays: userProfile?.training_days_per_week || 3,
        sessionMinutes: userProfile?.time_per_session_minutes || 30,
      }));

      setStats({
        totalWorkouts: progress.completed_workouts,
        totalCalories: estimatedCalories,
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
          name: displayName,
          email: '',
          goal: userProfile?.goal || 'body_control',
          experience: userProfile?.experience || 'beginner',
          trainingDays: userProfile?.training_days_per_week || 3,
          sessionMinutes: userProfile?.time_per_session_minutes || 30,
        },
        stats: {
          totalWorkouts: progress.completed_workouts,
          totalCalories: estimatedCalories,
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

      try {
        const capability = await bioAuth.initialize();
        setBiometricAvailable(capability.isAvailable);
        const sessionValid = await bioAuth.isSessionValid();
        setBiometricEnabled(sessionValid);
      } catch {
        /* biometric detection optional */
      }

      try {
        const mxp = await getMindXP('user_local_001');
        if (mxp) setMindXP(mxp);
      } catch {
        /* mind xp optional */
      }
    } catch (err: any) {
      if (__DEV__) console.error('[Profile] Load failed:', err);
      if (mountedRef.current) setLoadError(t('profile.loadFailed') || 'Failed to load profile data');
    } finally {
      if (mountedRef.current) setLoading(false);
      isLoadingProfileRef.current = false;
      lastProfileLoadAt.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only profile load; t used inside but stable
  }, []);

  const debouncedLoadProfile = useCallback(() => {
    if (!dbReady) return;
    if (profileLoadTimer.current) clearTimeout(profileLoadTimer.current);
    profileLoadTimer.current = setTimeout(() => {
      if (Date.now() - lastProfileLoadAt.current < PROFILE_LOAD_COOLDOWN_MS) return;
      loadData();
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady]);

  // ── Effects ──

  useEffect(() => {
    if (!dbReady) return;
    void runReplayIfDue({ reason: 'profile_load', cooldownMs: 45 * 1000 });
    void loadData();
    void refreshHealthIntegrationStatus();
    void refreshHealthSyncErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady]);

  useFocusEffect(
    useCallback(() => {
      if (dbReady) debouncedLoadProfile();
    }, [dbReady, debouncedLoadProfile]),
  );

  useDataSync(
    ['workout_completed', 'xp_awarded', 'level_up', 'streak_updated', 'profile_updated', 'rank_milestone_reached'],
    debouncedLoadProfile,
  );

  // ── Action Handlers ──

  const handleTrainingDays = () => {
    setPickerModal({
      visible: true,
      title: t('profile.trainingDaysModalTitle'),
      subtitle: t('profile.trainingDaysModalSub'),
      options: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
        label: `${d} ${d > 1 ? t('common.days') : t('common.day')}`,
        value: String(d),
      })),
      onSelect: async (val) => {
        const d = Number(val);
        if (__DEV__) console.warn('[Profile] Update training days', { value: d });
        await updateUserProfile('user_local_001', { training_days_per_week: d });
        setProfile((prev) => (prev ? { ...prev, trainingDays: d } : prev));
        await refreshProfile();
      },
    });
  };

  const handleSessionLength = () => {
    setPickerModal({
      visible: true,
      title: t('profile.sessionLengthModalTitle'),
      subtitle: t('profile.sessionLengthModalSub'),
      options: [15, 20, 30, 45, 60, 90].map((m) => ({
        label: `${m} ${t('common.minutes')}`,
        value: String(m),
      })),
      onSelect: async (val) => {
        const m = Number(val);
        if (__DEV__) console.warn('[Profile] Update session length', { value: m });
        await updateUserProfile('user_local_001', { time_per_session_minutes: m });
        setProfile((prev) => (prev ? { ...prev, sessionMinutes: m } : prev));
        await refreshProfile();
      },
    });
  };

  const handleWorkSchedule = () => {
    setScheduleEdit({
      startHour: professionSchedule?.work_start_hour ?? 8,
      endHour: professionSchedule?.work_end_hour ?? 17,
      shiftType: (professionSchedule?.shift_type as 'day' | 'night' | 'rotating') || 'day',
      commute: professionSchedule?.commute_minutes ?? 30,
    });
    setShowScheduleModal(true);
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
        if (__DEV__) console.warn('[Profile] Update experience', { value: val });
        await updateUserProfile('user_local_001', { experience: val as any });
        setProfile((prev) => (prev ? { ...prev, experience: val } : prev));
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
        if (__DEV__) console.warn('[Profile] Update goal', { value: val });
        await updateUserProfile('user_local_001', { goal: val as any });
        setProfile((prev) => (prev ? { ...prev, goal: val } : prev));
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
        if (__DEV__) console.warn('[Profile] Update equipment level', { value: level });
        await setAppState('user.equipment_level', level);
        setEquipmentLevel(level);
      },
    });
  };

  const handleLanguage = () => {
    setPickerModal({
      visible: true,
      title: t('profile.language'),
      options: SUPPORTED_LANGUAGES.map((lang) => ({
        label: `${lang.flag} ${lang.name}`,
        value: lang.code,
      })),
      onSelect: (val) => {
        setLanguage(val);
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
        const next = MEAL_REGION_VALUES.includes(val as MealRegionValue) ? (val as MealRegionValue) : 'AUTO';
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
            subtitle: t('profile.notificationsAction.pickTime') || 'Choose your preferred reminder time',
            options: Array.from({ length: 24 }, (_, hour) => ({
              label: `${String(hour).padStart(2, '0')}:00`,
              value: String(hour),
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

  const handleLogout = () => {
    setPickerModal({
      visible: true,
      title: t('profile.logout'),
      subtitle: t('profile.logoutConfirm'),
      options: [{ label: t('profile.logout'), value: 'logout' }],
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
      showToast({
        message: `${t('profile.alert.consentRecordedTitle') || 'Consent recorded'} (v${result.version})`,
        type: 'success',
      });
    } catch (e: any) {
      showToast({ message: e?.message ?? t('profile.alert.consentFailed') ?? 'Failed', type: 'error' });
    } finally {
      setPrivacyBusy(false);
    }
  }, [privacyBusy, showToast, t]);

  const handleExportData = useCallback(async () => {
    if (privacyBusy) return;
    setPrivacyBusy(true);
    try {
      const [profileData, equipment, injuries, fatigue, sessions, streakData, progress, steps, xp] = await Promise.all([
        getUserProfile('user_local_001'),
        getUserEquipment('user_local_001'),
        getUserInjuries('user_local_001'),
        getMuscleFatigue('user_local_001'),
        getRecentSessions('user_local_001', 100),
        getStreak('user_local_001'),
        getAllProgressRecords('user_local_001', 100),
        getStepHistory('user_local_001', 90),
        getXPData(),
      ]);

      const payload = {
        _exportedAt: new Date().toISOString(),
        _version: 'FitQuest 2.0 Local Export',
        profile: profileData,
        equipment,
        injuries,
        muscleFatigue: fatigue,
        workoutSessions: sessions,
        streak: streakData,
        progressRecords: progress,
        dailySteps: steps,
        xpData: xp,
      };

      const exportDir = `${FileSystem.documentDirectory}exports/`;
      const dirInfo = await FileSystem.getInfoAsync(exportDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
      }

      const outUri = `${exportDir}fitquest_user_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(outUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      showToast({ message: t('profile.alert.exportCompleteTitle') || 'Export complete', type: 'success' });
    } catch (e: any) {
      showToast({ message: e?.message ?? t('profile.alert.exportFailedBody') ?? 'Export failed', type: 'error' });
    } finally {
      setPrivacyBusy(false);
    }
  }, [privacyBusy, showToast, t]);

  const handleDeleteCloudData = useCallback(() => {
    if (privacyBusy) return;
    Alert.alert(t('profile.menu.deleteCloudData'), t('profile.menu.deleteCloudDataConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.menu.deletePermanently'),
        style: 'destructive',
        onPress: async () => {
          setPrivacyBusy(true);
          try {
            await deleteAllUserData('user_local_001');
            await signOut();
            router.replace('/login');
          } catch (e: any) {
            Alert.alert(t('profile.alert.deleteFailedTitle'), e?.message ?? t('profile.alert.deleteFailedBody'));
          } finally {
            setPrivacyBusy(false);
          }
        },
      },
    ]);
  }, [privacyBusy, signOut, router, t]);

  const handleSocialToggle = useCallback(
    async (enabled: boolean) => {
      if (socialBusy) return;
      setSocialBusy(true);
      try {
        const next = await setSocialLayerEnabled('user_local_001', enabled);
        setSocialSettings(next);
      } catch (e: any) {
        showToast({
          message: e?.message ?? t('profile.alert.updateSocialFailedBody') ?? 'Update failed',
          type: 'error',
        });
      } finally {
        setSocialBusy(false);
      }
    },
    [socialBusy, showToast, t],
  );

  const handlePickPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        const destUri = `${FileSystem.documentDirectory}profile_pic.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: destUri });
        setProfilePicUri(destUri);
        await setAppState('user.profile_pic', destUri);
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[Profile] Photo pick failed:', e);
    }
  }, []);

  const handleSaveName = useCallback(async () => {
    const trimmed = editNameValue.trim();
    if (trimmed) {
      setProfile((prev) => (prev ? { ...prev, name: trimmed } : prev));
      await setAppState('user.display_name', trimmed);
    }
    setIsEditingName(false);
  }, [editNameValue]);

  const handleSaveSchedule = useCallback(async () => {
    const schedule: ProfessionSchedule = {
      profession_type: professionSchedule?.profession_type || 'office',
      work_start_hour: scheduleEdit.startHour,
      work_end_hour: scheduleEdit.endHour,
      commute_minutes: scheduleEdit.commute,
      preferred_windows: scheduleEdit.startHour <= 8 ? ['AFTER_WORK'] : ['BEFORE_WORK', 'AFTER_WORK'],
      shift_type: scheduleEdit.shiftType,
    };
    await saveProfessionSchedule('user_local_001', schedule);
    setProfessionSchedule(schedule);
    setShowScheduleModal(false);
  }, [professionSchedule, scheduleEdit]);

  const handleBiometricTest = useCallback(async () => {
    if (!biometricAvailable) {
      showToast({
        message: t('profile.biometricUnavailable') || 'Biometric not available on this device',
        type: 'info',
      });
      return;
    }
    try {
      const result = await bioAuth.authenticate();
      if (result.success) {
        setBiometricEnabled(true);
        showToast({ message: t('profile.biometricVerified') || 'Biometric verified', type: 'success' });
      } else if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        // User cancelled — no error to show
      } else {
        showToast({ message: t('profile.biometricFailed') || 'Authentication failed', type: 'error' });
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[Profile] Biometric test failed:', e);
    }
  }, [biometricAvailable, showToast, t]);

  const handleDismissHealthErrors = useCallback(async () => {
    for (const err of healthSyncErrors) {
      await errorTelemetry.resolveError(err.id);
    }
    refreshHealthSyncErrors();
  }, [healthSyncErrors, refreshHealthSyncErrors]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    loadData();
  }, [loadData]);

  // ── Derived ──

  const goalMeta = GOAL_LABELS[profile?.goal || 'body_control'] ?? GOAL_LABELS['body_control']!;
  const goalInfo = { icon: goalMeta.icon, color: (theme.colors as any)[goalMeta.colorKey] as string };
  const goalLabel = t(`profile.goal.${profile?.goal || 'body_control'}`);
  const xpProgress = stats && stats.xpForNext > 0 ? stats.currentLevelXP / stats.xpForNext : 0;

  const healthConnectSublabel = `${!healthConnectEnabled ? t('profile.statusDisabled') || 'Disabled' : healthIntegrationReady ? t('profile.statusConnected') : t('profile.statusNotConnected')} · ${healthProviderLabel(healthProviderCode)}`;
  const healthSyncSublabel = healthBusy ? t('profile.syncInProgress') : t('profile.healthSyncSub');
  const notificationSublabel = notificationSettings.enabled
    ? `${t('profile.notificationsStatus.enabled')} · ${formatReminderHourLabel(notificationSettings.reminderHour)}`
    : t('profile.notificationsStatus.disabled');
  const biometricSublabel = biometricAvailable
    ? biometricEnabled
      ? t('profile.biometricActive') || 'Face ID / Fingerprint active'
      : t('profile.biometricAvailable') || 'Tap to enable Face ID / Fingerprint'
    : t('profile.biometricUnavailable') || 'Not available on this device';
  const scheduleLabel = professionSchedule
    ? `${professionSchedule.work_start_hour.toString().padStart(2, '0')}:00–${professionSchedule.work_end_hour.toString().padStart(2, '0')}:00 · ${professionSchedule.shift_type} shift`
    : 'Set your work hours for smarter scheduling';
  const subscriptionLabel =
    accessState === 'SUBSCRIBED'
      ? t('profile.subscribed') || 'Subscribed'
      : accessState === 'TRIAL_ACTIVE'
        ? `${t('profile.trial') || 'Trial'} — ${trialDaysRemaining} ${t('paywall.trialDaysLeft') || 'days left'}`
        : t('profile.expired') || 'Expired';
  const subscriptionSublabel =
    accessState === 'SUBSCRIBED'
      ? t('profile.fullAccess') || 'Full access to every feature'
      : accessState === 'TRIAL_ACTIVE'
        ? t('profile.trialAccess') || 'Full access during trial'
        : t('profile.subscribeToUnlock') || 'Subscribe to unlock all features';
  const subscriptionIcon =
    accessState === 'SUBSCRIBED' ? 'check-decagram' : accessState === 'TRIAL_ACTIVE' ? 'clock-outline' : 'lock';

  return {
    // Theme & i18n
    theme,
    mode,
    setMode,
    t,
    language,
    setLanguage,
    languageName,
    router,
    accessState,

    // Data state
    profile,
    stats,
    loading,
    loadError,
    adaptiveProfile,
    socialSettings,
    socialBusy,
    mealRegionOverride,
    notificationSettings,
    biometricAvailable,
    biometricEnabled,
    healthProviderCode,
    healthIntegrationReady,
    healthBusy,
    healthConnectEnabled,
    healthSyncErrors,
    equipmentLevel,
    profilePicUri,
    isEditingName,
    editNameValue,
    totalSteps,
    totalDistance,
    recentDistance,
    mindXP,
    professionSchedule,
    consentTimestamp,
    consentVersion,
    consentSource,
    privacyBusy,

    // UI state
    showAboutModal,
    setShowAboutModal,
    showHelpModal,
    setShowHelpModal,
    showScheduleModal,
    setShowScheduleModal,
    expandedAdaptive,
    setExpandedAdaptive,
    setIsEditingName,
    setEditNameValue,
    scheduleEdit,
    setScheduleEdit,
    pickerModal,
    closePicker,

    // Actions
    handleTrainingDays,
    handleSessionLength,
    handleWorkSchedule,
    handleExperience,
    handleGoalChange,
    handleEquipmentLevel,
    handleLanguage,
    handleMealRegion,
    handleNotifications,
    handleHealthConnectSettings,
    handleSyncHealth,
    handleLogout,
    handleRecordConsent,
    handleExportData,
    handleDeleteCloudData,
    handleSocialToggle,
    handlePickPhoto,
    handleSaveName,
    handleSaveSchedule,
    handleBiometricTest,
    handleDismissHealthErrors,
    retryLoad,
    loadData,

    // Derived
    goalInfo,
    goalLabel,
    xpProgress,
    mealRegionLabel,
    healthConnectSublabel,
    healthSyncSublabel,
    notificationSublabel,
    biometricSublabel,
    scheduleLabel,
    subscriptionLabel,
    subscriptionSublabel,
    subscriptionIcon,
  };
});

export type ProfileViewModel = ReturnType<typeof useProfileViewModel>;
