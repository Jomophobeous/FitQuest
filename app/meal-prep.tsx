import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import ThemedText from '../src/components/ThemedText';
import { ScreenContainer } from '../src/components/ui/primitives';
import { GlassCard } from '../src/components/ui/GlassCard';
import { spacing } from '../src/design/theme-system';

export default function MealPrepScreen() {
  const { theme } = useTheme();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <GlassCard style={styles.card}>
            <MaterialCommunityIcons name="food-apple-outline" size={64} color={theme.colors.accent} />
            <ThemedText variant="h2" style={styles.title}>
              Meal Prep
            </ThemedText>
            <ThemedText variant="body" color="muted" style={styles.subtitle}>
              Smart meal planning and nutrition tracking — coming soon.
            </ThemedText>
          </GlassCard>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  card: { padding: spacing[8], alignItems: 'center' },
  title: { marginTop: spacing[4] },
  subtitle: { marginTop: spacing[2], textAlign: 'center' },
});
