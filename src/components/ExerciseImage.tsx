/**
 * ExerciseImage — Displays exercise illustration from the database.
 *
 * Resolution strategy:
 * 1. Query exercise_images table for the exercise
 * 2. If images exist: load from documentDirectory/exercises/{image_path}
 * 3. If loading fails or no images: show category-themed placeholder
 *
 * Two frames are stored per exercise (0.jpg = start pose, 1.jpg = end pose).
 * The component auto-alternates between them to create a simple animation.
 *
 * Image files must be placed in the app documentDirectory under exercises/
 * by one of: build-time copy script, first-launch download, or manual adb push.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Platform,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { Category } from '../database/types';
import { categoryTheme, defaultCategoryTheme } from '../design/theme-system';
import { resolveExerciseImageFolder } from '../services/exerciseImageMap';

// ─── Constants ───

/**
 * All platforms use documentDirectory for exercise images.
 * On Android, images are copied from APK assets to documentDirectory on first launch
 * by initializeExerciseImages() in exerciseImageService.ts.
 */
const IMAGE_BASE_DIR = `${FileSystem.documentDirectory}exercises/`;
const APK_ASSETS_DIR = 'file:///android_asset/exercises/';
const ANIMATION_INTERVAL_MS = 1200; // Toggle between 0.jpg and 1.jpg

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
  const [retryCount, setRetryCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const catTheme = categoryTheme[category] || defaultCategoryTheme;
  const config = { colors: catTheme.colors, icon: catTheme.icon as GlyphMapKey };
  const dimensions = VARIANT_DIMENSIONS[variant]!;

  // Resolve image URIs from file system
  useEffect(() => {
    let cancelled = false;

    async function resolveImages() {
      try {
        const paths = preloadedPaths ?? [];
        if (paths.length === 0) {
          // No pre-loaded paths — import service lazily to avoid circular deps
          const { getExerciseImages } = await import('../database/service');
          const images = await getExerciseImages(exerciseId);
          paths.push(...images.map(img => img.image_path));
        }

        // Fallback: use exerciseImageMap (primary strategy) or derive from name
        if (paths.length === 0) {
          const { getDatabase } = await import('../database/schema');
          const db = await getDatabase();
          const ex = await db.getFirstAsync<{ external_id: string | null; name: string }>(
            'SELECT external_id, name FROM exercises WHERE id = ?',
            [exerciseId]
          );
          if (ex) {
            // Primary: use the comprehensive image map
            const mappedFolder = resolveExerciseImageFolder(ex.name);
            if (mappedFolder) {
              paths.push(`${mappedFolder}/0.webp`, `${mappedFolder}/1.webp`, `${mappedFolder}/0.jpg`, `${mappedFolder}/1.jpg`);
            } else {
              // Fallback: try external_id or underscored name
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
          if (!cancelled) setResolvedUris([]);
          return;
        }

        // Check which files actually exist on disk (try documentDirectory first, then APK assets)
        const validUris: string[] = [];
        // Deduplicate paths — the same folder may appear with both .webp and .jpg
        const seen = new Set<string>();
        for (const imgPath of paths) {
          if (validUris.length >= 2) break; // Only need 2 frames max
          if (seen.has(imgPath)) continue;
          seen.add(imgPath);

          const fullPath = `${IMAGE_BASE_DIR}${imgPath}`;
          // Also try .webp variant if the path is .jpg/.png (APK may only have .webp)
          const webpPath = imgPath.replace(/\.(jpg|png)$/i, '.webp');
          const fullWebpPath = `${IMAGE_BASE_DIR}${webpPath}`;

          // Try documentDirectory first (both webp and original)
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
          if (validUris.length > seen.size - 1) continue; // Found one, move on

          // Android: load directly from APK assets — getInfoAsync doesn't work
          // for file:///android_asset/ (compressed archive), but <Image> can load them.
          // Prefer .webp since APK assets were converted to webp.
          if (Platform.OS === 'android') {
            validUris.push(`${APK_ASSETS_DIR}${webpPath !== imgPath ? webpPath : imgPath}`);
          }
        }

        if (!cancelled) {
          setResolvedUris(validUris);
          setHasError(false);
        }
      } catch {
        if (!cancelled) {
          setResolvedUris([]);
        }
      }
    }

    resolveImages();
    return () => { cancelled = true; };
  }, [exerciseId, preloadedPaths]);

  // Animation timer: toggle between frames
  useEffect(() => {
    if (!animate || resolvedUris.length < 2) return;

    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % resolvedUris.length);
    }, ANIMATION_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animate, resolvedUris.length]);

  const handleError = useCallback(() => {
    // On first error with APK asset URI, try alternate format (.webp ↔ .jpg)
    if (retryCount === 0 && resolvedUris.length > 0 && Platform.OS === 'android') {
      const altUris = resolvedUris.map(uri => {
        if (uri.endsWith('.webp')) return uri.replace(/\.webp$/, '.jpg');
        if (uri.endsWith('.jpg')) return uri.replace(/\.jpg$/, '.webp');
        return uri;
      });
      // Only retry if the alternatives are different
      if (altUris.some((u, i) => u !== resolvedUris[i])) {
        setRetryCount(1);
        setResolvedUris(altUris);
        return;
      }
    }
    setHasError(true);
  }, [retryCount, resolvedUris]);

  // Show real image
  if (resolvedUris.length > 0 && !hasError) {
    const uri = resolvedUris[currentFrame] ?? resolvedUris[0];
    const borderRadius = variant === 'thumbnail' ? 8 : 12;
    return (
      <View style={[
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
      ]}>
        <Image
          source={{ uri }}
          style={[dimensions, styles.image, { borderRadius: borderRadius - 1 }] as ImageStyle[]}
          resizeMode={variant === 'hero' ? 'cover' : 'contain'}
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

  // Placeholder: gradient + category icon with dual-frame indicator for detail/hero
  const showDualHint = variant === 'detail' || variant === 'hero';
  const placeholderRadius = variant === 'thumbnail' ? 8 : 12;
  return (
    <View style={[
      dimensions,
      styles.container,
      {
        borderRadius: placeholderRadius,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      },
      style,
    ]}>
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[dimensions, styles.placeholder, { borderRadius: placeholderRadius - 1 }]}
      >
        {showDualHint ? (
          <View style={styles.dualPlaceholder}>
            <View style={styles.dualFrame}>
              <MaterialCommunityIcons
                name={config.icon}
                size={dimensions.height * 0.3}
                color="rgba(255,255,255,0.5)"
              />
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
          <MaterialCommunityIcons
            name={config.icon}
            size={dimensions.height * 0.45}
            color="rgba(255,255,255,0.6)"
          />
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
  hero: { width: 999, height: 300 }, // width: 999 means "use flex"
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
    gap: 3,
  },
  frameDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dualPlaceholder: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
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
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
});
