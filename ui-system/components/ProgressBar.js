/**
 * UI System — ProgressBar Component Spec
 * Phase 31: Component Lock System
 * 
 * RULE: All progress indicators MUST use this pattern.
 *       Maps to GlassUI ProgressRing for circular, this spec for linear.
 */

module.exports = {
  name: 'ProgressBar',
  locked: true,
  implementation: 'ui-system/components/ProgressBar.js',
  relatedComponents: ['src/components/ui/GlassUI.tsx → ProgressRing (circular variant)'],

  props: {
    progress: { type: 'number', required: true, description: 'Value 0-1 (fractional)' },
    label: { type: 'string', required: false, description: 'Optional label text' },
    color: { type: 'string', default: 'theme.colors.accent', description: 'Fill color — must be token' },
    height: { type: 'number', default: 8, description: 'Bar height in px' },
    showPercentage: { type: 'boolean', default: false },
    animated: { type: 'boolean', default: true },
    style: { type: 'ViewStyle', required: false },
  },

  tokens: {
    track_dark: 'rgba(255,255,255,0.08)',
    track_light: 'rgba(0,0,0,0.06)',
    fill_default: 'theme.colors.accent (#10B981)',
    fill_warning: 'theme.colors.warning (#F4A427)',
    fill_danger: 'theme.colors.error (#EF4444)',
    radius: 'theme.borderRadius.full (9999)',
    label_color: 'theme.colors.textSecondary',
  },

  structure: {
    jsx: `
<View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
  <Animated.View style={[styles.fill, { width: animatedWidth, backgroundColor: color, height }]} />
</View>
{label && <ThemedText variant="caption" color="secondary">{label}</ThemedText>}
{showPercentage && <ThemedText variant="caption" color="muted">{Math.round(progress * 100)}%</ThemedText>}
    `,
    styling: `
track: { borderRadius: 9999, overflow: 'hidden', width: '100%' }
fill: { borderRadius: 9999 }
    `,
  },

  violations: [
    'Creating custom progress views with inline width calculations',
    'Hardcoding track/fill colors',
    'Using non-animated width transitions',
    'Progress values outside 0-1 range (must be fractional)',
  ],

  examples: {
    basic: '<ProgressBar progress={0.65} />',
    labeled: '<ProgressBar progress={0.3} label="Workout Progress" showPercentage />',
    warning: '<ProgressBar progress={0.85} color={theme.colors.warning} />',
  },
};
