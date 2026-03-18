/**
 * FitQuest AI Professor Screen
 * Standalone scholarly AI chat for learning, reading comprehension,
 * Socratic dialogue, and knowledge exploration.
 * Uses the DualAIEngine PROFESSOR personality.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Dimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import SimpleMarkdown from '../../src/components/SimpleMarkdown';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { PulseDot } from '../../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { dualAI, type AIResponse, type AIContext } from '../../src/fitmind/DualAIEngine';
import { encryptedDB } from '../../src/security/EncryptedDatabase';
import { useDatabase } from '../../src/context/DatabaseContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_MESSAGE_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 420);

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  id: string;
  role: 'professor' | 'user';
  text: string;
  timestamp: Date;
  suggestions?: string[];
}

// ============================================
// TYPING INDICATOR
// ============================================

function TypingIndicator() {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.messageBubble, styles.professorBubble, {
        backgroundColor: theme.colors.surfaceVariant,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 16,
        paddingHorizontal: 18,
      }]}
    >
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(i * 200)}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: theme.colors.accent2 || theme.colors.accent,
            opacity: 0.5 + (i * 0.15),
          }}
        />
      ))}
    </Animated.View>
  );
}

// ============================================
// MESSAGE BUBBLE
// ============================================

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const { theme } = useTheme();
  const isProfessor = message.role === 'professor';

  return (
    <Animated.View
      entering={isProfessor
        ? FadeInRight.delay(index > 10 ? 0 : 50).duration(200)
        : FadeIn.duration(150)
      }
      style={[
        styles.messageBubble,
        isProfessor ? [styles.professorBubble, { backgroundColor: theme.colors.surfaceVariant }] : styles.userBubble,
      ]}
    >
      {isProfessor && (
        <View style={styles.professorAvatarRow}>
          <LinearGradient
            colors={[theme.colors.purple, theme.colors.indigo] as [string, string]}
            style={styles.professorAvatarIcon}
          >
            <MaterialCommunityIcons name="school" size={12} color={theme.colors.onAccent} />
          </LinearGradient>
          <Text style={[styles.professorLabel, { color: theme.colors.purple }]}>Professor</Text>
        </View>
      )}
      {isProfessor ? (
        <View>
          <SimpleMarkdown
            text={message.text}
            style={[styles.messageText, { color: theme.colors.text }]}
            boldStyle={{ color: theme.colors.purple }}
          />
        </View>
      ) : (
        <LinearGradient
          colors={[theme.colors.purple, theme.colors.indigo] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubbleGradient}
        >
          <Text style={[styles.messageText, { color: theme.colors.onAccent }]}>{message.text}</Text>
        </LinearGradient>
      )}
      <Text style={[styles.timestamp, { color: theme.colors.textMuted }]}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </Animated.View>
  );
}

// ============================================
// SCREEN
// ============================================

function ProfessorScreenInner() {
  const { theme } = useTheme();
  const { t, language, languageName } = useLanguage();
  const { isReady: dbReady } = useDatabase();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputScale = useSharedValue(1);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  useEffect(() => {
    if (dbReady) loadGreeting();
  }, [dbReady]);

  // Handle Android hardware back button on flat Tabs navigator
  useEffect(() => {
    const backAction = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/dashboard');
      }
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadGreeting = async () => {
    try {
      const response = await dualAI.query('hello', {
        personality: 'PROFESSOR',
        conversationHistory: [],
        language,
        languageName,
      });

      setMessages([{
        id: 'greeting',
        role: 'professor',
        text: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions,
      }]);

      if (response.suggestions?.length) {
        setActiveSuggestions(response.suggestions);
      }
    } catch {
      setMessages([{
        id: 'greeting',
        role: 'professor',
        text: "Welcome, scholar! I'm your Professor — here to help you think deeply, analyze ideas, and expand your understanding. Ask me about anything you're reading, learning, or curious about. 📚",
        timestamp: new Date(),
      }]);
    }
    // Load past conversation history
    try {
      const history = await encryptedDB.getAIConversations('PROFESSOR', 20);
      if (history.length > 0) {
        const pastMessages: ChatMessage[] = [];
        const pastHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        for (const entry of history.reverse()) {
          pastMessages.push({
            id: `hist_user_${entry.created_at}`,
            role: 'user',
            text: entry.query,
            timestamp: new Date(entry.created_at),
          });
          pastMessages.push({
            id: `hist_prof_${entry.created_at}`,
            role: 'professor',
            text: entry.response,
            timestamp: new Date(entry.created_at),
          });
          pastHistory.push({ role: 'user', content: entry.query });
          pastHistory.push({ role: 'assistant', content: entry.response });
        }
        setMessages(prev => [...prev, ...pastMessages]);
        setConversationHistory(pastHistory);
      }
    } catch (e) {
      console.warn('[Professor] Failed to load conversation history:', e);
    }  };

  const sendMessageWithText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setActiveSuggestions([]);

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: text },
    ];

    try {
      const context: AIContext = {
        personality: 'PROFESSOR',
        conversationHistory: updatedHistory.slice(-10),
        language,
        languageName,
      };

      const response = await dualAI.query(text, context);

      const professorMsg: ChatMessage = {
        id: `professor_${Date.now()}`,
        role: 'professor',
        text: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions,
      };

      setMessages(prev => [...prev, professorMsg]);
      setConversationHistory([
        ...updatedHistory,
        { role: 'assistant', content: response.message },
      ]);

      encryptedDB.storeAIConversation('PROFESSOR', text, response.message).catch(e =>
        console.warn('[Professor] Failed to persist conversation:', e)
      );

      if (response.suggestions?.length) {
        setActiveSuggestions(response.suggestions);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `professor_err_${Date.now()}`,
        role: 'professor',
        text: "I apologize — I encountered an issue processing your question. Could you rephrase it?",
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [conversationHistory, language, languageName]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    sendMessageWithText(text);
  }, [input, sendMessageWithText]);

  const handleSuggestion = useCallback((text: string) => {
    setInput(text);
    // Defer to allow React to flush the input state, then trigger send
    setTimeout(() => {
      sendMessageWithText(text);
    }, 50);
  }, [conversationHistory, language, languageName]);

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const quickSuggestions = [
    { text: "Explain a concept to me simply", icon: 'lightbulb-on-outline' as const },
    { text: "Help me understand this book", icon: 'book-open-page-variant' as const },
    { text: "Quiz me on a topic", icon: 'head-question' as const },
    { text: "Summarize an idea for me", icon: 'text-box-outline' as const },
    { text: "Play devil's advocate", icon: 'scale-balance' as const },
    { text: "Teach me about fitness science", icon: 'flask-outline' as const },
    { text: "How does muscle growth work?", icon: 'arm-flex' as const },
    { text: "Explain sleep and recovery", icon: 'sleep' as const },
    { text: "Nutrition science basics", icon: 'food-apple-outline' as const },
    { text: "History of exercise", icon: 'history' as const },
    { text: "Study technique tips", icon: 'brain' as const },
    { text: "Create flashcards from a topic", icon: 'cards-outline' as const },
  ];

  const suggestionColors = [
    theme.colors.purple, theme.colors.indigo, theme.colors.purpleLight, theme.colors.purple,
    theme.colors.indigo, theme.colors.purpleLight, theme.colors.purple, theme.colors.indigo,
    theme.colors.accent, theme.colors.accent, theme.colors.skyBlue, theme.colors.blue,
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── HEADER ── */}
        <Animated.View entering={FadeInDown.duration(150)}>
          <LinearGradient
            colors={theme.isDark
              ? [theme.colors.purple + '33', theme.colors.purple + '0D', 'transparent'] as [string, string, string]
              : [theme.colors.purple + '1A', theme.colors.purple + '05', 'transparent'] as [string, string, string]}
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}
                style={[styles.headerBackBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <LinearGradient
                  colors={[theme.colors.purple, theme.colors.indigo] as [string, string]}
                  style={styles.headerAvatar}
                >
                  <MaterialCommunityIcons name="school" size={22} color={theme.colors.onAccent} />
                </LinearGradient>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Professor</Text>
                    <View style={{ backgroundColor: theme.colors.purple + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: theme.colors.purple, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>BETA</Text>
                    </View>
                  </View>
                  <View style={styles.headerStatusRow}>
                    <PulseDot color={theme.colors.purple} size={6} />
                    <Text style={[styles.headerStatus, { color: theme.colors.purple }]}>Scholarly mode</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/fitmind-library' as any)}
                style={[styles.headerBackBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <MaterialCommunityIcons name="bookshelf" size={18} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          {/* ── MESSAGES ── */}
          <FlatList
            ref={scrollRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <MessageBubble key={item.id} message={item} index={index} />
            )}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={7}
            ListHeaderComponent={
              <Animated.View entering={FadeIn.delay(200)} style={styles.dateBadgeWrap}>
                <View style={[styles.dateBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.dateBadgeText, { color: theme.colors.textMuted }]}>
                    Today
                  </Text>
                </View>
              </Animated.View>
            }
            ListFooterComponent={
              <>
                {isTyping && <TypingIndicator />}

                {/* Quick Suggestions (show after greeting) */}
                {messages.length <= 1 && !isTyping && (
                  <Animated.View entering={FadeInUp.delay(150).duration(150)} style={styles.suggestionsWrap}>
                    <Text style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                      What would you like to explore?
                    </Text>
                    <View style={styles.suggestionsGrid}>
                      {quickSuggestions.map((suggestion, idx) => (
                        <Animated.View
                          key={suggestion.text}
                          entering={FadeInDown.delay(180 + idx * 30).duration(150)}
                        >
                          <TouchableOpacity
                            style={[styles.suggestionChip, {
                              backgroundColor: theme.colors.surfaceVariant,
                              borderColor: theme.colors.border,
                            }]}
                            activeOpacity={0.7}
                            onPress={() => handleSuggestion(suggestion.text)}
                          >
                            <View style={[styles.suggestionIcon, { backgroundColor: suggestionColors[idx % suggestionColors.length] + '20' }]}>
                              <MaterialCommunityIcons
                                name={suggestion.icon}
                                size={16}
                                color={suggestionColors[idx % suggestionColors.length]}
                              />
                            </View>
                            <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
                              {suggestion.text}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      ))}
                    </View>
                  </Animated.View>
                )}

                {/* Follow-up suggestions */}
                {activeSuggestions.length > 0 && messages.length > 1 && !isTyping && (
                  <Animated.View entering={FadeInUp.delay(100).duration(150)} style={styles.followUpWrap}>
                    <Text style={[styles.suggestionsLabel, { color: theme.colors.textMuted }]}>
                      Continue exploring
                    </Text>
                    <View style={styles.followUpRow}>
                      {activeSuggestions.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.followUpChip, {
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: theme.colors.border,
                          }]}
                          activeOpacity={0.7}
                          onPress={() => handleSuggestion(s)}
                        >
                          <Text style={[styles.followUpText, { color: theme.colors.purple }]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Animated.View>
                )}
              </>
            }
          />

          {/* ── INPUT BAR ── */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(150)}
            style={[styles.inputBarWrap, {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
              paddingBottom: Math.max(12, insets.bottom + 8),
              marginBottom: Platform.OS === 'android' ? Math.max(0, keyboardHeight - 10) : 0,
            }]}
          >
            <View style={[styles.inputRow, {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.border,
            }]}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Ask the Professor anything..."
                placeholderTextColor={theme.colors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline={false}
              />
              <Animated.View style={sendAnimatedStyle}>
                <TouchableOpacity
                  onPress={sendMessage}
                  disabled={!input.trim()}
                  onPressIn={() => { inputScale.value = withTiming(0.92, { duration: 120 }); }}
                  onPressOut={() => { inputScale.value = withTiming(1, { duration: 120 }); }}
                  activeOpacity={1}
                >
                  <LinearGradient
                    colors={input.trim()
                      ? [theme.colors.purple, theme.colors.indigo] as [string, string]
                      : [theme.colors.surfaceVariant, theme.colors.surface] as [string, string]
                    }
                    style={styles.sendButton}
                  >
                    <MaterialCommunityIcons name="send" size={18} color={theme.colors.onAccent} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerGradient: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBackBtn: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  headerStatus: { fontSize: 11, fontWeight: '600' },

  // Messages
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  dateBadgeWrap: { alignItems: 'center', marginBottom: 16 },
  dateBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  dateBadgeText: { fontSize: 11, fontWeight: '600' },
  messageBubble: { maxWidth: MAX_MESSAGE_WIDTH, marginBottom: 12 },
  professorBubble: { alignSelf: 'flex-start', padding: 14, borderRadius: 18, borderBottomLeftRadius: 6 },
  professorAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  professorAvatarIcon: { width: 20, height: 20, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  professorLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  userBubble: { alignSelf: 'flex-end' },
  userBubbleGradient: { padding: 14, borderRadius: 18, borderBottomRightRadius: 6 },
  messageText: { fontSize: 14.5, lineHeight: 21, fontWeight: '400' },
  timestamp: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

  // Suggestions
  suggestionsWrap: { marginTop: 8 },
  suggestionsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 10, letterSpacing: 0.3 },
  suggestionsGrid: { gap: 8 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  suggestionIcon: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  suggestionText: { fontSize: 13.5, fontWeight: '500' },

  // Follow-up
  followUpWrap: { marginTop: 8, marginBottom: 8 },
  followUpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  followUpChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  followUpText: { fontSize: 13, fontWeight: '600' },

  // Input
  inputBarWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 16, borderTopWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 24, borderWidth: 1 },
  textInput: { flex: 1, fontSize: 15, paddingVertical: 10, paddingHorizontal: 14, maxHeight: 100 },
  sendButton: { width: 38, height: 38, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});

export default function ProfessorScreen() {
  const router = useRouter();
  const handleBack = () => router.canGoBack() ? router.back() : router.replace('/dashboard');
  return (
    <ScreenErrorBoundary screenName="AI Professor" onGoBack={handleBack}>
      <ProfessorScreenInner />
    </ScreenErrorBoundary>
  );
}
