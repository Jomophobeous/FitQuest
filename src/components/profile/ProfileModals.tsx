/**
 * Profile modals extracted from profile.tsx:
 * - ScheduleModal   (work schedule editor)
 * - HelpModal       (help & support info)
 * - AboutModal      (app information)
 */

import React from 'react';
import { View, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemedText from '../ThemedText';
import { GradientButton } from '../ui/GlassUI';
import { modalStyles } from './ProfileParts';
import { typography, spacing, radius } from '../../design/theme-system';

// ─── Schedule Modal ──────────────────────────────────────
interface ScheduleEdit {
  startHour: number;
  endHour: number;
  shiftType: 'day' | 'night' | 'rotating';
  commute: number;
}

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  scheduleEdit: ScheduleEdit;
  setScheduleEdit: React.Dispatch<React.SetStateAction<ScheduleEdit>>;
  onSave: () => void;
}

export function ScheduleModal({ visible, onClose, scheduleEdit, setScheduleEdit, onSave }: ScheduleModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable
          style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText style={[modalStyles.title, { color: theme.colors.text }]}>Work Schedule</ThemedText>
          <ThemedText style={[modalStyles.subtitle, { color: theme.colors.textMuted }]}>
            Configure your work hours for optimal training suggestions
          </ThemedText>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Start Time */}
            <ThemedText
              style={{
                color: theme.colors.textSecondary,
                fontSize: typography.sizes.caption,
                fontWeight: '600',
                marginBottom: spacing[1.5],
                marginTop: spacing[3],
              }}
            >
              START TIME
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
              {Array.from({ length: 17 }, (_, i) => i + 5).map((h) => (
                <TouchableOpacity
                  key={`start-${h}`}
                  onPress={() =>
                    setScheduleEdit((prev) => ({
                      ...prev,
                      startHour: h,
                      endHour: Math.max(prev.endHour, h + 1),
                    }))
                  }
                  style={{
                    paddingHorizontal: spacing[3.5],
                    paddingVertical: spacing[2],
                    borderRadius: radius.lg,
                    marginRight: spacing[1.5],
                    backgroundColor:
                      scheduleEdit.startHour === h ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                    borderWidth: scheduleEdit.startHour === h ? 1 : 0,
                    borderColor: theme.colors.accent,
                  }}
                >
                  <ThemedText
                    style={{
                      color: scheduleEdit.startHour === h ? theme.colors.accent : theme.colors.text,
                      fontSize: typography.sizes.label,
                      fontWeight: '600',
                    }}
                  >
                    {h.toString().padStart(2, '0')}:00
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* End Time */}
            <ThemedText
              style={{
                color: theme.colors.textSecondary,
                fontSize: typography.sizes.caption,
                fontWeight: '600',
                marginBottom: spacing[1.5],
              }}
            >
              END TIME
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
              {Array.from({ length: 17 }, (_, i) => i + 5)
                .filter((h) => h > scheduleEdit.startHour)
                .map((h) => (
                  <TouchableOpacity
                    key={`end-${h}`}
                    onPress={() => setScheduleEdit((prev) => ({ ...prev, endHour: h }))}
                    style={{
                      paddingHorizontal: spacing[3.5],
                      paddingVertical: spacing[2],
                      borderRadius: radius.lg,
                      marginRight: spacing[1.5],
                      backgroundColor:
                        scheduleEdit.endHour === h ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                      borderWidth: scheduleEdit.endHour === h ? 1 : 0,
                      borderColor: theme.colors.accent,
                    }}
                  >
                    <ThemedText
                      style={{
                        color: scheduleEdit.endHour === h ? theme.colors.accent : theme.colors.text,
                        fontSize: typography.sizes.label,
                        fontWeight: '600',
                      }}
                    >
                      {h.toString().padStart(2, '0')}:00
                    </ThemedText>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Shift Type */}
            <ThemedText
              style={{
                color: theme.colors.textSecondary,
                fontSize: typography.sizes.caption,
                fontWeight: '600',
                marginBottom: spacing[1.5],
              }}
            >
              SHIFT TYPE
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] }}>
              {(['day', 'night', 'rotating'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setScheduleEdit((prev) => ({ ...prev, shiftType: s }))}
                  style={{
                    flex: 1,
                    paddingVertical: spacing[2.5],
                    borderRadius: radius.lg,
                    alignItems: 'center',
                    backgroundColor:
                      scheduleEdit.shiftType === s ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                    borderWidth: scheduleEdit.shiftType === s ? 1 : 0,
                    borderColor: theme.colors.accent,
                  }}
                >
                  <MaterialCommunityIcons
                    name={s === 'day' ? 'weather-sunny' : s === 'night' ? 'weather-night' : 'sync'}
                    size={18}
                    color={scheduleEdit.shiftType === s ? theme.colors.accent : theme.colors.textMuted}
                  />
                  <ThemedText
                    style={{
                      color: scheduleEdit.shiftType === s ? theme.colors.accent : theme.colors.text,
                      fontSize: typography.sizes.caption,
                      fontWeight: '600',
                      marginTop: spacing[1],
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Commute */}
            <ThemedText
              style={{
                color: theme.colors.textSecondary,
                fontSize: typography.sizes.caption,
                fontWeight: '600',
                marginBottom: spacing[1.5],
              }}
            >
              COMMUTE (minutes)
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[4] }}>
              {[0, 10, 15, 20, 30, 45, 60, 90].map((m) => (
                <TouchableOpacity
                  key={`com-${m}`}
                  onPress={() => setScheduleEdit((prev) => ({ ...prev, commute: m }))}
                  style={{
                    paddingHorizontal: spacing[3.5],
                    paddingVertical: spacing[2],
                    borderRadius: radius.lg,
                    marginRight: spacing[1.5],
                    backgroundColor:
                      scheduleEdit.commute === m ? theme.colors.accent + '25' : theme.colors.surfaceVariant,
                    borderWidth: scheduleEdit.commute === m ? 1 : 0,
                    borderColor: theme.colors.accent,
                  }}
                >
                  <ThemedText
                    style={{
                      color: scheduleEdit.commute === m ? theme.colors.accent : theme.colors.text,
                      fontSize: typography.sizes.label,
                      fontWeight: '600',
                    }}
                  >
                    {m === 0 ? 'None' : `${m} min`}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>

          <GradientButton title="Save Schedule" variant="primary" onPress={onSave} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Help Modal ──────────────────────────────────────────
interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HelpModal({ visible, onClose }: HelpModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable
          style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: theme.colors.warning + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[3],
              }}
            >
              <MaterialCommunityIcons name="help-circle-outline" size={28} color={theme.colors.warning} />
            </View>
            <ThemedText style={[modalStyles.title, { color: theme.colors.text }]}>
              {t('profile.helpSupport')}
            </ThemedText>
          </View>

          <View style={{ gap: spacing[3], marginBottom: spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
              <MaterialCommunityIcons name="frequently-asked-questions" size={20} color={theme.colors.accent} />
              <View style={{ flex: 1 }}>
                <ThemedText
                  style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}
                >
                  {t('help.faqTitle')}
                </ThemedText>
                <ThemedText
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: typography.sizes.caption,
                    marginTop: spacing[0.5],
                  }}
                >
                  {t('help.faqDesc')}
                </ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
              <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.accent2} />
              <View style={{ flex: 1 }}>
                <ThemedText
                  style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}
                >
                  {t('help.contactTitle')}
                </ThemedText>
                <ThemedText
                  style={{
                    color: theme.colors.accent,
                    fontSize: typography.sizes.caption,
                    marginTop: spacing[0.5],
                  }}
                >
                  fitquestsupp0rt@gmail.com
                </ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
              <MaterialCommunityIcons name="bug-outline" size={20} color={theme.colors.error} />
              <View style={{ flex: 1 }}>
                <ThemedText
                  style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}
                >
                  {t('help.bugTitle')}
                </ThemedText>
                <ThemedText
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: typography.sizes.caption,
                    marginTop: spacing[0.5],
                  }}
                >
                  {t('help.bugDesc')}
                </ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
              <MaterialCommunityIcons name="lightbulb-outline" size={20} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <ThemedText
                  style={{ color: theme.colors.text, fontSize: typography.sizes.bodySmall, fontWeight: '600' }}
                >
                  {t('help.featureTitle')}
                </ThemedText>
                <ThemedText
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: typography.sizes.caption,
                    marginTop: spacing[0.5],
                  }}
                >
                  {t('help.featureDesc')}
                </ThemedText>
              </View>
            </View>
          </View>

          <ThemedText
            style={{
              color: theme.colors.textMuted,
              fontSize: typography.sizes.captionSm,
              textAlign: 'center',
              marginBottom: spacing[3],
            }}
          >
            {t('help.responseTime')}
          </ThemedText>

          <TouchableOpacity
            style={[modalStyles.cancelBtn, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <ThemedText style={[modalStyles.cancelText, { color: theme.colors.accent }]}>
              {t('common.close')}
            </ThemedText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── About Modal ─────────────────────────────────────────
interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AboutModal({ visible, onClose }: AboutModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable
          style={[modalStyles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
            <LinearGradient
              colors={[theme.colors.accent, theme.colors.indigo] as [string, string]}
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.xl,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[3],
              }}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={32} color={theme.colors.onAccent} />
            </LinearGradient>
            <ThemedText style={[modalStyles.title, { color: theme.colors.text }]}>FitQuest 2.0</ThemedText>
            <ThemedText
              style={{ color: theme.colors.textMuted, fontSize: typography.sizes.label, marginTop: spacing[0.5] }}
            >
              {t('profile.version')} 1.0.0
            </ThemedText>
          </View>

          <ThemedText
            style={{
              color: theme.colors.textSecondary,
              fontSize: typography.sizes.label,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: spacing[4],
            }}
          >
            {t('about.description')}
          </ThemedText>

          <View style={{ gap: spacing[2], marginBottom: spacing[4] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>
                {t('about.platform')}
              </ThemedText>
              <ThemedText style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                React Native / Expo
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>
                {t('about.dataStorage')}
              </ThemedText>
              <ThemedText style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                {t('about.onDevice')}
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>
                {t('about.encryption')}
              </ThemedText>
              <ThemedText style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                AES-256-GCM
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText style={{ color: theme.colors.textMuted, fontSize: typography.sizes.caption }}>
                {t('about.security')}
              </ThemedText>
              <ThemedText style={{ color: theme.colors.text, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                {t('about.biometric')}
              </ThemedText>
            </View>
          </View>

          <ThemedText
            style={{
              color: theme.colors.textMuted,
              fontSize: typography.sizes.captionSm,
              textAlign: 'center',
              marginBottom: spacing[3],
            }}
          >
            {t('about.madeWith')}
          </ThemedText>

          <TouchableOpacity
            style={[modalStyles.cancelBtn, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <ThemedText style={[modalStyles.cancelText, { color: theme.colors.accent }]}>
              {t('common.close')}
            </ThemedText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
