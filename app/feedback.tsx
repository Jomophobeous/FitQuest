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
  TouchableOpacity,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../src/components/ui/primitives';
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
import ThemedText from '../src/components/ThemedText';
import { typography, spacing, radius } from '../src/design/theme-system';


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
      <ScreenContainer>
          <Animated.View entering={FadeIn.duration(300)} style={styles.thankYouCenter}>
            <Animated.View style={checkStyle}>
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                style={styles.thankYouCircle}
              >
                <MaterialCommunityIcons name="check" size={48} color={theme.colors.onAccent} />
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <ThemedText style={[styles.thankYouTitle, { color: theme.colors.text }]}>Thank You!</ThemedText>
              <ThemedText style={[styles.thankYouMessage, { color: theme.colors.textSecondary }]}>
                Your feedback has been submitted. Every issue will be reviewed carefully and considered in the next
                update.
              </ThemedText>
              <ThemedText style={[styles.thankYouMessage, { color: theme.colors.textMuted, marginTop: spacing[2], fontSize: typography.sizes.label }]}>
                We truly appreciate you taking the time to help improve FitQuest.
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).duration(200)} style={styles.thankYouActions}>
              <TouchableOpacity
                style={[styles.thankYouBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={handleVisitWebsite}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel="Visit our website"
              >
                <MaterialCommunityIcons name="web" size={18} color={theme.colors.accent} />
                <ThemedText style={[styles.thankYouBtnText, { color: theme.colors.accent }]}>Visit Our Website</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Back to profile">
                <LinearGradient
                  colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                  style={styles.thankYouPrimaryBtn}
                >
                  <MaterialCommunityIcons name="arrow-left" size={18} color={theme.colors.onAccent} />
                  <ThemedText style={[styles.thankYouPrimaryText, { color: theme.colors.onAccent }]}>Back to Profile</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
      </ScreenContainer>
    );
  }

  // ─── FEEDBACK FORM ───
  return (
    <ScreenContainer>
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
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.headerTitle, { color: theme.colors.text }]}>Feedback & Bug Report</ThemedText>
              <ThemedText style={[styles.headerSub, { color: theme.colors.textMuted }]}>Help us improve FitQuest</ThemedText>
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
              <ThemedText style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>What's this about?</ThemedText>
              <View style={styles.categoryGrid}>
                {categories.map((cat, i) => {
                  const selected = category === cat.key;
                  return (
                    <Animated.View key={cat.key} entering={FadeInDown.delay(150 + i * 60).duration(200)}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setCategory(cat.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`${cat.label} category${selected ? ', selected' : ''}`}
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
                        <ThemedText style={[styles.categoryLabel, { color: theme.colors.text }]}>{cat.label}</ThemedText>
                        <ThemedText style={[styles.categorySub, { color: theme.colors.textMuted }]}>{cat.sublabel}</ThemedText>
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
                <ThemedText style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: spacing[5] }]}>
                  Tell us more
                </ThemedText>
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
                  <ThemedText style={[styles.charCount, { color: theme.colors.textMuted }]}>{message.length}/2000</ThemedText>
                </View>
              </Animated.View>
            )}

            {/* Submit Button */}
            {category && message.trim().length > 10 && (
              <Animated.View entering={FadeInUp.duration(200)} style={{ marginTop: spacing[5] }}>
                <TouchableOpacity onPress={handleSubmit} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Submit feedback">
                  <LinearGradient
                    colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
                    style={styles.submitBtn}
                  >
                    <MaterialCommunityIcons name="send" size={18} color={theme.colors.onAccent} />
                    <ThemedText style={[styles.submitText, { color: theme.colors.onAccent }]}>Submit Feedback</ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Quick Links */}
            <Animated.View entering={FadeInDown.delay(300).duration(200)} style={styles.quickLinks}>
              <ThemedText style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: spacing[6] }]}>
                Quick Links
              </ThemedText>
              <TouchableOpacity
                style={[
                  styles.linkRow,
                  { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                ]}
                onPress={handleVisitWebsite}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel="Visit official website"
              >
                <MaterialCommunityIcons name="web" size={20} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.linkLabel, { color: theme.colors.text }]}>Official Website</ThemedText>
                  <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>
                    jomo-playground.github.io/FitQ
                  </ThemedText>
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
                accessibilityRole="link"
                accessibilityLabel="Email support"
              >
                <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.linkLabel, { color: theme.colors.text }]}>Email Support</ThemedText>
                  <ThemedText style={[styles.linkSub, { color: theme.colors.textMuted }]}>{SUPPORT_EMAIL}</ThemedText>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.h3, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: typography.sizes.caption, 
    marginTop: spacing['px'],
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
  },
  sectionLabel: {
    fontSize: typography.sizes.label, 
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing[2.5],
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2.5],
  },
  categoryCard: {
    width: '100%',
    minWidth: 150,
    flex: 1,
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[3.5],
    borderRadius: 14,
    flexBasis: '46%',
    position: 'relative',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  categoryLabel: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '600',
  },
  categorySub: {
    fontSize: typography.sizes.captionSm, 
    marginTop: spacing[0.5],
  },
  selectedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: radius.sm,
  },
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing[3.5],
  },
  inputField: {
    fontSize: typography.sizes.bodyMid, 
    lineHeight: 22,
    minHeight: 140,
    maxHeight: 250,
  },
  charCount: {
    fontSize: typography.sizes.captionSm, 
    textAlign: 'right',
    marginTop: spacing[1.5],
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: 14,
  },
  submitText: {
    color: '#FAFAFA',
    fontSize: typography.sizes.body, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quickLinks: {
    gap: spacing[0],
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3.5],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing[2],
  },
  linkLabel: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '600',
  },
  linkSub: {
    fontSize: typography.sizes.captionSm, 
    marginTop: spacing['px'],
  },
  // Thank you screen
  thankYouSafe: {
    flex: 1,
  },
  thankYouCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  thankYouCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  thankYouTitle: {
    fontSize: typography.sizes.h1Sm, 
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  thankYouMessage: {
    fontSize: typography.sizes.bodyMid, 
    lineHeight: 22,
    textAlign: 'center',
  },
  thankYouActions: {
    marginTop: spacing[8],
    width: '100%',
    gap: spacing[3],
  },
  thankYouBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderRadius: 14,
  },
  thankYouBtnText: {
    fontSize: typography.sizes.bodyMid, 
    fontWeight: '600',
  },
  thankYouPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: 14,
  },
  thankYouPrimaryText: {
    color: '#FAFAFA',
    fontSize: typography.sizes.body, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
