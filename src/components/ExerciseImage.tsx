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
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { Category } from '../database/types';

// ─── Constants ───

const IMAGE_BASE_DIR = `${FileSystem.documentDirectory}exercises/`;
const ANIMATION_INTERVAL_MS = 1200; // Toggle between 0.jpg and 1.jpg

// ─── Category theming (gradient + icon) ───

type GlyphMapKey = keyof typeof MaterialCommunityIcons.glyphMap;

const CATEGORY_CONFIG: Record<string, {
  colors: [string, string];
  icon: GlyphMapKey;
}> = {
  body_control: { colors: ['#10B981', '#059669'], icon: 'human-handsup' },
  posture: { colors: ['#6366F1', '#4F46E5'], icon: 'human-male-height' },
  speed: { colors: ['#F59E0B', '#D97706'], icon: 'lightning-bolt' },
  mobility: { colors: ['#EC4899', '#DB2777'], icon: 'yoga' },
  focus: { colors: ['#8B5CF6', '#7C3AED'], icon: 'meditation' },
  strength: { colors: ['#EF4444', '#DC2626'], icon: 'dumbbell' },
};

const DEFAULT_CONFIG = { colors: ['#64748B', '#475569'] as [string, string], icon: 'dumbbell' as GlyphMapKey };

// ─── Props ───

interface ExerciseImageProps {
  /** The exercise ID to look up images for */
  exerciseId: string;
  /** Category used for placeholder theming */
  category?: Category | string;
  /** Pre-resolved image paths (from batch getExerciseImageMap) to skip DB query */
  imagePaths?: string[];
  /** Display variant */
  variant?: 'thumbnail' | 'detail' | 'hero';
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = CATEGORY_CONFIG[category] || DEFAULT_CONFIG;
  const dimensions = VARIANT_DIMENSIONS[variant];

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

        if (paths.length === 0) {
          if (!cancelled) setResolvedUris([]);
          return;
        }

        // Check which files actually exist on disk
        const validUris: string[] = [];
        for (const imgPath of paths) {
          // image_path in DB: "3_4_Sit-Up/0.jpg"
          // file on disk:     documentDirectory/exercises/3_4_Sit-Up/images/0.jpg
          const parts = imgPath.split('/');
          const folder = parts.slice(0, -1).join('/');
          const file = parts[parts.length - 1];
          const fullPath = `${IMAGE_BASE_DIR}${folder}/images/${file}`;

          const info = await FileSystem.getInfoAsync(fullPath);
          if (info.exists) {
            validUris.push(fullPath);
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
    setHasError(true);
  }, []);

  // Show real image
  if (resolvedUris.length > 0 && !hasError) {
    const uri = resolvedUris[currentFrame] ?? resolvedUris[0];
    return (
      <View style={[dimensions, styles.container, { borderRadius: variant === 'thumbnail' ? 8 : 12 }, style]}>
        <Image
          source={{ uri }}
          style={[dimensions, styles.image, { borderRadius: variant === 'thumbnail' ? 8 : 12 }] as ImageStyle[]}
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
                    backgroundColor: i === currentFrame ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  // Placeholder: gradient + category icon
  return (
    <View style={[dimensions, styles.container, { borderRadius: variant === 'thumbnail' ? 8 : 12 }, style]}>
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[dimensions, styles.placeholder, { borderRadius: variant === 'thumbnail' ? 8 : 12 }]}
      >
        <MaterialCommunityIcons
          name={config.icon}
          size={dimensions.height * 0.45}
          color="rgba(255,255,255,0.6)"
        />
      </LinearGradient>
    </View>
  );
}

// ─── Variant dimensions ───

const VARIANT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  thumbnail: { width: 56, height: 56 },
  detail: { width: 120, height: 120 },
  hero: { width: 999, height: 200 }, // width: 999 means "use flex"
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
});
