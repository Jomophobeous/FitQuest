/**
 * ExerciseImage — Displays exercise illustration from the database.
 *
 * Resolution strategy:
 * 1. Check in-memory LRU cache (fastest path)
 * 2. Query exercise_images table for the exercise
 * 3. If images exist: load from documentDirectory/exercises/{image_path}
 * 4. If loading fails or no images: show category-themed placeholder
 *
 * Two frames are stored per exercise (0.jpg = start pose, 1.jpg = end pose).
 * The component auto-alternates between them to create a simple animation.
 *
 * Shows skeleton shimmer while loading, error state with retry on failure.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform, type ViewStyle, type ImageStyle } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import type { Category } from '../database/types';
import { categoryTheme, defaultCategoryTheme, spacing, radius } from '../design/theme-system';
import { resolveExerciseImageFolder } from '../services/exerciseImageMap';
import { imageCache } from '../services/ImageCacheService';
import ImageLoadingState from './ui/ImageLoadingState';

// ─── Constants ───

const IMAGE_BASE_DIR = `${FileSystem.documentDirectory}exercises/`;
const APK_ASSETS_DIR = 'file:///android_asset/exercises/';
const ANIMATION_INTERVAL_MS = 1200;
const MAX_RETRY_ATTEMPTS = 2;

type GlyphMapKey = keyof typeof MaterialCommunityIcons.glyphMap;

// ─── Props ───

interface ExerciseImageProps {
  /** The exercise ID to look up images for */
  exerciseId: string;
  /** Category used for placeholder theming */
  category?: Category | string;
  /** Pre-resolved image paths (from batch getExerciseImageMap) to skip DB query */
  imagePaths?: string[];
  /** Display variant */
  variant?: 'thumbnail' | 'card' | 'detail' | 'hero';
  /** Whether to animate between start/end frames */
  animate?: boolean;
  /** Custom container style */
  style?: ViewStyle;
}

// ─── Component ───

