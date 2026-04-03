/**
 * Nutrition Calculator Screen ViewModel
 * Encapsulates meal persistence (load/save via app_state) and food database access.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { createViewModel } from './createViewModel';
import { getAppState, setAppState } from '../database/service';

export { REGIONAL_FOOD_DATABASE } from '../services/foodDatabase';
export type { RegionalFoodItem, RegionalFoodCategory } from '../services/foodDatabase';

interface MealEntry {
  id: string;
  food: { name: string; category: string; protein_g: number; description: string; local_name?: string };
  servings: number;
}

export const useNutritionCalculatorViewModel = createViewModel(() => {
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const hasMounted = useRef(false);

  const loadMeals = useCallback(async () => {
    try {
      const saved = await getAppState('nutrition.todayMeals');
      if (saved) {
        const parsed = JSON.parse(saved) as { date: string; entries: MealEntry[] };
        if (parsed.date === new Date().toISOString().split('T')[0]) {
          setMealEntries(parsed.entries);
        }
      }
    } catch {
      // No saved data or parse error — start fresh
    } finally {
      hasMounted.current = true;
    }
  }, []);

  const persistMeals = useCallback((entries: MealEntry[]) => {
    if (!hasMounted.current) return;
    const payload = JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      entries,
    });
    setAppState('nutrition.todayMeals', payload).catch((e) => {
      if (__DEV__) console.warn('[Nutrition] save failed', e);
    });
  }, []);

  return {
    mealEntries,
    setMealEntries,
    loadMeals,
    persistMeals,
  };
});
