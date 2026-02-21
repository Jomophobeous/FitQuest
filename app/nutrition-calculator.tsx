/**
 * FitQuest Nutrition Calculator Screen
 * Search foods from the regional database, add them to a meal tracker,
 * and view nutritional totals (protein, estimated calories).
 */

import React, { useState, useMemo, useCallback } from 'react';

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
import MedicalDisclaimer from '../src/components/MedicalDisclaimer';
import { useLanguage } from '../src/context/LanguageContext';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import {
  REGIONAL_FOOD_DATABASE,
  RegionalFoodItem,
  RegionalFoodCategory,
} from '../src/services/foodDatabase';

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
  carb: 200,    // ~200 kcal per serving (rice, bread, etc.)
  fat: 180,     // ~180 kcal per serving (oils, nuts, avocado)
  vegetable: 45, // ~45 kcal per serving
  fruit: 80,     // ~80 kcal per serving
  snack: 150,    // ~150 kcal per serving
  meal: 350,     // ~350 kcal per serving (complete meal)
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

const getCategoryMeta = (t: (key: string) => string, colors: { error: string; warning: string; purple: string; accent: string; pink: string; orange: string; indigo: string }): Record<RegionalFoodCategory, { icon: string; color: string; label: string }> => ({
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
// SCREEN
// ============================================

export default function NutritionCalculatorScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const categoryMeta = useMemo(() => getCategoryMeta(t, theme.colors), [t, theme.colors]);
  const filterOptions = useMemo(() => getFilterOptions(t), [t]);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RegionalFoodCategory | 'all'>('all');
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [showSearch, setShowSearch] = useState(true);

  // Search & filter foods
  const filteredFoods = useMemo(() => {
    let foods = REGIONAL_FOOD_DATABASE;

    if (categoryFilter !== 'all') {
      foods = foods.filter(f => f.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      foods = foods.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.local_name && f.local_name.toLowerCase().includes(q))
      );
    }

    if (__DEV__) console.log(`[Nutrition] Filter: category=${categoryFilter}, query="${searchQuery}", results=${foods.length}/${REGIONAL_FOOD_DATABASE.length}`);
    return foods; // Show all matching foods — FlatList handles virtualization
  }, [searchQuery, categoryFilter]);

  // Totals
  const totals = useMemo(() => {
    let calories = 0;
    let protein = 0;
    mealEntries.forEach(entry => {
      calories += estimateCalories(entry.food, entry.servings);
      protein += estimateProtein(entry.food, entry.servings);
    });
    return { calories: Math.round(calories), protein: Math.round(protein) };
  }, [mealEntries]);

  const addFood = useCallback((food: RegionalFoodItem) => {
    setMealEntries(prev => [
      ...prev,
      { id: `${food.name}_${Date.now()}`, food, servings: 1 },
    ]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setMealEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateServings = useCallback((id: string, servings: number) => {
    if (servings < 0.5) return;
    setMealEntries(prev =>
      prev.map(e => (e.id === id ? { ...e, servings } : e))
    );
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert(t('common.clearAll'), t('nutrition.clearAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.clearAll'), style: 'destructive', onPress: () => setMealEntries([]) },
    ]);
  }, [t]);

  const s = dynamicStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(150)}>
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {t('nutrition.title')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowSearch(!showSearch)}
              style={[styles.toggleBtn, { backgroundColor: showSearch ? theme.colors.accent + '15' : 'transparent' }]}
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
                <Text style={[styles.totalValue, { color: theme.colors.accent }]}>
                  {totals.calories}
                </Text>
                <Text style={[styles.totalLabel, { color: theme.colors.textMuted }]}>
                  {t('nutrition.kcalEst')}
                </Text>
              </View>
              <View style={[styles.totalDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: theme.colors.error }]}>
                  {totals.protein}g
                </Text>
                <Text style={[styles.totalLabel, { color: theme.colors.textMuted }]}>
                  {t('nutrition.protein')}
                </Text>
              </View>
              <View style={[styles.totalDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: theme.colors.purple }]}>
                  {mealEntries.length}
                </Text>
                <Text style={[styles.totalLabel, { color: theme.colors.textMuted }]}>
                  {t('common.items')}
                </Text>
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
                <View style={[styles.searchRow, {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.border,
                }]}>
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
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
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
                        backgroundColor: categoryFilter === opt.value
                          ? theme.colors.accent + '20'
                          : theme.colors.surfaceVariant,
                        borderColor: categoryFilter === opt.value
                          ? theme.colors.accent + '40'
                          : theme.colors.border,
                      },
                    ]}
                    onPress={() => setCategoryFilter(opt.value)}
                  >
                    <Text
                      style={[
                        styles.filterLabel,
                        {
                          color: categoryFilter === opt.value
                            ? theme.colors.accent
                            : theme.colors.textMuted,
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
                keyExtractor={(item, index) => `${item.name}_${index}`}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                maxToRenderPerBatch={15}
                windowSize={5}
                renderItem={({ item, index }) => {
                  const meta = categoryMeta[item.category];
                  return (
                    <View>
                      <TouchableOpacity
                        style={[styles.foodCard, {
                          backgroundColor: theme.colors.surfaceVariant,
                          borderColor: theme.colors.border,
                        }]}
                        activeOpacity={0.7}
                        onPress={() => addFood(item)}
                      >
                        <View style={[styles.foodIcon, { backgroundColor: meta.color + '18' }]}>
                          <MaterialCommunityIcons name={meta.icon as any} size={18} color={meta.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.foodName, { color: theme.colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[styles.foodDesc, { color: theme.colors.textMuted }]} numberOfLines={1}>
                            {item.protein_g}g {t('nutrition.protein')} · {meta.label}
                            {item.local_name ? ` · ${item.local_name}` : ''}
                          </Text>
                        </View>
                        <View style={[styles.addBtn, { backgroundColor: theme.colors.accent + '15' }]}>
                          <MaterialCommunityIcons name="plus" size={18} color={theme.colors.accent} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }}
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
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <SectionHeader title={`${t('nutrition.myMeal')} (${mealEntries.length} ${t('common.items')})`} delay={50} />

              {mealEntries.length === 0 ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.emptyMeal}>
                  <MaterialCommunityIcons name="food-variant-off" size={56} color={theme.colors.textMuted} />
                  <Text style={[styles.emptyMealTitle, { color: theme.colors.text }]}>
                    {t('nutrition.noItems')}
                  </Text>
                  <Text style={[styles.emptyMealSub, { color: theme.colors.textMuted }]}>
                    {t('nutrition.addPrompt')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.switchBtn, { borderColor: theme.colors.accent }]}
                    onPress={() => setShowSearch(true)}
                  >
                    <MaterialCommunityIcons name="magnify" size={16} color={theme.colors.accent} />
                    <Text style={{ color: theme.colors.accent, fontWeight: '600', marginLeft: 6 }}>
                      {t('nutrition.searchFoods')}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <>
                  {mealEntries.map((entry, idx) => {
                    const meta = categoryMeta[entry.food.category];
                    const cal = estimateCalories(entry.food, entry.servings);
                    const prot = estimateProtein(entry.food, entry.servings);

                    return (
                      <Animated.View
                        key={entry.id}
                        entering={FadeInDown.delay(idx * 30).duration(150)}
                      >
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
                            <TouchableOpacity onPress={() => removeEntry(entry.id)}>
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
                            >
                              <MaterialCommunityIcons name="minus" size={16} color={theme.colors.accent} />
                            </TouchableOpacity>
                            <Text style={[styles.servingValue, { color: theme.colors.text }]}>
                              {entry.servings}
                            </Text>
                            <TouchableOpacity
                              style={[styles.servingBtn, { backgroundColor: theme.colors.accent + '15' }]}
                              onPress={() => updateServings(entry.id, entry.servings + 0.5)}
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
                  <GlassCard gradient style={{ marginBottom: 16 }}>
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownItem}>
                        <LinearGradient
                          colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                          style={styles.breakdownIcon}
                        >
                          <MaterialCommunityIcons name="fire" size={18} color={theme.colors.onAccent} />
                        </LinearGradient>
                        <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>
                          {totals.calories}
                        </Text>
                        <Text style={[styles.breakdownLabel, { color: theme.colors.textMuted }]}>
                          {t('nutrition.caloriesEst')}
                        </Text>
                      </View>
                      <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownIcon, { backgroundColor: theme.colors.error }]}>
                          <MaterialCommunityIcons name="food-steak" size={18} color={theme.colors.onAccent} />
                        </View>
                        <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>
                          {totals.protein}g
                        </Text>
                        <Text style={[styles.breakdownLabel, { color: theme.colors.textMuted }]}>
                          {t('nutrition.protein')}
                        </Text>
                      </View>
                      <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownIcon, { backgroundColor: theme.colors.warning }]}>
                          <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={theme.colors.onAccent} />
                        </View>
                        <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>
                          {mealEntries.length}
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
                    >
                      <MaterialCommunityIcons name="delete-outline" size={16} color={theme.colors.error} />
                      <Text style={{ color: theme.colors.error, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 18,
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
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
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
    fontSize: 24,
    fontWeight: '700',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  totalDivider: {
    width: 1,
    height: 32,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  filterScroll: {
    minHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 13,
    lineHeight: 16,
  },
  resultCount: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
    gap: 12,
  },
  foodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
  },
  foodDesc: {
    fontSize: 12,
    marginTop: 2,
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
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyMeal: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyMealTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyMealSub: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  mealCard: {
    marginBottom: 8,
  },
  mealCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    gap: 10,
  },
  servingsLabel: {
    fontSize: 13,
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
    fontSize: 16,
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
    gap: 6,
  },
  breakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
