/**
 * UI System — Button Component Spec
 * Phase 31: Component Lock System
 * 
 * RULE: All buttons in FitQuest MUST use GradientButton from GlassUI.tsx.
 *       No new button components. No inline button styles.
 * 
 * This file defines the enforcement contract, not a new component.
 */

module.exports = {
  name: 'Button',
  locked: true,
  implementation: 'src/components/ui/GlassUI.tsx → GradientButton',
  importStatement: "import { GradientButton } from '@/components/ui/GlassUI';",

  props: {
    title: { type: 'string', required: true, description: 'Button label text' },
    onPress: { type: '() => void', required: true, description: 'Press handler' },
    variant: {
      type: "'primary' | 'success' | 'warning'",
      default: 'primary',
      description: 'Visual variant — all use theme tokens',
    },
    size: {
      type: "'sm' | 'md' | 'lg'",
      default: 'md',
      description: 'Size preset: sm=10py/13px, md=14py/15px, lg=18py/17px',
    },
    icon: { type: 'MaterialCommunityIcons glyph', required: false },
    disabled: { type: 'boolean', default: false },
    style: { type: 'ViewStyle', required: false, description: 'Container style only' },
  },

  tokens: {
    bg_primary: 'theme.colors.accent',
    bg_warning: 'theme.colors.warning',
    bg_disabled: 'theme.colors.surfaceVariant',
    text: 'theme.colors.onAccent',
    radius: 'theme.borderRadius.lg (12)',
  },

  violations: [
    'Creating new <TouchableOpacity> styled as buttons',
    'Using <Pressable> with inline button styling',
    'Hardcoding background colors on button elements',
    'Using fontSize instead of size prop',
  ],

  examples: {
    primary: '<GradientButton title="Start Workout" onPress={handleStart} icon="play" />',
    warning: '<GradientButton title="End Session" onPress={handleEnd} variant="warning" size="sm" />',
    disabled: '<GradientButton title="Loading..." onPress={() => {}} disabled />',
  },
};
