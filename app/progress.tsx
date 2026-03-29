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
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Paths, File, Directory } from 'expo-file-system';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useRouter } from 'expo-router';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { getXPData, awardProgressPhotoXP, type XPData } from '../src/services/xpService';
import { getAppState, setAppState, getUserProgress, getStreak } from '../src/database/service';
import ScreenTutorial from '../src/components/ScreenTutorial';
import ThemedText from '../src/components/ThemedText';
import ProgressBar from '../src/components/ProgressBar';
import { GlassCard, SectionHeader } from '../src/components/ui/GlassUI';
import { getCardWidth, getGridColumns, ms } from '../src/utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLS = getGridColumns();
const PHOTO_SIZE = getCardWidth(GRID_COLS, 16, 12);

// ============================================
// TYPES
// ============================================

interface ProgressPhoto {
  id: string;
  uri: string;
  date: string;
  label?: string; // 'front' | 'side' | 'back'
}

// ============================================
// PHOTO STORAGE
// ============================================

const PHOTOS_DIR_NAME = 'progress_photos';
const PHOTOS_KEY = 'progress_photos_index';

function getPhotosDir(): Directory {
  return new Directory(Paths.document, PHOTOS_DIR_NAME);
}

async function ensurePhotosDir(): Promise<void> {
  const dir = getPhotosDir();
  if (!dir.exists) {
    dir.create();
  }
}

