# FitQuest Mobile - Theme System Documentation

## Overview

The FitQuest mobile app now has a comprehensive **dual-mode design system** supporting both **Dark Mode** (emotion/focus) and **Light Mode** (clinical/analytical).

### Key Philosophy

- **Dark Mode**: Immersion, visual drama, emotional engagement (glow effects, scale animations)
- **Light Mode**: Speed, clarity, analytical precision (no glare, flat design, snappy animations)

---

## Quick Start

### 1. Using the Theme in Components

```tsx
import { useTheme } from '../context/ThemeContext';
import ThemedText from '../components/ThemedText';

export default function MyComponent() {
  const { theme } = useTheme();
  
  return (
    <View style={{ 
      backgroundColor: theme.colors.background,
      padding: theme.spacing[4]
    }}>
      <ThemedText variant="h2" color="primary">
        Hello
      </ThemedText>
    </View>
  );
}
```

### 2. Accessing Colors

```tsx
// Primary colors
theme.colors.text           // Primary text
theme.colors.textSecondary  // Secondary text
theme.colors.textMuted      // Tertiary/disabled text

// Surfaces
theme.colors.background     // App background
theme.colors.surface        // Cards/elevated areas
theme.colors.surfaceVariant // Secondary surfaces

// Accents (consistent across modes)
theme.colors.accent         // Primary actions (#5F63FF)
theme.colors.accent2        // Energy/calories (#F4A427)
theme.colors.accent3        // Success (#10B981)

// Utilities
theme.colors.border         // Borders & dividers
theme.colors.error          // Error states
```

### 3. Using Design Tokens

```tsx
// Spacing
theme.spacing[1]  // 4px
theme.spacing[2]  // 8px
theme.spacing[3]  // 12px
theme.spacing[4]  // 16px
theme.spacing[5]  // 20px

// Border Radius
theme.radius.sm   // 4px
theme.radius.md   // 8px
theme.radius.lg   // 12px

// Shadows (mode-aware)
theme.shadows.sm  // Subtle shadow
theme.shadows.md  // Medium shadow
theme.shadows.lg  // Strong shadow

// Motion (duration in ms)
theme.motion.fast  // 150ms
theme.motion.base  // 250ms (dark) / 200ms (light)
theme.motion.slow  // 350ms / 300ms
```

---

## Theme Structure

### Color System

#### Dark Mode
```
Background:        #0A0E17 (matte black)
Surface:           #121820 (slightly elevated)
Surface Variant:   #1A1F2B (secondary)

Text:              #F5F7FB (almost white)
Text Secondary:    #A8B0BD
Text Muted:        #6B7280

Border:            #2A2F3B (very subtle)

Accent:            #5F63FF (vibrant purple-blue)
Accent2:           #F4A427 (warm amber)
Accent3:           #10B981 (emerald green)
```

#### Light Mode
```
Background:        #F4F5F7 (soft neutral - NOT pure white)
Surface:           #FFFFFF (primary card surface)
Surface Variant:   #ECEEF2 (secondary)

Text:              #121316 (almost black)
Text Secondary:    #4B4F58
Text Muted:        #7A7F89

Border:            #DADDE3 (1px hairline, very soft)

Accent:            #5F63FF (same, luminance adjusted)
Accent2:           #F4A427 (same)
Accent3:           #10B981 (same)
```

### Typography

```tsx
Sizes:
- h1:        32px
- h2:        24px
- h3:        20px
- h4:        18px
- body:      16px
- bodySmall: 14px
- label:     13px
- caption:   12px

Weights:
- regular:   400
- medium:    500
- semibold:  600
- bold:      700

Line Heights:
- tight:     1.2
- normal:    1.5
- relaxed:   1.75
```

---

## Component Integration

### ThemedText Component

```tsx
<ThemedText 
  variant="h2"        // h1, h2, h3, h4, body, bodySmall, label, caption
  color="primary"     // primary, secondary, muted, accent, accent2, error
  weight="600"        // 400, 500, 600, 700
>
  Hello World
</ThemedText>
```

