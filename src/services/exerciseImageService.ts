/**
 * Exercise Image Service
 * 
 * Manages the exercise image asset pipeline:
 * - On Android: copies bundled APK assets to documentDirectory on first launch
 * - On other platforms: expects images in documentDirectory (deployed via adb push)
 * - Tracks deployment status in app_state
 * - Provides diagnostics (expected vs. actual image count)
 * 
 * Images are sourced from workspace-repos/exercise-content/free-exercise-db/
 * and deployed to documentDirectory/exercises/{ExerciseName}/{frame}.jpg
 * 
 * DB stores image_path as "ExerciseName/0.jpg" — files on disk live at:
 *   documentDirectory/exercises/ExerciseName/0.jpg
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../database/schema';

/**
 * All platforms use documentDirectory for exercise images.
 * On Android, images are copied from APK assets on first launch.
 */
const EXERCISE_IMAGES_DIR = `${FileSystem.documentDirectory}exercises/`;
const APK_ASSETS_DIR = 'file:///android_asset/exercises/';
const DEPLOYMENT_KEY = 'exercise_images_deployed';

/**
 * Check if exercise images have been deployed to documentDirectory.
 */
export async function areImagesDeployed(): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_state WHERE key = ?`,
    [DEPLOYMENT_KEY]
  );
  return result?.value === 'true';
}

/**
 * Mark exercise images as deployed
 */
export async function markImagesDeployed(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, 'true', datetime('now'))`,
    [DEPLOYMENT_KEY]
  );
}

/**
 * Get exercise image diagnostics
 */
export async function getImageDiagnostics(): Promise<{
  expectedCount: number;
  deployedCount: number;
  exercisesWithImages: number;
  totalExercises: number;
  imagesDirectory: string;
  isDeployed: boolean;
}> {
  const db = await getDatabase();

  const expectedResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercise_images`
  );
  const exercisesWithImagesResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT exercise_id) as count FROM exercise_images`
  );
  const totalExercisesResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercises`
  );

  // Count actual files on disk
  let deployedCount = 0;
  try {
    const dirInfo = await FileSystem.getInfoAsync(EXERCISE_IMAGES_DIR);
    if (dirInfo.exists) {
      const exercises = await FileSystem.readDirectoryAsync(EXERCISE_IMAGES_DIR);
      for (const exerciseDir of exercises) {
        const exercisePath = `${EXERCISE_IMAGES_DIR}${exerciseDir}/`;
        const exerciseInfo = await FileSystem.getInfoAsync(exercisePath);
        if (exerciseInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(exercisePath);
          deployedCount += files.filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')).length;
        }
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  return {
    expectedCount: expectedResult?.count ?? 0,
    deployedCount,
    exercisesWithImages: exercisesWithImagesResult?.count ?? 0,
    totalExercises: totalExercisesResult?.count ?? 0,
    imagesDirectory: EXERCISE_IMAGES_DIR,
    isDeployed: deployedCount > 0,
  };
}

/**
 * Resolve the file system path for an exercise image.
 * 
 * Given a DB image_path like "3_4_Sit-Up/0.jpg", returns the full file:// URI.
 */
export function resolveImagePath(imagePath: string): string {
  return `${EXERCISE_IMAGES_DIR}${imagePath}`;
}

/**
 * Ensure the exercises image directory exists
 */
export async function ensureImageDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(EXERCISE_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(EXERCISE_IMAGES_DIR, { intermediates: true });
  }
}

/**
 * Deploy images from APK assets to documentDirectory on Android.
 * Reads image_path entries from exercise_images table and copies each file.
 * Runs in batches to avoid blocking the UI thread.
 */
async function deployAndroidAssetImages(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ image_path: string }>(
    `SELECT DISTINCT image_path FROM exercise_images ORDER BY image_path`
  );

  if (rows.length === 0) return 0;

  let copied = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async ({ image_path }) => {
      // Try .webp version first (APK may have been optimized), then original path
      const webpPath = image_path.replace(/\.(jpg|png)$/i, '.webp');
      const candidates = webpPath !== image_path ? [webpPath, image_path] : [image_path];

      const dest = `${EXERCISE_IMAGES_DIR}${image_path}`;
      const dirPath = dest.substring(0, dest.lastIndexOf('/'));
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      // Skip if already copied (check both original and webp)
      const destInfo = await FileSystem.getInfoAsync(dest);
      const webpDest = `${EXERCISE_IMAGES_DIR}${webpPath}`;
      const webpInfo = webpPath !== image_path ? await FileSystem.getInfoAsync(webpDest) : destInfo;
      if (destInfo.exists || webpInfo.exists) {
        copied++;
        return;
      }

      for (const candidate of candidates) {
        const src = `${APK_ASSETS_DIR}${candidate}`;
        const cdest = `${EXERCISE_IMAGES_DIR}${candidate}`;
        try {
          await FileSystem.copyAsync({ from: src, to: cdest });
          copied++;
          return;
        } catch {
          // Try next candidate
        }
      }
    });
    await Promise.all(promises);

    // Yield to UI thread between batches
    if (i + BATCH_SIZE < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  return copied;
}

/**
 * Initialize exercise images on first launch.
 * On Android: copies images from APK assets to documentDirectory.
 * On other platforms: creates the base directory and checks deployment status.
 * 
 * Verifies actual files on disk — re-deploys if the flag was set but images are missing.
 */
export async function initializeExerciseImages(): Promise<void> {
  await ensureImageDirectory();

  const deployed = await areImagesDeployed();
  if (deployed) {
    // Spot-check: verify at least some images actually exist on disk
    try {
      const dirInfo = await FileSystem.getInfoAsync(EXERCISE_IMAGES_DIR);
      if (dirInfo.exists) {
        const dirs = await FileSystem.readDirectoryAsync(EXERCISE_IMAGES_DIR);
        if (dirs.length > 50) {
          // Images are actually deployed, trust the flag
          return;
        }
      }
      // Flag was set but images are missing — clear it and re-deploy
      if (__DEV__) console.log('[ExerciseImages] Flag set but images missing on disk — re-deploying...');
      const db = await getDatabase();
      await db.runAsync(
        `DELETE FROM app_state WHERE key = ?`,
        [DEPLOYMENT_KEY]
      );
    } catch {
      return; // Can't verify — trust the flag
    }
  }

  if (Platform.OS === 'android') {
    // Copy from APK assets to documentDirectory
    if (__DEV__) console.log('[ExerciseImages] Deploying images from APK assets...');
    const count = await deployAndroidAssetImages();
    if (__DEV__) console.log(`[ExerciseImages] Deployed ${count} images to documentDirectory`);
    if (count > 0) {
      await markImagesDeployed();
    }
    return;
  }

  // Non-Android: check if images already exist on disk (e.g., from a prior adb push)
  const diagnostics = await getImageDiagnostics();
  if (diagnostics.deployedCount > 0) {
    if (__DEV__) console.log(`[ExerciseImages] Found ${diagnostics.deployedCount} images already on device`);
    await markImagesDeployed();
  } else {
    if (__DEV__) {
      console.log('[ExerciseImages] No exercise images on device — users will see placeholders');
      if (__DEV__) console.log('[ExerciseImages] Deploy via: npm run deploy:images (requires adb for Android)');
    }
  }
}
