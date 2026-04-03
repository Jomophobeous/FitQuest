/**
 * FitQuest Nutrition Calculator Screen
 * Search foods from the regional database, add them to a meal tracker,
 * and view nutritional totals (protein, estimated calories).
 */

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';

import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import MedicalDisclaimer from '../src/components/MedicalDisclaimer';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { useNutritionCalculatorViewModel, REGIONAL_FOOD_DATABASE, type RegionalFoodItem, type RegionalFoodCategory } from '../src/viewmodels/useNutritionCalculatorViewModel';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { typography, spacing } from '../src/design/theme-system';


// ============================================
// TYPES
// ============================================

interface MealEntry {
  id: string;
  food: RegionalFoodItem;
  servings: number;
}

// ============================================
// CALORIE ESTIMATION
// ============================================

const CATEGORY_CALORIE_ESTIMATES: Record<RegionalFoodCategory, number> = {
  protein: 165, // ~165 kcal per serving (lean meat/fish)
  carb: 200, // ~200 kcal per serving (rice, bread, etc.)
  fat: 180, // ~180 kcal per serving (oils, nuts, avocado)
  vegetable: 45, // ~45 kcal per serving
  fruit: 80, // ~80 kcal per serving
  snack: 150, // ~150 kcal per serving
  meal: 350, // ~350 kcal per serving (complete meal)
};

function estimateCalories(food: RegionalFoodItem, servings: number): number {
  if (food.calories_per_serving) return food.calories_per_serving * servings;
  return (CATEGORY_CALORIE_ESTIMATES[food.category] || 150) * servings;
}

function estimateProtein(food: RegionalFoodItem, servings: number): number {
  return (food.protein_g || 0) * servings;
}

// ============================================
// CATEGORY ICONS & COLORS
// ============================================

const getCategoryMeta = (
  t: (key: string) => string,
  colors: {
    error: string;
    warning: string;
    purple: string;
    accent: string;
    pink: string;
    orange: string;
    indigo: string;
  },
): Record<RegionalFoodCategory, { icon: string; color: string; label: string }> => ({
  protein: { icon: 'food-drumstick', color: colors.error, label: t('nutrition.category.protein') },
  carb: { icon: 'bread-slice', color: colors.warning, label: t('nutrition.category.carbs') },
  fat: { icon: 'peanut', color: colors.purple, label: t('nutrition.category.fats') },
  vegetable: { icon: 'leaf', color: colors.accent, label: t('nutrition.category.vegetable') },
  fruit: { icon: 'fruit-cherries', color: colors.pink, label: t('nutrition.category.fruit') },
  snack: { icon: 'cookie', color: colors.orange, label: t('nutrition.category.snack') },
  meal: { icon: 'food', color: colors.indigo, label: t('nutrition.category.meal') },
});

// ============================================
// FILTER TABS
// ============================================

const getFilterOptions = (t: (key: string) => string): { label: string; value: RegionalFoodCategory | 'all' }[] => [
  { label: t('nutrition.filter.all'), value: 'all' },
  { label: t('nutrition.category.protein'), value: 'protein' },
  { label: t('nutrition.category.carbs'), value: 'carb' },
  { label: t('nutrition.category.fats'), value: 'fat' },
  { label: t('nutrition.filter.veggies'), value: 'vegetable' },
  { label: t('nutrition.category.fruit'), value: 'fruit' },
];

// ============================================
// MEMOIZED LIST ITEM
// ============================================

const FoodListItem = memo(function FoodListItem({
  item,
  meta,
  onAdd,
  colors,
}: {
  item: RegionalFoodItem;
  meta: { icon: string; color: string; label: string };
  onAdd: (food: RegionalFoodItem) => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.foodCard,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: colors.border,
        },
      ]}
      activeOpacity={0.7}
      onPress={() => onAdd(item)}
      accessibilityRole="button"
      accessibilityLabel={`Add ${item.name}`}
    >
      <View style={[styles.foodIcon, { backgroundColor: meta.color + '18' }]}>
        <MaterialCommunityIcons name={meta.icon as any} size={18} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.foodDesc, { color: colors.textMuted }]} numberOfLines={1}>
          {item.protein_g}g protein · {meta.label}
          {item.local_name ? ` · ${item.local_name}` : ''}
        </Text>
      </View>
      <View style={[styles.addBtn, { backgroundColor: colors.accent + '15' }]}>
        <MaterialCommunityIcons name="plus" size={18} color={colors.accent} />
      </View>
    </TouchableOpacity>
  );
});

