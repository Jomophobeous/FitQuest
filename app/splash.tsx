import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import ThemedText from '../src/components/ThemedText';
import { useTheme } from '../src/context/ThemeContext';

export default function Splash() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ThemedText variant="h2" color="accent" style={{ marginBottom: 16 }}>
        FitQuest
      </ThemedText>
      <ActivityIndicator size="large" color={theme.colors.accent} />
    </View>
  );
}
