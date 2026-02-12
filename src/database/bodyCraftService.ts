/**
 * FitQuest Body Craft Database Service
 * CRUD operations for body_craft_algorithms table
 */

import {
  applyBodyCraftAlgorithmToProfile as applyBodyCraftAlgorithmToProfileRecord,
  getActiveBodyCraftAlgorithm as getActiveBodyCraftAlgorithmRecord,
  saveBodyCraftAlgorithm as saveBodyCraftAlgorithmRecord,
} from './service';
import type { BodyCraftAlgorithm } from '../engines/bodyCraftEngine';

// ============================================
// SAVE
// ============================================

/**
 * Save a new BodyCraftAlgorithm, deactivating any previous active one
 */
export async function saveBodyCraftAlgorithm(algo: BodyCraftAlgorithm): Promise<void> {
  await saveBodyCraftAlgorithmRecord(algo);
}

// ============================================
// GET ACTIVE
// ============================================

/**
 * Get the currently active BodyCraftAlgorithm for a user
 */
export async function getActiveBodyCraftAlgorithm(userId: string): Promise<BodyCraftAlgorithm | null> {
  return getActiveBodyCraftAlgorithmRecord(userId);
}

// ============================================
// APPLY TO PROFILE
// ============================================

/**
 * Apply a BodyCraftAlgorithm to the user's profile
 * Updates the user_profile goal and training_days_per_week
 */
export async function applyAlgorithmToProfile(userId: string, algo: BodyCraftAlgorithm): Promise<void> {
  await applyBodyCraftAlgorithmToProfileRecord(userId, algo);
}
