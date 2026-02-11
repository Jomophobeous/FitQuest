/**
 * FitQuest Mobile - Design System Usage Guide
 * 
 * This guide explains how to use the new theme system throughout the app.
 * 
 * ============================================================================
 * QUICK START
 * ============================================================================
 * 
 * 1. Import the hook:
 *    import { useTheme } from '../context/ThemeContext';
 * 
 * 2. Use in component:
 *    const { theme } = useTheme();
 * 
 * 3. Access colors:
 *    theme.colors.text
 *    theme.colors.accent
 *    theme.colors.background
 * 
 * ============================================================================
 * THEME STRUCTURE
 * ============================================================================
 * 
 * theme.colors: {
 *   background      - App background
 *   surface         - Cards/elevated areas
 *   surfaceVariant  - Secondary surfaces
 *   text            - Primary text
 *   textSecondary   - Secondary text
 *   textMuted       - Tertiary/disabled text
 *   border          - Borders & dividers
 *   accent          - Primary actions (purple-blue)
 *   accent2         - Secondary emphasis (amber)
 *   accent3         - Success/positive (green)
 *   error, warning  - Semantic colors
 * }
 * 
 * theme.typography: {
 *   sizes: { h1, h2, h3, h4, body, bodySmall, label, caption }
 *   weights: { regular, medium, semibold, bold }
 *   lineHeights: { tight, normal, relaxed }
 * }
 * 
 * theme.spacing: {
 *   0-12, with: 1, 2, 3, 4, 5, 6, 8, 10, 12
 * }
 * 
 * theme.radius: {
 *   sm, md, lg, xl, full
 * }
 * 
 * theme.shadows: {
 *   none, sm, md, lg
 * }
 * 
 * theme.motion: {
 *   fast, base, slow (durations in ms)
 * }
 * 
 * ============================================================================
 * PHILOSOPHY: DARK VS LIGHT
 * ============================================================================
 * 
 * DARK MODE (Current Default):
 *   - Emotion, immersion, focus
 *   - Glowing accents
 *   - Visual drama (scale animations, glow effects)
 *   - Longer animations (250-350ms)
 *   - Bold typography weights
 * 
 * LIGHT MODE:
 *   - Speed, analysis, accuracy
 *   - Clinical, sharp, zero glare
 *   - No pure white backgrounds
 *   - Shorter animations (150-200ms)
 *   - Density-first layout
 *   - Opacity + subtle movement instead of scale
 * 
 * ============================================================================
 * COLOR USAGE PATTERNS
 * ============================================================================
 * 
 * PRIMARY ACTIONS:
 *   backgroundColor: theme.colors.accent (#5F63FF)
 *   text: white or theme.colors.text
 * 
 * SECONDARY ACTIONS:
 *   backgroundColor: theme.colors.surfaceVariant
 *   color: theme.colors.accent
 * 
 * ENERGY/CALORIES:
 *   Use: theme.colors.accent2 (#F4A427)
 *   For progress bars, calorie badges, energy indicators
 * 
 * BACKGROUNDS:
 *   App: theme.colors.background
 *   Cards: theme.colors.surface
 *   Secondary: theme.colors.surfaceVariant
 * 
 * TEXT HIERARCHY:
 *   Primary: theme.colors.text
 *   Secondary: theme.colors.textSecondary
 *   Muted/meta: theme.colors.textMuted
 * 
 * ============================================================================
 * COMPONENT EXAMPLES
 * ============================================================================
 * 
 * DARK MODE GLOW EFFECT:
 *   {theme.isDark && <View style={{ 
 *     shadowColor: theme.colors.accent,
 *     shadowOffset: { width: 0, height: 0 },
 *     shadowOpacity: 0.15,
 *     shadowRadius: 8,
 *   }} />}
 * 
 * FLAT CARD (LIGHT MODE STYLE):
 *   {
 *     backgroundColor: theme.colors.surface,
 *     borderWidth: 1,
 *     borderColor: theme.colors.border,
 *   }
 * 
 * ELEVATED CARD (DARK MODE STYLE):
 *   {
 *     backgroundColor: theme.colors.surface,
 *     ...theme.shadows.md,
 *   }
 * 
 * ANIMATION TIMING:
 *   Animated.timing(animated, {
 *     toValue: 1,
 *     duration: theme.isDark ? 700 : 250,
 *     easing: Easing.bezier(0.4, 0, 0.2, 1),
 *     useNativeDriver: true,
 *   })
 * 
 * ============================================================================
 * RECOMMENDED CONVERSIONS
 * ============================================================================
 * 
 * OLD CODE:
 *   backgroundColor: '#F5F7FB'
 *   color: '#0F1724'
 *   borderColor: '#E5E7EB'
 * 
 * NEW CODE:
 *   backgroundColor: theme.colors.background
 *   color: theme.colors.text
 *   borderColor: theme.colors.border
 * 
 * ============================================================================
 * THEMING CHECKLIST FOR NEW COMPONENTS
 * ============================================================================
 * 
 * [ ] Import useTheme hook
 * [ ] Extract theme in component
 * [ ] Replace hardcoded colors with theme.colors.*
 * [ ] Replace hardcoded typography with theme.typography.*
 * [ ] Replace hardcoded spacing with theme.spacing.*
 * [ ] Replace hardcoded radius with theme.radius.*
 * [ ] Apply appropriate shadows (theme.shadows.*)
 * [ ] Adjust animations based on theme.isDark
 * [ ] Test in both dark and light modes
 * 
 * ============================================================================
 * ACCENT COLOR USAGE QUICK REFERENCE
 * ============================================================================
 * 
 * PROGRESS / PRIMARY:        #5F63FF (theme.colors.accent)
 * ENERGY / CALORIES:         #F4A427 (theme.colors.accent2)
 * SUCCESS / POSITIVE:        #10B981 (theme.colors.accent3)
 * 
 * These remain CONSISTENT across both modes.
 * Only luminance and supporting shadows adjust.
 * 
 * ============================================================================
 */

export default {};