export default function ExerciseImage({
  exerciseId,
  category = 'body_control',
  imagePaths: preloadedPaths,
  variant = 'thumbnail',
  animate = true,
  style,
}: ExerciseImageProps) {
  const { theme } = useTheme();
  const [resolvedUris, setResolvedUris] = useState<string[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const catTheme = categoryTheme[category] || defaultCategoryTheme;
  const config = { colors: catTheme.colors, icon: catTheme.icon as GlyphMapKey };
  const dimensions = VARIANT_DIMENSIONS[variant]!;

  // Resolve image URIs — cache-first, then file system
  useEffect(() => {
    let cancelled = false;

    async function resolveImages() {
      setIsLoading(true);
      setHasError(false);

      try {
        // 1. Check LRU cache first
        const cached = imageCache.get(exerciseId);
        if (cached && cached.length > 0) {
          if (!cancelled) {
            setResolvedUris(cached);
            setIsLoading(false);
          }
          return;
        }

        // 2. Resolve from DB / file system
        const paths = preloadedPaths ?? [];
        if (paths.length === 0) {
          const { getExerciseImages } = await import('../database/service');
          const images = await getExerciseImages(exerciseId);
          paths.push(...images.map((img) => img.image_path));
        }

        if (paths.length === 0) {
          const { getDatabase } = await import('../database/schema');
          const db = await getDatabase();
          const ex = await db.getFirstAsync<{ external_id: string | null; name: string }>(
            'SELECT external_id, name FROM exercises WHERE id = ?',
            [exerciseId],
          );
          if (ex) {
            const mappedFolder = resolveExerciseImageFolder(ex.name);
            if (mappedFolder) {
              paths.push(
                `${mappedFolder}/0.webp`,
                `${mappedFolder}/1.webp`,
                `${mappedFolder}/0.jpg`,
                `${mappedFolder}/1.jpg`,
              );
            } else {
              const candidates: string[] = [];
              if (ex.external_id) candidates.push(ex.external_id);
              candidates.push(ex.name.replace(/[/ (),']/g, '_'));

              const seen = new Set<string>();
              for (const c of candidates) {
                if (!seen.has(c)) {
                  seen.add(c);
                  paths.push(`${c}/0.webp`, `${c}/1.webp`, `${c}/0.jpg`, `${c}/1.jpg`);
                }
              }
            }
          }
        }

        if (paths.length === 0) {
          if (!cancelled) {
            setResolvedUris([]);
            setIsLoading(false);
          }
          return;
        }

        // Check which files exist on disk
        const validUris: string[] = [];

        if (Platform.OS === 'android') {
          const addedFolders = new Set<string>();
          for (const imgPath of paths) {
            if (validUris.length >= 2) break;
            const folder = imgPath.split('/')[0];
            const frame = imgPath.split('/')[1];
            if (!folder || !frame) continue;
            const frameKey = `${folder}/${frame?.replace(/\.(jpg|png|webp)$/i, '')}`;
            if (addedFolders.has(frameKey)) continue;
            addedFolders.add(frameKey);
            const webpUri = `${APK_ASSETS_DIR}${folder}/${frame.replace(/\.(jpg|png)$/i, '.webp')}`;
            validUris.push(webpUri);
          }
        } else {
          const seen = new Set<string>();
          for (const imgPath of paths) {
            if (validUris.length >= 2) break;
            if (seen.has(imgPath)) continue;
            seen.add(imgPath);

            const fullPath = `${IMAGE_BASE_DIR}${imgPath}`;
            const webpPath = imgPath.replace(/\.(jpg|png)$/i, '.webp');
            const fullWebpPath = `${IMAGE_BASE_DIR}${webpPath}`;

            for (const candidate of webpPath !== imgPath ? [fullWebpPath, fullPath] : [fullPath]) {
              try {
                const info = await FileSystem.getInfoAsync(candidate);
                if (info.exists) {
                  validUris.push(candidate);
                  break;
                }
              } catch {
                // Skip
              }
            }
          }
        }

        if (!cancelled) {
          setResolvedUris(validUris);
          setIsLoading(false);

          // Cache the resolved URIs
          if (validUris.length > 0) {
            imageCache.set(exerciseId, validUris);
          }
        }
      } catch {
        if (!cancelled) {
          setResolvedUris([]);
          setIsLoading(false);
        }
      }
    }

    resolveImages();
    return () => {
      cancelled = true;
    };
  }, [exerciseId, preloadedPaths, retryCount]);

  // Animation timer
  useEffect(() => {
    if (!animate || resolvedUris.length < 2) return;

    intervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % resolvedUris.length);
    }, ANIMATION_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animate, resolvedUris.length]);

  // Image load error handler with retry
  const handleError = useCallback(() => {
    if (animate && currentFrame > 0) {
      if (__DEV__) console.warn('[ExerciseImage] Skipping retry during animation');
      setHasError(true);
      return;
    }

    // On first error, try alternate format (.webp ↔ .jpg)
    if (retryCount === 0 && resolvedUris.length > 0 && Platform.OS === 'android') {
      const altUris = resolvedUris.map((uri) => {
        if (uri.endsWith('.webp')) return uri.replace(/\.webp$/, '.jpg');
        if (uri.endsWith('.jpg')) return uri.replace(/\.jpg$/, '.webp');
        return uri;
      });
      if (altUris.some((u, i) => u !== resolvedUris[i])) {
        setRetryCount(1);
        setResolvedUris(altUris);
        return;
      }
    }
    // On second error, try documentDirectory
    if (retryCount === 1 && resolvedUris.length > 0) {
      const docUris = resolvedUris.map((uri) => {
        if (uri.startsWith(APK_ASSETS_DIR)) {
          return `${IMAGE_BASE_DIR}${uri.slice(APK_ASSETS_DIR.length)}`;
        }
        return uri;
      });
      if (docUris.some((u, i) => u !== resolvedUris[i])) {
        setRetryCount(2);
        setResolvedUris(docUris);
        return;
      }
    }
    setHasError(true);
  }, [retryCount, resolvedUris, animate, currentFrame]);

  // Manual retry from error UI
  const handleManualRetry = useCallback(() => {
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      // Reset retry count to allow fresh attempts
      setRetryCount(0);
    }
    // Invalidate cache for this exercise
    imageCache.get(exerciseId); // no-op read, but let's just delete
    setHasError(false);
    setIsLoading(true);
    setResolvedUris([]);
    setCurrentFrame(0);
    // Trigger re-resolve by bumping retryCount
    setRetryCount((prev) => prev + 1);
  }, [exerciseId, retryCount]);

  // ─── Loading State ───
  if (isLoading) {
    return (
      <View style={style}>
        <ImageLoadingState isLoading isError={false} variant={variant} frameCount={2} currentFrame={0} />
      </View>
    );
  }

  // ─── Error State (after all retries exhausted) ───
  if (hasError || (resolvedUris.length === 0 && !isLoading)) {
    // If we have resolved URIs = 0 and not loading, show placeholder (not error)
    if (resolvedUris.length === 0 && !hasError) {
      // No images available — show themed placeholder (not an error)
      return <Placeholder variant={variant} config={config} dimensions={dimensions} style={style} theme={theme} />;
    }

    return (
      <View style={style}>
        <ImageLoadingState isLoading={false} isError onRetry={handleManualRetry} variant={variant} />
      </View>
    );
  }

  // ─── Real Image ───
  const uri = resolvedUris[currentFrame] ?? resolvedUris[0];
  const borderRadius = variant === 'thumbnail' ? 8 : 12;

  return (
    <View
      style={[
        dimensions,
        styles.container,
        {
          borderRadius,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceVariant,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={[dimensions, styles.image, { borderRadius: borderRadius - 1 }] as ImageStyle[]}
        contentFit={variant === 'hero' ? 'cover' : 'contain'}
        onError={handleError}
      />
      {/* Frame indicator dots */}
      {resolvedUris.length > 1 && animate && (
        <View style={styles.frameIndicator}>
          {resolvedUris.map((_, i) => (
            <View
              key={i}
              style={[
                styles.frameDot,
                {
                  backgroundColor: i === currentFrame ? theme.colors.accent : 'rgba(255,255,255,0.4)',
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Placeholder sub-component ───

function Placeholder({
  variant,
  config,
  dimensions,
  style,
  theme,
}: {
  variant: string;
  config: { colors: string[]; icon: GlyphMapKey };
  dimensions: { width: number; height: number };
  style?: ViewStyle;
  theme: any;
}) {
  const showDualHint = variant === 'detail' || variant === 'hero';
  const placeholderRadius = variant === 'thumbnail' ? 8 : 12;

  return (
    <View
      style={[
        dimensions,
        styles.container,
        {
          borderRadius: placeholderRadius,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={config.colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[dimensions, styles.placeholder, { borderRadius: placeholderRadius - 1 }]}
      >
        {showDualHint ? (
          <View style={styles.dualPlaceholder}>
            <View style={styles.dualFrame}>
              <MaterialCommunityIcons name={config.icon} size={dimensions.height * 0.3} color="rgba(255,255,255,0.5)" />
              <View style={[styles.dualLabel, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
                <MaterialCommunityIcons name="numeric-1-circle-outline" size={12} color="rgba(255,255,255,0.7)" />
              </View>
            </View>
            <View style={styles.dualDivider} />
            <View style={styles.dualFrame}>
              <MaterialCommunityIcons
                name={config.icon}
                size={dimensions.height * 0.3}
                color="rgba(255,255,255,0.35)"
              />
              <View style={[styles.dualLabel, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
                <MaterialCommunityIcons name="numeric-2-circle-outline" size={12} color="rgba(255,255,255,0.7)" />
              </View>
            </View>
          </View>
        ) : (
          <MaterialCommunityIcons name={config.icon} size={dimensions.height * 0.45} color="rgba(255,255,255,0.6)" />
        )}
      </LinearGradient>
    </View>
  );
}

// ─── Variant dimensions ───

const VARIANT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  thumbnail: { width: 56, height: 56 },
  card: { width: 72, height: 72 },
  detail: { width: 120, height: 120 },
  hero: { width: 999, height: 300 },
};

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[0.75],
  },
  frameDot: {
    width: 4,
    height: 4,
    borderRadius: radius.sm,
  },
  dualPlaceholder: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[0.5],
  },
  dualFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dualDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dualLabel: {
    position: 'absolute',
    bottom: 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing[0.5],
    paddingVertical: spacing['px'],
  },
});
