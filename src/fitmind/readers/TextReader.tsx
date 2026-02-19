/**
 * Text Reader Component
 * 
 * Simple plain text reader for notes and plaintext documents.
 * Supports optional editing mode.
 * 
 * Features:
 * - Plain text display
 * - Edit mode for notes
 * - Reading progress tracking
 * - Monospace font option
 * - Auto-save on edit
 */

import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import ThemedText from '../../components/ThemedText';
import type {
  TextReaderProps,
  DocumentLoadInfo,
} from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WORDS_PER_PAGE = 250;

// ============================================
// TEXT READER COMPONENT
// ============================================

export function TextReader({
  document,
  currentPage,
  onPageChange,
  onLoad,
  onError,
  onTextSelect,
  theme,
  editable = false,
  onTextChange,
}: TextReaderProps): React.ReactElement {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [editedContent, setEditedContent] = useState(document.content || '');
  const [hasChanges, setHasChanges] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = editable ? editedContent : (document.content || '');

  // Calculate word count and pages
  const wordCount = useMemo(() => {
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }, [content]);

  const totalPages = Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));

  // Notify parent of document load
  useEffect(() => {
    const loadInfo: DocumentLoadInfo = {
      totalPages,
      title: document.title,
      author: document.author,
      wordCount,
      estimatedMinutes: Math.ceil(wordCount / 200),
    };
    onLoad?.(loadInfo);
  }, [document.id, totalPages, wordCount]);

  // Reset edited content when document changes
  useEffect(() => {
    setEditedContent(document.content || '');
    setHasChanges(false);
  }, [document.id]);

  // =====================
  // Edit Handlers
  // =====================

  const handleTextChange = useCallback(
    (text: string) => {
      setEditedContent(text);
      setHasChanges(true);

      // Debounced auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        onTextChange?.(text);
      }, 1000);
    },
    [onTextChange]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Save immediately on unmount if there are changes
        if (hasChanges) {
          onTextChange?.(editedContent);
        }
      }
    };
  }, [hasChanges, editedContent, onTextChange]);

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

        const page = Math.max(1, Math.ceil((progress / 100) * totalPages));
        if (page !== currentPage) {
          onPageChange(page);
        }
      }
    },
    [currentPage, totalPages, onPageChange]
  );

  // =====================
  // Render
  // =====================

  if (!content && !editable) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: theme.backgroundColor }]}>
        <ThemedText variant="h3" color="muted" style={styles.emptyTitle}>
          Empty Note
        </ThemedText>
        <ThemedText variant="body" color="muted" style={styles.emptyText}>
          This note has no content.
        </ThemedText>
      </View>
    );
  }

  const Wrapper = editable ? KeyboardAvoidingView : View;
  const wrapperProps = editable
    ? { behavior: Platform.OS === 'ios' ? 'padding' as const : undefined, style: styles.container }
    : { style: styles.container };

  return (
    <Wrapper {...wrapperProps} style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingHorizontal: SCREEN_WIDTH > 600 ? 48 : 20 },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeIn.duration(300)}>
          <ThemedText
            variant="h2"
            style={[styles.title, { color: theme.textColor }]}
          >
            {document.title}
          </ThemedText>

          <View style={styles.metaRow}>
            <ThemedText
              variant="caption"
              style={[styles.meta, { color: theme.textColor, opacity: 0.5 }]}
            >
              {wordCount.toLocaleString()} words
            </ThemedText>
            {hasChanges && (
              <ThemedText
                variant="caption"
                style={[styles.unsavedBadge, { color: theme.accentColor }]}
              >
                • Unsaved
              </ThemedText>
            )}
          </View>
        </Animated.View>

        {/* Content */}
        {editable ? (
          <TextInput
            value={editedContent}
            onChangeText={handleTextChange}
            placeholder="Start writing..."
            placeholderTextColor={theme.textColor + '60'}
            multiline
            style={[
              styles.textInput,
              {
                color: theme.textColor,
                backgroundColor: 'transparent',
              },
            ]}
            textAlignVertical="top"
            autoCorrect
            autoCapitalize="sentences"
            scrollEnabled={false}
          />
        ) : (
          <ThemedText
            variant="body"
            style={[
              styles.textContent,
              { color: theme.textColor },
            ]}
          >
            {content}
          </ThemedText>
        )}

        {/* Bottom padding */}
        <View style={{ height: editable ? 200 : 100 }} />
      </ScrollView>

      {/* Progress bar */}
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
    </Wrapper>
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
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.3)',
  },
  meta: {},
  unsavedBadge: {
    fontWeight: '600',
  },
  textContent: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 300,
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

export default TextReader;
