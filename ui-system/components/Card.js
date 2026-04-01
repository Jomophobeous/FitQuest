/**
 * UI System — Card Component Spec
 * Phase 31: Component Lock System
 * 
 * RULE: All cards MUST use GlassCard from GlassUI.tsx.
 *       No freestyle card styling. No new card components.
 */

module.exports = {
  name: 'Card',
  locked: true,
  implementation: 'src/components/ui/GlassUI.tsx → GlassCard',
  importStatement: "import { GlassCard } from '@/components/ui/GlassUI';",

  props: {
    children: { type: 'ReactNode', required: true },
    style: { type: 'ViewStyle', required: false, description: 'Additional container style' },
    delay: { type: 'number', default: 0, description: 'FadeInDown animation delay (ms)' },
    onPress: { type: '() => void', required: false, description: 'Makes card tappable' },
  },

  tokens: {
    bg_dark: 'rgba(255,255,255,0.04)',
    bg_light: 'rgba(255,255,255,0.95)',
    border_dark: 'rgba(255,255,255,0.06)',
    border_light: 'rgba(0,0,0,0.06)',
    radius: 'theme.borderRadius.xl (16)',
    padding: 'theme.spacing[4] (16)',
  },

  variants: {
    standard: 'GlassCard — base card with subtle animation',
    pressable: 'GlassCard with onPress — adds scale animation on press',
  },

  violations: [
    'Creating <View> with card-like styling (rounded, elevated, padded)',
    'Using StyleSheet.create for card patterns',
    'Hardcoding border radius on container views',
    'Using bg-white or bg-gray-50 backgrounds',
  ],

  examples: {
    basic: '<GlassCard><ThemedText variant="h4">Title</ThemedText></GlassCard>',
    delayed: '<GlassCard delay={200}><StatContent /></GlassCard>',
    tappable: '<GlassCard onPress={handleNav}><WorkoutPreview /></GlassCard>',
  },
};
