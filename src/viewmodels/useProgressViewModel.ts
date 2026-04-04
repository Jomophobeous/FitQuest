/**
 * Progress Screen ViewModel
 * Encapsulates photo index persistence, XP tracking, and workout stats loading.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Paths, File, Directory } from 'expo-file-system';
import { createViewModel } from './createViewModel';
import { getAppState, setAppState, getUserProgress, getStreak } from '../database/service';
import { getXPData, awardProgressPhotoXP, type XPData } from '../services/xpService';

export type { XPData };

export interface ProgressPhoto {
  id: string;
  uri: string;
  date: string;
  label?: string;
}

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

export const useProgressViewModel = createViewModel(() => {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [xpData, setXPData] = useState<XPData | null>(null);
  const [stats, setStats] = useState<{ workouts: number; streak: number; exercises: number }>({
    workouts: 0,
    streak: 0,
    exercises: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [photoList, xp, progress, streak] = await Promise.all([
        loadPhotoIndex(),
        getXPData(),
        getUserProgress(),
        getStreak('user_local_001'),
      ]);
      if (!mountedRef.current) return;
      setPhotos(photoList);
      setXPData(xp);
      setStats({
        workouts: progress.completed_workouts,
        streak: streak.current,
        exercises: progress.total_exercises_done,
      });
    } catch (e) {
      if (__DEV__) console.warn('[Progress] Data load error:', e);
      if (mountedRef.current) setLoadError('Failed to load progress data.');
    }
  }, []);

  const saveNewPhoto = useCallback(
    async (uri: string, label?: string): Promise<{ xpEarned: number }> => {
      await ensurePhotosDir();
      const id = `photo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
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

      const existing = await loadPhotoIndex();
      existing.unshift(photo);
      await savePhotoIndex(existing);

      const xpResult = await awardProgressPhotoXP();
      await loadData();
      return xpResult;
    },
    [loadData],
  );

  const deleteProgressPhoto = useCallback(
    async (photoId: string) => {
      const all = await loadPhotoIndex();
      const photo = all.find((p) => p.id === photoId);
      if (photo) {
        try {
          const file = new File(photo.uri);
          if (file.exists) file.delete();
        } catch {}
        await savePhotoIndex(all.filter((p) => p.id !== photoId));
      }
      await loadData();
    },
    [loadData],
  );

  return {
    photos,
    xpData,
    stats,
    loadError,
    loadData,
    saveNewPhoto,
    deleteProgressPhoto,
  };
});