### Card Component

```tsx
<Card variant="elevated"> {/* or 'flat' or 'default' */}
  <ThemedText>Content</ThemedText>
</Card>

// Behavior:
// Dark mode + elevated  → Shadow effect
// Dark mode + flat      → Border
// Light mode + elevated → Border (same as flat)
// Light mode + flat     → Border
```

### Button Component

```tsx
<Button 
  variant="primary"   // primary, secondary, ghost, outline
  size="md"           // sm, md, lg
  onPress={() => {}}
>
  Click Me
</Button>
```

### StatRing Component (Progress Circles)

```tsx
<StatRing 
  progress={0.75}      // 0..1
  label="45%"
  sub="Complete"
  variant="progress"   // progress or energy
  size={84}
/>

// Renders animated progress circle with theme-aware colors
// Dark: Glowing effect
// Light: Solid fill, no glow
```

### ProgressBar Component

```tsx
<ProgressBar 
  progress={0.6}       // 0..1
  height={6}
  variant="progress"   // progress or energy
  showGlow={true}      // Glow only shows in dark mode
/>
```

---

## Dark Mode Features

### Glow Effects
Dark mode uses glowing accents to create visual drama:

```tsx
{theme.isDark && (
  <View style={{
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  }} />
)}
```

### Animations
- Duration: 250-350ms (slower, more dramatic)
- Use: Scale, fade, spring easing
- Effect: Emphasis through movement

### Visual Style
- Shadow-based separation
- Slightly elevated surfaces
- Bold typography weights

---

## Light Mode Features

