/**
 * FitQuest Offline Banner — Phase 25B
 *
 * Compact status banner showing connectivity state.
 * Renders at the top of screens when offline or syncing.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useConnectivity } from '../context/ConnectivityContext';
import ThemedText from './ThemedText';

function OfflineBannerInner() {
  const { theme } = useTheme();
  const { isOnline, pendingSyncCount, isSyncing } = useConnectivity();

  // Nothing to show when online with no pending items
  if (isOnline && pendingSyncCount === 0 && !isSyncing) {
    return null;
  }

  let label: string;
  let bgColor: string;

  if (!isOnline) {
    label = pendingSyncCount > 0 ? `Offline · ${pendingSyncCount} pending` : 'Offline Mode';
    bgColor = theme.colors.warning;
  } else if (isSyncing) {
    label = 'Syncing…';
    bgColor = theme.colors.accent;
  } else if (pendingSyncCount > 0) {
    label = `${pendingSyncCount} actions pending sync`;
    bgColor = theme.colors.textMuted;
  } else {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ThemedText variant="caption" style={styles.text}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

const OfflineBanner = memo(OfflineBannerInner);
export default OfflineBanner;
