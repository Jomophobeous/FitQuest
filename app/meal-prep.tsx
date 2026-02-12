/**
 * FitQuest Meal Prep Screen
 * AI-powered meal suggestions with location-based food filtering
 */

import React, { useMemo, useState, useEffect } from 'react';
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
import { useLanguage } from '../src/context/LanguageContext';
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

const MEAL_TABS: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'weather-sunset-up' },
  { key: 'pre-workout', label: 'Pre-Workout', icon: 'lightning-bolt' },
  { key: 'lunch', label: 'Lunch', icon: 'food' },
  { key: 'post-workout', label: 'Post-Workout', icon: 'arm-flex' },
  { key: 'dinner', label: 'Dinner', icon: 'food-turkey' },
  { key: 'snack', label: 'Snack', icon: 'food-apple-outline' },
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

const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${normalized}${channel}`;
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { paddingBottom: theme.spacing[8] },
    headerGradient: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3], paddingBottom: theme.spacing[3] },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
    headerSpacer: { width: theme.spacing[6] },
    locationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginTop: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    locationText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
    mealTabs: { flexGrow: 0, paddingHorizontal: theme.spacing[4], paddingVertical: theme.spacing[2] },
    mealTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      marginRight: theme.spacing[2],
    },
    mealTabText: { fontSize: 12 },
    tipCard: { marginHorizontal: theme.spacing[4], marginTop: theme.spacing[2], padding: theme.spacing[4] },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
    tipText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19, color: theme.colors.text },
    emptyCard: { marginHorizontal: theme.spacing[4], padding: theme.spacing[6], alignItems: 'center' },
    emptyText: { textAlign: 'center', fontSize: 13, marginTop: theme.spacing[3], lineHeight: 20, color: theme.colors.textMuted },
    foodCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing[4],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      gap: theme.spacing[3],
    },
    foodIcon: {
      width: theme.spacing[10],
      height: theme.spacing[10],
      borderRadius: theme.borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    foodInfo: { flex: 1 },
    foodName: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
    foodDesc: { fontSize: 11, marginTop: theme.spacing[1], lineHeight: 15, color: theme.colors.textMuted },
    foodLocal: { fontSize: 11, marginTop: theme.spacing[1], fontStyle: 'italic', color: theme.colors.accent },
    foodNutrition: { alignItems: 'flex-end' },
    foodCal: { fontSize: 12, fontWeight: '700', color: theme.colors.warning },
    foodProtein: { fontSize: 10, fontWeight: '500', marginTop: theme.spacing[1], color: theme.colors.accent2 },
    compactFoodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      gap: theme.spacing[3],
    },
    categoryDot: { width: theme.spacing[2], height: theme.spacing[2], borderRadius: theme.borderRadius.full },
    compactFoodName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text },
    compactFoodCategory: { fontSize: 11, textTransform: 'capitalize', color: theme.colors.textMuted },
    compactFoodCal: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
    locationInfo: {
      marginHorizontal: theme.spacing[4],
      marginTop: theme.spacing[4],
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing[3],
      padding: theme.spacing[4],
    },
    locationInfoText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
    foodItemSpacing: { paddingHorizontal: theme.spacing[4], marginBottom: theme.spacing[2] },
    compactItemSpacing: { paddingHorizontal: theme.spacing[4], marginBottom: theme.spacing[2] },
    bottomSpacer: { height: theme.spacing[8] },
  });

// ============================================
// SCREEN
// ============================================

export default function MealPrepScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
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
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mealTabColors = useMemo(
    () => ({
      breakfast: theme.colors.warning,
      'pre-workout': theme.colors.accent,
      lunch: theme.colors.success,
      'post-workout': theme.colors.error,
      dinner: theme.colors.accent2,
      snack: theme.colors.textSecondary,
    }),
    [theme]
  );
  const categoryColors = useMemo(
    () => ({
      protein: theme.colors.error,
      carb: theme.colors.warning,
      fat: theme.colors.accent2,
      vegetable: theme.colors.success,
      fruit: theme.colors.accent,
      snack: theme.colors.textSecondary,
      meal: theme.colors.accent2,
    }),
    [theme]
  );

  const selectedTabColor = mealTabColors[selectedMeal];

  const dynamicStyles = useMemo(() => {
    const mealTabStyle = MEAL_TABS.reduce((acc, tab) => {
      const isActive = selectedMeal === tab.key;
      const color = mealTabColors[tab.key];
      acc[tab.key] = {
        backgroundColor: isActive
          ? withAlpha(color, 0.2)
          : withAlpha(theme.colors.text, theme.isDark ? 0.04 : 0.03),
        borderColor: isActive ? withAlpha(color, 0.5) : theme.colors.border,
      };
      return acc;
    }, {} as Record<MealType, { backgroundColor: string; borderColor: string }>);

    const mealTabText = MEAL_TABS.reduce((acc, tab) => {
      const isActive = selectedMeal === tab.key;
      const color = mealTabColors[tab.key];
      acc[tab.key] = {
        color: isActive ? color : theme.colors.textMuted,
        fontWeight: isActive ? '700' : '500',
      };
      return acc;
    }, {} as Record<MealType, { color: string; fontWeight: '700' | '500' }>);

    const categoryIcon = Object.keys(categoryColors).reduce((acc, key) => {
      const category = key as FoodItem['category'];
      acc[category] = { backgroundColor: withAlpha(categoryColors[category], 0.18) };
      return acc;
    }, {} as Record<FoodItem['category'], { backgroundColor: string }>);

    const categoryDot = Object.keys(categoryColors).reduce((acc, key) => {
      const category = key as FoodItem['category'];
      acc[category] = { backgroundColor: categoryColors[category] };
      return acc;
    }, {} as Record<FoodItem['category'], { backgroundColor: string }>);

    return {
      headerGradientColors: theme.isDark
        ? ([withAlpha(selectedTabColor, 0.2), 'transparent'] as const)
        : ([withAlpha(selectedTabColor, 0.1), 'transparent'] as const),
      locationBadge: {
        backgroundColor: withAlpha(theme.colors.text, theme.isDark ? 0.06 : 0.04),
        borderColor: withAlpha(theme.colors.text, theme.isDark ? 0.08 : 0.06),
      },
      mealTabStyle,
      mealTabText,
      foodCard: {
        backgroundColor: theme.isDark
          ? withAlpha(theme.colors.text, 0.04)
          : withAlpha(theme.colors.surface, 0.9),
        borderColor: withAlpha(theme.colors.text, theme.isDark ? 0.06 : 0.04),
      },
      compactFoodRow: {
        backgroundColor: theme.isDark
          ? withAlpha(theme.colors.text, 0.03)
          : withAlpha(theme.colors.surface, 0.8),
        borderColor: withAlpha(theme.colors.text, theme.isDark ? 0.05 : 0.03),
      },
      categoryIcon,
      categoryDot,
    };
  }, [theme, selectedMeal, mealTabColors, categoryColors, selectedTabColor]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── HEADER ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <LinearGradient
            colors={dynamicStyles.headerGradientColors}
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Meal Prep</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Location Badge */}
            <TouchableOpacity
              onPress={loadLocation}
              style={[styles.locationBadge, dynamicStyles.locationBadge]}
            >
              <MaterialCommunityIcons
                name={location ? 'map-marker-check' : 'map-marker-question'}
                size={14}
                color={location ? theme.colors.success : theme.colors.textMuted}
              />
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Text style={styles.locationText}>
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
              const tabColor = mealTabColors[tab.key];
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setSelectedMeal(tab.key)}
                  style={[
                    styles.mealTab,
                    dynamicStyles.mealTabStyle[tab.key],
                  ]}
                >
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={18}
                    color={isActive ? tabColor : theme.colors.textMuted}
                  />
                  <Text style={[styles.mealTabText, dynamicStyles.mealTabText[tab.key]]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ── TIP CARD ── */}
        <GlassCard style={styles.tipCard} delay={200} glowColor={selectedTabColor}>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color={selectedTabColor} />
            <Text style={styles.tipText}>
              {currentMealSuggestions.tip}
            </Text>
          </View>
        </GlassCard>

        {/* ── FOOD SUGGESTIONS ── */}
        <SectionHeader title={currentMealSuggestions.title} delay={250} />

        {currentMealSuggestions.foods.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <MaterialCommunityIcons name="food-off" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>
                No foods available for this meal type right now.{'\n'}Try another meal tab or refresh location.
              </Text>
            </GlassCard>
        ) : (
          currentMealSuggestions.foods.map((food, idx) => (
            <AnimatedListItem key={`${food.name}-${idx}`} index={idx} style={styles.foodItemSpacing}>
              <View style={[styles.foodCard, dynamicStyles.foodCard]}>
                <View style={[styles.foodIcon, dynamicStyles.categoryIcon[food.category]]}>
                  <MaterialCommunityIcons
                    name={CATEGORY_ICONS[food.category] as any}
                    size={20}
                    color={categoryColors[food.category]}
                  />
                </View>
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName}>{food.name}</Text>
                  <Text style={styles.foodDesc}>{food.description}</Text>
                  {food.local_name && (
                    <Text style={styles.foodLocal}>
                      Local: {food.local_name}
                    </Text>
                  )}
                </View>
                <View style={styles.foodNutrition}>
                  {food.calories_per_serving && (
                    <Text style={styles.foodCal}>
                      {food.calories_per_serving} cal
                    </Text>
                  )}
                  {food.protein_g && (
                    <Text style={styles.foodProtein}>
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
          <AnimatedListItem key={`all-${food.name}-${idx}`} index={idx} style={styles.compactItemSpacing}>
            <View style={[styles.compactFoodRow, dynamicStyles.compactFoodRow]}>
              <View style={[styles.categoryDot, dynamicStyles.categoryDot[food.category]]} />
              <Text style={styles.compactFoodName}>{food.name}</Text>
              <Text style={styles.compactFoodCategory}>
                {food.category}
              </Text>
              {food.calories_per_serving && (
                <Text style={styles.compactFoodCal}>
                  {food.calories_per_serving} cal
                </Text>
              )}
            </View>
          </AnimatedListItem>
        ))}

        {/* ── LOCATION INFO ── */}
        <GlassCard style={styles.locationInfo} delay={500}>
          <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.accent} />
          <Text style={styles.locationInfoText}>
            {location
              ? `Showing foods available in ${location.city && location.city !== 'Unknown' ? location.city : location.country && location.country !== 'Global' ? location.country : 'your area'}, including regional and global options.`
              : 'Enable location to see region-specific food suggestions. Tap the location badge above to retry.'}
          </Text>
        </GlassCard>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

