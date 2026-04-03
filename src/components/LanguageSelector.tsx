/**
 * FitQuest Language Selector Modal
 * Displays a searchable list of supported languages with native names and flag emoji
 */

import React, { useState, useMemo } from 'react';
import { View, Modal, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageInfo } from '../i18n/translations';
import { typography, spacing } from '../design/theme-system';


interface LanguageSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSelector({ visible, onClose }: LanguageSelectorProps) {
  const { theme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return SUPPORTED_LANGUAGES;
    const q = search.toLowerCase();
    return SUPPORTED_LANGUAGES.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = (code: string) => {
    setLanguage(code);
    setSearch('');
    onClose();
  };

  const renderItem = ({ item }: { item: LanguageInfo }) => {
    const isActive = item.code === language;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSelect(item.code)}
        style={[
          styles.langItem,
          {
            backgroundColor: isActive
              ? theme.colors.accent + '18'
              : theme.isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)',
            borderColor: isActive
              ? theme.colors.accent + '40'
              : theme.isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        <Text style={styles.flag}>{item.flag}</Text>
        <View style={styles.langTextWrap}>
          <Text
            style={[
              styles.langName,
              {
                color: isActive ? theme.colors.accent : theme.colors.text,
                fontWeight: isActive ? '700' : '500',
              },
            ]}
          >
            {item.name}
          </Text>
          <Text style={[styles.langCode, { color: theme.colors.textMuted }]}>{item.code.toUpperCase()}</Text>
        </View>
        {!!isActive && <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.accent} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.language')}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View
            style={[
              styles.searchWrap,
              {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder={t('profile.searchLanguages')}
              placeholderTextColor={theme.colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Language list */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            windowSize={3}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing[4],
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.sizes.h4, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '400',
    padding: spacing[0],
  },
  listContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing[2],
    gap: spacing[3],
  },
  flag: {
    fontSize: typography.sizes.h2, 
  },
  langTextWrap: {
    flex: 1,
  },
  langName: {
    fontSize: typography.sizes.bodySmall, 
    letterSpacing: 0.2,
  },
  langCode: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '400',
    marginTop: spacing[0.5],
  },
});