// ============================================
// SCREEN
// ============================================

export default function NutritionCalculatorScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isReady: dbReady } = useDatabase();
  const categoryMeta = useMemo(() => getCategoryMeta(t, theme.colors), [t, theme.colors]);
  const filterOptions = useMemo(() => getFilterOptions(t), [t]);
  const router = useRouter();
  const vm = useNutritionCalculatorViewModel();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RegionalFoodCategory | 'all'>('all');
  const [showSearch, setShowSearch] = useState(true);

  // Load persisted meals on mount
  useEffect(() => {
    if (!dbReady) return;
    vm.loadMeals();
  }, [dbReady, vm]);

  // Persist meals to SQLite whenever they change
  useEffect(() => {
    vm.persistMeals(vm.mealEntries);
  }, [vm.mealEntries, vm]);

  // Search & filter foods
  const filteredFoods = useMemo(() => {
    let foods = REGIONAL_FOOD_DATABASE;

    if (categoryFilter !== 'all') {
      foods = foods.filter((f) => f.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      foods = foods.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          (f.local_name && f.local_name.toLowerCase().includes(q)),
      );
    }

    if (__DEV__)
      console.warn(
        `[Nutrition] Filter: category=${categoryFilter}, query="${searchQuery}", results=${foods.length}/${REGIONAL_FOOD_DATABASE.length}`,
      );
    return foods; // Show all matching foods — FlatList handles virtualization
  }, [searchQuery, categoryFilter]);

  // Totals
  const totals = useMemo(() => {
    let calories = 0;
    let protein = 0;
    vm.mealEntries.forEach((entry) => {
      calories += estimateCalories(entry.food, entry.servings);
      protein += estimateProtein(entry.food, entry.servings);
    });
    return { calories: Math.round(calories), protein: Math.round(protein) };
  }, [vm.mealEntries]);

  const addFood = useCallback((food: RegionalFoodItem) => {
    vm.setMealEntries((prev) => [...prev, { id: `${food.name}_${Date.now()}`, food, servings: 1 }]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    vm.setMealEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateServings = useCallback((id: string, servings: number) => {
    if (servings < 0.5) return;
    vm.setMealEntries((prev) => prev.map((e) => (e.id === id ? { ...e, servings } : e)));
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert(t('common.clearAll'), t('nutrition.clearAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.clearAll'), style: 'destructive', onPress: () => vm.setMealEntries([]) },
    ]);
  }, [t]);

  const s = dynamicStyles(theme);

  // Stable FlatList helpers
  const keyExtractorFood = useCallback((item: RegionalFoodItem, index: number) => `${item.name}_${index}`, []);
  const renderFoodItem = useCallback(
    ({ item }: { item: RegionalFoodItem }) => {
      const meta = categoryMeta[item.category] || { icon: 'food', color: theme.colors.textMuted, label: item.category };
      return <FoodListItem item={item} meta={meta} onAdd={addFood} colors={theme.colors} />;
    },
    [categoryMeta, addFood, theme.colors],
  );

  if (!dbReady) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScreenErrorBoundary
      screenName="NutritionCalculator"
      onGoBack={() => (router.canGoBack() ? router.back() : undefined)}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScreenTutorial
          screenKey="nutrition-calculator"
          icon="calculator"
          title="Nutrition Calculator"
          description="Calculate your daily calorie needs, macro breakdown, and find regional foods that fit your nutrition goals."
        />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Header */}
          <Animated.View entering={FadeIn.duration(150)}>
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('nutrition.title')}</Text>
              <TouchableOpacity
                onPress={() => setShowSearch(!showSearch)}
                style={[styles.toggleBtn, { backgroundColor: showSearch ? theme.colors.accent + '15' : 'transparent' }]}
                accessibilityRole="button"
                accessibilityLabel={showSearch ? 'Show nutrition calculator' : 'Search foods'}
              >
                <MaterialCommunityIcons
                  name={showSearch ? 'food-apple' : 'magnify'}
                  size={20}
                  color={showSearch ? theme.colors.accent : theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Medical Disclaimer */}
          <MedicalDisclaimer screen="nutrition" compact />

          {/* Totals Summary */}
          <Animated.View entering={FadeInDown.delay(100).duration(150)}>
            <GlassCard gradient style={styles.totalsCard}>
              <View style={styles.totalsRow}>
                <View style={styles.totalItem}>
                  <Text style={[styles.totalValue, { color: theme.colors.accent }]}>{totals.calories}</Text>
                  <Text style={[styles.totalLabel, { color: theme.colors.textMuted }]}>{t('nutrition.kcalEst')}</Text>
                </View>
                <View style={[styles.totalDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.totalItem}>
                  <Text style={[styles.totalValue, { color: theme.colors.error }]}>{totals.protein}g</Text>
                  <Text style={[styles.totalLabel, { color: theme.colors.textMuted }]}>{t('nutrition.protein')}</Text>
                </View>
                <View style={[styles.totalDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.totalItem}>
                  <Text style={[styles.totalValue, { color: theme.colors.purple }]}>{vm.mealEntries.length}</Text>
                  <Text style={[styles.totalLabel, { color: theme.colors.textMuted }]}>{t('common.items')}</Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={100}
          >
            {showSearch ? (
              /* ——— FOOD SEARCH VIEW ——— */
              <View style={{ flex: 1 }}>
                {/* Search Input */}
                <Animated.View entering={FadeInDown.delay(150).duration(150)} style={styles.searchWrap}>
                  <View
                    style={[
                      styles.searchRow,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textMuted} />
                    <TextInput
                      style={[styles.searchInput, { color: theme.colors.text }]}
                      placeholder={t('nutrition.searchPlaceholder')}
                      placeholderTextColor={theme.colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      returnKeyType="search"
                      autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
                        <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>

                {/* Category Filter Tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                  contentContainerStyle={styles.filterContent}
                >
                  {filterOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor:
                            categoryFilter === opt.value ? theme.colors.accent + '20' : theme.colors.surfaceVariant,
                          borderColor: categoryFilter === opt.value ? theme.colors.accent + '40' : theme.colors.border,
                        },
                      ]}
                      onPress={() => setCategoryFilter(opt.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`${opt.label} filter${categoryFilter === opt.value ? ', selected' : ''}`}
                    >
                      <Text
                        style={[
                          styles.filterLabel,
                          {
                            color: categoryFilter === opt.value ? theme.colors.accent : theme.colors.textMuted,
                            fontWeight: categoryFilter === opt.value ? '700' : '500',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Results Count */}
                <Text style={[styles.resultCount, { color: theme.colors.textMuted }]}>
                  {filteredFoods.length} {t('nutrition.foodsFound')}
                </Text>

                {/* Food Results */}
                <FlatList
                  data={filteredFoods}
                  keyExtractor={keyExtractorFood}
                  contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[6] }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={8}
                  windowSize={3}
                  updateCellsBatchingPeriod={100}
                  removeClippedSubviews={true}
                  getItemLayout={(_data, index) => ({
                    length: 66,
                    offset: 66 * index,
                    index,
                  })}
                  renderItem={renderFoodItem}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons name="food-off" size={48} color={theme.colors.textMuted} />
                      <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                        {t('nutrition.noFoods')}
                      </Text>
                    </View>
                  }
                />
              </View>
            ) : (
              /* ——— MEAL TRACKER VIEW ——— */
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[8] }}
                showsVerticalScrollIndicator={false}
              >
                <SectionHeader
                  title={`${t('nutrition.myMeal')} (${vm.mealEntries.length} ${t('common.items')})`}
                  delay={50}
                />

                {vm.mealEntries.length === 0 ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.emptyMeal}>
                    <MaterialCommunityIcons name="food-variant-off" size={56} color={theme.colors.textMuted} />
                    <Text style={[styles.emptyMealTitle, { color: theme.colors.text }]}>{t('nutrition.noItems')}</Text>
                    <Text style={[styles.emptyMealSub, { color: theme.colors.textMuted }]}>
                      {t('nutrition.addPrompt')}
                    </Text>
                    <TouchableOpacity
                      style={[styles.switchBtn, { borderColor: theme.colors.accent }]}
                      onPress={() => setShowSearch(true)}
                    >
                      <MaterialCommunityIcons name="magnify" size={16} color={theme.colors.accent} />
                      <Text style={{ color: theme.colors.accent, fontWeight: '600', marginLeft: spacing[1.5] }}>
                        {t('nutrition.searchFoods')}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : (
                  <>
                    {vm.mealEntries.map((entry, idx) => {
                      const meta = categoryMeta[entry.food.category] || {
                        icon: 'food',
                        color: theme.colors.textMuted,
                        label: entry.food.category,
                      };
                      const cal = estimateCalories(entry.food, entry.servings);
                      const prot = estimateProtein(entry.food, entry.servings);

                      return (
                        <Animated.View key={entry.id} entering={FadeInDown.delay(idx * 30).duration(150)}>
                          <GlassCard style={styles.mealCard}>
                            <View style={styles.mealCardTop}>
                              <View style={[styles.foodIcon, { backgroundColor: meta.color + '18' }]}>
                                <MaterialCommunityIcons name={meta.icon as any} size={18} color={meta.color} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.foodName, { color: theme.colors.text }]} numberOfLines={1}>
                                  {entry.food.name}
                                </Text>
                                <Text style={[styles.foodDesc, { color: theme.colors.textMuted }]}>
                                  {Math.round(cal)} kcal · {Math.round(prot)}g {t('nutrition.protein')}
                                </Text>
                              </View>
                              <TouchableOpacity onPress={() => removeEntry(entry.id)} accessibilityRole="button" accessibilityLabel={`Remove ${entry.food.name}`}>
                                <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.textMuted} />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.servingsRow}>
                              <Text style={[styles.servingsLabel, { color: theme.colors.textMuted }]}>
                                {t('nutrition.servings')}
                              </Text>
                              <TouchableOpacity
                                style={[styles.servingBtn, { backgroundColor: theme.colors.accent + '15' }]}
                                onPress={() => updateServings(entry.id, entry.servings - 0.5)}
                                accessibilityRole="button"
                                accessibilityLabel={`Decrease servings for ${entry.food.name}`}
                              >
                                <MaterialCommunityIcons name="minus" size={16} color={theme.colors.accent} />
                              </TouchableOpacity>
                              <Text style={[styles.servingValue, { color: theme.colors.text }]}>{entry.servings}</Text>
                              <TouchableOpacity
                                style={[styles.servingBtn, { backgroundColor: theme.colors.accent + '15' }]}
                                onPress={() => updateServings(entry.id, entry.servings + 0.5)}
                                accessibilityRole="button"
                                accessibilityLabel={`Increase servings for ${entry.food.name}`}
                              >
                                <MaterialCommunityIcons name="plus" size={16} color={theme.colors.accent} />
                              </TouchableOpacity>
                            </View>
                          </GlassCard>
                        </Animated.View>
                      );
                    })}

                    {/* Nutrition Breakdown */}
                    <SectionHeader title={t('nutrition.breakdown')} delay={100} />
                    <GlassCard gradient style={{ marginBottom: spacing[4] }}>
                      <View style={styles.breakdownRow}>
                        <View style={styles.breakdownItem}>
                          <LinearGradient
                            colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                            style={styles.breakdownIcon}
                          >
                            <MaterialCommunityIcons name="fire" size={18} color={theme.colors.onAccent} />
                          </LinearGradient>
                          <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>{totals.calories}</Text>
                          <Text style={[styles.breakdownLabel, { color: theme.colors.textMuted }]}>
                            {t('nutrition.caloriesEst')}
                          </Text>
                        </View>
                        <View style={styles.breakdownItem}>
                          <View style={[styles.breakdownIcon, { backgroundColor: theme.colors.error }]}>
                            <MaterialCommunityIcons name="food-steak" size={18} color={theme.colors.onAccent} />
                          </View>
                          <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>{totals.protein}g</Text>
                          <Text style={[styles.breakdownLabel, { color: theme.colors.textMuted }]}>
                            {t('nutrition.protein')}
                          </Text>
                        </View>
                        <View style={styles.breakdownItem}>
                          <View style={[styles.breakdownIcon, { backgroundColor: theme.colors.warning }]}>
                            <MaterialCommunityIcons
                              name="silverware-fork-knife"
                              size={18}
                              color={theme.colors.onAccent}
                            />
                          </View>
                          <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>
                            {vm.mealEntries.length}
                          </Text>
                          <Text style={[styles.breakdownLabel, { color: theme.colors.textMuted }]}>
                            {t('common.items')}
                          </Text>
                        </View>
                      </View>
                    </GlassCard>

                    {/* Clear All + Search More */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.clearBtn, { borderColor: theme.colors.error + '40' }]}
                        onPress={clearAll}
                        accessibilityRole="button"
                        accessibilityLabel="Clear all meals"
                      >
                        <MaterialCommunityIcons name="delete-outline" size={16} color={theme.colors.error} />
                        <Text style={{ color: theme.colors.error, fontWeight: '600', marginLeft: spacing[1.5], fontSize: typography.sizes.label }}>
                          {t('common.clearAll')}
                        </Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <GradientButton
                          title={t('nutrition.addMore')}
                          icon="plus"
                          onPress={() => setShowSearch(true)}
                          variant="primary"
                          size="sm"
                        />
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ScreenErrorBoundary>
  );
}

