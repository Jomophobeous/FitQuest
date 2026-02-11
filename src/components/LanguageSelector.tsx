/**
 * FitQuest Language Selector Modal
 * Displays a searchable list of supported languages with native names and flag emoji
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageInfo } from '../i18n/translations';

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
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
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
          <Text style={[styles.langCode, { color: theme.colors.textMuted }]}>
            {item.code.toUpperCase()}
          </Text>
        </View>
        {isActive && (
          <MaterialCommunityIcons
            name="check-circle"
            size={20}
            color={theme.colors.accent}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.isDark ? '#121820' : '#FFFFFF',
              borderColor: theme.isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t('profile.language')}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View
            style={[
              styles.searchWrap,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
                borderColor: theme.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color={theme.colors.textMuted}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder={t('library.search')}
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
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  flag: {
    fontSize: 24,
  },
  langTextWrap: {
    flex: 1,
  },
  langName: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  langCode: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
});
