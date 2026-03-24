/**
 * Shared muscle name formatting utility.
 * Maps internal snake_case muscle identifiers to user-friendly display names.
 */

const MUSCLE_DISPLAY_NAMES: Record<string, string> = {
  chest_mid: 'Chest',
  chest_upper: 'Upper Chest',
  chest_lower: 'Lower Chest',
  lats: 'Lats',
  rhomboids: 'Upper Back',
  traps_mid: 'Traps',
  traps_upper: 'Upper Traps',
  biceps: 'Biceps',
  triceps: 'Triceps',
  deltoids_front: 'Front Delts',
  deltoids_rear: 'Rear Delts',
  deltoids_lateral: 'Side Delts',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes_max: 'Glutes',
  glutes_med: 'Glute Med',
  calves_gastrocnemius: 'Calves',
  calves_soleus: 'Soleus',
  abs: 'Abs',
  obliques: 'Obliques',
  core_deep: 'Core',
  lower_back: 'Lower Back',
  forearms: 'Forearms',
  adductors: 'Adductors',
  hip_flexors: 'Hip Flexors',
  neck: 'Neck',
  serratus: 'Serratus',
};

/** Format a single muscle name for display */
export function formatMuscleName(muscle: string): string {
  return MUSCLE_DISPLAY_NAMES[muscle] ?? muscle.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
