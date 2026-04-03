/**
 * Meal Prep Screen ViewModel
 * Encapsulates location loading, food data fetching, and cache management.
 */
import { useState, useCallback, useEffect } from 'react';
import { createViewModel } from './createViewModel';
import { getAppState } from '../database/service';
import { getCached, setCached } from '../services/cacheStoreService';
import {
  getCurrentLocation,
  getFoodsByLocation,
  type UserLocation,
  type FoodItem,
} from '../services/locationService';

export type { UserLocation, FoodItem };
export { getMealSuggestionsFromFoods } from '../services/locationService';

type MealRegionOverride = 'AUTO' | 'ZA' | 'US' | 'GB' | 'IN' | 'BR' | 'AU';

const REGION_OVERRIDE_LOCATION: Record<
  Exclude<MealRegionOverride, 'AUTO'>,
  Pick<UserLocation, 'country' | 'isoCountryCode' | 'city' | 'region'>
> = {
  ZA: { country: 'South Africa', isoCountryCode: 'ZA', city: 'Unknown', region: undefined },
  US: { country: 'United States', isoCountryCode: 'US', city: 'Unknown', region: undefined },
  GB: { country: 'United Kingdom', isoCountryCode: 'GB', city: 'Unknown', region: undefined },
  IN: { country: 'India', isoCountryCode: 'IN', city: 'Unknown', region: undefined },
  BR: { country: 'Brazil', isoCountryCode: 'BR', city: 'Unknown', region: undefined },
  AU: { country: 'Australia', isoCountryCode: 'AU', city: 'Unknown', region: undefined },
};

export const useMealPrepViewModel = createViewModel(() => {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [manualRegionOverride, setManualRegionOverride] = useState<MealRegionOverride>('AUTO');
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [allFoods, setAllFoods] = useState<FoodItem[]>(() => getFoodsByLocation(null));

  // Load location (with cache + override support)
  const loadLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    try {
      const [savedOverride, cachedAutoLocation] = await Promise.all([
        getAppState('meal.region_override').catch(() => null) as Promise<MealRegionOverride | null>,
        getCached<UserLocation | null>('meal', 'auto_location'),
      ]);

      const activeOverride: MealRegionOverride =
        savedOverride && (savedOverride in REGION_OVERRIDE_LOCATION || savedOverride === 'AUTO')
          ? savedOverride
          : 'AUTO';
      setManualRegionOverride(activeOverride);

      if (activeOverride !== 'AUTO') {
        const overrideLocation = REGION_OVERRIDE_LOCATION[activeOverride as Exclude<MealRegionOverride, 'AUTO'>];
        const overrideResolvedLocation = {
          latitude: 0,
          longitude: 0,
          city: overrideLocation.city,
          region: overrideLocation.region,
          country: overrideLocation.country,
          isoCountryCode: overrideLocation.isoCountryCode,
        };
        setLocation(overrideResolvedLocation);
        void setCached('meal', 'auto_location', overrideResolvedLocation, 24 * 60 * 60 * 1000);
        return;
      }

      if (cachedAutoLocation.value) {
        setLocation(cachedAutoLocation.value);
        return;
      }

      const loc = await getCurrentLocation();
      setLocation(loc);
      void setCached('meal', 'auto_location', loc, 24 * 60 * 60 * 1000);
    } catch (e) {
      if (__DEV__) console.warn('[MealPrep] Failed to load location:', e);
      setLocation(null);
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  // Reload foods when location changes
  useEffect(() => {
    let active = true;
    const loadFoods = async () => {
      const regionCode = String(location?.isoCountryCode || 'GLOBAL').toUpperCase();
      const cacheId = `foods_${regionCode}`;
      const cached = await getCached<FoodItem[]>('meal', cacheId);
      if (active && cached.value && cached.value.length > 0) {
        setAllFoods(cached.value);
      }

      const freshFoods = getFoodsByLocation(location);
      if (active) {
        setAllFoods(freshFoods);
        void setCached('meal', cacheId, freshFoods);
      }
    };

    void loadFoods();
    return () => {
      active = false;
    };
  }, [location]);

  // Init
  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const forceRefreshLocation = useCallback(async () => {
    void setCached('meal', 'auto_location', null, 0);
    await loadLocation();
  }, [loadLocation]);

  return {
    location,
    manualRegionOverride,
    isLoadingLocation,
    allFoods,
    loadLocation,
    forceRefreshLocation,
  };
});
