/**
 * FitQuest Progress Screen
 * Photo-based progress tracking with before/after comparisons
 * Users take and store progress photos over time
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useToast } from '../src/context/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useRouter } from 'expo-router';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { useProgressViewModel, type XPData, type ProgressPhoto } from '../src/viewmodels/useProgressViewModel';
import ScreenTutorial from '../src/components/ScreenTutorial';
import ThemedText from '../src/components/ThemedText';
import ProgressBar from '../src/components/ProgressBar';
import { GlassCard, SectionHeader, GradientButton } from '../src/components/ui/GlassUI';
import { getCardWidth, getGridColumns, ms } from '../src/utils/responsive';
import { typography, spacing, radius } from '../src/design/theme-system';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLS = getGridColumns();
const PHOTO_SIZE = getCardWidth(GRID_COLS, 16, 12);

// ============================================
// SCREEN
// ============================================

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const { isReady: dbReady } = useDatabase();
  const vm = useProgressViewModel();
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<ProgressPhoto[]>([]);

  useEffect(() => {
    if (dbReady) vm.loadData();
  }, [dbReady, vm]);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: t('progress.cameraRequired'), type: 'warning' });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsEditing: true,
        aspect: [3, 4],
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processNewPhoto(result.assets[0].uri);
      }
    } catch (e) {
      if (__DEV__) console.warn('[Progress] Camera error:', e);
      showToast({ message: t('progress.cameraFailed'), type: 'error' });
    }
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: t('progress.galleryRequired'), type: 'warning' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsEditing: true,
        aspect: [3, 4],
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processNewPhoto(result.assets[0].uri);
      }
    } catch (e) {
      if (__DEV__) console.warn('[Progress] Gallery error:', e);
      showToast({ message: t('progress.galleryFailed'), type: 'error' });
    }
  };

  const processNewPhoto = async (uri: string) => {
    Alert.alert(t('progress.labelPhoto'), t('progress.whichView'), [
      { text: t('common.front'), onPress: () => saveAndRefresh(uri, 'front') },
      { text: t('common.side'), onPress: () => saveAndRefresh(uri, 'side') },
      { text: t('common.back'), onPress: () => saveAndRefresh(uri, 'back') },
      { text: t('common.noLabel'), onPress: () => saveAndRefresh(uri, undefined) },
    ]);
  };

  const saveAndRefresh = async (uri: string, label?: string) => {
    try {
      const xpResult = await vm.saveNewPhoto(uri, label);
      showToast({ message: `+${xpResult.xpEarned} XP ${t('common.earned')}!`, type: 'success' });
    } catch (e) {
      if (__DEV__) console.warn('[Progress] Save failed:', e);
      showToast({ message: t('progress.saveFailed'), type: 'error' });
    }
  };

  const handleDeletePhoto = (photo: ProgressPhoto) => {
    Alert.alert(t('progress.deletePhoto'), t('progress.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await vm.deleteProgressPhoto(photo.id);
          setSelectedPhoto(null);
        },
      },
    ]);
  };

  const handleCompareToggle = (photo: ProgressPhoto) => {
    if (!compareMode) return;
    const exists = comparePhotos.find((p) => p.id === photo.id);
    if (exists) {
      setComparePhotos(comparePhotos.filter((p) => p.id !== photo.id));
    } else if (comparePhotos.length < 2) {
      setComparePhotos([...comparePhotos, photo]);
    }
  };

  // ===== COMPARE VIEW =====
  if (compareMode && comparePhotos.length === 2) {
    return (
      <ScreenContainer>
        <View style={styles.compareHeader}>
          <TouchableOpacity
            onPress={() => {
              setCompareMode(false);
              setComparePhotos([]);
            }}
            accessibilityRole="button"
            accessibilityLabel="Close compare view"
          >
            <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="h3">Before & After</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.compareContainer}>
          {comparePhotos.map((photo, idx) => (
            <View key={photo.id} style={styles.comparePhotoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.comparePhoto} />
              <ThemedText variant="bodySmall" color="secondary" style={{ textAlign: 'center', marginTop: spacing[1] }}>
                {photo.date} {photo.label ? `(${photo.label})` : ''}
              </ThemedText>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.accent, margin: spacing[4] }]}
          onPress={() => {
            setCompareMode(false);
            setComparePhotos([]);
          }}
          accessibilityRole="button"
          accessibilityLabel="Done comparing"
        >
          <ThemedText style={[styles.buttonText, { color: theme.colors.text }]}>Done</ThemedText>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ===== FULL PHOTO VIEW =====
  if (selectedPhoto) {
    return (
      <ScreenContainer>
        <View style={styles.photoViewHeader}>
          <TouchableOpacity
            onPress={() => setSelectedPhoto(null)}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="body" weight="600">
            {selectedPhoto.date} {selectedPhoto.label ? `• ${selectedPhoto.label}` : ''}
          </ThemedText>
          <TouchableOpacity
            onPress={() => handleDeletePhoto(selectedPhoto)}
            accessibilityRole="button"
            accessibilityLabel="Delete photo"
          >
            <MaterialCommunityIcons name="delete-outline" size={24} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
        <Image source={{ uri: selectedPhoto.uri }} style={styles.fullPhoto} resizeMode="contain" />
      </ScreenContainer>
    );
  }

  // ===== MAIN VIEW =====
  if (!dbReady) {
    return (
      <ScreenContainer
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </ScreenContainer>
    );
  }

  if (vm.loadError) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>{vm.loadError}</ThemedText>
        <GradientButton title={t('common.retry') ?? 'Retry'} onPress={() => { setLoadError(null); loadData(); }} style={{ marginTop: spacing[4] }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary screenName="Progress" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <ScreenTutorial
          screenKey="progress"
          icon="chart-line"
          title="Your Progress"
          description="Track your fitness journey with progress photos, workout stats, and XP levels. Take before/after photos to visualize your transformation."
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero Header */}
          <Animated.View entering={FadeInDown.delay(50).duration(200)}>
            <LinearGradient
              colors={
                theme.isDark
                  ? ([theme.colors.accent + '12', theme.colors.purple + '08', 'transparent'] as [
                      string,
                      string,
                      string,
                    ])
                  : ([theme.colors.accent + '0A', theme.colors.purple + '05', 'transparent'] as [
                      string,
                      string,
                      string,
                    ])
              }
              style={{ paddingTop: spacing[2], paddingBottom: spacing[4], borderRadius: 20, marginBottom: spacing[1] }}
            >
              <View style={styles.header}>
                <ThemedText variant="h2">Progress</ThemedText>
                {vm.photos.length >= 2 && (
                  <TouchableOpacity
                    onPress={() => setCompareMode(!compareMode)}
                    accessibilityRole="button"
                    accessibilityLabel={compareMode ? 'Exit compare mode' : 'Compare photos'}
                  >
                    <MaterialCommunityIcons
                      name={compareMode ? 'close' : 'compare'}
                      size={24}
                      color={theme.colors.accent}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* XP & Level Card */}
          {!!vm.xpData && (
            <Animated.View entering={FadeInDown.delay(100).duration(200)}>
              <GlassCard gradient glowColor={theme.colors.warning} style={styles.xpCard}>
                <View style={styles.xpHeader}>
                  <MaterialCommunityIcons name="star" size={28} color={theme.colors.warning} />
                  <View style={{ marginLeft: spacing[3], flex: 1 }}>
                    <ThemedText variant="h3">Level {vm.xpData.level}</ThemedText>
                    <ThemedText variant="bodySmall" color="secondary">
                      {vm.xpData.currentLevelXP} / {vm.xpData.xpToNextLevel} XP
                    </ThemedText>
                  </View>
                  <ThemedText variant="h4" color="accent">
                    {vm.xpData.totalXP} XP
                  </ThemedText>
                </View>
                <ProgressBar progress={vm.xpData.progressPercent} height={8} variant="progress" />
              </GlassCard>
            </Animated.View>
          )}

          {/* Stats Row */}
          <Animated.View entering={FadeInDown.delay(150).duration(200)}>
            <View style={styles.statsRow}>
              <GlassCard gradient glowColor={theme.colors.accent} style={styles.statCard}>
                <ThemedText variant="h3" color="accent">
                  {vm.stats.workouts}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary">
                  Workouts
                </ThemedText>
              </GlassCard>
              <GlassCard gradient glowColor={theme.colors.warning} style={styles.statCard}>
                <ThemedText variant="h3" color="accent">
                  {vm.stats.streak}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary">
                  Streak
                </ThemedText>
              </GlassCard>
              <GlassCard gradient glowColor={theme.colors.purple} style={styles.statCard}>
                <ThemedText variant="h3" color="accent">
                  {vm.stats.exercises}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary">
                  Exercises
                </ThemedText>
              </GlassCard>
            </View>
          </Animated.View>

          {/* Compare mode instruction */}
          {!!compareMode && (
            <GlassCard style={[styles.compareInstr, { borderColor: theme.colors.accent }]}>
              <ThemedText variant="bodySmall" color="accent" style={{ textAlign: 'center' }}>
                Tap 2 photos to compare side by side ({comparePhotos.length}/2 selected)
              </ThemedText>
            </GlassCard>
          )}

          {/* Photo Actions */}
          <SectionHeader title="Photos" delay={200} />
          <Animated.View entering={FadeInDown.delay(250).duration(200)}>
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1 }]}
                onPress={handleTakePhoto}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
              >
                <MaterialCommunityIcons name="camera" size={20} color={theme.colors.onAccent} />
                <ThemedText style={[styles.buttonText, { color: theme.colors.onAccent }]}>Take Photo</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, flex: 1 },
                ]}
                onPress={handlePickPhoto}
                accessibilityRole="button"
                accessibilityLabel="Pick from gallery"
              >
                <MaterialCommunityIcons name="image-plus" size={20} color={theme.colors.text} />
                <ThemedText style={[styles.buttonText, { color: theme.colors.text }]}>Gallery</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Photo Grid */}
            {vm.photos.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <MaterialCommunityIcons name="image-multiple-outline" size={48} color={theme.colors.textMuted} />
                <ThemedText variant="body" color="secondary" style={{ marginTop: spacing[3], textAlign: 'center' }}>
                  No progress photos yet
                </ThemedText>
                <ThemedText variant="bodySmall" color="muted" style={{ marginTop: spacing[1], textAlign: 'center' }}>
                  Take your first photo to start tracking your transformation!
                </ThemedText>
              </GlassCard>
            ) : (
              <View style={styles.photoGrid}>
                {vm.photos.map((photo) => {
                  const isSelected = comparePhotos.find((p) => p.id === photo.id);
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={[styles.photoThumb, isSelected && { borderColor: theme.colors.accent, borderWidth: 3 }]}
                      onPress={() => (compareMode ? handleCompareToggle(photo) : setSelectedPhoto(photo))}
                      accessibilityRole="button"
                      accessibilityLabel={`Progress photo from ${photo.date}${photo.label ? `, ${photo.label}` : ''}`}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                      <View style={[styles.photoOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                        <ThemedText style={[styles.photoDate, { color: theme.colors.text }]}>{photo.date}</ThemedText>
                        {photo.label && <ThemedText style={styles.photoLabel}>{photo.label}</ThemedText>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing[4] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  xpCard: { padding: spacing[4], marginBottom: spacing[3] },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  statCard: {
    flex: 1,
    padding: spacing[3],
    alignItems: 'center',
  },
  compareInstr: {
    padding: spacing[3],
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    gap: spacing[2],
  },
  buttonText: {
    fontSize: typography.sizes.bodyMid, 
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing[8],
    alignItems: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.33,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[2],
  },
  photoDate: {
    fontSize: ms(12),
    fontWeight: '600',
  },
  photoLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: ms(10),
    textTransform: 'uppercase',
  },
  photoViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
  },
  fullPhoto: {
    flex: 1,
    width: '100%',
  },
  compareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
  },
  compareContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[4],
  },
  comparePhotoWrap: {
    flex: 1,
  },
  comparePhoto: {
    width: '100%',
    flex: 1,
    borderRadius: radius.lg,
  },
});
