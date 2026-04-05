# UI/UX Structuring Guidelines for FitQuest v1.2.0
## Canonical Rules for All Screens

---

## 1. TYPOGRAPHY HIERARCHY (MANDATORY)

### Level 1: Page Title
```
Font Size:    h1 (32px) or h2 (24px)
Weight:       700 (bold)
Letter Spacing: 0.5px
Color:        theme.colors.text
Margin Below: spacing[4] (16px)
Use Case:     Screen titles, major sections
Example:      "Dashboard", "Profile", "Coach"
```

### Level 2: Section Header
```
Font Size:    h3 (20px)
Weight:       700 (bold)
Letter Spacing: 0.3px
Color:        theme.colors.text
Margin Below: spacing[3] (12px)
Use Case:     Major subsections
Example:      "Training Profile", "Achievements", "Account"
```

### Level 3: Card Header / Item Label
```
Font Size:    body (16px)
Weight:       600 (semibold)
Letter Spacing: 0.2px
Color:        theme.colors.text
Margin Below: spacing[1] (4px)
Use Case:     Menu items, card titles, form labels
Example:      "Training Goal", "Email Address"
```

### Level 4: Body / Description Text
```
Font Size:    body (16px)
Weight:       400 (regular)
Letter Spacing: 0
Color:        theme.colors.text or theme.colors.textSecondary
Line Height:  24px (1.5x font size)
Use Case:     Main content, paragraphs, messages
Example:      "FitQuest is designed for users aged 13+..."
```

### Level 5: Secondary Label / Sublabel
```
Font Size:    label (13px)
Weight:       500 (medium)
Letter Spacing: 0.1px
Color:        theme.colors.textSecondary
Margin Above: spacing[1] (4px)
Use Case:     Secondary info under primary label
Example:      "Strength — Training Goal Description"
```

### Level 6: Meta / Caption Text
```
Font Size:    caption (12px)
Weight:       400 (regular)
Letter Spacing: 0
Color:        theme.colors.textMuted
Use Case:     Timestamps, helper text, disabled text
Example:      "Last updated 2 hours ago"
```

### Level 7: Minimal Text
```
Font Size:    captionSm (11px)
Weight:       400 (regular)
Color:        theme.colors.textMuted
Use Case:     Badge labels, version info
Example:      "v1.2.0"
```

### ❌ ANTI-PATTERNS
```
❌ DON'T use bodyMid (15px)          — ambiguous between body and label
❌ DON'T use custom font sizes       — always use theme.typography.sizes.*
❌ DON'T use weight 500 for labels   — use 600 (semibold) or 700 (bold)
❌ DON'T skip line-height on body text — always set lineHeight: 24
❌ DON'T mix light/dark colors in same section — be consistent
```

---

## 2. SPACING SYSTEM (MANDATORY)

### Spacing Scale
```
spacing[0] = 0px
spacing[0.5] = 2px
spacing[1] = 4px
spacing[1.5] = 6px
spacing[2] = 8px
spacing[2.5] = 10px
spacing[3] = 12px
spacing[4] = 16px
spacing[5] = 20px
spacing[6] = 24px
spacing[8] = 32px
spacing[10] = 40px
spacing[12] = 48px
```

### Margin Rules (Between Sections)
```
Between screens:        spacing[6] (24px) — top/bottom safe area
Between major sections: spacing[4] (16px) — top/bottom padding
Between subsections:    spacing[3] (12px) — top/bottom padding
Between items:          spacing[2] (8px)  — vertical gap
Between inline items:   spacing[1.5] (6px) — buttons side-by-side
```

### Padding Rules (Inside Components)
```
Card padding:           spacing[4] (16px) — all sides
Button padding:         spacing[3] vert × spacing[4] horiz (12px × 16px)
Input field padding:    spacing[2] horiz × spacing[2.5] vert (8px × 10px)
Section padding:        spacing[4] (16px) — left/right
List item padding:      spacing[3] (12px) — left/right
Icon + text gap:        spacing[2] (8px)  — horizontal
Message bubble padding: spacing[3] (12px) — all sides
```

### Menu Item Spacing (NEW STANDARD)
```
Vertical padding:    spacing[2.5] (10px)  ← was spacing[4] (16px)
Horizontal padding:  spacing[3] (12px)    ← was spacing[4] (16px)
Margin between:      spacing[1] (4px)     ← was spacing[2.5] (10px)
Icon-to-text gap:    spacing[2] (8px)     ← was spacing[3] (12px)
Result height:       48px                 ← was 68px (30% reduction)
```

