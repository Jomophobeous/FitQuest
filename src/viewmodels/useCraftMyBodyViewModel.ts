/**
 * Craft-My-Body ViewModel
 *
 * Wraps profile pre-fill, algorithm generation (engine), and algorithm persistence (DB).
 * Screen keeps: all wizard form state, step navigation, validation, toast, router.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createViewModel } from './createViewModel';
import { getUserProfile } from '../database/service';
import { saveBodyCraftAlgorithm, applyAlgorithmToProfile } from '../database/bodyCraftService';
import {
  generateBodyCraftAlgorithm,
  type BodyCraftAlgorithm,
  type BodyCraftInputs,
  type BodyType,
  type GoalType,
  type FitnessLevel,
  type ActivityLevel,
  type MusclePriority,
  type TimelineMonths,
} from '../engines/bodyCraftEngine';

export type {
  BodyCraftAlgorithm,
  BodyCraftInputs,
  BodyType,
  GoalType,
  FitnessLevel,
  ActivityLevel,
  MusclePriority,
  TimelineMonths,
};

interface ProfilePrefill {
  heightCm?: string;
  weightKg?: string;
  sex?: 'male' | 'female';
}

export const useCraftMyBodyViewModel = createViewModel(() => {
  const [profilePrefill, setProfilePrefill] = useState<ProfilePrefill | null>(null);
  const [applied, setApplied] = useState(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const loadProfilePrefill = useCallback(async () => {
    try {
      const profile = await getUserProfile('user_local_001');
      if (!mountedRef.current || !profile) return;
      const prefill: ProfilePrefill = {};
      if (profile.height_cm) prefill.heightCm = String(Math.round(profile.height_cm));
      if (profile.weight_kg) prefill.weightKg = String(Math.round(profile.weight_kg));
      if (profile.sex && (profile.sex === 'male' || profile.sex === 'female')) prefill.sex = profile.sex;
      setProfilePrefill(prefill);
    } catch {
      // Profile not available — not critical
    }
  }, []);

  const generate = useCallback((inputs: BodyCraftInputs): BodyCraftAlgorithm => {
    return generateBodyCraftAlgorithm(inputs, 'user_local_001');
  }, []);

  const applyAlgorithm = useCallback(async (algorithm: BodyCraftAlgorithm): Promise<boolean> => {
    try {
      await saveBodyCraftAlgorithm(algorithm);
      await applyAlgorithmToProfile('user_local_001', algorithm);
      if (!mountedRef.current) return false;
      setApplied(true);
      return true;
    } catch (e) {
      if (__DEV__) console.error('[CraftMyBody] Failed to apply algorithm:', e);
      return false;
    }
  }, []);

  return { profilePrefill, applied, loadProfilePrefill, generate, applyAlgorithm };
});
