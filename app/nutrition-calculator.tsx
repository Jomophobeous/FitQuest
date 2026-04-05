import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import ThemedText from '../src/components/ThemedText';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { ScreenContainer } from '../src/components/ui/primitives';
import { spacing, radius, typography } from '../src/design/theme-system';
import { useDatabase } from '../src/context/DatabaseContext';
import {
  RealisticHealthEngine,
  type BiologicalSex,
  type ActivityLevel,
  type FitnessGoal,
} from '../src/engines/RealisticHealthEngine';

// ─── Option Selector ───

function OptionRow({
  label,
  options,
  selected,
  onSelect,
  accentColor,
  surfaceColor,
  textColor,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.optionRow}>
      <ThemedText variant="body" color="secondary" style={styles.optionLabel}>
        {label}
      </ThemedText>
      <View style={styles.optionButtons}>
        {options.map((opt) => {
          const isActive = opt.value === selected;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={[styles.optionBtn, { backgroundColor: isActive ? accentColor : surfaceColor }]}
            >
              <ThemedText variant="caption" style={{ color: isActive ? theme.colors.onAccent : textColor }}>
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Result Card ───

function ResultCard({
  title,
  items,
  bgColor,
}: {
  title: string;
  items: Array<{ label: string; value: string; highlight?: boolean }>;
  bgColor: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.resultCard, { backgroundColor: bgColor }]}>
      <ThemedText variant="h4" style={styles.resultTitle}>
        {title}
      </ThemedText>
      {items.map((item) => (
        <View key={item.label} style={styles.resultRow}>
          <ThemedText variant="body" color="secondary">
            {item.label}
          </ThemedText>
          <ThemedText
            variant="body"
            style={item.highlight ? { color: theme.colors.accent, fontWeight: '600' } : undefined}
          >
            {item.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ───

function NutritionCalculatorContent() {
  const { theme } = useTheme();
  const { userProfile } = useDatabase();

  // Pre-fill from user profile if available
  const [age, setAge] = useState('25');
  const [sex, setSex] = useState<BiologicalSex>(
    userProfile?.sex === 'male' ? 'MALE' : userProfile?.sex === 'female' ? 'FEMALE' : 'MALE',
  );
  const [heightCm, setHeightCm] = useState(userProfile?.height_cm ? String(Math.round(userProfile.height_cm)) : '175');
  const [weightKg, setWeightKg] = useState(userProfile?.weight_kg ? String(Math.round(userProfile.weight_kg)) : '70');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('MODERATE');
  const [goal, setGoal] = useState<FitnessGoal>('MAINTAIN');

  const results = useMemo(() => {
    const ageNum = parseInt(age, 10);
    const heightNum = parseFloat(heightCm);
    const weightNum = parseFloat(weightKg);

    if (!ageNum || !heightNum || !weightNum || ageNum < 10 || ageNum > 120) return null;

    const stats = {
      age: ageNum,
      sex,
      heightCm: heightNum,
      weightKg: weightNum,
      activityLevel,
      goal,
    };

    const profile = RealisticHealthEngine.getMetabolicProfile(stats);
    const macros = RealisticHealthEngine.calculateMacros(stats);
    const hydration = RealisticHealthEngine.calculateHydration(weightNum, 30);

    return { profile, macros, hydration };
  }, [age, sex, heightCm, weightKg, activityLevel, goal]);

  const cardBg = theme.colors.surface;
  const inputStyle = [
    styles.input,
    {
      backgroundColor: cardBg,
      color: theme.colors.text,
      borderColor: theme.colors.border,
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="calculator-variant-outline" size={28} color={theme.colors.accent} />
          <ThemedText variant="h2" style={styles.headerTitle}>
            Nutrition Calculator
          </ThemedText>
        </View>

        {/* Inputs */}
        <View style={styles.inputGrid}>
          <View style={styles.inputField}>
            <ThemedText variant="caption" color="muted">
              Age
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              maxLength={3}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={styles.inputField}>
            <ThemedText variant="caption" color="muted">
              Height (cm)
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              maxLength={3}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={styles.inputField}>
            <ThemedText variant="caption" color="muted">
              Weight (kg)
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              maxLength={4}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>

        <OptionRow
          label="Sex"
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
          ]}
          selected={sex}
          onSelect={(v) => setSex(v as BiologicalSex)}
          accentColor={theme.colors.accent}
          surfaceColor={cardBg}
          textColor={theme.colors.text}
        />

        <OptionRow
          label="Activity"
          options={[
            { value: 'SEDENTARY', label: 'Sedentary' },
            { value: 'LIGHT', label: 'Light' },
            { value: 'MODERATE', label: 'Moderate' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'VERY_ACTIVE', label: 'Very Active' },
          ]}
          selected={activityLevel}
          onSelect={(v) => setActivityLevel(v as ActivityLevel)}
          accentColor={theme.colors.accent}
          surfaceColor={cardBg}
          textColor={theme.colors.text}
        />

        <OptionRow
          label="Goal"
          options={[
            { value: 'LOSE_FAT', label: 'Lose Fat' },
            { value: 'MAINTAIN', label: 'Maintain' },
            { value: 'BUILD_MUSCLE', label: 'Build Muscle' },
            { value: 'PERFORMANCE', label: 'Performance' },
          ]}
          selected={goal}
          onSelect={(v) => setGoal(v as FitnessGoal)}
          accentColor={theme.colors.accent}
          surfaceColor={cardBg}
          textColor={theme.colors.text}
        />

        {/* Results */}
        {results && (
          <>
            <ResultCard
              title="Energy"
              bgColor={cardBg}
              items={[
                { label: 'BMR', value: `${Math.round(results.profile.bmr)} kcal/day` },
                { label: 'TDEE', value: `${Math.round(results.profile.tdee)} kcal/day` },
                {
                  label: 'Target Calories',
                  value: `${Math.round(results.profile.targetCalories)} kcal/day`,
                  highlight: true,
                },
                { label: 'BMI', value: `${results.profile.bmi.toFixed(1)} (${results.profile.bmiCategory})` },
              ]}
            />

            <ResultCard
              title="Macros"
              bgColor={cardBg}
              items={[
                {
                  label: `Protein (${results.macros.proteinPercent}%)`,
                  value: `${Math.round(results.macros.proteinGrams)}g`,
                  highlight: true,
                },
                {
                  label: `Carbs (${results.macros.carbPercent}%)`,
                  value: `${Math.round(results.macros.carbGrams)}g`,
                },
                {
                  label: `Fat (${results.macros.fatPercent}%)`,
                  value: `${Math.round(results.macros.fatGrams)}g`,
                },
                { label: 'Fiber', value: `${Math.round(results.macros.fiberGrams)}g` },
              ]}
            />

            <ResultCard
              title="Body Composition"
              bgColor={cardBg}
              items={[
                {
                  label: 'Est. Body Fat',
                  value: `${results.profile.estimatedBodyFat.toFixed(1)}%`,
                },
                { label: 'Lean Mass', value: `${results.profile.leanMass.toFixed(1)} kg` },
                { label: 'Fat Mass', value: `${results.profile.fatMass.toFixed(1)} kg` },
              ]}
            />

            <ResultCard
              title="Hydration"
              bgColor={cardBg}
              items={[
                {
                  label: 'Daily Water',
                  value: `${results.hydration.baseLiters.toFixed(1)}L`,
                  highlight: true,
                },
                {
                  label: 'With Exercise',
                  value: `${results.hydration.totalLiters.toFixed(1)}L`,
                },
              ]}
            />
          </>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </ScreenContainer>
  );
}

export default function NutritionCalculatorScreen() {
  return (
    <ScreenErrorBoundary screenName="nutrition-calculator">
      <NutritionCalculatorContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] },
  headerTitle: { marginLeft: spacing[2] },
  inputGrid: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  inputField: { flex: 1 },
  input: {
    marginTop: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: typography.sizes.body,
  },
  optionRow: { marginBottom: spacing[3] },
  optionLabel: { marginBottom: spacing[1] },
  optionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  optionBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.md,
  },
  resultCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    marginTop: spacing[4],
  },
  resultTitle: { marginBottom: spacing[3] },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[1.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  spacer: { height: spacing[12] },
});
