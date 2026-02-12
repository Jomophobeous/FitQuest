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
import { getUserProgress, getStreak, getUserProfile, updateUserProfile } from '../src/database/service';
import { useRouter } from 'expo-router';
import { getXPData, XPData } from '../src/services/xpService';
import { GlassCard, GradientButton, ProgressRing, StatChip, SectionHeader } from '../src/components/ui/GlassUI';
import { useAuth } from '../src/context/AuthContext';
import { deleteMyUserData, exportMyUserData, recordConsentTimestamp } from '../src/services/authApi';
import { getAdaptiveTrainingProfile, type AdaptiveTrainingProfile } from '../src/services/adaptiveTrainingService';
import { getSocialLayerSettings, setSocialLayerEnabled, type SocialLayerSettings } from '../src/services/socialLayerService';

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
          {subtitle && (
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
            <Text style={[modalStyles.cancelText, { color: theme.colors.accent }]}>Cancel</Text>
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

const GOAL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  calisthenics: { label: 'Calisthenics', icon: 'human-handsup', color: '#5F63FF' },
  getting_taller: { label: 'Getting Taller', icon: 'human-male-height', color: '#10B981' },
  faster: { label: 'Speed & Agility', icon: 'lightning-bolt', color: '#F4A427' },
  flexible: { label: 'Flexibility', icon: 'yoga', color: '#EC4899' },
  mental_clarity: { label: 'Mental Clarity', icon: 'head-snowflake', color: '#8B5CF6' },
  building_muscle: { label: 'Muscle Building', icon: 'weight-lifter', color: '#EF4444' },
};

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
          {sublabel && (
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
  const [adaptiveProfile, setAdaptiveProfile] = useState<AdaptiveTrainingProfile | null>(null);
  const [socialSettings, setSocialSettings] = useState<SocialLayerSettings | null>(null);
  const [socialBusy, setSocialBusy] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

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

  const handleTrainingDays = () => {
    setPickerModal({
      visible: true,
      title: 'Training Days per Week',
      subtitle: 'How many days do you train?',
      options: [1, 2, 3, 4, 5, 6, 7].map(d => ({
        label: `${d} day${d > 1 ? 's' : ''}`,
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
      title: 'Session Length',
      subtitle: 'How long are your sessions?',
      options: [15, 20, 30, 45, 60, 90].map(m => ({
        label: `${m} minutes`,
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
      title: 'Experience Level',
      subtitle: 'Select your fitness experience',
      options: [
        { label: 'Beginner', value: 'beginner' },
        { label: 'Intermediate', value: 'intermediate' },
        { label: 'Advanced', value: 'advanced' },
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
      title: 'Training Goal',
      subtitle: 'What do you want to focus on?',
      options: [
        { label: '💪 Calisthenics', value: 'calisthenics' },
        { label: '📏 Getting Taller', value: 'getting_taller' },
        { label: '⚡ Speed & Agility', value: 'faster' },
        { label: '🧘 Flexibility', value: 'flexible' },
        { label: '🧠 Mental Clarity', value: 'mental_clarity' },
        { label: '🏋️ Muscle Building', value: 'building_muscle' },
      ],
      onSelect: async (val) => {
        await updateUserProfile('user_local_001', { goal: val as any });
        setProfile(prev => prev ? { ...prev, goal: val } : prev);
      },
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [userProfile, progress, streak, xp, adaptive, social] = await Promise.all([
        getUserProfile('user_local_001'),
        getUserProgress(),
        getStreak('user_local_001'),
        getXPData(),
        getAdaptiveTrainingProfile('user_local_001'),
        getSocialLayerSettings('user_local_001'),
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
    } catch (err) {
      console.error('[Profile] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const goalInfo = GOAL_LABELS[profile?.goal || 'calisthenics'];
  const xpProgress = stats ? stats.currentLevelXP / stats.xpForNext : 0;

  const handleLogout = () => {
    setPickerModal({
      visible: true,
      title: 'Log Out',
      subtitle: 'Are you sure you want to log out?',
      options: [
        { label: 'Log Out', value: 'logout' },
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
      const result = await recordConsentTimestamp();
      setConsentTimestamp(result.consentTimestamp);
      Alert.alert('Consent recorded', 'Your privacy consent timestamp has been saved.');
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not record consent');
    } finally {
      setPrivacyBusy(false);
    }
  }, [privacyBusy]);

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

      Alert.alert('Export complete', `Saved to:\n${outUri}`);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not export user data');
    } finally {
      setPrivacyBusy(false);
    }
  }, [privacyBusy]);

  const handleDeleteCloudData = useCallback(() => {
    if (privacyBusy) return;
    setPickerModal({
      visible: true,
      title: 'Delete Cloud Data',
      subtitle: 'This permanently deletes your account backups and cloud metadata.',
      options: [{ label: 'Delete Permanently', value: 'delete' }],
      destructiveIndex: 0,
      onSelect: async () => {
        setPrivacyBusy(true);
        try {
          await deleteMyUserData();
          await signOut();
          router.replace('/login');
        } catch (e: any) {
          Alert.alert('Delete failed', e?.message ?? 'Could not delete cloud data');
        } finally {
          setPrivacyBusy(false);
        }
      },
    });
  }, [privacyBusy, signOut, router]);

  const handleSocialToggle = useCallback(async (enabled: boolean) => {
    if (socialBusy) return;
    setSocialBusy(true);
    try {
      const next = await setSocialLayerEnabled('user_local_001', enabled);
      setSocialSettings(next);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Could not update social settings');
    } finally {
      setSocialBusy(false);
    }
  }, [socialBusy]);

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
                        <Text style={styles.avatarInitials}>
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
                    <Text style={[styles.goalBadgeText, { color: goalInfo.color }]}>{goalInfo.label}</Text>
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
          <StatChip icon="fire" label="Streak" value={`${stats?.streak || 0}d`} color="#F4A427" delay={200} />
          <StatChip icon="dumbbell" label="Workouts" value={`${stats?.totalWorkouts || 0}`} color={theme.colors.accent} delay={300} />
          <StatChip icon="lightning-bolt" label="XP" value={`${stats?.totalXP || 0}`} color="#8B5CF6" delay={400} />
        </View>

        {/* ── ACHIEVEMENTS CARD ── */}
        <View style={styles.section}>
          <SectionHeader title="Achievements" delay={300} />
          <GlassCard gradient delay={350}>
            <View style={styles.achievementRow}>
              <View style={styles.achievementItem}>
                <ProgressRing progress={Math.min((stats?.totalWorkouts || 0) / 50, 1)} size={56} strokeWidth={4} color={theme.colors.accent}>
                  <MaterialCommunityIcons name="trophy" size={20} color={theme.colors.accent} />
                </ProgressRing>
                <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                  {stats?.totalWorkouts || 0}/50
                </Text>
                <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>Workouts</Text>
              </View>
              <View style={styles.achievementItem}>
                <ProgressRing progress={Math.min((stats?.longestStreak || 0) / 30, 1)} size={56} strokeWidth={4} color="#F4A427">
                  <MaterialCommunityIcons name="fire" size={20} color="#F4A427" />
                </ProgressRing>
                <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                  {stats?.longestStreak || 0}/30
                </Text>
                <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>Best Streak</Text>
              </View>
              <View style={styles.achievementItem}>
                <ProgressRing progress={Math.min((stats?.level || 1) / 20, 1)} size={56} strokeWidth={4} color="#10B981">
                  <MaterialCommunityIcons name="star" size={20} color="#10B981" />
                </ProgressRing>
                <Text style={[styles.achievementLabel, { color: theme.colors.text }]}>
                  LVL {stats?.level || 1}
                </Text>
                <Text style={[styles.achievementSub, { color: theme.colors.textMuted }]}>Level</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* ── TRAINING PROFILE ── */}
        <View style={styles.section}>
          <SectionHeader title="Training Profile" delay={400} />
          <MenuItem
            icon="target"
            label="Training Goal"
            sublabel={`${goalInfo.label} — Sets your workout focus and exercise selection`}
            color={goalInfo.color}
            delay={440}
            onPress={handleGoalChange}
          />
          <MenuItem
            icon="calendar-week"
            label="Training Days"
            sublabel={`${profile?.trainingDays || 3} days per week — How often you train`}
            color="#5F63FF"
            delay={460}
            onPress={handleTrainingDays}
          />
          <MenuItem
            icon="clock-outline"
            label="Session Length"
            sublabel={`${profile?.sessionMinutes || 30} minutes — Duration of each workout`}
            color="#10B981"
            delay={480}
            onPress={handleSessionLength}
          />
          <MenuItem
            icon="signal-cellular-3"
            label="Experience"
            sublabel={`${(profile?.experience || 'beginner').charAt(0).toUpperCase() + (profile?.experience || 'beginner').slice(1)} — Adjusts exercise difficulty`}
            color="#F4A427"
            delay={500}
            onPress={handleExperience}
          />
          <MenuItem
            icon="human-edit"
            label="Craft My Body"
            sublabel="Personalized body transformation plan with nutrition & training"
            color="#EC4899"
            delay={520}
            onPress={() => router.push('/craft-my-body')}
          />
        </View>

        {/* ── ADAPTIVE PROFILE ── */}
        <View style={styles.section}>
          <SectionHeader title="Adaptive Training" delay={530} />
          <GlassCard delay={560}>
            <View style={styles.adaptiveRow}>
              <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>Fatigue sensitivity</Text>
              <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                {adaptiveProfile ? adaptiveProfile.fatigueSensitivity.toFixed(2) : '1.00'}
              </Text>
            </View>
            <View style={styles.adaptiveRow}>
              <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>Progression pace</Text>
              <Text style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                {adaptiveProfile ? adaptiveProfile.progressionAggressiveness.toFixed(2) : '1.00'}
              </Text>
            </View>
            <View style={styles.adaptiveRow}>
              <Text style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>Volume tolerance</Text>
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
              Confidence: {Math.round((adaptiveProfile?.confidence ?? 0) * 100)}% · Samples: {adaptiveProfile?.samples ?? 0}
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
          <SectionHeader title="Preferences" delay={500} />
          <MenuItem
            icon="account-group-outline"
            label="Social Layer (Opt-in)"
            sublabel={socialSettings?.enabled
              ? 'Enabled for future leaderboards/challenges'
              : 'Disabled (solo mode preserved)'}
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
            label="Dark Mode"
            sublabel={theme.isDark ? 'Dark theme active' : 'Light theme active'}
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
            icon="bell-outline"
            label={t('profile.notifications')}
            sublabel="Set workout reminders and daily motivation alerts"
            color="#EC4899"
            delay={600}
          />
          <MenuItem
            icon="shield-check-outline"
            label="Privacy & Security"
            sublabel="Manage data consent, encryption, and security settings"
            color="#10B981"
            delay={650}
          />
          <MenuItem
            icon="check-decagram-outline"
            label="Record Consent"
            sublabel={consentTimestamp
              ? `Saved ${new Date(consentTimestamp).toLocaleString()}`
              : 'Tap to save privacy consent timestamp'}
            color="#10B981"
            delay={670}
            onPress={() => {
              void handleRecordConsent();
            }}
          />
          <MenuItem
            icon="file-export-outline"
            label="Export My Data"
            sublabel="Create local JSON export of cloud metadata + backups"
            color="#5F63FF"
            delay={690}
            onPress={() => {
              void handleExportData();
            }}
          />
          <MenuItem
            icon="trash-can-outline"
            label="Delete Cloud Data"
            sublabel="Permanently remove server-side account data"
            color="#EF4444"
            delay={710}
            onPress={handleDeleteCloudData}
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            sublabel="FAQs, guides, and contact support"
            color="#F4A427"
            delay={730}
          />
        </View>

        {/* ── APP INFO ── */}
        <View style={styles.section}>
          <SectionHeader title="App" delay={650} />
          <MenuItem
            icon="backup-restore"
            label="Backup & Restore"
            sublabel="Encrypted local backup files"
            color={theme.colors.accent}
            delay={680}
            onPress={() => router.push('/backups')}
          />
          <MenuItem
            icon="information-outline"
            label="About FitQuest"
            sublabel="Version 1.0.0"
            color="#5F63FF"
            delay={700}
          />
        </View>

        {/* ── LOGOUT ── */}
        <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.logoutSection}>
          <TouchableOpacity
            style={[styles.logoutBtn, {
              borderColor: '#EF4444' + '40',
              backgroundColor: '#EF4444' + '10',
            }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
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
    color: '#fff',
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
    color: '#EF4444',
  },
});
