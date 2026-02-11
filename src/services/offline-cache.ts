import AsyncStorage from '@react-native-async-storage/async-storage';
import { apolloClient } from './apollo-client';

const CACHE_PREFIX = 'apollo_cache_';

export class OfflineCacheManager {
  static async saveToOffline(key: string, data: any): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save offline cache:', error);
    }
  }

  static async getFromOffline(key: string): Promise<any | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const data = await AsyncStorage.getItem(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to retrieve offline cache:', error);
      return null;
    }
  }

  static async clearOfflineCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Failed to clear offline cache:', error);
    }
  }

  static async syncWithServer(): Promise<boolean> {
    try {
      // Attempt to fetch fresh data from server
      // If successful, update cache
      // If failed, fall back to offline cache
      const result = await apolloClient.query({
        query: require('./apollo-client').GET_EXERCISES,
        fetchPolicy: 'network-only',
      });
      return !!result.data;
    } catch (error) {
      console.log('Sync failed, using offline cache:', error);
      return false;
    }
  }

  static async cacheExercises(exercises: any[]): Promise<void> {
    await this.saveToOffline('exercises', exercises);
  }

  static async getOfflineExercises(): Promise<any[] | null> {
    return this.getFromOffline('exercises');
  }

  static async cacheWorkoutPlans(plans: any[]): Promise<void> {
    await this.saveToOffline('workout_plans', plans);
  }

  static async getOfflineWorkoutPlans(): Promise<any[] | null> {
    return this.getFromOffline('workout_plans');
  }
}
