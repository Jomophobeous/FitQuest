import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ThemedText from './ThemedText';
import Card from './Card';
import { spacing } from '../design/theme-system';

export default function ThemeToggle() {
  const { mode, toggleTheme, theme } = useTheme();

  return (
    <Card variant={theme.isDark ? 'elevated' : 'flat'}>
      <TouchableOpacity onPress={toggleTheme} style={[styles.container, { padding: theme.spacing[4] }]}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={mode === 'blackGold' ? 'crown' : mode === 'dark' ? 'moon-waning-crescent' : 'white-balance-sunny'}
              size={24}
              color={mode === 'blackGold' ? theme.colors.accent : mode === 'dark' ? theme.colors.warning : theme.colors.orange}
            />
          </View>
          <View style={styles.textContainer}>
            <ThemedText variant="body" weight="600">
              {mode === 'blackGold' ? 'Black & Gold' : mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </ThemedText>
            <ThemedText variant="bodySmall" color="secondary" style={{ marginTop: spacing[0.5] }}>
              {mode === 'blackGold' ? 'Luxury & elegance' : mode === 'dark' ? 'Focus & immersion' : 'Speed & clarity'}
            </ThemedText>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: spacing[4],
  },
  textContainer: {
    flex: 1,
  },
});