### ❌ ANTI-PATTERNS
```
❌ DON'T use arbitrary pixel values (15px, 18px, etc.) — use spacing scale
❌ DON'T use different padding left/right in same component — be symmetric
❌ DON'T add extra margins between items without reason — use standard gaps
❌ DON'T nest spacing (spacing[4] + spacing[2] = spacing[6]) — use single value
```

---

## 3. TOUCH TARGETS (WCAG AA Compliance)

### Minimum Sizes (MANDATORY)
```
Primary button:        48px minimum height
Secondary button:      44px minimum height
Icon button:           44 × 44px minimum
Menu item:             48px minimum height
Input field:           44px minimum height
Checkbox:              24 × 24px minimum
Radio button:          24 × 24px minimum
Link (inline):         44px minimum touch target (padding if needed)
```

### Spacing Between Targets (WCAG AA)
```
Between buttons:       spacing[3] (12px) minimum
Between interactive elements: spacing[2] (8px) minimum
Margin around touch target: spacing[2] (8px) safe zone
```

### Button Sizing Spec
```
Large button:          full-width, 52px height (primary CTAs)
Standard button:       ~120-160px width, 48px height
Small button:          ~80-100px width, 40px height
Icon button:           44 × 44px square
```

---

## 4. BORDER RADIUS (CANONICAL)

### Values (Use Only These)
```
radius.sm  = 4px   — small elements, inputs
radius.md  = 8px   — buttons, cards
radius.lg  = 12px  — standard buttons, chips
radius.xl  = 16px  — large cards, modals
radius.full = 9999px — circles, badges
```

### Application Rules
```
Buttons:           radius.lg (12px)
Input fields:      radius.lg (12px)
Cards:             radius.xl (16px)
Modals:            radius.xl (16px)
Small chips:       radius.md (8px)
Icon wrappers:     radius.lg (12px)
Badges:            radius.full (circle)
Avatars:           radius.full (circle)
```

### ❌ ANTI-PATTERNS
```
❌ DON'T use radius[2] (8px) for buttons — use radius.lg (12px)
❌ DON'T mix radius values in similar components — be consistent
❌ DON'T use large radius on small elements — looks awkward
```

---

## 5. COLOR USAGE (SEMANTIC)

### Text Colors (STRICT)
```
Primary text:        theme.colors.text           (#F4F5F9 dark, #0F1724 light)
Secondary text:      theme.colors.textSecondary  (#A8B0C0 dark, #6B7590 light)
Muted text:          theme.colors.textMuted      (#6B7590 dark, #A8B0C0 light)
Disabled text:       theme.colors.textMuted @ 50% opacity
Links:               theme.colors.accent         (#10B981 emerald)
```

### Background Colors (STRICT)
```
App background:      theme.colors.background     (#050507 dark, #F8F9FA light)
Card/Surface:        theme.colors.surface        (#0E0E12 dark, #FFFFFF light)
Secondary surface:   theme.colors.surfaceVariant (#161619 dark, #F0F1F5 light)
Overlay:             rgba(0,0,0,0.5) always
Hover state:         surfaceVariant + brighten/darken by 10%
Pressed state:       surfaceVariant + brighten/darken by 20%
```

### Accent Colors (CANONICAL)
```
Primary action:      theme.colors.accent    (#10B981 emerald)
Success:             theme.colors.accent    (#10B981 emerald)
Error:               theme.colors.error     (#EF4444 red)
Warning:             theme.colors.warning   (#F4A427 amber)
Info:                theme.colors.info      (#3B82F6 blue)
Secondary action:    theme.colors.surfaceVariant (neutral)
```

### Special Colors (For Category Icons)
```
purple:   #8B5CF6
indigo:   #5F63FF
pink:     #EC4899
blue:     #3B82F6
orange:   #F97316
skyBlue:  #38BDF8
```

### Opacity Rules
```
Disabled button:      opacity: 0.5
Hint text:           opacity: 0.7 (textSecondary)
Ghost element:       opacity: 0.3 (hovering state)
Glass effect:        opacity: 0.8-0.95 (layered surfaces)
Shadow with accent:  theme.colors.accent @ 0.15 opacity
```

### ❌ ANTI-PATTERNS
```
❌ DON'T use hardcoded colors (#FF0000, etc.) — use theme.colors.*
❌ DON'T use textSecondary for primary content — use text
❌ DON'T create contrast issues (textMuted on surfaceVariant) — check ratios
❌ DON'T use random accent colors for buttons — always use accent (#10B981)
```

---

## 6. LAYOUT PATTERNS (TEMPLATES)

