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
import { LanguageSelector } from '../src/components/LanguageSelector';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import { RankCard, MilestoneList } from '../src/components/RankDisplay';
import { useProfileViewModel } from '../src/viewmodels/useProfileViewModel';
import { typography, spacing, radius } from '../src/design/theme-system';
import { featureFlags as featureFlagsService } from '../src/services/featureFlags';
import { ThemedPickerModal, MenuItem, adaptiveLabel } from '../src/components/profile/ProfileParts';
import { ScheduleModal, HelpModal, AboutModal } from '../src/components/profile/ProfileModals';
import { ProfileHeader } from '../src/components/profile/ProfileHeader';
import { StatsGrid, AchievementsCard } from '../src/components/profile/ProfileStats';

// ============================================
// SCREEN
// ============================================

export default function ProfileScreen() {
  const vm = useProfileViewModel();
  const {
    theme,
    mode,
    setMode,
    t,
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
    showLanguageSelector,
    setShowLanguageSelector,
    showThemePicker,
    setShowThemePicker,
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
      <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View entering={ZoomIn} style={{ alignItems: 'center' }}>
          <MaterialCommunityIcons name="account-circle" size={48} color={theme.colors.accent} />
          <ThemedText variant="bodySmall" color="muted" style={{ marginTop: spacing[2] }}>
            {t('profile.loading') || 'Loading profile...'}
          </ThemedText>
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

          {/* ── MIND XP ── */}
          <View style={styles.section}>
            <SectionHeader title={'Mind XP'} delay={275} />
            <GlassCard gradient delay={280}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
                <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.purple + '18' }]}>
                  <MaterialCommunityIcons name="head-lightbulb-outline" size={22} color={theme.colors.purple} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <ThemedText style={[styles.menuLabel, { color: theme.colors.text, fontSize: typography.sizes.body }]}>
                    Craft My Mind
                  </ThemedText>
                  <ThemedText style={[styles.menuSublabel, { color: theme.colors.textSecondary }]}>
                    {mindXP?.total_mind_xp || 0} Mind XP
                  </ThemedText>
                </View>
                <View
                  style={{
                    backgroundColor: theme.colors.warning + '25',
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[0.75],
                    borderRadius: 6,
                  }}
                >
                  <ThemedText
                    style={{
                      color: theme.colors.warning,
                      fontSize: typography.sizes.xs,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                    }}
                  >
                    COMING SOON
                  </ThemedText>
                </View>
              </View>
              <View style={{ opacity: 0.5 }}>
                <View style={styles.achievementRow}>
                  <View style={styles.achievementItem}>
                    <ThemedText style={[styles.achievementLabel, { color: theme.colors.text }]}>
                      {mindXP?.pages_read_total || 0}
                    </ThemedText>
                    <ThemedText style={[styles.achievementSub, { color: theme.colors.textMuted }]}>
                      Pages Read
                    </ThemedText>
                  </View>
                  <View style={styles.achievementItem}>
                    <ThemedText style={[styles.achievementLabel, { color: theme.colors.text }]}>
                      {mindXP?.flashcards_reviewed_total || 0}
                    </ThemedText>
                    <ThemedText style={[styles.achievementSub, { color: theme.colors.textMuted }]}>
                      Cards Reviewed
                    </ThemedText>
                  </View>
                  <View style={styles.achievementItem}>
                    <ThemedText style={[styles.achievementLabel, { color: theme.colors.text }]}>
                      {mindXP?.documents_completed || 0}
                    </ThemedText>
                    <ThemedText style={[styles.achievementSub, { color: theme.colors.textMuted }]}>
                      Books Done
                    </ThemedText>
                  </View>
                </View>
              </View>
            </GlassCard>
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
            {featureFlagsService.isEnabled('BODY_CRAFT_MODULE') && (
              <MenuItem
                icon="human-edit"
                label={t('profile.craftMyBody')}
                sublabel={t('profile.craftMyBodySub')}
                color={theme.colors.pink}
                delay={520}
                onPress={() => router.push('/craft-my-body')}
              />
            )}
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
              <ThemedText
                style={{
                  color: theme.colors.textMuted,
                  fontSize: typography.sizes.caption,
                  marginBottom: spacing[3],
                  lineHeight: 18,
                }}
              >
                {t('profile.adaptiveExplanation')}
              </ThemedText>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedAdaptive(expandedAdaptive === 'fatigue' ? null : 'fatigue')}
                accessibilityRole="button"
                accessibilityLabel={`Fatigue sensitivity${expandedAdaptive === 'fatigue' ? ', expanded' : ''}`}
              >
                <View style={styles.adaptiveRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <MaterialCommunityIcons name="heart-pulse" size={16} color={theme.colors.error} />
                    <ThemedText style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>
                      {t('profile.fatigueSensitivity')}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <ThemedText style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                      {adaptiveLabel(adaptiveProfile ? adaptiveProfile.fatigueSensitivity : 1)}
                    </ThemedText>
                    <MaterialCommunityIcons
                      name={expandedAdaptive === 'fatigue' ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              {expandedAdaptive === 'fatigue' && (
                <Animated.View
                  entering={FadeInDown.duration(150)}
                  style={{ paddingLeft: spacing[6], paddingBottom: spacing[2] }}
                >
                  <ThemedText
                    style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, lineHeight: 18 }}
                  >
                    {t('profile.fatigueSensitivityDesc')}
                  </ThemedText>
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
                    <ThemedText style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>
                      {t('profile.progressionPace')}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <ThemedText style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                      {adaptiveLabel(adaptiveProfile ? adaptiveProfile.progressionAggressiveness : 1)}
                    </ThemedText>
                    <MaterialCommunityIcons
                      name={expandedAdaptive === 'progression' ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              {expandedAdaptive === 'progression' && (
                <Animated.View
                  entering={FadeInDown.duration(150)}
                  style={{ paddingLeft: spacing[6], paddingBottom: spacing[2] }}
                >
                  <ThemedText
                    style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, lineHeight: 18 }}
                  >
                    {t('profile.progressionPaceDesc')}
                  </ThemedText>
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
                    <ThemedText style={[styles.adaptiveLabel, { color: theme.colors.textSecondary }]}>
                      {t('profile.volumeTolerance')}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <ThemedText style={[styles.adaptiveValue, { color: theme.colors.text }]}>
                      {adaptiveLabel(adaptiveProfile ? adaptiveProfile.volumeTolerance : 1)}
                    </ThemedText>
                    <MaterialCommunityIcons
                      name={expandedAdaptive === 'volume' ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              {expandedAdaptive === 'volume' && (
                <Animated.View
                  entering={FadeInDown.duration(150)}
                  style={{ paddingLeft: spacing[6], paddingBottom: spacing[2] }}
                >
                  <ThemedText
                    style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption, lineHeight: 18 }}
                  >
                    {t('profile.volumeToleranceDesc')}
                  </ThemedText>
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
              <ThemedText style={[styles.adaptiveConfidenceText, { color: theme.colors.textMuted }]}>
                Learning your patterns ({adaptiveProfile?.samples ?? 0} workouts analyzed)
              </ThemedText>

              {adaptiveProfile?.rationale?.map((line, index) => (
                <ThemedText key={`${line}_${index}`} style={[styles.adaptiveReason, { color: theme.colors.textMuted }]}>
                  • {line}
                </ThemedText>
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
                  <ThemedText style={[styles.healthErrorsTitle, { color: theme.colors.error }]}>
                    {t('profile.healthSyncIssues') || 'Recent Sync Issues'}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={handleDismissHealthErrors}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss sync errors"
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
              <ThemedText style={[styles.logoutText, { color: theme.colors.error }]}>{t('profile.logout')}</ThemedText>
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

  // Achievements (shared with Mind XP section)
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

  // Menu (shared with Mind XP inline usage)
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: typography.sizes.bodyMid,
    fontWeight: '500',
  },
});
