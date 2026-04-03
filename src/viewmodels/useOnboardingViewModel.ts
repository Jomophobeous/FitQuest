/**
 * Onboarding ViewModel
 *
 * Wraps all database writes for user profile creation, equipment,
 * interests, personal goals, app-state flags, and telemetry.
 * Screen keeps: form state, step navigation, permissions, validation display, toast, router.
 */

import { useState, useCallback } from 'react';
import { createViewModel } from './createViewModel';
import {
  createUserProfile,
  setUserEquipment,
  updateUserProfile,
  getUserProfile,
  lockUserProfile,
  setAppState,
  setUserInterests,
  addUserPersonalGoal,
} from '../database/service';
import { EquipmentItem, PersonalDevelopmentTopic } from '../database/types';
import { validateNumeric, BODY_RANGES } from '../utils/validation';
import { logEvent } from '../services/telemetry';

export type { EquipmentItem, PersonalDevelopmentTopic };

export interface OnboardingData {
  goal: 'body_control' | 'posture' | 'speed' | 'mobility' | 'focus' | 'strength' | null;
  experience: 'beginner' | 'intermediate' | 'advanced' | null;
  trainingDays: number;
  sessionMinutes: number;
  weightKg: string;
  heightCm: string;
  sex: 'male' | 'female' | null;
  equipment: EquipmentItem[];
  interests: PersonalDevelopmentTopic[];
  personalGoal: string;
}

interface SaveResult {
  success: boolean;
  errors?: Record<string, string>;
}

const GYM_ITEMS: string[] = ['BARBELL', 'CABLE_MACHINE', 'BENCH'];
const MINIMAL_ITEMS: string[] = ['DUMBBELLS', 'RESISTANCE_BANDS', 'KETTLEBELL', 'PULL_UP_BAR'];

export const useOnboardingViewModel = createViewModel(() => {
  const [saving, setSaving] = useState(false);

  const saveProfile = useCallback(
    async (data: OnboardingData, refreshProfile: () => Promise<void>): Promise<SaveResult> => {
      // Validate optional numeric body stats
      const errors: Record<string, string> = {};
      let parsedWeight: number | undefined;
      let parsedHeight: number | undefined;

      if (data.weightKg.trim()) {
        const wv = validateNumeric(data.weightKg, BODY_RANGES.weightKg, false);
        if (!wv.valid) {
          errors.weightKg = wv.error!;
        } else {
          parsedWeight = wv.value || undefined;
        }
      }
      if (data.heightCm.trim()) {
        const hv = validateNumeric(data.heightCm, BODY_RANGES.heightCm, false);
        if (!hv.valid) {
          errors.heightCm = hv.error!;
        } else {
          parsedHeight = hv.value || undefined;
        }
      }

      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      setSaving(true);
      try {
        const existingProfile = await getUserProfile('user_local_001');
        if (existingProfile) {
          await updateUserProfile('user_local_001', {
            sex: data.sex ?? undefined,
            weight_kg: parsedWeight,
            height_cm: parsedHeight,
            goal: data.goal ?? 'body_control',
            experience: data.experience ?? 'beginner',
            training_days_per_week: data.trainingDays,
            time_per_session_minutes: data.sessionMinutes,
          });
        } else {
          await createUserProfile({
            id: 'user_local_001',
            sex: data.sex ?? undefined,
            weight_kg: parsedWeight,
            height_cm: parsedHeight,
            goal: data.goal ?? 'body_control',
            experience: data.experience ?? 'beginner',
            training_days_per_week: data.trainingDays,
            time_per_session_minutes: data.sessionMinutes,
            locked: false,
          } as any);
        }

        await lockUserProfile('user_local_001');

        if (data.equipment.length > 0) {
          await setUserEquipment('user_local_001', data.equipment);
        }

        const hasGym = data.equipment.some((e) => GYM_ITEMS.includes(e));
        const hasMinimal = data.equipment.some((e) => MINIMAL_ITEMS.includes(e));
        const equipLevel = hasGym ? 'playground' : hasMinimal ? 'minimal' : 'none';
        await setAppState('user.equipment_level', equipLevel);

        if (data.interests.length > 0) {
          await setUserInterests(
            'user_local_001',
            data.interests.map((topic, i) => ({
              user_id: 'user_local_001',
              topic,
              priority: Math.max(1, 5 - i),
              created_at: Date.now(),
            })),
          );
        }

        if (data.personalGoal.trim()) {
          await addUserPersonalGoal('user_local_001', data.personalGoal.trim(), 'fitness');
        }

        await refreshProfile();

        await setAppState('onboarding_complete', 'true');
        await setAppState('age_verified_13_plus', 'true');
        await setAppState('data_consent_accepted', String(Date.now()));
        await setAppState('medical_disclaimer_accepted', String(Date.now()));
        void logEvent('onboarding_completed', {
          goal: data.goal,
          experience: data.experience,
          training_days: data.trainingDays,
          equipment_count: data.equipment.length,
        });
      } catch (e) {
        if (__DEV__) console.warn('[Onboarding] Profile save error:', e);
        setSaving(false);
        return { success: false };
      }
      setSaving(false);
      return { success: true };
    },
    [],
  );

  const skipOnboarding = useCallback(async (refreshProfile: () => Promise<void>) => {
    await setAppState('onboarding_complete', 'true');
    await setAppState('age_verified_13_plus', 'true');
    await setAppState('data_consent_accepted', String(Date.now()));
    await setAppState('medical_disclaimer_accepted', String(Date.now()));
    await refreshProfile();
  }, []);

  return { saving, saveProfile, skipOnboarding };
});
