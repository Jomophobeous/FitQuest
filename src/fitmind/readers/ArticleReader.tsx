/**
 * Article Reader Component
 * 
 * Scrollable rich text rendering for web articles and clipped content.
 * 
 * Features:
 * - Responsive text layout
 * - Adjustable font size
 * - Reading progress tracking
 * - Text selection for highlights
 * - Sepia mode option
 * - Image display
 */

import React, { useCallback, useState, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import ThemedText from '../../components/ThemedText';
import type {
  ArticleReaderProps,
  DocumentLoadInfo,
} from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WORDS_PER_PAGE = 250;

// ============================================
// ARTICLE READER COMPONENT
// ============================================

export function ArticleReader({
  document,
  currentPage,
  onPageChange,
  onLoad,
  onError,
  onTextSelect,
  annotations,
  theme,
  fontSize = 16,
  sepiaMode = false,
  showProgressBar = true,
}: ArticleReaderProps): React.ReactElement {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Parse content into paragraphs
  const paragraphs = useMemo(() => {
    const content = document.content || '';
    return content
      .split(/\n\n+/)
      .filter(p => p.trim().length > 0)
      .map((p, idx) => ({ id: idx, text: p.trim() }));
  }, [document.content]);

  // Calculate word count and pages
  const wordCount = useMemo(() => {
    const content = document.content || '';
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }, [document.content]);

  const totalPages = Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));

  // Notify parent of document load
  React.useEffect(() => {
    const loadInfo: DocumentLoadInfo = {
      totalPages,
      title: document.title,
      author: document.author,
      wordCount,
      estimatedMinutes: Math.ceil(wordCount / 200), // ~200 WPM reading speed
    };
    onLoad?.(loadInfo);
  }, [document.id, totalPages, wordCount]);

  // =====================
  // Scroll Handlers
  // =====================

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const scrollableHeight = contentSize.height - layoutMeasurement.height;
      
      if (scrollableHeight > 0) {
        const progress = Math.min(100, (contentOffset.y / scrollableHeight) * 100);
        setScrollProgress(progress);
        
        // Calculate approximate page based on scroll position
        const page = Math.max(1, Math.ceil((progress / 100) * totalPages));
        if (page !== currentPage) {
          onPageChange(page);
        }
      }
    },
    [currentPage, totalPages, onPageChange]
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      setContentHeight(height);
    },
    []
  );

  // =====================
  // Theme Styles
  // =====================

  const backgroundColor = useMemo(() => {
    if (sepiaMode) return '#f4ecd8';
    return theme.backgroundColor;
  }, [sepiaMode, theme.backgroundColor]);

  const textColor = useMemo(() => {
    if (sepiaMode) return '#5c4b37';
    return theme.textColor;
  }, [sepiaMode, theme.textColor]);

  // =====================
  // Render
  // =====================

  if (!document.content || paragraphs.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor }]}>
        <ThemedText variant="h3" color="muted" style={styles.emptyTitle}>
          No Content
        </ThemedText>
        <ThemedText variant="body" color="muted" style={styles.emptyText}>
          This article has no readable content.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingHorizontal: SCREEN_WIDTH > 600 ? 48 : 20 },
        ]}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View entering={FadeIn.duration(300)}>
          <ThemedText
            variant="h1"
            style={[
              styles.title,
              { color: textColor, fontSize: fontSize * 1.75 },
            ]}
          >
            {document.title}
          </ThemedText>
          
          {document.author && document.author !== 'Unknown' && (
            <ThemedText
              variant="caption"
              style={[styles.author, { color: textColor, opacity: 0.6 }]}
            >
              by {document.author}
            </ThemedText>
          )}
          
          <View style={styles.metaRow}>
            <ThemedText variant="caption" style={[styles.meta, { color: textColor, opacity: 0.5 }]}>
              {wordCount.toLocaleString()} words
            </ThemedText>
            <ThemedText variant="caption" style={[styles.meta, { color: textColor, opacity: 0.5 }]}>
              •
            </ThemedText>
            <ThemedText variant="caption" style={[styles.meta, { color: textColor, opacity: 0.5 }]}>
              {Math.ceil(wordCount / 200)} min read
            </ThemedText>
          </View>
        </Animated.View>

        {/* Content */}
        <View style={styles.content}>
          {paragraphs.map((para, idx) => (
            <ThemedText
              key={para.id}
              variant="body"
              style={[
                styles.paragraph,
                {
                  color: textColor,
                  fontSize,
                  lineHeight: fontSize * 1.7,
                },
              ]}
            >
              {para.text}
            </ThemedText>
          ))}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Progress bar */}
      {showProgressBar && (
        <View style={[styles.progressBar, { backgroundColor: theme.backgroundColor }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${scrollProgress}%`,
                backgroundColor: theme.accentColor,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 24,
    paddingBottom: 40,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    marginBottom: 8,
    fontWeight: '700',
  },
  author: {
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.3)',
  },
  meta: {},
  content: {
    gap: 16,
  },
  paragraph: {
    textAlign: 'justify',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
});

export default ArticleReader;