### Full-Screen Card Pattern
```
┌─────────────────────────────────┐
│ padding[6]                      │  safe area top
│                                 │
│  Title (h2)                     │  h2 (24px)
│  spacing[4]                     │
│                                 │
│  [Card with border, rounded]    │
│  └─ padding[4] inside           │
│     Body text / content         │
│     spacing[3]                  │
│     Footer / CTA                │
│                                 │
│  spacing[4]                     │
│  padding[6]                     │  safe area bottom
│                                 │
└─────────────────────────────────┘
```

### Menu List Pattern
```
┌─────────────────────────────────┐
│  "Settings" (h2)                │  Title
│  spacing[4]                     │
│                                 │
│  ┌─ MenuItem padding[3] vert ──│ 48px
│  │ spacing[1]                  │
│  ├─────────────────────────────┤
│  │ ┌─ MenuItem padding[3] vert │ 48px
│  │ spacing[1]                  │
│  └─────────────────────────────┘
│  spacing[6]                     │
└─────────────────────────────────┘
```

### Two-Column Layout (Input + Button)
```
┌──────────────┬──────────────┐
│   Input      │   Button     │  height: 48px
│   flex: 1    │   flex: 0    │
│  (gap: [2])  │   (80px)     │
└──────────────┴──────────────┘
```

### Stacked Form Pattern
```
┌─────────────────────────────────┐
│  Form Title (h3)                │
│  spacing[4]                     │
│                                 │
│  Label (body)                   │
│  spacing[1]                     │
│  [Input field 44px]             │
│  spacing[3]                     │
│                                 │
│  Label (body)                   │
│  spacing[1]                     │
│  [Dropdown 44px]                │
│  spacing[4]                     │
│                                 │
│  [Full-width Button 52px]       │
│  spacing[6]                     │
└─────────────────────────────────┘
```

---

## 7. ANIMATION TIMING (CANONICAL)

### Standard Durations
```
Press feedback:      150ms      (button scale, ripple)
Fast entrance:       200ms      (fade in, slide)
Standard entrance:   250ms      (staggered list items)
Slow entrance:       350ms      (page transitions)
Breathing pulse:     2000ms     (CTA attention)
Transition out:      100-150ms  (fade, slide out)
```

### Easing Functions (Standard)
```
Press/release:       Easing.inOut(Easing.quad)
Entrance:            Easing.bezier(0.4, 0, 0.2, 1) (material ease-out)
Exit:                Easing.inOut(Easing.quad)
Breathing:           Easing.inOut(Easing.sin)
```

### Stagger Delay (Lists)
```
Item 1:  delay(0ms) or delay(150ms)
Item 2:  delay(30ms) or delay(180ms)
Item 3:  delay(60ms) or delay(210ms)
Item 4:  delay(90ms) or delay(240ms)
Item 5:  delay(120ms) or delay(270ms)
Max:     ~300ms total (don't exceed 400ms)
```

### ❌ ANTI-PATTERNS
```
❌ DON'T use arbitrary durations (275ms, 383ms) — stick to standard values
❌ DON'T stagger more than 300ms total — feels sluggish
❌ DON'T use slow animations (500ms+) on press feedback — feels janky
❌ DON'T animate everything — be selective (focus: CTAs, entrances, transitions)
```

---

## 8. COMPONENT COMPOSITION RULES

### Do (✅)
```tsx
✅ Use theme.colors.* for all colors
✅ Use theme.spacing[N] for all margins/padding
✅ Use theme.typography.sizes.* for all font sizes
✅ Use theme.radius.* for all border radius
✅ Memoize expensive renders (useMemo, React.memo)
✅ Extract inline styles to StyleSheet.create()
✅ Use FlatList for long lists (not ScrollView)
✅ Add loading states (skeleton, spinner)
✅ Add error states (fallback, retry)
✅ Add empty states (EmptyState component)
✅ Test on 375px, 412px, 480px widths
✅ Provide accessibility labels (accessibilityLabel, accessibilityRole)
```

### Don't (❌)
```tsx
❌ DON'T hardcode colors (#FFFFFF, #000000)
❌ DON'T hardcode spacing (20, 32, etc.)
❌ DON'T use undefined styling behavior
❌ DON'T nest styles deeply (hard to maintain)
❌ DON'T render long lists without virtualization
❌ DON'T forget loading/error states
❌ DON'T skip accessibility attributes
❌ DON'T use setTimeout for animations
❌ DON'T create large bundles in single component
❌ DON'T test only on one device size
```

---

## 9. SCREEN LAYOUT CHECKLIST

Use this for every new screen:

