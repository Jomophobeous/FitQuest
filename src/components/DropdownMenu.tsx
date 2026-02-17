/**
 * FitQuest Dropdown Menu Component
 * Premium glass-morphism dropdown with animated items
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { timerService } from '../services/timerService';

// ============================================
// TYPES
// ============================================

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route?: string;
  action?: () => void;
  disabled?: boolean;
  category: 'movement' | 'knowledge' | 'system';
  color?: string;
}

interface DropdownMenuProps {
  onClose?: () => void;
}

// ============================================
// MENU ITEMS
// ============================================

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'exercise-library',
    label: 'Exercise Library',
    icon: 'book-open-variant',
    route: '/exercises',
    category: 'movement',
  },
  {
    id: 'progress',
    label: 'Progress Photos',
    icon: 'camera-burst',
    route: '/progress',
    category: 'movement',
  },
  {
    id: 'coach',
    label: 'AI Coach (Beta)',
    icon: 'robot-happy',
    route: '/coach',
    category: 'knowledge',
    color: '#8B5CF6',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'chart-bar',
    route: '/analytics',
    category: 'knowledge',
    color: '#4ECDC4',
  },
  {
    id: 'nutrition-calc',
    label: 'Nutrition Calculator',
    icon: 'calculator-variant',
    route: '/nutrition-calculator',
    category: 'knowledge',
    color: '#F97316',
  },
  {
    id: 'meal-prep',
    label: 'Meal Prep',
    icon: 'food-variant',
    route: '/meal-prep',
    category: 'knowledge',
    color: '#10B981',
  },
  {
    id: 'health-dashboard',
    label: 'Health Dashboard',
    icon: 'heart-pulse',
    route: '/health-dashboard',
    category: 'knowledge',
    color: '#EF4444',
  },
  {
    id: 'craft-my-body',
    label: 'Craft My Body',
    icon: 'human-edit',
    route: '/craft-my-body',
    category: 'movement',
    color: '#EC4899',
  },
  {
    id: 'saved-workouts',
    label: 'My Workouts',
    icon: 'folder-star',
    route: '/saved-workouts',
    category: 'movement',
  },
  {
    id: 'subscription',
    label: 'Subscription',
    icon: 'crown',
    route: '/paywall',
    category: 'system',
    color: '#F4A427',
  },
  {
    id: 'backups',
    label: 'Backup & Restore',
    icon: 'backup-restore',
    route: '/backups',
    category: 'system',
  },
  {
    id: 'about',
    label: 'About FitQuest',
    icon: 'information-outline',
    action: () => {
      Alert.alert(
        'FitQuest 2.0',
        `Version 1.0.0\n${Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web'} · Expo SDK 54\n\nBody + Mind fitness platform.\nAll data encrypted on-device.\n\n© 2026 FitQuest`,
      );
    },
    category: 'system',
  },
];

// ============================================
// DROPDOWN TRIGGER BUTTON
// ============================================

interface DropdownTriggerProps {
  onPress: () => void;
}

export function DropdownTrigger({ onPress }: DropdownTriggerProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.92, { duration: 120 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
        style={styles.trigger}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="dots-vertical"
          size={24}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================
// ANIMATED MENU ITEM
// ============================================

function AnimatedMenuItem({
  item,
  index,
  isDisabled,
  isLast,
  showDivider,
  onPress,
}: {
  item: MenuItem;
  index: number;
  isDisabled: boolean;
  isLast: boolean;
  showDivider: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const isWorkoutActive = timerService.isActive();
  const scale = useSharedValue(1);
  const iconColor = item.color || (isDisabled ? theme.colors.textMuted : theme.colors.accent);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 30).duration(150)}
    >
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={[
            styles.menuItem,
            isDisabled && styles.menuItemDisabled,
          ]}
          onPressIn={() => { scale.value = withTiming(0.97, { duration: 120 }); }}
          onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
          onPress={() => !isDisabled && onPress()}
          disabled={isDisabled}
          activeOpacity={0.8}
        >
          <View style={[styles.menuItemIcon, { backgroundColor: iconColor + '14' }]}>
            <MaterialCommunityIcons
              name={item.icon}
              size={18}
              color={iconColor}
            />
          </View>
          <Text
            style={[
              styles.menuItemLabel,
              { color: isDisabled ? theme.colors.textMuted : theme.colors.text },
            ]}
          >
            {item.label}
          </Text>
          {isWorkoutActive && item.category !== 'system' && (
            <MaterialCommunityIcons name="lock" size={12} color={theme.colors.textMuted} />
          )}
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={theme.colors.textMuted}
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>
      </Animated.View>
      {showDivider && (
        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
      )}
    </Animated.View>
  );
}

// ============================================
// DROPDOWN MENU
// ============================================

export function DropdownMenu({ onClose }: DropdownMenuProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const isWorkoutActive = timerService.isActive();

  const handleOpen = useCallback(() => { setVisible(true); }, []);
  const handleClose = useCallback(() => { setVisible(false); onClose?.(); }, [onClose]);

  const handleItemPress = useCallback((item: MenuItem) => {
    handleClose();
    setTimeout(() => {
      if (item.action) item.action();
      else if (item.route) router.push(item.route as any);
    }, 200);
  }, [router, handleClose]);

  return (
    <>
      <DropdownTrigger onPress={handleOpen} />

      <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <Animated.View
            entering={FadeInDown.duration(150)}
            style={[
              styles.menuContainer,
              {
                backgroundColor: theme.isDark ? 'rgba(18,24,32,0.96)' : 'rgba(255,255,255,0.97)',
                borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            {/* Header */}
            <LinearGradient
              colors={theme.isDark
                ? [theme.colors.accent + '15', 'transparent']
                : [theme.colors.accent + '08', 'transparent']
              }
              style={[styles.menuHeader, { borderBottomColor: theme.colors.border }]}
            >
              <Text style={[styles.menuTitle, { color: theme.colors.text }]}>More</Text>
              {isWorkoutActive && (
                <View style={[styles.workoutBadge, { backgroundColor: theme.colors.warning }]}>
                  <Text style={styles.workoutBadgeText}>Active</Text>
                </View>
              )}
            </LinearGradient>

            {/* Menu Items */}
            <ScrollView
              style={styles.menuList}
              contentContainerStyle={styles.menuListContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
              nestedScrollEnabled
            >
              {MENU_ITEMS.map((item, index, array) => {
                const isDisabled = item.disabled || (isWorkoutActive && item.category !== 'system');
                const isLastInCategory =
                  index === array.length - 1 || array[index + 1]?.category !== item.category;

                return (
                  <AnimatedMenuItem
                    key={item.id}
                    item={item}
                    index={index}
                    isDisabled={isDisabled}
                    isLast={index === array.length - 1}
                    showDivider={isLastInCategory && index < array.length - 1}
                    onPress={() => handleItemPress(item)}
                  />
                );
              })}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  trigger: {
    padding: 8,
    marginRight: 8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    marginTop: 56,
    marginRight: 14,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 220,
    maxWidth: 280,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  workoutBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  workoutBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  menuList: {
    maxHeight: Dimensions.get('window').height * 0.55,
  },
  menuListContent: {
    paddingVertical: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  separator: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 14,
  },
});

export default DropdownMenu;