async function loadPhotoIndex(): Promise<ProgressPhoto[]> {
  const data = await getAppState(PHOTOS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function savePhotoIndex(photos: ProgressPhoto[]): Promise<void> {
  await setAppState(PHOTOS_KEY, JSON.stringify(photos));
}

async function savePhoto(uri: string, label?: string): Promise<ProgressPhoto> {
  await ensurePhotosDir();
  const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const ext = uri.split('.').pop() || 'jpg';
  const destFile = new File(getPhotosDir(), `${id}.${ext}`);
  const sourceFile = new File(uri);

  try {
    sourceFile.copy(destFile);
  } catch (e) {
    throw new Error(`Failed to save photo: ${e instanceof Error ? e.message : String(e)}`);
  }

  const photo: ProgressPhoto = {
    id,
    uri: destFile.uri,
    date: new Date().toISOString().split('T')[0]!,
    label,
  };

  const photos = await loadPhotoIndex();
  photos.unshift(photo); // newest first
  await savePhotoIndex(photos);

  return photo;
}

async function deletePhoto(photoId: string): Promise<void> {
  const photos = await loadPhotoIndex();
  const photo = photos.find((p) => p.id === photoId);
  if (photo) {
    try {
      const file = new File(photo.uri);
      if (file.exists) file.delete();
    } catch {}
    await savePhotoIndex(photos.filter((p) => p.id !== photoId));
  }
}

// ============================================
// SCREEN
// ============================================

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { isReady: dbReady } = useDatabase();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [xpData, setXPData] = useState<XPData | null>(null);
  const [stats, setStats] = useState<{ workouts: number; streak: number; exercises: number }>({
    workouts: 0,
    streak: 0,
    exercises: 0,
  });
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<ProgressPhoto[]>([]);

  useEffect(() => {
    if (dbReady) loadData();
  }, [dbReady]);

  const loadData = async () => {
    const [photoList, xp, progress, streak] = await Promise.all([
      loadPhotoIndex(),
      getXPData(),
      getUserProgress(),
      getStreak('user_local_001'),
    ]);
    setPhotos(photoList);
    setXPData(xp);
    setStats({
      workouts: progress.completed_workouts,
      streak: streak.current,
      exercises: progress.total_exercises_done,
    });
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('progress.permissionNeeded'), t('progress.cameraRequired'));
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
      Alert.alert(t('common.error'), t('progress.cameraFailed'));
    }
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('progress.permissionNeeded'), t('progress.galleryRequired'));
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
      Alert.alert(t('common.error'), t('progress.galleryFailed'));
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
      await savePhoto(uri, label);
      const xpResult = await awardProgressPhotoXP();
      Alert.alert(t('progress.photoSaved'), `+${xpResult.xpEarned} XP ${t('common.earned')}!`);
      await loadData();
    } catch (e) {
      if (__DEV__) console.warn('[Progress] Save failed:', e);
      Alert.alert(t('common.error'), t('progress.saveFailed'));
    }
  };

  const handleDeletePhoto = (photo: ProgressPhoto) => {
    Alert.alert(t('progress.deletePhoto'), t('progress.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(photo.id);
          setSelectedPhoto(null);
          await loadData();
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
              <ThemedText variant="bodySmall" color="secondary" style={{ textAlign: 'center', marginTop: 4 }}>
                {photo.date} {photo.label ? `(${photo.label})` : ''}
              </ThemedText>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.accent, margin: 16 }]}
          onPress={() => {
            setCompareMode(false);
            setComparePhotos([]);
          }}
          accessibilityRole="button"
          accessibilityLabel="Done comparing"
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ===== FULL PHOTO VIEW =====
  if (selectedPhoto) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
      </SafeAreaView>
    );
  }

  // ===== MAIN VIEW =====
  if (!dbReady) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <ScreenErrorBoundary screenName="Progress" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
              style={{ paddingTop: 8, paddingBottom: 16, borderRadius: 20, marginBottom: 4 }}
            >
              <View style={styles.header}>
                <ThemedText variant="h2">Progress</ThemedText>
                {photos.length >= 2 && (
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
          {!!xpData && (
            <Animated.View entering={FadeInDown.delay(100).duration(200)}>
              <GlassCard gradient glowColor={theme.colors.warning} style={styles.xpCard}>
                <View style={styles.xpHeader}>
                  <MaterialCommunityIcons name="star" size={28} color={theme.colors.warning} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <ThemedText variant="h3">Level {xpData.level}</ThemedText>
                    <ThemedText variant="bodySmall" color="secondary">
                      {xpData.currentLevelXP} / {xpData.xpToNextLevel} XP
                    </ThemedText>
                  </View>
                  <ThemedText variant="h4" color="accent">
                    {xpData.totalXP} XP
                  </ThemedText>
                </View>
                <ProgressBar progress={xpData.progressPercent} height={8} variant="progress" />
              </GlassCard>
            </Animated.View>
          )}

          {/* Stats Row */}
          <Animated.View entering={FadeInDown.delay(150).duration(200)}>
            <View style={styles.statsRow}>
              <GlassCard gradient glowColor={theme.colors.accent} style={styles.statCard}>
                <ThemedText variant="h3" color="accent">
                  {stats.workouts}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary">
                  Workouts
                </ThemedText>
              </GlassCard>
              <GlassCard gradient glowColor={theme.colors.warning} style={styles.statCard}>
                <ThemedText variant="h3" color="accent">
                  {stats.streak}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary">
                  Streak
                </ThemedText>
              </GlassCard>
              <GlassCard gradient glowColor={theme.colors.purple} style={styles.statCard}>
                <ThemedText variant="h3" color="accent">
                  {stats.exercises}
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
                <Text style={[styles.buttonText, { color: theme.colors.onAccent }]}>Take Photo</Text>
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
                <Text style={[styles.buttonText, { color: theme.colors.text }]}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* Photo Grid */}
            {photos.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <MaterialCommunityIcons name="image-multiple-outline" size={48} color={theme.colors.textMuted} />
                <ThemedText variant="body" color="secondary" style={{ marginTop: 12, textAlign: 'center' }}>
                  No progress photos yet
                </ThemedText>
                <ThemedText variant="bodySmall" color="muted" style={{ marginTop: 4, textAlign: 'center' }}>
                  Take your first photo to start tracking your transformation!
                </ThemedText>
              </GlassCard>
            ) : (
              <View style={styles.photoGrid}>
                {photos.map((photo) => {
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
                        <Text style={[styles.photoDate, { color: theme.colors.text }]}>{photo.date}</Text>
                        {photo.label && <Text style={styles.photoLabel}>{photo.label}</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  xpCard: { padding: 16, marginBottom: 12 },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  compareInstr: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.33,
    borderRadius: 12,
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
    padding: 8,
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
    padding: 16,
  },
  fullPhoto: {
    flex: 1,
    width: '100%',
  },
  compareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  compareContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  comparePhotoWrap: {
    flex: 1,
  },
  comparePhoto: {
    width: '100%',
    flex: 1,
    borderRadius: 12,
  },
});
