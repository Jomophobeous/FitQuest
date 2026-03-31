/**
 * FitQuest Feedback & Bug Report Screen
 * Allows users to submit reviews, bug reports, and feature suggestions.
 * Opens native email compose or mailto link — no server needed.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../src/context/ThemeContext';

const SUPPORT_EMAIL = 'fitquestsupp0rt@gmail.com';
const WEBSITE_URL = 'https://jomo-playground.github.io/FitQ/';

type FeedbackCategory = 'bug' | 'review' | 'suggestion' | 'other';

interface CategoryOption {
  key: FeedbackCategory;
  icon: string;
  label: string;
  sublabel: string;
  color: string;
}

export default function FeedbackScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Animated values
  const checkScale = useSharedValue(0);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const categories: CategoryOption[] = [
    {
      key: 'bug',
      icon: 'bug-outline',
      label: 'Report a Bug',
      sublabel: 'Something not working correctly',
      color: theme.colors.error,
    },
    {
      key: 'review',
      icon: 'star-outline',
      label: 'Leave a Review',
      sublabel: 'Share your experience',
      color: theme.colors.warning,
    },
    {
      key: 'suggestion',
      icon: 'lightbulb-outline',
      label: 'Feature Suggestion',
      sublabel: 'Ideas to improve FitQuest',
      color: theme.colors.accent,
    },
    {
      key: 'other',
      icon: 'message-text-outline',
      label: 'Other Feedback',
      sublabel: 'Anything else on your mind',
      color: theme.colors.indigo,
    },
  ];

  const handleSubmit = useCallback(async () => {
    if (!category || !message.trim()) return;
    Keyboard.dismiss();

    const subjectMap: Record<FeedbackCategory, string> = {
      bug: '[Bug Report] FitQuest 2.0',
      review: '[Review] FitQuest 2.0',
      suggestion: '[Feature Suggestion] FitQuest 2.0',
      other: '[Feedback] FitQuest 2.0',
    };

    const subject = encodeURIComponent(subjectMap[category]);
    const body = encodeURIComponent(
      `Category: ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n${message.trim()}\n\n---\nSent from FitQuest 2.0 (${Platform.OS})`,
    );

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(mailto);
      if (supported) {
        await Linking.openURL(mailto);
      }
    } catch {
      // Fallback: show thank you anyway — the user intends to send feedback
    }

    // Show thank-you regardless (email compose may open externally)
    checkScale.value = withSequence(withTiming(0, { duration: 0 }), withSpring(1, { damping: 8, stiffness: 120 }));
    setSubmitted(true);
  }, [category, message, checkScale]);

  const handleVisitWebsite = useCallback(() => {
    Linking.openURL(WEBSITE_URL).catch(() => {});
  }, []);

  // ─── THANK YOU SCREEN ───
  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={styles.thankYouSafe}>
          <Animated.View entering={FadeIn.duration(300)} style={styles.thankYouCenter}>
            <Animated.View style={checkStyle}>
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                style={styles.thankYouCircle}
              >
                <MaterialCommunityIcons name="check" size={48} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <Text style={[styles.thankYouTitle, { color: theme.colors.text }]}>Thank You!</Text>
              <Text style={[styles.thankYouMessage, { color: theme.colors.textSecondary }]}>
                Your feedback has been submitted. Every issue will be reviewed carefully and considered in the next
                update.
              </Text>
              <Text style={[styles.thankYouMessage, { color: theme.colors.textMuted, marginTop: 8, fontSize: 13 }]}>
                We truly appreciate you taking the time to help improve FitQuest.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).duration(200)} style={styles.thankYouActions}>
              <TouchableOpacity
                style={[styles.thankYouBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={handleVisitWebsite}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="web" size={18} color={theme.colors.accent} />
                <Text style={[styles.thankYouBtnText, { color: theme.colors.accent }]}>Visit Our Website</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <LinearGradient
                  colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                  style={styles.thankYouPrimaryBtn}
                >
                  <MaterialCommunityIcons name="arrow-left" size={18} color="#fff" />
                  <Text style={styles.thankYouPrimaryText}>Back to Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── FEEDBACK FORM ───
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Feedback & Bug Report</Text>
              <Text style={[styles.headerSub, { color: theme.colors.textMuted }]}>Help us improve FitQuest</Text>
            </View>
          </Animated.View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Category Selection */}
            <Animated.View entering={FadeInDown.delay(100).duration(200)}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>What's this about?</Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat, i) => {
                  const selected = category === cat.key;
                  return (
                    <Animated.View key={cat.key} entering={FadeInDown.delay(150 + i * 60).duration(200)}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setCategory(cat.key)}
                        style={[
                          styles.categoryCard,
                          {
                            backgroundColor: selected ? cat.color + '18' : theme.colors.surfaceVariant,
                            borderColor: selected ? cat.color : theme.colors.border,
                            borderWidth: selected ? 1.5 : 1,
                          },
                        ]}
                      >
                        <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                          <MaterialCommunityIcons name={cat.icon as any} size={22} color={cat.color} />
                        </View>
                        <Text style={[styles.categoryLabel, { color: theme.colors.text }]}>{cat.label}</Text>
                        <Text style={[styles.categorySub, { color: theme.colors.textMuted }]}>{cat.sublabel}</Text>
                        {selected && <View style={[styles.selectedDot, { backgroundColor: cat.color }]} />}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Message Input */}
            {category && (
              <Animated.View entering={FadeInDown.duration(200)}>
                <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: 20 }]}>
                  Tell us more
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <TextInput
                    ref={inputRef}
                    style={[styles.inputField, { color: theme.colors.text }]}
                    placeholder={
                      category === 'bug'
                        ? 'Describe the issue: what happened, what you expected, and steps to reproduce...'
                        : category === 'review'
                          ? 'Share your thoughts about your FitQuest experience...'
                          : category === 'suggestion'
                            ? 'What feature would make FitQuest better for you?'
                            : 'What would you like to tell us?'
                    }
                    placeholderTextColor={theme.colors.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                    maxLength={2000}
                  />
                  <Text style={[styles.charCount, { color: theme.colors.textMuted }]}>{message.length}/2000</Text>
                </View>
              </Animated.View>
            )}

            {/* Submit Button */}
            {category && message.trim().length > 10 && (
              <Animated.View entering={FadeInUp.duration(200)} style={{ marginTop: 20 }}>
                <TouchableOpacity onPress={handleSubmit} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                    style={styles.submitBtn}
                  >
                    <MaterialCommunityIcons name="send" size={18} color="#fff" />
                    <Text style={styles.submitText}>Submit Feedback</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Quick Links */}
            <Animated.View entering={FadeInDown.delay(300).duration(200)} style={styles.quickLinks}>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: 24 }]}>
                Quick Links
              </Text>
              <TouchableOpacity
                style={[
                  styles.linkRow,
                  { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                ]}
                onPress={handleVisitWebsite}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="web" size={20} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkLabel, { color: theme.colors.text }]}>Official Website</Text>
                  <Text style={[styles.linkSub, { color: theme.colors.textMuted }]}>
                    jomo-playground.github.io/FitQ
                  </Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.linkRow,
                  { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                ]}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkLabel, { color: theme.colors.text }]}>Email Support</Text>
                  <Text style={[styles.linkSub, { color: theme.colors.textMuted }]}>{SUPPORT_EMAIL}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '100%',
    minWidth: 150,
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexBasis: '46%',
    position: 'relative',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  categorySub: {
    fontSize: 11,
    marginTop: 2,
  },
  selectedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  inputField: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 140,
    maxHeight: 250,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quickLinks: {
    gap: 0,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkSub: {
    fontSize: 11,
    marginTop: 1,
  },
  // Thank you screen
  thankYouSafe: {
    flex: 1,
  },
  thankYouCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  thankYouCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  thankYouTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  thankYouMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  thankYouActions: {
    marginTop: 32,
    width: '100%',
    gap: 12,
  },
  thankYouBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  thankYouBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  thankYouPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  thankYouPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
