/**
 * FitQuest Profile Screen
 * Premium glass-morphism profile with live stats, settings, and theme toggle
 *
 * Architecture: Pure UI — all data/service access via useProfileViewModel.
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import ThemedText from '../src/components/ThemedText';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import { RankCard, MilestoneList } from '../src/components/RankDisplay';
import { useProfileViewModel } from '../src/viewmodels/useProfileViewModel';
import { typography, spacing, radius } from '../src/design/theme-system';
import { featureFlags as featureFlagsService } from '../src/services/featureFlags';
import { preloadFromProfile } from '../src/services/preloadService';
import { useNavigationState } from '../src/hooks/useNavigationState';
import { ThemedPickerModal, MenuItem, adaptiveLabel } from '../src/components/profile/ProfileParts';
import { ScheduleModal, HelpModal, AboutModal } from '../src/components/profile/ProfileModals';
import { ProfileHeader } from '../src/components/profile/ProfileHeader';
import { StatsGrid, AchievementsCard } from '../src/components/profile/ProfileStats';
import { ThemePillRow } from '../src/components/profile/InlinePickers';
import { AccountSection } from '../src/components/profile/AccountSection';
import { SUPPORTED_LANGUAGES } from '../src/i18n/translations';
import type { ThemeMode } from '../src/design/theme-system';
import { SkeletonProfile } from '../src/components/ui/Skeleton';

// ============================================
// SCREEN
// ============================================

export default function ProfileScreen() {
  const vm = useProfileViewModel();
  // Preload adjacent screens + persist scroll position
  const navState = useNavigationState('profile');
  React.useEffect(() => {
    preloadFromProfile();
  }, []);
  const {
    theme,
    mode,
    setMode,
    t,
    language,
    setLanguage,
    languageName,
    router,
    accessState,
    profile,
    stats,
    loading,
    loadError,
    adaptiveProfile,
    socialSettings,
    socialBusy,
    mealRegionOverride,
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
    consentTimestamp,
    consentVersion,
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
    handleTrainingDays,
    handleSessionLength,
    handleWorkSchedule,
    handleExperience,
    handleGoalChange,
    handleEquipmentLevel,
    handleMealRegion,
    handleLanguage,
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
  } = vm;

  // Analytics opt-out toggle
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const handleAnalyticsToggle = (next: boolean) => {
    setAnalyticsOn(next);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Animated.View entering={FadeInDown.duration(200)}>
          <SkeletonProfile />
        </Animated.View>
      </ScreenContainer>
    );
  }

  if (loadError) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center', padding: spacing[6] }}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>
          {loadError}
        </ThemedText>
        <GradientButton title="Retry" onPress={retryLoad} style={{ marginTop: spacing[4] }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary
      screenName="Profile"
      onGoBack={() => (router.canGoBack() ? router.back() : router.replace('/dashboard' as any))}
    >
      <ScreenContainer>
        <ScreenTutorial
          screenKey="profile"
          icon="account-circle"
          title="Your Profile"
          description="View and edit your fitness profile, track your stats, manage equipment preferences, and customize app settings."
        />
        <Animated.View entering={FadeInDown.duration(250)}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* ── PROFILE HEADER ── */}
            <ProfileHeader
              profile={profile}
              stats={stats}
              xpProgress={xpProgress}
              goalInfo={goalInfo}
              goalLabel={goalLabel}
              profilePicUri={profilePicUri}
              isEditingName={isEditingName}
              editNameValue={editNameValue}
              setEditNameValue={setEditNameValue}
              setIsEditingName={setIsEditingName}
              onSaveName={handleSaveName}
              onPickPhoto={handlePickPhoto}
            />

            {/* ── STATS GRID ── */}
            <StatsGrid
              stats={stats}
              totalSteps={totalSteps}
              totalDistance={totalDistance}
              recentDistance={recentDistance}
            />

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

            {/* ── ACHIEVEMENTS CARD ── */}
            <AchievementsCard stats={stats} />

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
                icon="dumbbell"
                label={t('profile.trainingProfile')}
                sublabel={`${goalLabel} · ${profile?.trainingDays || 3} ${t('common.daysPerWeek')} · ${profile?.sessionMinutes || 30} ${t('common.minutes')}`}
                color={theme.colors.accent}
                delay={420}
                onPress={() => router.push('/training-profile' as any)}
              />
            </View>

            {/* ── ADAPTIVE TRAINING ── */}
            <View style={styles.section}>
              <SectionHeader title={t('profile.adaptiveTraining')} delay={440} />
              <MenuItem
                icon="chart-line-variant"
                label={t('profile.adaptiveTraining')}
                sublabel={`${adaptiveProfile?.samples || 0} ${t('profile.workoutsAnalyzed') || 'workouts analyzed'} · ${Math.round((adaptiveProfile?.confidence ?? 0) * 100)}% ${t('profile.confidence') || 'confidence'}`}
                color={theme.colors.accent}
                delay={460}
                onPress={() => router.push('/adaptive-training' as any)}
              />
            </View>

            {/* ── PREFERENCES (Compact Card) ── */}
            <View style={styles.section}>
              <SectionHeader title={t('profile.preferences')} delay={500} />
              <GlassCard delay={510}>
                {/* ── Theme Picker (inline pills) ── */}
                <View style={styles.inlineSettingRow}>
                  <View
                    style={[
                      styles.menuIconWrap,
                      { backgroundColor: (mode === 'blackGold' ? theme.colors.accent3 : theme.colors.purple) + '18' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        (mode === 'blackGold' ? 'crown' : mode === 'dark' ? 'weather-night' : 'weather-sunny') as any
                      }
                      size={18}
                      color={mode === 'blackGold' ? theme.colors.accent3 : theme.colors.purple}
                    />
                  </View>
                  <ThemedText style={[styles.menuLabel, { color: theme.colors.text, flex: 1 }]}>
                    {t('profile.theme') || 'Theme'}
                  </ThemedText>
                </View>
                <ThemePillRow current={mode as ThemeMode} onSelect={(m) => setMode(m as any)} />

                <View style={[styles.inlineDivider, { backgroundColor: theme.colors.border }]} />

                {/* ── Language Picker (single MenuItem) ── */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleLanguage}
                  style={styles.inlineSettingRow}
                  accessibilityLabel={t('profile.language')}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.blue + '18' }]}>
                    <MaterialCommunityIcons name="translate" size={18} color={theme.colors.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.menuLabel, { color: theme.colors.text }]}>
                      {t('profile.language')}
                    </ThemedText>
                    <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                      {languageName}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.inlineDivider, { backgroundColor: theme.colors.border }]} />

                {/* ── Social Toggle ── */}
                <View style={styles.inlineSettingRow}>
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.blue + '18' }]}>
                    <MaterialCommunityIcons name="account-group-outline" size={18} color={theme.colors.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.menuLabel, { color: theme.colors.text }]}>
                      {t('profile.socialLayer')}
                    </ThemedText>
                    <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                      {socialSettings?.enabled ? t('profile.socialLayerOn') : t('profile.socialLayerOff')}
                    </ThemedText>
                  </View>
                  <Switch
                    value={socialSettings?.enabled ?? false}
                    onValueChange={(next) => {
                      void handleSocialToggle(next);
                    }}
                    disabled={socialBusy}
                    trackColor={{ false: theme.colors.border, true: theme.colors.blue + '60' }}
                    thumbColor={(socialSettings?.enabled ?? false) ? theme.colors.blue : theme.colors.surface}
                    accessibilityRole="switch"
                    accessibilityLabel={t('profile.socialLayer')}
                    accessibilityState={{ checked: socialSettings?.enabled ?? false }}
                  />
                </View>

                <View style={[styles.inlineDivider, { backgroundColor: theme.colors.border }]} />

                {/* ── Notifications (picker) ── */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleNotifications}
                  style={styles.inlineSettingRow}
                  accessibilityLabel={t('profile.notifications')}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.pink + '18' }]}>
                    <MaterialCommunityIcons name="bell-outline" size={18} color={theme.colors.pink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.menuLabel, { color: theme.colors.text }]}>
                      {t('profile.notifications')}
                    </ThemedText>
                    <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                      {notificationSublabel}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.inlineDivider, { backgroundColor: theme.colors.border }]} />

                {/* ── Meal Region (picker) ── */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleMealRegion}
                  style={styles.inlineSettingRow}
                  accessibilityLabel={t('profile.mealRegion.title')}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.accent + '18' }]}>
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.menuLabel, { color: theme.colors.text }]}>
                      {t('profile.mealRegion.title')}
                    </ThemedText>
                    <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                      {mealRegionLabel(mealRegionOverride)}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </GlassCard>
            </View>

            {/* ── HEALTH & SECURITY (Expandable Card) ── */}
            <View style={styles.section}>
              <SectionHeader title={t('profile.healthSecurity') || 'Health & Security'} delay={600} />
              <GlassCard delay={610}>
                {/* ── Biometric Lock ── */}
                <TouchableOpacity activeOpacity={0.7} onPress={handleBiometricTest} style={styles.inlineSettingRow}>
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.indigo + '18' }]}>
                    <MaterialCommunityIcons name="fingerprint" size={18} color={theme.colors.indigo} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.menuLabel, { color: theme.colors.text }]}>
                      {t('profile.biometricLock') || 'Biometric Lock'}
                    </ThemedText>
                    <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                      {biometricSublabel}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.inlineDivider, { backgroundColor: theme.colors.border }]} />

                {/* ── Health Connect ── */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleHealthConnectSettings}
                  style={styles.inlineSettingRow}
                >
                  <View
                    style={[
                      styles.menuIconWrap,
                      { backgroundColor: (healthConnectEnabled ? theme.colors.accent : theme.colors.textMuted) + '18' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={18}
                      color={healthConnectEnabled ? theme.colors.accent : theme.colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.menuLabel, { color: theme.colors.text }]}>
                      {t('profile.healthConnect')}
                    </ThemedText>
                    <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                      {healthConnectSublabel}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.inlineDivider, { backgroundColor: theme.colors.border }]} />

                {/* ── Health Sync ── */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    void handleSyncHealth();
                  }}
                  style={styles.inlineSettingRow}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.blue + '18' }]}>
                    <MaterialCommunityIcons name="sync" size={18} color={theme.colors.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.menuLabel, { color: theme.colors.text }]}>
                      {t('profile.healthSync')}
                    </ThemedText>
                    <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                      {healthSyncSublabel}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="sync" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </GlassCard>

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
                    <ThemedText style={[styles.healthErrorsTitle, { color: theme.colors.error }]}>
                      {t('profile.healthSyncIssues') || 'Recent Sync Issues'}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={handleDismissHealthErrors}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.dismiss') || 'Dismiss'}
                    >
                      <ThemedText style={[styles.healthErrorsDismiss, { color: theme.colors.textMuted }]}>
                        {t('common.dismiss') || 'Dismiss'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                  {healthSyncErrors.slice(0, 3).map((err) => (
                    <ThemedText
                      key={err.id}
                      numberOfLines={1}
                      style={[styles.healthErrorItem, { color: theme.colors.textSecondary }]}
                    >
                      • {err.message}
                    </ThemedText>
                  ))}
                  {healthSyncErrors.length > 3 && (
                    <ThemedText style={[styles.healthErrorMore, { color: theme.colors.textMuted }]}>
                      +{healthSyncErrors.length - 3} {t('common.more') || 'more'}
                    </ThemedText>
                  )}
                </Animated.View>
              )}
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
                icon="chart-timeline-variant-shimmer"
                label={t('profile.analytics') || 'Usage Analytics'}
                sublabel={
                  analyticsOn
                    ? t('profile.analyticsOn') || 'Sending anonymized usage data'
                    : t('profile.analyticsOff') || 'Usage data collection disabled'
                }
                color={theme.colors.accent}
                delay={655}
                onPress={() => handleAnalyticsToggle(!analyticsOn)}
                rightContent={
                  <Switch
                    value={analyticsOn}
                    onValueChange={handleAnalyticsToggle}
                    trackColor={{ false: theme.colors.border, true: theme.colors.accent + '60' }}
                    thumbColor={analyticsOn ? theme.colors.accent : theme.colors.surface}
                    accessibilityRole="switch"
                    accessibilityLabel="Usage analytics"
                    accessibilityState={{ checked: analyticsOn }}
                  />
                }
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

            {/* ── FEEDBACK & BUG REPORT ── */}
            <View style={styles.section}>
              <SectionHeader title={t('profile.feedback') || 'Feedback'} delay={750} />
              <MenuItem
                icon="message-star-outline"
                label={t('profile.reviewBugReport') || 'Review & Bug Report'}
                sublabel={t('profile.reviewBugReportSub') || 'Help us improve FitQuest'}
                color={theme.colors.accent}
                delay={760}
                onPress={() => router.push('/feedback' as any)}
              />
            </View>

            {/* ── ACCOUNT SECTION ── */}
            <AccountSection
              email={'jomophobeous@gmail.com'}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteCloudData}
              delay={770}
            />

            {/* Bottom spacing */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </Animated.View>

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
        <ScheduleModal
          visible={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          scheduleEdit={scheduleEdit}
          setScheduleEdit={setScheduleEdit}
          onSave={handleSaveSchedule}
        />

        {/* Help & Support Modal */}
        <HelpModal visible={showHelpModal} onClose={() => setShowHelpModal(false)} />

        {/* About FitQuest Modal */}
        <AboutModal visible={showAboutModal} onClose={() => setShowAboutModal(false)} />
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing[25] },

  // Sections
  section: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },

  // Inline settings (inside GlassCard)
  inlineSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  inlineDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing[3],
    opacity: 0.5,
  },

  // Menu (shared with Mind XP inline usage)
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  adaptiveConfidenceFill: {
    height: '100%',
    borderRadius: radius.full,
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
    borderRadius: radius.lg,
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
});
