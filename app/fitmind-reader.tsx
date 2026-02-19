import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Linking,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PdfViewer } from '../src/components/PdfViewer';
import { WebView } from 'react-native-webview';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedText from '../src/components/ThemedText';
import { GlassCard, GradientButton } from '../src/components/ui/GlassUI';
import { getAppState, setAppState } from '../src/database/service';
import {
  FitMindService,
  type FitMindDocument,
  type Annotation,
} from '../src/fitmind/schema';
import { DocumentProcessor } from '../src/fitmind/DocumentProcessor';
import { dualAI, type AIResponse } from '../src/fitmind/DualAIEngine';
import { rateLimiter, RATE_LIMITS, formatRetryAfter } from '../src/utils/rateLimiter';
import {
  type ReaderEngine,
  resolveReaderEngine,
  calculateReaderProgressPercent,
  parseEpubWebMessage,
  normalizeReaderFileUri,
  getBinaryRendererFailureMessage,
  canUseInlinePageNavigation,
} from '../src/fitmind/readerEngine';
import {
  loadReaderWebScripts,
  buildPdfWebReaderHtml,
  buildEpubWebReaderHtml,
  type ReaderWebScripts,
} from '../src/fitmind/readerWebAssets';
import { captureReaderError } from '../src/services/errorTelemetry';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WORDS_PER_PAGE = 250;
const OPENAI_KEY_STORAGE = 'fitmind.professor.openai.key';
const OPENAI_MODEL_STORAGE = 'fitmind.professor.openai.model';
const EPUB_PROGRESS_PREFIX = 'fitmind.reader.epub.progress';

const requestedReaderEngine =
  process.env.EXPO_PUBLIC_FITMIND_READER_ENGINE;
const isExpoGo = Constants.appOwnership === 'expo';
const readerEngine: ReaderEngine = resolveReaderEngine(requestedReaderEngine, Constants.appOwnership);

const getEpubProgressKey = (id: string) => `${EPUB_PROGRESS_PREFIX}.${id}`;

export default function FitMindReaderScreen() {
  const router = useRouter();
  return (
    <ScreenErrorBoundary screenName="FitMind Reader" onGoBack={() => router.back()}>
      <FitMindReaderScreenInner />
    </ScreenErrorBoundary>
  );
}

