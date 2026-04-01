/**
 * UI System — StatBlock Component Spec
 * Phase 31: Component Lock System
 * 
 * RULE: All stat/metric displays MUST use this pattern.
 *       Wraps GlassCard + AnimatedCounter from GlassUI.
 */

module.exports = {
  name: 'StatBlock',
  locked: true,
  implementation: 'ui-system/components/StatBlock.js',
  relatedComponents: [
    'src/components/ui/GlassUI.tsx → GlassCard (container)',
    'src/components/ui/GlassUI.tsx → AnimatedCounter (value)',
  ],

  props: {
    label: { type: 'string', required: true, description: 'Metric label (e.g. "Steps Today")' },
    value: { type: 'number | string', required: true, description: 'Primary metric value' },
    suffix: { type: 'string', required: false, description: 'Unit suffix (e.g. "kcal", "min")' },
    icon: { type: 'MaterialCommunityIcons glyph', required: false },
    iconColor: { type: 'string', default: 'theme.colors.accent', description: 'Must be token color' },
    trend: { type: "'up' | 'down' | 'flat'", required: false, description: 'Trend indicator' },
    trendValue: { type: 'string', required: false, description: 'e.g. "+12%"' },
    compact: { type: 'boolean', default: false, description: 'Compact mode for grid layouts' },
    style: { type: 'ViewStyle', required: false },
  },

  tokens: {
    container: 'GlassCard tokens (surface bg, border, radius 16)',
    label: 'theme.colors.textMuted + caption variant',
    value: 'theme.colors.text + h3 variant (compact: h4)',
    suffix: 'theme.colors.textSecondary + bodySmall variant',
    trend_up: 'theme.colors.success (#10B981)',
    trend_down: 'theme.colors.error (#EF4444)',
    trend_flat: 'theme.colors.textMuted',
    icon_size: '24 (compact: 20)',
    padding: 'theme.spacing[4] (16)',
    gap: 'theme.spacing[2] (8)',
  },

  structure: {
    jsx: `
<GlassCard style={[containerStyle, style]}>
  <View style={styles.header}>
    {icon && <MaterialCommunityIcons name={icon} size={iconSize} color={iconColor} />}
    <ThemedText variant="caption" color="muted">{label}</ThemedText>
  </View>
  <View style={styles.valueRow}>
    <AnimatedCounter value={value} suffix={suffix} style={valueStyle} />
    {trend && (
      <View style={styles.trend}>
        <MaterialCommunityIcons name={trendIcon} size={14} color={trendColor} />
        <ThemedText variant="caption" color={trendTextColor}>{trendValue}</ThemedText>
      </View>
    )}
  </View>
</GlassCard>
    `,
  },

  violations: [
    'Displaying metrics in raw <Text> without AnimatedCounter',
    'Creating ad-hoc stat card layouts with inline styles',
    'Using hardcoded icon colors',
    'Mixing metric display patterns across screens',
  ],

  examples: {
    basic: '<StatBlock label="Steps Today" value={8432} icon="walk" />',
    withTrend: '<StatBlock label="Active Minutes" value={45} suffix="min" trend="up" trendValue="+12%" />',
    compact: '<StatBlock label="Calories" value={1840} suffix="kcal" compact />',
  },
};