```
[ ] Title uses h2 (24px), weight 700
[ ] Sections separated by spacing[4] (16px)
[ ] Section headers use h3 (20px), weight 700
[ ] All text uses theme.typography.sizes.*
[ ] All colors use theme.colors.*
[ ] All spacing uses theme.spacing[N]
[ ] All radius uses theme.radius.*
[ ] Button height ≥ 48px (primary) or 44px (secondary)
[ ] Input field height ≥ 44px
[ ] Menu item height ≥ 48px
[ ] Padding inside cards: spacing[4] (16px)
[ ] Margin between sections: spacing[4] (16px)
[ ] Margin between items: spacing[2] (8px)
[ ] Icon + text gap: spacing[2] (8px)
[ ] Tested on 375px, 412px, 480px widths
[ ] Tested on both dark and light modes
[ ] Tested with long text (email, description)
[ ] Tested with empty state
[ ] Tested with loading state
[ ] Tested with error state
[ ] Accessibility labels on all interactive elements
[ ] No hardcoded colors, spacing, or sizes
[ ] Performance: <60ms frame time
[ ] No console warnings or errors
```

---

## 10. COMMON MISTAKES & FIXES

### Mistake 1: Inconsistent Font Sizes
```tsx
❌ WRONG:
<ThemedText style={{ fontSize: 15 }}>Label</ThemedText>
<ThemedText style={{ fontSize: 16 }}>Another Label</ThemedText>
<ThemedText style={{ fontSize: 14 }}>Sublabel</ThemedText>

✅ RIGHT:
<ThemedText style={{ fontSize: typography.sizes.body }}>Label</ThemedText>
<ThemedText style={{ fontSize: typography.sizes.body }}>Another Label</ThemedText>
<ThemedText style={{ fontSize: typography.sizes.label }}>Sublabel</ThemedText>
```

### Mistake 2: Over-Padding Menu Items
```tsx
❌ WRONG:
menuItem: {
  padding: spacing[4],  // 16px all sides = 68px height
  marginBottom: spacing[2.5],
}

✅ RIGHT:
menuItem: {
  paddingVertical: spacing[2.5],    // 10px top/bottom
  paddingHorizontal: spacing[3],    // 12px left/right
  marginBottom: spacing[1],         // 4px gap
  // Result: 48px height (efficient)
}
```

### Mistake 3: Mixing Color Assignments
```tsx
❌ WRONG:
<View style={{ backgroundColor: '#f5f5f5' }} />  // hardcoded
<View style={{ backgroundColor: theme.colors.surface }} />
<View style={{ color: '#333333' }} />            // hardcoded

✅ RIGHT:
<View style={{ backgroundColor: theme.colors.background }} />
<View style={{ backgroundColor: theme.colors.surface }} />
<Text style={{ color: theme.colors.text }} />
```

### Mistake 4: Ignoring Empty/Loading States
```tsx
❌ WRONG:
return <FlatList data={workouts} renderItem={...} />
// If workouts is empty → blank screen (bad UX)

✅ RIGHT:
if (loading) return <SkeletonList />;
if (error) return <ErrorState retry={retry} />;
if (workouts.length === 0) return <EmptyState />;
return <FlatList data={workouts} renderItem={...} />;
```

### Mistake 5: Keyboard Overlap on Android
```tsx
❌ WRONG:
<KeyboardAvoidingView behavior="padding">
  {/* Works on iOS but not Android */}
</KeyboardAvoidingView>

✅ RIGHT:
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.select({
    ios: insets.top + 44,
    android: 0,
  })}
>
  {/* Works on both iOS and Android */}
</KeyboardAvoidingView>
```

---

## Summary: Quick Reference

| Element | Font Size | Weight | Color | Spacing |
|---------|-----------|--------|-------|---------|
| **Page Title** | h2 (24px) | 700 | text | margin-bottom: [4] |
| **Section Header** | h3 (20px) | 700 | text | margin-bottom: [3] |
| **Card Title** | body (16px) | 600 | text | margin-bottom: [1] |
| **Body Text** | body (16px) | 400 | text | line-height: 24px |
| **Label** | label (13px) | 500 | textSecondary | margin-top: [1] |
| **Caption** | caption (12px) | 400 | textMuted | - |
| **Button** | bodySmall (14px) | 600 | onAccent | h: 48px, v-pad: [3] |
| **Input** | body (16px) | 400 | text | h: 44px, pad: [2.5] |
| **Menu Item** | body (16px) | 600 | text | h: 48px, pad: [2.5] vert |

---

**Document ID**: FQ-UI-GUIDELINES-v1.2.0  
**Owner**: Alfred Ω  
**Status**: CANONICAL (enforce in all code reviews)  
**Last Updated**: 2026-04-05
