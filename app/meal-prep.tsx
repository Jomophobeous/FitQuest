/**
 * FitQuest Meal Prep Screen
 * AI-powered meal suggestions with location-based food filtering
 * 
 * Food text filtered by location will be populated later by the user
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import {
  GlassCard,
  SectionHeader,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';
import {
  getCurrentLocation,
  getFoodsByLocation,
  getMealSuggestions,
  type UserLocation,
  type FoodItem,
} from '../src/services/locationService';

// ============================================
// MEAL TYPES
// ============================================

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'pre-workout' | 'post-workout' | 'snack';

const MEAL_TABS: { key: MealType; label: string; icon: string; color: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'weather-sunset-up', color: '#F4A427' },
  { key: 'pre-workout', label: 'Pre-Workout', icon: 'lightning-bolt', color: '#5F63FF' },
  { key: 'lunch', label: 'Lunch', icon: 'food', color: '#10B981' },
  { key: 'post-workout', label: 'Post-Workout', icon: 'arm-flex', color: '#FF6B6B' },
  { key: 'dinner', label: 'Dinner', icon: 'food-turkey', color: '#8B5CF6' },
  { key: 'snack', label: 'Snack', icon: 'food-apple-outline', color: '#4ECDC4' },
];

const CATEGORY_ICONS: Record<FoodItem['category'], string> = {
  protein: 'food-steak',
  carb: 'bread-slice',
  fat: 'peanut',
  vegetable: 'leaf',
  fruit: 'fruit-cherries',
  snack: 'cookie',
  meal: 'food-variant',
};

const CATEGORY_COLORS: Record<FoodItem['category'], string> = {
  protein: '#EF4444',
  carb: '#F4A427',
  fat: '#8B5CF6',
  vegetable: '#10B981',
  fruit: '#FF6B6B',
  snack: '#4ECDC4',
  meal: '#5F63FF',
};

// ============================================
// SCREEN
// ============================================

export default function MealPrepScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [selectedMeal, setSelectedMeal] = useState<MealType>('breakfast');
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [allFoods, setAllFoods] = useState<FoodItem[]>([]);

  useEffect(() => {
    loadLocation();
  }, []);

  useEffect(() => {
    setAllFoods(getFoodsByLocation(location));
  }, [location]);

  const loadLocation = async () => {
    setIsLoadingLocation(true);
    const loc = await getCurrentLocation();
    setLocation(loc);
    setIsLoadingLocation(false);
  };

  const currentMealSuggestions = getMealSuggestions(selectedMeal, location);
  const selectedTab = MEAL_TABS.find(t => t.key === selectedMeal)!;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── HEADER ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <LinearGradient
            colors={theme.isDark
              ? [selectedTab.color + '20', 'transparent']
              : [selectedTab.color + '10', 'transparent']
            }
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Meal Prep</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Location Badge */}
            <TouchableOpacity
              onPress={loadLocation}
              style={[styles.locationBadge, {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }]}
            >
              <MaterialCommunityIcons
                name={location ? 'map-marker-check' : 'map-marker-question'}
                size={14}
                color={location ? theme.colors.success : theme.colors.textMuted}
              />
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                  {location
                    ? (location.city && location.city !== 'Unknown'
                        ? `${location.city}${location.country && location.country !== 'Global' ? `, ${location.country}` : ''}`
                        : location.country && location.country !== 'Global'
                          ? location.country
                          : 'Your Area')
                    : 'Tap to enable location'}
                </Text>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* ── MEAL TYPE SELECTOR ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(150)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealTabs}>
            {MEAL_TABS.map((tab, idx) => {
              const isActive = selectedMeal === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setSelectedMeal(tab.key)}
                  style={[
                    styles.mealTab,
                    {
                      backgroundColor: isActive ? tab.color + '20' : theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      borderColor: isActive ? tab.color + '50' : theme.colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={18}
                    color={isActive ? tab.color : theme.colors.textMuted}
                  />
                  <Text style={[styles.mealTabText, {
                    color: isActive ? tab.color : theme.colors.textMuted,
                    fontWeight: isActive ? '700' : '500',
                  }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ── TIP CARD ── */}
        <GlassCard style={styles.tipCard} delay={200} glowColor={selectedTab.color}>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color={selectedTab.color} />
            <Text style={[styles.tipText, { color: theme.colors.text }]}>
              {currentMealSuggestions.tip}
            </Text>
          </View>
        </GlassCard>

        {/* ── FOOD SUGGESTIONS ── */}
        <SectionHeader title={currentMealSuggestions.title} delay={250} />

        {currentMealSuggestions.foods.length === 0 ? (
          <GlassCard style={{ marginHorizontal: 16, padding: 24, alignItems: 'center' }}>
            <MaterialCommunityIcons name="food-off" size={48} color={theme.colors.textMuted} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No foods available for this meal type yet.{'\n'}Location-specific foods will be added soon!
            </Text>
          </GlassCard>
        ) : (
          currentMealSuggestions.foods.map((food, idx) => (
            <AnimatedListItem key={food.name} index={idx} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <View style={[styles.foodCard, {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
                borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }]}>
                <View style={[styles.foodIcon, { backgroundColor: CATEGORY_COLORS[food.category] + '18' }]}>
                  <MaterialCommunityIcons
                    name={CATEGORY_ICONS[food.category] as any}
                    size={20}
                    color={CATEGORY_COLORS[food.category]}
                  />
                </View>
                <View style={styles.foodInfo}>
                  <Text style={[styles.foodName, { color: theme.colors.text }]}>{food.name}</Text>
                  <Text style={[styles.foodDesc, { color: theme.colors.textMuted }]}>{food.description}</Text>
                  {food.local_name && (
                    <Text style={[styles.foodLocal, { color: theme.colors.accent }]}>
                      Local: {food.local_name}
                    </Text>
                  )}
                </View>
                <View style={styles.foodNutrition}>
                  {food.calories_per_serving && (
                    <Text style={[styles.foodCal, { color: theme.colors.warning }]}>
                      {food.calories_per_serving} cal
                    </Text>
                  )}
                  {food.protein_g && (
                    <Text style={[styles.foodProtein, { color: theme.colors.accent2 }]}>
                      {food.protein_g}g protein
                    </Text>
                  )}
                </View>
              </View>
            </AnimatedListItem>
          ))
        )}

        {/* ── ALL FOODS SECTION ── */}
        <SectionHeader title="📋 Full Food List" delay={400} />

        {allFoods.map((food, idx) => (
          <AnimatedListItem key={`all-${food.name}`} index={idx} style={{ paddingHorizontal: 16, marginBottom: 6 }}>
            <View style={[styles.compactFoodRow, {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
              borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }]}>
              <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[food.category] }]} />
              <Text style={[styles.compactFoodName, { color: theme.colors.text }]}>{food.name}</Text>
              <Text style={[styles.compactFoodCategory, { color: theme.colors.textMuted }]}>
                {food.category}
              </Text>
              {food.calories_per_serving && (
                <Text style={[styles.compactFoodCal, { color: theme.colors.textSecondary }]}>
                  {food.calories_per_serving} cal
                </Text>
              )}
            </View>
          </AnimatedListItem>
        ))}

        {/* ── LOCATION INFO ── */}
        <GlassCard style={styles.locationInfo} delay={500}>
          <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.accent} />
          <Text style={[styles.locationInfoText, { color: theme.colors.textMuted }]}>
            {location
              ? `Showing foods available in ${location.city && location.city !== 'Unknown' ? location.city : location.country && location.country !== 'Global' ? location.country : 'your area'}. Location-specific foods will be added in a future update.`
              : 'Enable location to see region-specific food suggestions. Tap the location badge above to retry.'}
          </Text>
        </GlassCard>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  headerGradient: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  locationText: { fontSize: 12, fontWeight: '500' },
  mealTabs: { flexGrow: 0, paddingHorizontal: 16, paddingVertical: 8 },
  mealTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  mealTabText: { fontSize: 12 },
  tipCard: { marginHorizontal: 16, marginTop: 8, padding: 14 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  emptyText: { textAlign: 'center', fontSize: 13, marginTop: 12, lineHeight: 20 },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  foodIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 14, fontWeight: '600' },
  foodDesc: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  foodLocal: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  foodNutrition: { alignItems: 'flex-end' },
  foodCal: { fontSize: 12, fontWeight: '700' },
  foodProtein: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  compactFoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  compactFoodName: { flex: 1, fontSize: 13, fontWeight: '600' },
  compactFoodCategory: { fontSize: 11, textTransform: 'capitalize' },
  compactFoodCal: { fontSize: 11, fontWeight: '600' },
  locationInfo: { marginHorizontal: 16, marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  locationInfoText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
