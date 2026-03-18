/**
 * FitQuest Location Service
 * Provides device location for location-based features (meal prep, food filtering)
 * 
 * Uses expo-location for GPS access
 */

import * as Location from 'expo-location';
import { REGIONAL_FOOD_DATABASE } from './foodDatabase';

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
 * Uses device timezone to make a reasonable regional guess
 */
export function getDefaultLocation(): UserLocation {
  // Try to infer region from timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzLower = tz.toLowerCase();
    
    // Map timezone regions to likely country codes
    if (tzLower.includes('africa/johannesburg') || tzLower.includes('africa/harare') || tzLower.includes('africa/maputo')) {
      return { latitude: -26.2, longitude: 28.0, city: 'Johannesburg', region: 'Gauteng', country: 'South Africa', isoCountryCode: 'ZA' };
    }
    if (tzLower.includes('africa/cape_town') || tzLower.includes('africa/durban')) {
      return { latitude: -33.9, longitude: 18.4, city: 'Cape Town', region: 'Western Cape', country: 'South Africa', isoCountryCode: 'ZA' };
    }
    if (tzLower.includes('africa/')) {
      // Generic Africa fallback — use ZA as closest regional match
      return { latitude: -26.2, longitude: 28.0, city: undefined, region: undefined, country: 'South Africa', isoCountryCode: 'ZA' };
    }
    if (tzLower.includes('america/new_york') || tzLower.includes('america/chicago') || tzLower.includes('america/denver') || tzLower.includes('america/los_angeles')) {
      return { latitude: 40.7, longitude: -74.0, city: undefined, region: undefined, country: 'United States', isoCountryCode: 'US' };
    }
    if (tzLower.includes('europe/london')) {
      return { latitude: 51.5, longitude: -0.1, city: 'London', region: undefined, country: 'United Kingdom', isoCountryCode: 'GB' };
    }
    if (tzLower.includes('asia/kolkata') || tzLower.includes('asia/mumbai')) {
      return { latitude: 19.0, longitude: 72.8, city: undefined, region: undefined, country: 'India', isoCountryCode: 'IN' };
    }
    if (tzLower.includes('australia/')) {
      return { latitude: -33.8, longitude: 151.2, city: 'Sydney', region: undefined, country: 'Australia', isoCountryCode: 'AU' };
    }
    if (tzLower.includes('america/sao_paulo') || tzLower.includes('america/fortaleza')) {
      return { latitude: -23.5, longitude: -46.6, city: undefined, region: undefined, country: 'Brazil', isoCountryCode: 'BR' };
    }
  } catch {
    // Timezone detection failed
  }

  return {
    latitude: 0,
    longitude: 0,
    city: undefined,
    region: undefined,
    country: 'Global',
    isoCountryCode: 'GLOBAL',
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
 * Global fallback foods available in all regions
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

const COUNTRY_TO_REGIONAL_GROUP: Record<string, string[]> = {
  AU: ['AU', 'PAC'],
  NZ: ['PAC', 'AU'],
  ZA: ['ZA', 'MAF', 'NA'],
  BW: ['ZA', 'MAF'],
  NA: ['ZA', 'MAF'],
  ZW: ['ZA', 'MAF'],
  MZ: ['ZA', 'MAF'],
  AO: ['MAF', 'ZA'],
  CD: ['MAF'],
  CG: ['MAF'],
  CM: ['MAF'],
  CF: ['MAF'],
  GA: ['MAF'],
  MA: ['NA', 'EME'],
  DZ: ['NA', 'EME'],
  TN: ['NA', 'EME'],
  LY: ['NA', 'EME'],
  EG: ['NA', 'EME'],
  RU: ['EE', 'CAS'],
  UA: ['EE'],
  PL: ['EE'],
  RO: ['EE'],
  HU: ['EE'],
  BG: ['EE'],
  RS: ['EE'],
  BR: ['SA'],
  AR: ['SA'],
  CL: ['SA'],
  CO: ['SA'],
  PE: ['SA'],
  BO: ['SA'],
  PY: ['SA'],
  UY: ['SA'],
  VE: ['SA'],
  MX: ['SA'],
  US: ['SA', 'EME'],
  CA: ['SA', 'EE'],
  ES: ['EME'],
  PT: ['EME'],
  IT: ['EME'],
  GR: ['EME'],
  FR: ['EME'],
  TR: ['EME', 'CAS'],
  IL: ['EME'],
  LB: ['EME'],
  JO: ['EME'],
  SA: ['EME', 'CAS'],
  AE: ['EME', 'CAS'],
  QA: ['EME', 'CAS'],
  KW: ['EME', 'CAS'],
  IN: ['AS'],
  CN: ['AS'],
  JP: ['AS'],
  KR: ['AS'],
  TH: ['AS'],
  VN: ['AS'],
  PH: ['AS', 'PAC'],
  ID: ['AS', 'PAC'],
  MY: ['AS'],
  SG: ['AS'],
  PK: ['AS', 'CAS'],
  BD: ['AS'],
  LK: ['AS'],
  NP: ['AS', 'CAS'],
  KZ: ['CAS'],
  UZ: ['CAS'],
  KG: ['CAS'],
  TM: ['CAS'],
  TJ: ['CAS'],
  AF: ['CAS', 'AS'],
  FJ: ['PAC'],
  WS: ['PAC'],
  TO: ['PAC'],
  PG: ['PAC'],
  VU: ['PAC'],
};

function getRegionalGroupsForCountry(isoCountryCode?: string): string[] {
  if (!isoCountryCode) {
    return [];
  }

  const normalized = isoCountryCode.toUpperCase();
  return COUNTRY_TO_REGIONAL_GROUP[normalized] || [];
}

/**
 * Get foods filtered by user's location
 * Returns ALL foods from the database, with regional foods sorted first
 * When location is unknown, returns all foods in default order
 */
export function getFoodsByLocation(location: UserLocation | null): FoodItem[] {
  const allRegionalFoods = REGIONAL_FOOD_DATABASE.map(food => ({
    name: food.name,
    category: food.category,
    description: food.description,
    calories_per_serving: food.calories_per_serving,
    protein_g: food.protein_g,
    available_regions: food.available_regions,
    local_name: food.local_name,
  }));
  
  const globalFoods = GLOBAL_FOODS.filter(f => f.available_regions.includes('global'));
  const all = deduplicateFoods([...allRegionalFoods, ...globalFoods]);

  // If no location, return all foods unsorted
  if (!location?.isoCountryCode || location.isoCountryCode === 'GLOBAL') {
    return all;
  }

  // Sort regional foods first — user's region foods appear at the top
  const countryCode = location.isoCountryCode.toUpperCase();
  const regionalGroups = getRegionalGroupsForCountry(countryCode);

  return all.sort((a, b) => {
    const aRegional = a.available_regions.some(r => r === countryCode || regionalGroups.includes(r));
    const bRegional = b.available_regions.some(r => r === countryCode || regionalGroups.includes(r));
    if (aRegional && !bRegional) return -1;
    if (!aRegional && bRegional) return 1;
    return 0;
  });
}

/** O(n) deduplication using Set instead of O(n²) findIndex */
function deduplicateFoods(foods: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  return foods.filter(food => {
    const key = food.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get meal suggestions based on timing and location
 */
const MEAL_SUGGESTIONS_CONFIG: Record<string, { title: string; categories: FoodItem['category'][]; tip: string }> = {
  breakfast: { title: '🍳 Breakfast', categories: ['protein', 'carb', 'fruit'], tip: 'Eat within 1 hour of waking for best energy' },
  lunch: { title: '🥗 Lunch', categories: ['protein', 'carb', 'vegetable'], tip: 'Balance protein with complex carbs for sustained energy' },
  dinner: { title: '🍗 Dinner', categories: ['protein', 'vegetable', 'fat'], tip: 'Focus on lean protein and veggies for recovery' },
  'pre-workout': { title: '⚡ Pre-Workout', categories: ['carb', 'fruit'], tip: 'Light carbs 30-60 min before training' },
  'post-workout': { title: '💪 Post-Workout', categories: ['protein', 'carb'], tip: 'Consume protein within 30 min post-exercise' },
  snack: { title: '🥜 Snack', categories: ['fat', 'fruit', 'snack'], tip: 'Keep portions small — aim for 150-200 calories' },
};

const MEAL_ORDER: Array<'breakfast' | 'lunch' | 'dinner' | 'pre-workout' | 'post-workout' | 'snack'> =
  ['breakfast', 'pre-workout', 'lunch', 'post-workout', 'dinner', 'snack'];

/**
 * Deterministic hash for distributing foods across meal types.
 * Uses the food name to produce a stable numeric hash.
 */
function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Pre-partitioning cache: computed once per food array identity.
 * Maps mealType → food indices for that meal.
 */
let _partitionCache: { key: FoodItem[] | null; result: Map<string, FoodItem[]> } = { key: null, result: new Map() };

function partitionFoodsAcrossMeals(foods: FoodItem[]): Map<string, FoodItem[]> {
  // Return cached result if same array reference
  if (_partitionCache.key === foods) return _partitionCache.result;

  const result = new Map<string, FoodItem[]>();
  for (const m of MEAL_ORDER) result.set(m, []);

  // For each food, find which meals accept its category, then assign to ONE meal
  // using a stable hash so the assignment is deterministic.
  for (const food of foods) {
    const eligibleMeals = MEAL_ORDER.filter(m =>
      MEAL_SUGGESTIONS_CONFIG[m]?.categories.includes(food.category)
    );
    if (eligibleMeals.length === 0) continue;

    // Pick the meal with the fewest foods so far, breaking ties with hash
    const hash = stableHash(food.name);
    let bestMeal = eligibleMeals[hash % eligibleMeals.length]!;

    // Balance: if the hashed meal has 2× the count of the smallest eligible meal, pick smallest
    const counts = eligibleMeals.map(m => ({ m, c: result.get(m)?.length ?? 0 }));
    counts.sort((a, b) => a.c - b.c);
    const smallest = counts[0];
    const hashedCount = result.get(bestMeal)?.length ?? 0;
    if (smallest && hashedCount > smallest.c * 1.5 + 2) {
      bestMeal = smallest.m;
    }

    result.get(bestMeal)?.push(food);
  }

  _partitionCache = { key: foods, result };
  return result;
}

export function getMealSuggestions(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'pre-workout' | 'post-workout' | 'snack',
  location: UserLocation | null,
): { title: string; foods: FoodItem[]; tip: string } {
  return getMealSuggestionsFromFoods(mealType, getFoodsByLocation(location));
}

/**
 * Derive meal suggestions from a pre-computed food list.
 * Each food is assigned to exactly ONE meal type so no duplicates across tabs.
 */
export function getMealSuggestionsFromFoods(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'pre-workout' | 'post-workout' | 'snack',
  foods: FoodItem[],
): { title: string; foods: FoodItem[]; tip: string } {
  const config = MEAL_SUGGESTIONS_CONFIG[mealType];
  if (!config) return { title: mealType, foods: [], tip: '' };
  const partitioned = partitionFoodsAcrossMeals(foods);
  return {
    title: config.title,
    foods: partitioned.get(mealType) || [],
    tip: config.tip,
  };
}
