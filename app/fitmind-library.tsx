/**
 * FitQuest FitMind Library — Document Library & Cognitive Fitness
 *
 * Fully functional reading library wired to FitMindService.
 * Supports: add text/note documents, view library, filter by status,
 * reading streaks, flashcard review, and navigation to reader.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import { GlassCard, GradientButton, SectionHeader, AnimatedListItem } from '../src/components/ui/GlassUI';
import {
  FitMindService,
  type FitMindDocument,
  type DocumentStatus,
  type Flashcard,
} from '../src/fitmind/schema';
import { DocumentImportPipeline } from '../src/fitmind/DocumentImportPipeline';
import { useDatabase } from '../src/context/DatabaseContext';
import ScreenTutorial from '../src/components/ScreenTutorial';
import PremiumGate from '../src/components/PremiumGate';

type FilterStatus = 'ALL' | DocumentStatus;

const STATUS_FILTERS: { key: FilterStatus; icon: string; label: string }[] = [
  { key: 'ALL', icon: 'book-multiple', label: 'fitmind.filter.all' },
  { key: 'READING', icon: 'book-open-page-variant', label: 'fitmind.filter.reading' },
  { key: 'UNREAD', icon: 'book-clock', label: 'fitmind.filter.unread' },
  { key: 'COMPLETED', icon: 'book-check', label: 'fitmind.filter.done' },
  { key: 'ARCHIVED', icon: 'archive', label: 'fitmind.filter.archived' },
];

const STATUS_COLOR_KEYS: Record<string, string> = {
  UNREAD: 'blue',
  READING: 'accent',
  COMPLETED: 'purple',
  ARCHIVED: 'textMuted',
};

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function FitMindLibraryScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isReady: dbReady } = useDatabase();
  const router = useRouter();

  // Data state
  const [documents, setDocuments] = useState<FitMindDocument[]>([]);
  const [dueFlashcards, setDueFlashcards] = useState<Flashcard[]>([]);
  const [readingStreak, setReadingStreak] = useState({ currentStreak: 0, longestStreak: 0, totalBooksCompleted: 0, totalPagesRead: 0, totalMinutesRead: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  // Add document modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [addingDoc, setAddingDoc] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importingFile, setImportingFile] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [docs, streak, flashcards] = await Promise.all([
        FitMindService.getDocuments(filter === 'ALL' ? undefined : filter as DocumentStatus),
        FitMindService.getReadingStreak(),
        FitMindService.getDueFlashcards(10),
      ]);
      setDocuments(docs);
      setReadingStreak(streak);
      setDueFlashcards(flashcards);
    } catch (e) {
      if (__DEV__) console.warn('[FitMind] Failed to load data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    if (dbReady) void loadData();
  }, [dbReady, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const handleAddDocument = async () => {
    if (!newTitle.trim()) {
      Alert.alert(t('fitmind.titleRequired'), t('fitmind.titleRequiredDetail'));
      return;
    }
    setAddingDoc(true);
    try {
      const wordCount = newContent.trim().split(/\s+/).filter(Boolean).length;
      const estimatedMinutes = Math.max(1, Math.round(wordCount / 200));
      const totalPages = Math.max(1, Math.ceil(wordCount / 250));

      await FitMindService.addDocument({
        id: generateId(),
        title: newTitle.trim(),
        author: 'Me',
        type: 'NOTE' as const,
        status: 'UNREAD' as const,
        category: newCategory || 'General',
        tags: '[]',
        file_path: null,
        file_size: newContent.length,
        total_pages: totalPages,
        current_page: 0,
        content: newContent.trim() || null,
        word_count: wordCount,
        reading_level: null,
        estimated_minutes: estimatedMinutes,
        cover_color: ['#10B981', '#3B82F6', '#8B5CF6', '#F4A427', '#EC4899'][Math.floor(Math.random() * 5)] ?? '#10B981',
      });

      setNewTitle('');
      setNewContent('');
      setNewCategory('General');
      setShowAddModal(false);
      loadData();
    } catch (e) {
      Alert.alert(t('common.error'), t('fitmind.addFailed'));
      if (__DEV__) console.warn('[FitMind] Add document error:', e);
    } finally {
      setAddingDoc(false);
    }
  };

  const handleDeleteDocument = (doc: FitMindDocument) => {
    Alert.alert(
      t('fitmind.deleteTitle'),
      t('fitmind.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await FitMindService.deleteDocument(doc.id);
              loadData();
            } catch (e) {
              if (__DEV__) console.warn('[FitMind] Delete error:', e);
            }
          },
        },
      ]
    );
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/epub+zip',
          'text/plain',
          'text/markdown',
          'text/html',
        ],
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets?.[0];
      if (!asset) return;
      setImportingFile(true);
      setImportProgress(0);

      const pipeline = new DocumentImportPipeline({
        onProgress: (progress: number) => setImportProgress(progress),
      });

      const importResult = await pipeline.importFile(asset.uri, {
        title: asset.name?.replace(/\.[^.]+$/, '') || 'Imported Document',
        category: newCategory || 'General',
      });

      if (importResult.success) {
        setShowAddModal(false);
        setNewTitle('');
        setNewContent('');
        setNewCategory('General');
        loadData();
        Alert.alert(t('fitmind.imported'), t('fitmind.importedDetail'));
      } else {
        Alert.alert(t('fitmind.importFailed'), importResult.error || t('fitmind.importFailedDetail'));
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('fitmind.importFailedDetail'));
      if (__DEV__) console.warn('[FitMind] Import file error:', e);
    } finally {
      setImportingFile(false);
      setImportProgress(0);
    }
  };

  const openReader = (docId: string) => {
    router.push({ pathname: '/fitmind-reader', params: { id: docId } });
  };

  const statusColor = (s: string) => (theme.colors as any)[STATUS_COLOR_KEYS[s] ?? 'textMuted'] || theme.colors.textMuted;

  const dynamicStyles = {
    surface: { backgroundColor: theme.colors.surface },
    border: { borderColor: theme.colors.border },
    input: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      borderColor: theme.colors.border,
    },
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginTop: 120 }} />
      </View>
    );
  }

  const listHeader = (
    <>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(200)}>
        <LinearGradient
          colors={[theme.colors.accent + '15', theme.colors.background] as [string, string]}
          style={styles.headerGradient}
        >
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="book-open-variant" size={22} color={theme.colors.accent} />
            <ThemedText variant="h2" color="primary">{t('fitmind.title')}</ThemedText>
            <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addBtn, { backgroundColor: theme.colors.accent + '20' }]}>
              <MaterialCommunityIcons name="plus" size={22} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
          <GlassCard style={styles.statCard} delay={0}>
            <ThemedText variant="h3" color="accent">{readingStreak.currentStreak}</ThemedText>
            <ThemedText variant="caption" color="muted">{t('fitmind.dayStreak')}</ThemedText>
          </GlassCard>
          <GlassCard style={styles.statCard} delay={50}>
            <ThemedText variant="h3" color="primary">{readingStreak.totalBooksCompleted}</ThemedText>
            <ThemedText variant="caption" color="muted">{t('fitmind.completed')}</ThemedText>
          </GlassCard>
          <GlassCard style={styles.statCard} delay={100}>
            <ThemedText variant="h3" color="primary">{readingStreak.totalPagesRead}</ThemedText>
            <ThemedText variant="caption" color="muted">{t('fitmind.pagesRead')}</ThemedText>
          </GlassCard>
          <GlassCard style={styles.statCard} delay={150}>
            <ThemedText variant="h3" color="primary">{dueFlashcards.length}</ThemedText>
            <ThemedText variant="caption" color="muted">{t('fitmind.cardsDue')}</ThemedText>
          </GlassCard>
        </View>

      {/* Filter Tabs */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.filterPill,
                  { backgroundColor: active ? theme.colors.accent + '20' : theme.colors.surface, borderColor: active ? theme.colors.accent : theme.colors.border },
                ]}
              >
                <MaterialCommunityIcons name={f.icon as any} size={14} color={active ? theme.colors.accent : theme.colors.textMuted} />
                <ThemedText variant="caption" color={active ? 'accent' : 'muted'}>{t(f.label)}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Document List Header */}
      <SectionHeader title={`Library (${documents.length})`} delay={200} />
    </>
  );

  const listEmpty = (
    <GlassCard style={styles.emptyCard}>
      <MaterialCommunityIcons name="book-plus" size={48} color={theme.colors.textMuted} />
      <ThemedText variant="body" color="muted" style={styles.emptyText}>
        {t('fitmind.noDocuments')}
      </ThemedText>
    </GlassCard>
  );

  return (
    <PremiumGate featureName="FitMind Library">
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenTutorial
        screenKey="fitmind"
        icon="book-open-page-variant"
        title="FitMind Library"
        description="Your cognitive fitness hub. Import documents, articles, and notes. Read, highlight, create flashcards, and chat with AI to deepen your understanding."
      />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <FlatList
          data={documents}
          renderItem={({ item: doc, index: idx }) => (
            <AnimatedListItem key={doc.id} index={idx} style={styles.docItemSpacing}>
              <TouchableOpacity
                onPress={() => openReader(doc.id)}
                onLongPress={() => handleDeleteDocument(doc)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${doc.title} by ${doc.author}, ${doc.status}`}
              >
                <View style={[styles.docCard, dynamicStyles.surface, dynamicStyles.border]}>
                  <View style={[styles.docColor, { backgroundColor: doc.cover_color || theme.colors.accent }]} />
                  <View style={styles.docInfo}>
                    <ThemedText variant="body" color="primary" style={styles.docTitle} numberOfLines={1}>
                      {doc.title}
                    </ThemedText>
                    <View style={styles.docMeta}>
                      <ThemedText variant="caption" color="muted">
                        {doc.author}
                      </ThemedText>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor(doc.status) + '20' }]}>
                        <ThemedText variant="caption" style={{ color: statusColor(doc.status), fontSize: 10 }}>
                          {doc.status}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.docStats}>
                      <ThemedText variant="caption" color="muted">
                        {doc.total_pages != null ? `${doc.current_page ?? 0}/${doc.total_pages}p` : ''}
                      </ThemedText>
                      {doc.estimated_minutes != null && doc.estimated_minutes > 0 ? (
                        <ThemedText variant="caption" color="muted">
                          {` · ${doc.estimated_minutes}min`}
                        </ThemedText>
                      ) : null}
                      {doc.category ? (
                        <ThemedText variant="caption" color="muted">
                          {` · ${doc.category}`}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          )}
          keyExtractor={(doc) => doc.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={<View style={styles.bottomSpacer} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        />

        {/* Add Document Modal */}
        <Modal visible={showAddModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
              <View style={styles.modalHeader}>
                <ThemedText variant="h3" color="primary">{t('fitmind.addDocument')}</ThemedText>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Import from device */}
              <TouchableOpacity
                style={[styles.importFileBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleImportFile}
                disabled={importingFile}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={importingFile ? 'loading' : 'file-document-outline'}
                  size={28}
                  color={theme.colors.accent}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" color="primary" style={{ fontWeight: '600' }}>
                    {importingFile ? `${t('fitmind.importing')} ${importProgress}%` : t('fitmind.importFromDevice')}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {t('fitmind.supportedFormats')}
                  </ThemedText>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>

              {importingFile && (
                <View style={[styles.progressBar, { backgroundColor: theme.colors.surface }]}>
                  <View style={[styles.progressFill, { width: `${importProgress}%`, backgroundColor: theme.colors.accent }]} />
                </View>
              )}

              <View style={[styles.dividerRow, { borderTopColor: theme.colors.border }]}>
                <ThemedText variant="caption" color="muted">{t('fitmind.orAddManually')}</ThemedText>
              </View>

              <ThemedText variant="caption" color="muted" style={styles.fieldLabel}>{t('fitmind.titleLabel')}</ThemedText>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder={t('fitmind.titlePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={200}
              />

              <ThemedText variant="caption" color="muted" style={styles.fieldLabel}>{t('fitmind.categoryLabel')}</ThemedText>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder={t('fitmind.categoryPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={newCategory}
                onChangeText={setNewCategory}
                maxLength={50}
              />

              <ThemedText variant="caption" color="muted" style={styles.fieldLabel}>{t('fitmind.contentLabel')}</ThemedText>
              <TextInput
                style={[styles.inputMulti, dynamicStyles.input]}
                placeholder={t('fitmind.contentPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={newContent}
                onChangeText={setNewContent}
                multiline
                maxLength={500000}
                textAlignVertical="top"
              />

              <GradientButton
                title={addingDoc ? t('fitmind.adding') : t('fitmind.addToLibrary')}
                variant="primary"
                size="lg"
                onPress={addingDoc ? () => {} : handleAddDocument}
                style={addingDoc ? { ...styles.addDocBtn, opacity: 0.6 } : styles.addDocBtn}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  headerGradient: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, minWidth: 70 },

  filterRow: { paddingHorizontal: 16, paddingVertical: 4, marginBottom: 12 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },

  emptyCard: { alignItems: 'center', padding: 32, marginHorizontal: 16 },
  emptyText: { textAlign: 'center', marginTop: 12, lineHeight: 20 },

  docItemSpacing: { marginHorizontal: 16, marginBottom: 8 },
  docCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  docColor: { width: 6, height: 48, borderRadius: 3 },
  docInfo: { flex: 1 },
  docTitle: { fontWeight: '600', marginBottom: 2 },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  docStats: { flexDirection: 'row', marginTop: 2 },

  bottomSpacer: { height: 40 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  fieldLabel: { marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 4 },
  inputMulti: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 4, minHeight: 120 },
  addDocBtn: { marginTop: 20 },

  // File import
  importFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  dividerRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 4,
    alignItems: 'center',
  },
});