// ============================================
// DYNAMIC STYLES (theme-dependent)
// ============================================

function dynamicStyles(theme: any) {
  return {};
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.h4, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalsCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
    flex: 1,
  },
  totalValue: {
    fontSize: typography.sizes.h2, 
    fontWeight: '700',
  },
  totalLabel: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '500',
    marginTop: spacing[0.5],
  },
  totalDivider: {
    width: 1,
    height: 32,
  },
  searchWrap: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1],
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.bodyMid, 
    paddingVertical: spacing[2.5],
  },
  filterScroll: {
    minHeight: 50,
  },
  filterContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2.5],
    paddingBottom: spacing[1.5],
    gap: spacing[2],
  },
  filterChip: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    borderRadius: 12,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: typography.sizes.label, 
    lineHeight: 16,
  },
  resultCount: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[1.5],
    fontSize: typography.sizes.caption, 
    fontWeight: '500',
  },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing[1.5],
    gap: spacing[3],
  },
  foodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodName: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '600',
  },
  foodDesc: {
    fontSize: typography.sizes.caption, 
    marginTop: spacing[0.5],
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[12],
    gap: spacing[3],
  },
  emptyText: {
    fontSize: typography.sizes.bodySmall, 
    textAlign: 'center',
  },
  emptyMeal: {
    alignItems: 'center',
    paddingVertical: spacing[12],
    gap: spacing[3],
  },
  emptyMealTitle: {
    fontSize: typography.sizes.h4, 
    fontWeight: '600',
  },
  emptyMealSub: {
    fontSize: typography.sizes.bodySmall, 
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: 12,
    marginTop: spacing[2],
  },
  mealCard: {
    marginBottom: spacing[2],
  },
  mealCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2.5],
    paddingTop: spacing[2.5],
    gap: spacing[2.5],
  },
  servingsLabel: {
    fontSize: typography.sizes.label, 
    fontWeight: '500',
    marginRight: 'auto' as any,
  },
  servingBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingValue: {
    fontSize: typography.sizes.body, 
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  breakdownItem: {
    alignItems: 'center',
    gap: spacing[1.5],
  },
  breakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: typography.sizes.h3, 
    fontWeight: '700',
  },
  breakdownLabel: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: 12,
    borderWidth: 1,
  },
});