### Zero Glare Design
- No pure white backgrounds (#F4F5F7 instead)
- Hairline borders (1px max, very soft)
- Ultra-soft shadows (opacity ≤ 8%)

### Animations
- Duration: 150-250ms (shorter, snappier)
- Use: Opacity + subtle translateY (2-4px)
- Effect: Quick, responsive feedback

### Visual Style
- Border-based separation
- Flat card design
- Density-first layout
- Inline metrics & data

### Contrast
- WCAG AA compliance minimum
- Never soften text contrast
- Proper visual hierarchy through weight, not color

---

## Updating Existing Screens

### Step-by-Step Guide

1. **Import the theme hook**
   ```tsx
   import { useTheme } from '../context/ThemeContext';
   import ThemedText from '../components/ThemedText';
   ```

2. **Get theme in component**
   ```tsx
   const { theme } = useTheme();
   ```

3. **Replace hardcoded colors**
   ```tsx
   // Before:
   backgroundColor: '#FFFFFF'
   color: '#0F1724'
   
   // After:
   backgroundColor: theme.colors.surface
   color: theme.colors.text
   ```

4. **Use ThemedText for all text**
   ```tsx
   // Before:
   <Text style={{ fontSize: 16, color: '#0F1724' }}>Hello</Text>
   
   // After:
   <ThemedText variant="body">Hello</ThemedText>
   ```

5. **Apply spacing & radius from theme**
   ```tsx
   padding: theme.spacing[4]
   borderRadius: theme.radius.md
   ```

6. **Use theme-aware shadows**
   ```tsx
   dark: { ...theme.shadows.md }
   light: { borderWidth: 1, borderColor: theme.colors.border }
   ```

7. **Adjust animations**
   ```tsx
   Animated.timing(anim, {
     duration: theme.isDark ? 700 : 250,
     easing: Easing.bezier(0.4, 0, 0.2, 1),
   })
   ```

---

## Accent Color Usage

All apps use the **same three accent colors** across modes:

| Element | Color | Usage |
|---------|-------|-------|
| **Accent** | #5F63FF | Primary actions, progress, focus |
| **Accent2** | #F4A427 | Energy, calories, warnings |
| **Accent3** | #10B981 | Success, positive, completed |

These remain **consistent across both modes**. Only shadows and supporting elements adjust.

---

## Toggling Theme

Add the ThemeToggle component to settings:

```tsx
import ThemeToggle from '../components/ThemeToggle';

export default function SettingsScreen() {
  return (
    <ScrollView>
      <ThemeToggle /> {/* Shows current mode, toggles on press */}
      {/* other settings... */}
    </ScrollView>
  );
}
```

Programmatically toggle:

```tsx
const { toggleTheme, setMode } = useTheme();

// Toggle between dark and light
toggleTheme();

// Set specific mode
setMode('light');
setMode('dark');
```

---

## File Structure

```
src/
├── design/
│   ├── theme-system.ts      ← Color system & tokens
│   ├── tokens.ts            ← (deprecated, use theme-system)
│   └── THEME_GUIDE.md       ← Quick reference
├── context/
│   └── ThemeContext.tsx     ← Provider & hooks
└── components/
    ├── ThemedText.tsx       ← Text with theme
    ├── Card.tsx             ← Theme-aware cards
    ├── Button.tsx           ← Theme-aware buttons
    ├── StatRing.tsx         ← Progress circles
    ├── ProgressBar.tsx      ← Progress bars
    └── ThemeToggle.tsx      ← Theme switcher
```

---

## Best Practices

### ✅ DO

- Always use `theme.colors.*` instead of hardcoded colors
- Use `ThemedText` for all text rendering
- Apply spacing from `theme.spacing`
- Check `theme.isDark` for mode-specific layouts
- Wrap dark-mode features with `{theme.isDark && ...}`
- Test components in both dark and light modes

### ❌ DON'T

- Hardcode colors like `#FFFFFF` or `#000000`
- Mix theme colors with non-theme colors
- Create mode-specific duplicates of components
- Use color names instead of semantic tokens
- Forget to test light mode contrast
- Apply excessive shadows in light mode

---

## Examples

### Example 1: Simple Card with Stats

```tsx
import { useTheme } from '../context/ThemeContext';
import ThemedText from '../components/ThemedText';
import Card from '../components/Card';

export default function StatsCard() {
  const { theme } = useTheme();

  return (
    <Card variant={theme.isDark ? 'elevated' : 'flat'}>
      <ThemedText variant="h3" weight="600">
        Calories Burned
      </ThemedText>
      <ThemedText 
        variant="h2" 
        color="accent2"
        weight="700"
        style={{ marginTop: theme.spacing[2] }}
      >
        540 kcal
      </ThemedText>
    </Card>
  );
}
```

### Example 2: Animated Progress with Conditional Glow

```tsx
import { useTheme } from '../context/ThemeContext';
import ProgressBar from '../components/ProgressBar';

export default function WorkoutProgress() {
  const { theme } = useTheme();

  return (
    <View>
      <ProgressBar 
        progress={0.65}
        variant="energy"
        showGlow={theme.isDark} // Glow only in dark mode
      />
    </View>
  );
}
```

---

## Troubleshooting

### Text Looks Wrong in Light Mode
- Check contrast with `theme.colors.text` vs background
- Ensure using ThemedText for typography

### Animations Feel Slow
- Light mode animations are shorter (150-250ms) by design
- Dark mode is 250-350ms for drama

### Colors Inconsistent Between Screens
- Always use `theme.colors.*` not hardcoded hex
- Import from context, not old theme.ts

### Glow Effects Not Showing
- Glow only applies in dark mode (`theme.isDark`)
- Check shadow properties are set correctly

---

## Next Steps

1. ✅ Review [THEME_GUIDE.md](./THEME_GUIDE.md) for quick reference
2. ✅ Update all screens to use `useTheme` hook
3. ✅ Replace hardcoded colors with theme tokens
4. ✅ Test UI in both dark and light modes
5. ✅ Add theme toggle to settings screen
6. ✅ Verify WCAG AA contrast in light mode

---

## Support

For questions about the theme system:
- See `src/design/THEME_GUIDE.md` for quick reference
- Check existing components for implementation examples
- Review `src/context/ThemeContext.tsx` for provider setup