function FitMindReaderScreenInner() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const docId = params.id;

  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<FitMindDocument | null>(null);
  const [pageContent, setPageContent] = useState('');
  const [isBinaryDoc, setIsBinaryDoc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [epubProgressPercent, setEpubProgressPercent] = useState(0);
  const [epubFailed, setEpubFailed] = useState(false);
  const [webPdfFailed, setWebPdfFailed] = useState(false);
  const [webReaderScripts, setWebReaderScripts] = useState<ReaderWebScripts | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // AI chat state
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; suggestions?: string[] }>
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [professorProvider, setProfessorProvider] = useState<'LOCAL' | 'OPENAI'>('LOCAL');
  const [openAIKey, setOpenAIKey] = useState('');
  const [openAIModel, setOpenAIModel] = useState('gpt-4.1-mini');
  const webPdfRef = useRef<WebView>(null);

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
    void loadProfessorSettings();
    return () => {
      // Save reading session on unmount
      saveReadingSession();
    };
  }, []);

  const loadProfessorSettings = async () => {
    try {
      const [storedKey, storedModel] = await Promise.all([
        SecureStore.getItemAsync(OPENAI_KEY_STORAGE),
        SecureStore.getItemAsync(OPENAI_MODEL_STORAGE),
      ]);
      if (storedKey) setOpenAIKey(storedKey);
      if (storedModel) setOpenAIModel(storedModel);
      console.log('[FitMind Reader] Professor settings loaded');
    } catch (e) {
      console.warn('[FitMind Reader] Failed to load Professor settings');
    }
  };

  const saveProfessorSettings = async () => {
    try {
      const keyTrimmed = openAIKey.trim();
      const modelTrimmed = openAIModel.trim() || 'gpt-4.1-mini';

      if (keyTrimmed) {
        await SecureStore.setItemAsync(OPENAI_KEY_STORAGE, keyTrimmed);
      } else {
        await SecureStore.deleteItemAsync(OPENAI_KEY_STORAGE);
      }
      await SecureStore.setItemAsync(OPENAI_MODEL_STORAGE, modelTrimmed);
      setOpenAIModel(modelTrimmed);
      console.log('[FitMind Reader] Professor settings saved', {
        provider: professorProvider,
        model: modelTrimmed,
        hasKey: !!keyTrimmed,
      });
      setChatMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Professor cloud settings saved.',
      }]);
    } catch (e) {
      console.warn('[FitMind Reader] Failed to save Professor settings');
      setChatMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Could not save Professor settings. Please try again.',
      }]);
    }
  };

  const loadDocument = async () => {
    if (!docId) return;
    try {
      const doc = await FitMindService.getDocument(docId);
      if (!doc) {
        router.back();
        return;
      }
      setDocument(doc);
      setIsBinaryDoc(doc.type === 'PDF' || doc.type === 'EPUB');
      setEpubFailed(false);
      setWebPdfFailed(false);
      let startPage = doc.current_page > 0 ? doc.current_page : 1;

      if (doc.type === 'EPUB') {
        const raw = await getAppState(getEpubProgressKey(docId));
        if (raw) {
          try {
            const persisted = JSON.parse(raw) as {
              currentPage?: number;
              progressPercent?: number;
            };
            if (persisted.currentPage && persisted.currentPage > 0) {
              startPage = persisted.currentPage;
            }
            if (typeof persisted.progressPercent === 'number') {
              setEpubProgressPercent(persisted.progressPercent);
            }
          } catch {
            // Ignore malformed persisted progress
          }
        }
      }

      setCurrentPage(startPage);
      sessionStartPageRef.current = startPage;
      // NOTE documents may have null file_path — use inline content instead
      if (doc.file_path) {
        await loadPage(doc.file_path, startPage, doc.type);
      } else if (doc.content) {
        // Paginate inline content for NOTE/ARTICLE documents without a file
        const words = doc.content.split(/\s+/);
        const start = (startPage - 1) * WORDS_PER_PAGE;
        const pageWords = words.slice(start, start + WORDS_PER_PAGE);
        setPageContent(pageWords.join(' '));
        setHasNext(start + WORDS_PER_PAGE < words.length);
        setHasPrev(startPage > 1);
      } else {
        setPageContent(t('fitmind.reader.loadError'));
      }
      await loadAnnotations(startPage);
    } catch (e) {
      console.error('[FitMind Reader] Load error:', e);
      captureReaderError(e instanceof Error ? e : String(e), {
        engine: readerEngine,
        documentType: document?.type,
        documentId: docId,
        phase: 'boot',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (
    filePath: string,
    page: number,
    docType?: FitMindDocument['type']
  ) => {
    try {
      const binary = docType === 'PDF' || docType === 'EPUB';
      if (binary) {
        setPageContent('');
        setHasNext(false);
        setHasPrev(false);
        return;
      }
      const result = await DocumentProcessor.readDocumentPage(filePath, page, WORDS_PER_PAGE);
      setPageContent(result.content);
      setHasNext(result.hasNext);
      setHasPrev(result.hasPrev);
    } catch (e) {
      setPageContent(t('fitmind.reader.loadError'));
      console.error('[FitMind Reader] Page load error:', e);
    }
  };

  const isInAppPdfMode =
    !!document && document.type === 'PDF' && readerEngine === 'native_pdf';
  const shouldUseWebPdfMode =
    !!document && document.type === 'PDF' && readerEngine === 'web_pdfjs' && !webPdfFailed;
  const shouldUseWebEpubMode =
    !!document && document.type === 'EPUB' && readerEngine === 'web_epub' && !epubFailed;
  const isInAppWebPdfMode =
    shouldUseWebPdfMode && !!webReaderScripts;
  const isInAppEpubMode =
    shouldUseWebEpubMode && !!webReaderScripts;

  const normalizedPdfUri = normalizeReaderFileUri(document?.file_path);
  const normalizedEpubUri = normalizeReaderFileUri(document?.file_path);

  const progressPercent = calculateReaderProgressPercent({
    documentType: document?.type,
    currentPage,
    totalPages: document?.total_pages,
    epubProgressPercent,
  });

  const handlePdfPageChanged = useCallback(async (page: number) => {
    if (!docId) return;
    setCurrentPage(page);
    try {
      await FitMindService.updateProgress(docId, page);
    } catch (e) {
      console.warn('[FitMind Reader] Failed to persist PDF page progress');
    }
  }, [docId]);

  useEffect(() => {
    let mounted = true;

    if (!shouldUseWebPdfMode && !shouldUseWebEpubMode) {
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const scripts = await loadReaderWebScripts();
        if (mounted) {
          setWebReaderScripts(scripts);
        }
      } catch (e) {
        console.warn('[FitMind Reader] Failed to load local web reader scripts');
        if (!mounted) return;
        if (shouldUseWebPdfMode) {
          setWebPdfFailed(true);
        }
        if (shouldUseWebEpubMode) {
          setEpubFailed(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [shouldUseWebPdfMode, shouldUseWebEpubMode]);

  const pdfReaderHtml = normalizedPdfUri && webReaderScripts
    ? buildPdfWebReaderHtml({
        pdfUri: normalizedPdfUri,
        pdfScript: webReaderScripts.pdfScript,
        pdfWorkerScript: webReaderScripts.pdfWorkerScript,
        pdfHtmlTemplate: webReaderScripts.pdfHtmlTemplate,
      })
    : '';

  const epubReaderHtml = normalizedEpubUri && webReaderScripts
    ? buildEpubWebReaderHtml({
        epubUri: normalizedEpubUri,
        epubScript: webReaderScripts.epubScript,
        epubHtmlTemplate: webReaderScripts.epubHtmlTemplate,
      })
    : '';

  const loadAnnotations = async (page: number) => {
    if (!docId) return;
    const anns = await FitMindService.getAnnotations(docId, page);
    setAnnotations(anns);
  };

  const navigatePage = useCallback(async (direction: 'next' | 'prev') => {
    if (!document?.file_path) return;

    if (isInAppWebPdfMode) {
      const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
      if (newPage < 1) return;
      setCurrentPage(newPage);
      webPdfRef.current?.injectJavaScript(`window.__setPage(${newPage}); true;`);
      await FitMindService.updateProgress(docId!, newPage);
      return;
    }

    if (isBinaryDoc) return;
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    if (newPage < 1) return;

    setCurrentPage(newPage);
    await loadPage(document.file_path, newPage);
    await loadAnnotations(newPage);

    // Update progress in database
    await FitMindService.updateProgress(docId!, newPage);
  }, [currentPage, document, docId, isBinaryDoc, isInAppWebPdfMode]);

  const handleOpenExternalReader = useCallback(async () => {
    if (!document?.file_path) return;
    try {
      const externalUri = normalizeReaderFileUri(document.file_path);
      if (!externalUri) return;
      console.log('[FitMind Reader] Opening external reader', {
        type: document.type,
        path: externalUri,
      });
      await Linking.openURL(externalUri);
    } catch (e) {
      console.warn('[FitMind Reader] Failed to open external reader', { type: document.type });
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Could not open the system reader for this file.',
        },
      ]);
    }
  }, [document?.file_path, document?.type]);

  const handleRetryBinaryRender = useCallback(() => {
    if (!document) return;

    if (document.type === 'PDF') {
      setWebPdfFailed(false);
    }

    if (document.type === 'EPUB') {
      setEpubFailed(false);
    }
  }, [document]);

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

    const rl = rateLimiter.attempt('ai_query', RATE_LIMITS.AI_QUERY);
    if (!rl.allowed) {
      setChatMessages((prev) => [...prev, {
        role: 'assistant',
        content: `${t('fitmind.reader.rateLimited')} ${formatRetryAfter(rl.retryAfterMs)}`,
      }]);
      return;
    }

    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: input }]);
    setChatLoading(true);

    try {
      console.log('[FitMind Reader] Professor query:start', {
        provider: professorProvider,
        model: professorProvider === 'OPENAI' ? openAIModel : 'on-device',
        page: currentPage,
      });

      const response = await dualAI.queryProfessorWithModel(
        input,
        {
          readingContext: {
            documentTitle: document?.title,
            documentAuthor: document?.author,
            currentPage,
            totalPages: document?.total_pages,
            selectedText: undefined,
          },
        },
        {
          provider: professorProvider,
          apiKey: professorProvider === 'OPENAI' ? openAIKey : undefined,
          model: professorProvider === 'OPENAI' ? openAIModel : undefined,
        }
      );

      console.log('[FitMind Reader] Professor query:complete', {
        provider: professorProvider,
        latencyMs: response.processingTimeMs,
        confidence: response.confidence,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.message,
          suggestions: response.suggestions,
        },
      ]);
    } catch (e: any) {
      console.warn('[FitMind Reader] Professor query failed', {
        provider: professorProvider,
        message: e?.message,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: e?.message || t('fitmind.reader.errorResponse'),
        },
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
        <ThemedText variant="body" color="muted">{t('fitmind.reader.notFound')}</ThemedText>
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
            {`${t('fitmind.reader.pageOf')} ${currentPage} / ${document.total_pages || '?'} • ${progressPercent}%`}
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
                width: `${progressPercent}%`,
              },
            ]}
          />
        </View>
      )}

      {showChat ? (
        /* AI Chat Panel */
        <View style={styles.chatContainer}>
          <View style={[styles.providerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <View style={styles.providerRow}>
              <TouchableOpacity
                onPress={() => {
                  setProfessorProvider('LOCAL');
                  console.log('[FitMind Reader] Professor provider switched', { provider: 'LOCAL' });
                }}
                style={[
                  styles.providerChip,
                  {
                    borderColor: professorProvider === 'LOCAL' ? theme.colors.accent : theme.colors.border,
                    backgroundColor: professorProvider === 'LOCAL' ? theme.colors.accent + '16' : 'transparent',
                  },
                ]}
              >
                <ThemedText variant="caption" color={professorProvider === 'LOCAL' ? 'accent' : 'muted'}>
                  Local Professor
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setProfessorProvider('OPENAI');
                  console.log('[FitMind Reader] Professor provider switched', { provider: 'OPENAI' });
                }}
                style={[
                  styles.providerChip,
                  {
                    borderColor: professorProvider === 'OPENAI' ? theme.colors.accent : theme.colors.border,
                    backgroundColor: professorProvider === 'OPENAI' ? theme.colors.accent + '16' : 'transparent',
                  },
                ]}
              >
                <ThemedText variant="caption" color={professorProvider === 'OPENAI' ? 'accent' : 'muted'}>
                  OpenAI API
                </ThemedText>
              </TouchableOpacity>
            </View>

            {professorProvider === 'OPENAI' && (
              <View style={styles.openAIConfig}>
                <TextInput
                  style={[styles.modelInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={openAIModel}
                  onChangeText={setOpenAIModel}
                  placeholder="Model (e.g. gpt-4.1-mini)"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.apiKeyInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={openAIKey}
                  onChangeText={setOpenAIKey}
                  placeholder="OpenAI API key (sk-...)"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <TouchableOpacity
                  onPress={saveProfessorSettings}
                  style={[styles.saveConfigBtn, { backgroundColor: theme.colors.accent }]}
                >
                  <ThemedText variant="caption" color="primary" style={{ color: theme.colors.text }}>
                    Save API Settings
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
            {chatMessages.length === 0 && (
              <Animated.View entering={FadeInDown}>
                <GlassCard style={styles.chatWelcome}>
                  <MaterialCommunityIcons name="school" size={32} color={theme.colors.accent} />
                  <ThemedText variant="body" color="primary" style={{ marginTop: theme.spacing[2] }}>
                    {t('fitmind.reader.professorIntro')}
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
                  {t('fitmind.reader.thinking')}
                </ThemedText>
              </View>
            )}
          </ScrollView>

          {/* Chat Input */}
          <View style={[styles.chatInputRow, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.chatInputField, { color: theme.colors.text }]}
              placeholder={t('fitmind.reader.askProfessor')}
              placeholderTextColor={theme.colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
              maxLength={2000}
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

            {/* Page Text / Binary Reader Fallback */}
            <Animated.View entering={FadeIn}>
              {isBinaryDoc ? (
                isInAppPdfMode && normalizedPdfUri ? (
                  <View style={styles.pdfContainer}>
                    <PdfViewer
                      source={{ uri: normalizedPdfUri, cache: true }}
                      style={styles.pdfView}
                      page={currentPage}
                      trustAllCerts={false}
                      onLoadComplete={(totalPages) => {
                        if (document.total_pages !== totalPages) {
                          setDocument((prev) => prev ? { ...prev, total_pages: totalPages } : prev);
                        }
                        console.log('[FitMind Reader] PDF loaded', {
                          pages: totalPages,
                          engine: readerEngine,
                        });
                      }}
                      onPageChanged={(page) => {
                        void handlePdfPageChanged(page);
                      }}
                      onError={(error) => {
                        console.warn('[FitMind Reader] PDF render failed; fallback to external reader', {
                          message: String(error),
                        });
                        captureReaderError(String(error), {
                          engine: readerEngine,
                          documentType: document?.type,
                          documentId: docId,
                          phase: 'render',
                        });
                      }}
                    />
                  </View>
                ) : shouldUseWebPdfMode && normalizedPdfUri ? (
                  <View style={styles.pdfContainer}>
                    {isInAppWebPdfMode ? (
                      <WebView
                        ref={webPdfRef}
                        originWhitelist={['*']}
                        source={{ html: pdfReaderHtml, baseUrl: normalizedPdfUri }}
                        allowFileAccess
                        allowingReadAccessToURL={normalizedPdfUri}
                        onMessage={(event) => {
                          try {
                            const data = JSON.parse(event.nativeEvent.data || '{}');
                            if (data.type === 'loaded') {
                              const totalPages = Number(data.payload?.totalPages || 0);
                              if (totalPages > 0) {
                                setDocument((prev) => prev ? { ...prev, total_pages: totalPages } : prev);
                                setHasPrev(false);
                                setHasNext(totalPages > 1);
                              }
                            }
                            if (data.type === 'relocated') {
                              const page = Number(data.payload?.page || 1);
                              const progress = Number(data.payload?.progress || 0);
                              setCurrentPage(page);
                              setEpubProgressPercent(progress);
                              setHasPrev(!data.payload?.atStart);
                              setHasNext(!data.payload?.atEnd);
                              void FitMindService.updateProgress(docId!, page);
                            }
                            if (data.type === 'error') {
                              console.warn('[FitMind Reader] web_pdfjs render failed; fallback to external reader', {
                                message: String(data.payload?.message || 'unknown'),
                              });
                              setWebPdfFailed(true);
                            }
                          } catch {
                            console.warn('[FitMind Reader] web_pdfjs message parse failed');
                          }
                        }}
                        onError={() => {
                          console.warn('[FitMind Reader] web_pdfjs WebView error; fallback to external reader');
                          setWebPdfFailed(true);
                        }}
                      />
                    ) : (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.accent} />
                        <ThemedText variant="caption" color="muted" style={{ marginTop: 8 }}>
                          Loading offline PDF reader...
                        </ThemedText>
                      </View>
                    )}
                  </View>
                ) : shouldUseWebEpubMode && normalizedEpubUri ? (
                  <View style={styles.pdfContainer}>
                    {isInAppEpubMode ? (
                      <WebView
                        originWhitelist={['*']}
                        source={{ html: epubReaderHtml, baseUrl: normalizedEpubUri }}
                        allowFileAccess
                        allowingReadAccessToURL={normalizedEpubUri}
                        onMessage={(event) => {
                          const message = parseEpubWebMessage(event.nativeEvent.data || '');
                          if (message.type === 'loaded') {
                            if (message.totalPages > 0) {
                              setDocument((prev) => prev ? { ...prev, total_pages: message.totalPages } : prev);
                            }
                            return;
                          }

                          if (message.type === 'relocated') {
                            const progress = message.payload.progress;
                            setEpubProgressPercent(progress);
                            const totalPages = document?.total_pages || 0;
                            const derivedPage = totalPages > 0
                              ? Math.max(1, Math.round((progress / 100) * totalPages))
                              : currentPage;
                            setCurrentPage(derivedPage);
                            setHasPrev(!message.payload.atStart);
                            setHasNext(!message.payload.atEnd);

                            if (docId) {
                              void setAppState(
                                getEpubProgressKey(docId),
                                JSON.stringify({
                                  progressPercent: progress,
                                  cfi: message.payload.cfi || null,
                                  currentPage: derivedPage,
                                  totalPages: totalPages || null,
                                  updatedAt: Date.now(),
                                })
                              );
                              void FitMindService.updateProgress(docId, derivedPage);
                            }
                            return;
                          }

                          if (message.type === 'error') {
                            console.warn('[FitMind Reader] EPUB render failed; fallback to external reader', {
                              message: message.message,
                            });
                            setEpubFailed(true);
                          }
                        }}
                        onError={() => {
                          console.warn('[FitMind Reader] EPUB WebView error; fallback to external reader');
                          setEpubFailed(true);
                        }}
                      />
                    ) : (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.accent} />
                        <ThemedText variant="caption" color="muted" style={{ marginTop: 8 }}>
                          Loading offline EPUB reader...
                        </ThemedText>
                      </View>
                    )}
                  </View>
                ) : (
                  <GlassCard style={styles.binaryDocCard}>
                    <MaterialCommunityIcons name="file-document-outline" size={36} color={theme.colors.accent} />
                    <ThemedText variant="body" color="primary" style={{ marginTop: 10, textAlign: 'center' }}>
                      {t('fitmind.reader.binaryModeTitle') || 'Open in PDF/EPUB Reader'}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted" style={{ marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                      {t('fitmind.reader.binaryModeBody') || 'This document uses a binary format. Open it with your device reader for full pagination and rendering.'}
                    </ThemedText>
                    {isExpoGo && document.type === 'PDF' && (
                      <ThemedText variant="caption" color="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                        Native PDF mode requires a development build. Use `web_pdfjs` or external fallback in Expo Go.
                      </ThemedText>
                    )}
                    {document.type === 'EPUB' && (
                      <ThemedText variant="caption" color="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                        EPUB in-app mode can be enabled with EXPO_PUBLIC_FITMIND_READER_ENGINE=web_epub.
                      </ThemedText>
                    )}
                    {webPdfFailed && document.type === 'PDF' && (
                      <ThemedText variant="caption" color="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                        {getBinaryRendererFailureMessage(document.type)}
                      </ThemedText>
                    )}
                    {epubFailed && document.type === 'EPUB' && (
                      <ThemedText variant="caption" color="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                        {getBinaryRendererFailureMessage(document.type)}
                      </ThemedText>
                    )}
                    {(webPdfFailed || epubFailed) && (
                      <TouchableOpacity
                        onPress={handleRetryBinaryRender}
                        style={[styles.binaryOpenBtn, { backgroundColor: theme.colors.textSecondary + '14', borderColor: theme.colors.textSecondary, marginBottom: 8 }]}
                      >
                        <MaterialCommunityIcons name="refresh" size={16} color={theme.colors.textSecondary} />
                        <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                          Retry in-app renderer
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={handleOpenExternalReader}
                      style={[styles.binaryOpenBtn, { backgroundColor: theme.colors.accent + '18', borderColor: theme.colors.accent }]}
                    >
                      <MaterialCommunityIcons name="open-in-new" size={16} color={theme.colors.accent} />
                      <ThemedText variant="caption" color="accent" style={{ marginLeft: 6 }}>
                        {t('fitmind.reader.openReader') || 'Open Document'}
                      </ThemedText>
                    </TouchableOpacity>
                  </GlassCard>
                )
              ) : (
                <ThemedText
                  variant="body"
                  color="primary"
                  style={styles.readingText}
                >
                  {pageContent || t('fitmind.reader.noContent')}
                </ThemedText>
              )}
            </Animated.View>
          </ScrollView>

          {/* Page Navigation */}
          {(() => {
            const canUseNativeNavigation = canUseInlinePageNavigation({
              isBinaryDoc,
              isInAppWebPdfMode,
            });
            return (
          <View style={[styles.navBar, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity
              onPress={() => navigatePage('prev')}
              disabled={!hasPrev || !canUseNativeNavigation}
              style={[styles.navButton, (!hasPrev || !canUseNativeNavigation) && { opacity: 0.3 }]}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.text} />
              <ThemedText variant="caption" color="secondary">{t('fitmind.reader.prev')}</ThemedText>
            </TouchableOpacity>

            <View style={styles.pageIndicator}>
              <ThemedText variant="body" color="accent">
                {currentPage}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                / {document.total_pages || '?'} · {progressPercent}%
              </ThemedText>
            </View>

            <TouchableOpacity
              onPress={() => navigatePage('next')}
              disabled={!hasNext || !canUseNativeNavigation}
              style={[styles.navButton, (!hasNext || !canUseNativeNavigation) && { opacity: 0.3 }]}
            >
              <ThemedText variant="caption" color="secondary">{t('fitmind.reader.next')}</ThemedText>
              <MaterialCommunityIcons name="chevron-right" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
            );
          })()}
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 8,
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
    marginHorizontal: 16,
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
    padding: 24,
    paddingBottom: 100,
  },
  readingText: {
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  binaryDocCard: {
    alignItems: 'center',
    padding: 20,
  },
  pdfContainer: {
    height: SCREEN_HEIGHT * 0.72,
    borderRadius: 14,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfView: {
    flex: 1,
    width: SCREEN_WIDTH - 48,
    height: SCREEN_HEIGHT * 0.72,
  },
  binaryOpenBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  annotationsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
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
    paddingHorizontal: 24,
    paddingVertical: 16,
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
  providerCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  providerChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
  },
  openAIConfig: {
    gap: 8,
  },
  modelInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  saveConfigBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    gap: 8,
  },
  chatWelcome: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
  },
  chatBubble: {
    maxWidth: '85%',
    padding: 16,
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
    marginTop: 8,
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
    padding: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  chatInputField: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 16,
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
    padding: 8,
  },
});
