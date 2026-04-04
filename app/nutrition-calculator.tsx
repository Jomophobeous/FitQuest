import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import ThemedText from '../src/components/ThemedText';
import { spacing } from '../src/design/theme-system';

export default function NutritionCalculatorScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name="calculator-variant-outline" size={64} color={theme.colors.accent} />
      <ThemedText variant="h2" style={styles.title}>
        Nutrition Calculator
      </ThemedText>
      <ThemedText variant="body" color="muted" style={styles.subtitle}>
        Macro and calorie calculation tools — coming soon.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  title: { marginTop: spacing[4] },
  subtitle: { marginTop: spacing[2], textAlign: 'center' },
});
