import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import ThemedText from '../src/components/ThemedText';
import FQLogoMark from '../src/components/FQLogoMark';
import { useTheme } from '../src/context/ThemeContext';
import { useDatabase } from '../src/context/DatabaseContext';

export default function Splash() {
  const { theme } = useTheme();
  const router = useRouter();
  const { isReady, onboardingComplete } = useDatabase();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!isReady || navigatedRef.current) return;
    navigatedRef.current = true;

    if (onboardingComplete) {
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding');
    }
  }, [isReady, onboardingComplete, router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <FQLogoMark size={96} showGlow />
      <ThemedText variant="h2" color="accent" style={{ marginTop: 16, marginBottom: 16 }}>
        FitQuest
      </ThemedText>
      <ActivityIndicator size="large" color={theme.colors.accent} />
    </View>
  );
}
