/**
 * FitQuest Location Service
 * Provides device location for location-based features (meal prep, food filtering)
 * 
 * Uses expo-location for GPS access
 */

import * as Location from 'expo-location';

// ============================================
// TYPES
// ============================================

export interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  isoCountryCode?: string;
}

export interface FoodItem {
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'snack' | 'meal';
  description: string;
  calories_per_serving?: number;
  protein_g?: number;
  available_regions: string[]; // ISO country codes or 'global'
  local_name?: string;
}

// ============================================
// LOCATION FUNCTIONS
// ============================================

/**
 * Check if location services are enabled on the device
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * Request location permission and get current position
 * Returns null gracefully if location unavailable (with fallback for development)
 */
export async function getCurrentLocation(): Promise<UserLocation | null> {
  try {
    // First check if location services are enabled
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      console.log('[Location] Location services disabled on device');
      // Return a default location for development/fallback
      return getDefaultLocation();
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Location] Permission denied');
      return getDefaultLocation();
    }

    // Use a timeout to prevent hanging
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      mayShowUserSettingsDialog: false,
    });

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Location timeout')), 10000)
    );

    const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject | null;

    if (!location) {
      console.log('[Location] Location request timed out');
      return getDefaultLocation();
    }

    const { latitude, longitude } = location.coords;

    // Reverse geocode to get city/country
    try {
      const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode) {
        return {
          latitude,
          longitude,
          city: geocode.city || undefined,
          region: geocode.region || undefined,
          country: geocode.country || undefined,
          isoCountryCode: geocode.isoCountryCode || undefined,
        };
      }
    } catch (geoError) {
      console.warn('[Location] Reverse geocode failed:', geoError);
    }

    return { latitude, longitude };
  } catch (error) {
    console.warn('[Location] Failed to get location, using fallback:', error);
    return getDefaultLocation();
  }
}

/**
 * Get a default location when actual location is unavailable
 * Used for development and when location services are disabled
 */
function getDefaultLocation(): UserLocation {
  return {
    latitude: 0,
    longitude: 0,
    city: 'Unknown',
    region: undefined,
    country: 'Global',
    isoCountryCode: 'GLOBAL', // Special code for global foods
  };
}

/**
 * Check if location permission is granted
 */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ============================================
// FOOD FILTERING BY LOCATION
// ============================================

/**
 * Global food database - will be populated with location-specific food data later
 * Food text filtered by location will be provided by the user
 */
const GLOBAL_FOODS: FoodItem[] = [
  // Universal foods available everywhere
  { name: 'Eggs', category: 'protein', description: 'Whole eggs, scrambled, boiled, or fried', calories_per_serving: 155, protein_g: 13, available_regions: ['global'] },
  { name: 'Chicken Breast', category: 'protein', description: 'Grilled or baked chicken breast', calories_per_serving: 165, protein_g: 31, available_regions: ['global'] },
  { name: 'Rice', category: 'carb', description: 'White or brown rice', calories_per_serving: 206, protein_g: 4, available_regions: ['global'] },
  { name: 'Oats', category: 'carb', description: 'Rolled oats or oatmeal', calories_per_serving: 150, protein_g: 5, available_regions: ['global'] },
  { name: 'Banana', category: 'fruit', description: 'Fresh banana', calories_per_serving: 105, protein_g: 1, available_regions: ['global'] },
  { name: 'Spinach', category: 'vegetable', description: 'Fresh or cooked spinach', calories_per_serving: 23, protein_g: 3, available_regions: ['global'] },
  { name: 'Sweet Potato', category: 'carb', description: 'Baked or boiled sweet potato', calories_per_serving: 103, protein_g: 2, available_regions: ['global'] },
  { name: 'Greek Yoghurt', category: 'protein', description: 'Plain Greek yoghurt', calories_per_serving: 100, protein_g: 17, available_regions: ['global'] },
  { name: 'Avocado', category: 'fat', description: 'Fresh avocado', calories_per_serving: 160, protein_g: 2, available_regions: ['global'] },
  { name: 'Almonds', category: 'fat', description: 'Raw or roasted almonds', calories_per_serving: 164, protein_g: 6, available_regions: ['global'] },
  { name: 'Broccoli', category: 'vegetable', description: 'Steamed or raw broccoli', calories_per_serving: 55, protein_g: 4, available_regions: ['global'] },
  { name: 'Salmon', category: 'protein', description: 'Grilled or baked salmon fillet', calories_per_serving: 208, protein_g: 20, available_regions: ['global'] },
  { name: 'Lentils', category: 'protein', description: 'Cooked lentils (any variety)', calories_per_serving: 230, protein_g: 18, available_regions: ['global'] },
  { name: 'Peanut Butter', category: 'fat', description: 'Natural peanut butter', calories_per_serving: 188, protein_g: 8, available_regions: ['global'] },
  { name: 'Whole Wheat Bread', category: 'carb', description: 'Whole grain bread slices', calories_per_serving: 128, protein_g: 5, available_regions: ['global'] },
];

// ============================================
// Placeholder for location-specific foods
// Food text filtered by location will be provided later
// ============================================

const REGION_SPECIFIC_FOODS: FoodItem[] = [
  // These will be populated when the user provides location-specific food data
  // Example structure:
  // { name: 'Pap', category: 'carb', description: 'Maize meal porridge', calories_per_serving: 180, protein_g: 3, available_regions: ['ZA'], local_name: 'Pap' },
];

/**
 * Get foods filtered by user's location
 * Returns global foods + region-specific foods for the user's country
 */
export function getFoodsByLocation(location: UserLocation | null): FoodItem[] {
  const globalFoods = GLOBAL_FOODS.filter(f => f.available_regions.includes('global'));
  
  if (!location?.isoCountryCode) {
    return globalFoods;
  }

  const countryCode = location.isoCountryCode.toUpperCase();
  const regionalFoods = REGION_SPECIFIC_FOODS.filter(f => 
    f.available_regions.includes(countryCode)
  );

  return [...regionalFoods, ...globalFoods];
}

/**
 * Get meal suggestions based on timing and location
 */
export function getMealSuggestions(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'pre-workout' | 'post-workout' | 'snack',
  location: UserLocation | null,
): { title: string; foods: FoodItem[]; tip: string } {
  const allFoods = getFoodsByLocation(location);

  const suggestions: Record<string, { title: string; categories: FoodItem['category'][]; tip: string }> = {
    breakfast: { title: '🍳 Breakfast', categories: ['protein', 'carb', 'fruit'], tip: 'Eat within 1 hour of waking for best energy' },
    lunch: { title: '🥗 Lunch', categories: ['protein', 'carb', 'vegetable'], tip: 'Balance protein with complex carbs for sustained energy' },
    dinner: { title: '🍗 Dinner', categories: ['protein', 'vegetable', 'fat'], tip: 'Focus on lean protein and veggies for recovery' },
    'pre-workout': { title: '⚡ Pre-Workout', categories: ['carb', 'fruit'], tip: 'Light carbs 30-60 min before training' },
    'post-workout': { title: '💪 Post-Workout', categories: ['protein', 'carb'], tip: 'Consume protein within 30 min post-exercise' },
    snack: { title: '🥜 Snack', categories: ['fat', 'fruit', 'snack'], tip: 'Keep portions small — aim for 150-200 calories' },
  };

  const config = suggestions[mealType];
  const filteredFoods = allFoods.filter(f => config.categories.includes(f.category));

  return {
    title: config.title,
    foods: filteredFoods,
    tip: config.tip,
  };
}
