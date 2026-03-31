/**
 * Regional Food Database — Lazy-loaded from JSON asset.
 *
 * Data is NOT parsed at import time. The 189KB JSON is loaded on first access
 * via the getter, keeping the JS bundle lean at startup.
 */

export type RegionalFoodCategory = 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'snack' | 'meal';

export interface RegionalFoodItem {
  name: string;
  category: RegionalFoodCategory;
  description: string;
  calories_per_serving?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  available_regions: string[];
  local_name?: string;
}

// Lazy-loaded: data is parsed only on first access, not at module import
let _cache: RegionalFoodItem[] | null = null;

function loadFoodData(): RegionalFoodItem[] {
  if (!_cache) {
    // require() is lazy with Metro inline-requires; JSON files are tree-shaken per-bundle
    _cache = require('../../assets/food-data.json') as RegionalFoodItem[];
  }
  return _cache;
}

/**
 * Access the full food database. Lazy-loaded on first call.
 */
export const REGIONAL_FOOD_DATABASE: RegionalFoodItem[] = new Proxy([] as RegionalFoodItem[], {
  get(target, prop, receiver) {
    const data = loadFoodData();
    return Reflect.get(data, prop, receiver);
  },
  has(_target, prop) {
    return prop in loadFoodData();
  },
  ownKeys() {
    return Reflect.ownKeys(loadFoodData());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(loadFoodData(), prop);
  },
});
