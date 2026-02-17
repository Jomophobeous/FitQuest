import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedText from '../src/components/ThemedText';
import { GlassCard, GradientButton } from '../src/components/ui/GlassUI';
import {
  FitMindService,
  type FitMindDocument,
  type Annotation,
} from '../src/fitmind/schema';
import { DocumentProcessor } from '../src/fitmind/DocumentProcessor';
import { dualAI, type AIResponse } from '../src/fitmind/DualAIEngine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPACING = { xs: 8, sm: 16, md: 24, lg: 32 } as const;
const WORDS_PER_PAGE = 250;

export default function FitMindReaderScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const docId = params.id;

  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<FitMindDocument | null>(null);
  const [pageContent, setPageContent] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // AI chat state
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; suggestions?: string[] }>
  >([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Reading session tracking
  const sessionStartRef = useRef(Date.now());
  const sessionStartPageRef = useRef(1);
  const currentPageRef = useRef(1);
  const documentRef = useRef<FitMindDocument | null>(null);
  const docIdRef = useRef<string | undefined>(docId);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    docIdRef.current = docId;
  }, [docId]);

  useEffect(() => {
    loadDocument();
    return () => {
      // Save reading session on unmount
      saveReadingSession();
    };
  }, []);

  const loadDocument = async () => {
    if (!docId) return;
    try {
      const doc = await FitMindService.getDocument(docId);
      if (!doc) {
        router.back();
        return;
      }
      setDocument(doc);
      const startPage = doc.current_page > 0 ? doc.current_page : 1;
      setCurrentPage(startPage);
      sessionStartPageRef.current = startPage;
      await loadPage(doc.file_path!, startPage);
      await loadAnnotations(startPage);
    } catch (e) {
      console.error('[FitMind Reader] Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (filePath: string, page: number) => {
    try {
      const result = await DocumentProcessor.readDocumentPage(filePath, page, WORDS_PER_PAGE);
      setPageContent(result.content);
      setHasNext(result.hasNext);
      setHasPrev(result.hasPrev);
    } catch (e) {
      setPageContent('Unable to load page content.');
      console.error('[FitMind Reader] Page load error:', e);
    }
  };

  const loadAnnotations = async (page: number) => {
    if (!docId) return;
    const anns = await FitMindService.getAnnotations(docId, page);
    setAnnotations(anns);
  };

  const navigatePage = useCallback(async (direction: 'next' | 'prev') => {
    if (!document?.file_path) return;
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    if (newPage < 1) return;

    setCurrentPage(newPage);
    await loadPage(document.file_path, newPage);
    await loadAnnotations(newPage);

    // Update progress in database
    await FitMindService.updateProgress(docId!, newPage);
  }, [currentPage, document, docId]);

  const saveReadingSession = async () => {
    const activeDocId = docIdRef.current;
    const activeDocument = documentRef.current;
    const activePage = currentPageRef.current;

    if (!activeDocId || !activeDocument) return;
    const duration = Date.now() - sessionStartRef.current;
    if (duration < 5000) return; // Skip if less than 5 seconds

    const pagesRead = Math.abs(activePage - sessionStartPageRef.current) + 1;
    const wordsRead = pagesRead * WORDS_PER_PAGE;
    const durationMinutes = Math.max(1, Math.round(duration / 60000));

    await FitMindService.recordSession({
      document_id: activeDocId,
      start_page: sessionStartPageRef.current,
      end_page: activePage,
      duration_minutes: durationMinutes,
      words_read: wordsRead,
      comprehension_score: null,
      notes: null,
    });

    // Update reading streak
    await FitMindService.updateReadingStreak(pagesRead, durationMinutes);
  };

  const handleAddBookmark = async () => {
    if (!docId) return;
    await FitMindService.addAnnotation({
      document_id: docId,
      page_number: currentPage,
      type: 'BOOKMARK',
      content: `Page ${currentPage}`,
      color: theme.colors.accent,
      position_start: null,
      position_end: null,
    });
    await loadAnnotations(currentPage);
  };

  const handleAskProfessor = async (query?: string) => {
    const input = query || chatInput.trim();
    if (!input) return;

    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: input }]);
    setChatLoading(true);

    try {
      const response = await dualAI.query(input, {
        personality: 'PROFESSOR',
        readingContext: {
          documentTitle: document?.title,
          documentAuthor: document?.author,
          currentPage,
          totalPages: document?.total_pages,
          selectedText: undefined,
        },
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.message,
          suggestions: response.suggestions,
        },
      ]);
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (!document) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ThemedText variant="body" color="muted">Document not found</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <Animated.View entering={FadeIn} style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <ThemedText variant="body" color="primary" numberOfLines={1}>
            {document.title}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            Page {currentPage} of {document.total_pages || '?'}
          </ThemedText>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={handleAddBookmark} style={styles.iconButton}>
            <MaterialCommunityIcons name="bookmark-plus-outline" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowChat(!showChat)} style={styles.iconButton}>
            <MaterialCommunityIcons
              name={showChat ? 'close' : 'robot-outline'}
              size={22}
              color={showChat ? theme.colors.error : theme.colors.accent}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Progress Bar */}
      {document.total_pages > 0 && (
        <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.colors.accent,
                width: `${(currentPage / document.total_pages) * 100}%`,
              },
            ]}
          />
        </View>
      )}

      {showChat ? (
        /* AI Chat Panel */
        <View style={styles.chatContainer}>
          <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
            {chatMessages.length === 0 && (
              <Animated.View entering={FadeInDown}>
                <GlassCard style={styles.chatWelcome}>
                  <MaterialCommunityIcons name="school" size={32} color={theme.colors.accent} />
                  <ThemedText variant="body" color="primary" style={{ marginTop: SPACING.xs }}>
                    I'm the Professor
                  </ThemedText>
                  <ThemedText variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 4 }}>
                    Ask me about what you're reading. I'll help you understand, analyze, and remember.
                  </ThemedText>
                </GlassCard>
              </Animated.View>
            )}

            {chatMessages.map((msg, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 50)}
                style={[
                  styles.chatBubble,
                  msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  {
                    backgroundColor: msg.role === 'user'
                      ? theme.colors.accent
                      : theme.colors.surface,
                  },
                ]}
              >
                <ThemedText
                  variant="body"
                  color="primary"
                  style={msg.role === 'user' ? { color: theme.colors.text } : undefined}
                >
                  {msg.content}
                </ThemedText>

                {/* Suggestions */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <View style={styles.suggestionsRow}>
                    {msg.suggestions.map((s, j) => (
                      <TouchableOpacity
                        key={j}
                        onPress={() => handleAskProfessor(s)}
                        style={[styles.suggestionChip, { borderColor: theme.colors.accent }]}
                      >
                        <ThemedText variant="caption" color="accent">{s}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Animated.View>
            ))}

            {!!chatLoading && (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <ThemedText variant="caption" color="muted" style={{ marginLeft: 8 }}>
                  Thinking...
                </ThemedText>
              </View>
            )}
          </ScrollView>

          {/* Chat Input */}
          <View style={[styles.chatInputRow, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.chatInputField, { color: theme.colors.text }]}
              placeholder="Ask the Professor..."
              placeholderTextColor={theme.colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={() => handleAskProfessor()}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={() => handleAskProfessor()}
              style={[styles.sendButton, { backgroundColor: theme.colors.accent }]}
            >
              <MaterialCommunityIcons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Reading Content */
        <>
          <ScrollView
            style={styles.readingContent}
            contentContainerStyle={styles.readingPadding}
            showsVerticalScrollIndicator={false}
          >
            {/* Annotations for this page */}
            {annotations.length > 0 && (
              <View style={styles.annotationsBar}>
                {annotations.map((ann) => (
                  <View key={ann.id} style={[styles.annotationChip, { backgroundColor: ann.color + '30' }]}>
                    <MaterialCommunityIcons
                      name={ann.type === 'BOOKMARK' ? 'bookmark' : ann.type === 'NOTE' ? 'note-text' : 'marker'}
                      size={14}
                      color={ann.color}
                    />
                    <ThemedText variant="caption" color="secondary" numberOfLines={1}>
                      {ann.content.slice(0, 30)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            {/* Page Text */}
            <Animated.View entering={FadeIn}>
              <ThemedText
                variant="body"
                color="primary"
                style={styles.readingText}
              >
                {pageContent || 'No content available for this page.'}
              </ThemedText>
            </Animated.View>
          </ScrollView>

          {/* Page Navigation */}
          <View style={[styles.navBar, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity
              onPress={() => navigatePage('prev')}
              disabled={!hasPrev}
              style={[styles.navButton, !hasPrev && { opacity: 0.3 }]}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.text} />
              <ThemedText variant="caption" color="secondary">Prev</ThemedText>
            </TouchableOpacity>

            <View style={styles.pageIndicator}>
              <ThemedText variant="body" color="accent">
                {currentPage}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                / {document.total_pages || '?'}
              </ThemedText>
            </View>

            <TouchableOpacity
              onPress={() => navigatePage('next')}
              disabled={!hasNext}
              style={[styles.navButton, !hasNext && { opacity: 0.3 }]}
            >
              <ThemedText variant="caption" color="secondary">Next</ThemedText>
              <MaterialCommunityIcons name="chevron-right" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  backButton: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: SPACING.xs,
  },
  topActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    padding: 6,
  },
  progressBar: {
    height: 3,
    marginHorizontal: SPACING.sm,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  readingContent: {
    flex: 1,
  },
  readingPadding: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  readingText: {
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  annotationsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  annotationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  // Chat styles
  chatContainer: {
    flex: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  chatWelcome: {
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  chatBubble: {
    maxWidth: '85%',
    padding: SPACING.sm,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.xs,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.xs,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  chatInputField: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.xs,
  },
});
