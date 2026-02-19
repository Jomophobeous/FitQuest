/**
 * Web PDF Viewer fallback
 * 
 * react-native-pdf is native-only and cannot be imported on web.
 * This is the web fallback that shows a message.
 * Native platforms use PdfViewer.native.tsx instead.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import ThemedText from './ThemedText';
import { useTheme } from '../context/ThemeContext';

interface PdfViewerSource {
  uri: string;
  cache?: boolean;
}

export interface PdfViewerProps {
  source: PdfViewerSource;
  style?: ViewStyle;
  page?: number;
  trustAllCerts?: boolean;
  onLoadComplete?: (totalPages: number) => void;
  onPageChanged?: (page: number) => void;
  onError?: (error: unknown) => void;
}

/**
 * Web fallback for PDF viewer.
 * On web, native PDF rendering is not available.
 * Use the WebView-based PDF renderer (web_pdfjs engine) instead.
 */
export function PdfViewer(props: PdfViewerProps): React.ReactElement {
  const { theme } = useTheme();

  return (
    <View style={[styles.fallback, props.style, { backgroundColor: theme.colors.surface }]}>
      <ThemedText variant="body" color="muted" style={styles.fallbackText}>
        Native PDF rendering is not available on web.
      </ThemedText>
      <ThemedText variant="caption" color="muted" style={styles.fallbackHint}>
        Use the WebView-based PDF renderer (web_pdfjs engine) for web preview.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
  },
  fallbackText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  fallbackHint: {
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default PdfViewer;
