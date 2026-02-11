# 🆘 FitQuest Mobile Theme System - Troubleshooting Guide

## Common Issues & Solutions

---

## 🎨 Colors Look Wrong

### Issue: Colors not changing when theme toggles
**Solution:**
1. Ensure you're using `theme.colors.*` not hardcoded hex
2. Check that component is wrapped in ThemeProvider
3. Import hooks from correct path: `src/context/ThemeContext`
4. Force reload: Press `r` in Expo terminal

### Issue: Light mode looks too bright/glaring
**Solution:**
- Background is intentionally #F4F5F7 (not pure white)
- This is correct - provides 3% softness without being dingy
- Verify using color picker

### Issue: Accent colors don't match design
**Solution:**
1. Check hex codes in `src/design/theme-system.ts`
2. Primary: #5F63FF
3. Energy: #F4A427
4. Success: #10B981
5. These are intentionally consistent across modes

---

## 📝 Text Issues

### Issue: Text not rendering with theme colors
**Solution:**
```tsx
// ❌ WRONG:
<Text style={{ color: '#000000' }}>Hello</Text>

// ✅ CORRECT:
<ThemedText>Hello</ThemedText>
// or
<ThemedText variant="body" color="primary">Hello</ThemedText>
```

### Issue: Text too small or too large
**Solution:**
Use ThemedText variants:
- h1, h2, h3, h4 (headings)
- body (16px default)
- bodySmall (14px)
- label (13px)
- caption (12px)

### Issue: Font weight not right
**Solution:**
```tsx
<ThemedText weight="600">
  Semibold text
</ThemedText>
```

Available weights: 400, 500, 600, 700

---

## 🔘 Button Issues

### Issue: Button styling not correct
**Solution:**
```tsx
// Always use Button component:
<Button variant="primary">Click Me</Button>

// Variants: primary | secondary | ghost | outline
// Sizes: sm | md | lg
```

### Issue: Button colors not themed
**Solution:**
Buttons read from theme automatically. Check:
1. Using theme-aware Button component
2. App wrapped in ThemeProvider
3. No inline styles overriding theme

---

## 🎯 Component Issues

### Issue: Card not showing shadow/border correctly
**Solution:**
```tsx
// Dark mode: elevated cards have shadows
// Light mode: all cards have borders

<Card variant={theme.isDark ? 'elevated' : 'flat'}>
  {/* content */}
</Card>
```

### Issue: Progress bars not animating
**Solution:**
```tsx
// Check progress is 0-1:
<ProgressBar progress={0.65} /> // ✅ 65%

// Not:
<ProgressBar progress={65} /> // ❌ WRONG
```

### Issue: StatRing (progress circle) missing glow
**Solution:**
- Glow only shows in dark mode
- Light mode shows solid color (intentional)
- Check `theme.isDark` is true for glow

---

## 🌓 Theme Switching Issues

### Issue: Theme doesn't toggle
**Solution:**
1. Check ThemeProvider wraps App:
```tsx
<ThemeProvider>
  <ApolloProvider>
    <Slot />
  </ApolloProvider>
</ThemeProvider>
```

2. Use correct hook:
```tsx
const { toggleTheme } = useTheme(); // ✅
const { theme } = useTheme(); // ✅
```

3. Call in correct context (must be inside provider)

### Issue: Theme doesn't persist after restart
**Solution:**
- AsyncStorage permission needed
- Check console for errors
- Clear app data and restart
- Check THEME_STORAGE_KEY isn't conflicting

### Issue: System color scheme not detected
**Solution:**
1. App defaults to dark mode ✓
2. System preference is fallback only
3. User preference (saved) takes priority
4. Order: Saved > System > Dark (default)

---

## ⚙️ Setup Issues

### Issue: Can't find ThemeContext import
**Solution:**
Correct path is:
```tsx
import { useTheme } from '../context/ThemeContext';
```

Not from src/theme or other locations

### Issue: Components not accepting theme props
**Solution:**
Core components are theme-aware by default:
- Button, Card, ThemedText, StatRing, ProgressBar
- They read theme internally
- No need to pass theme as prop

### Issue: Old theme.ts file causing conflicts
**Solution:**
- Keep old `src/theme/theme.ts` for compatibility
- Use `src/design/theme-system.ts` for new code
- Old file will be deprecated

---

## 🎬 Animation Issues

### Issue: Animations too slow in light mode
**Solution:**
Intentional by design:
- Dark mode: 250-350ms (dramatic)
- Light mode: 150-250ms (snappy)

To customize, edit `src/design/theme-system.ts`:
```tsx
motion: {
  fast: 150,  // Can change
  base: 250,  // Dark mode duration
  slow: 350,
}
```

### Issue: No glow effect visible
**Solution:**
Glow is dark-mode only:
```tsx
{theme.isDark && <View withGlow />}
```

This is intentional - light mode is clinical/flat

---

## 🔍 Visual Issues

### Issue: Borders too thick/thin in light mode
**Solution:**
Light mode uses 1px hairline borders:
```tsx
borderWidth: 1,
borderColor: theme.colors.border, // #DADDE3
```

This is correct and intentional

### Issue: Shadows too strong/weak
**Solution:**
Adjust in `src/design/theme-system.ts`:

Dark shadows:
```tsx
shadowOpacity: 0.12  // Adjust 0-1
shadowRadius: 8      // Adjust blur
```

Light shadows:
```tsx
shadowOpacity: 0.06  // Already subtle
shadowRadius: 3      // Already minimal
```

### Issue: Colors don't match screenshots
**Solution:**
1. Check display color profile
2. Use color picker to verify hex
3. Take screenshot of style-guide screen
4. Colors in system are:
   - #5F63FF (accent)
   - #F4A427 (energy)
   - #10B981 (success)

---

## 🆘 Advanced Troubleshooting

### Issue: TypeScript errors with theme
**Solution:**
```tsx
import { Theme } from '../design/theme-system';

const { theme }: { theme: Theme } = useTheme();
```

### Issue: Circular imports
**Solution:**
Import order matters:
1. theme-system.ts (core, no imports)
2. ThemeContext.tsx (imports theme-system)
3. Components (import ThemeContext)
4. Screens (import components)

### Issue: Memory leaks on theme switch
**Solution:**
Use proper cleanup:
```tsx
useEffect(() => {
  // Setup
  return () => {
    // Cleanup
  };
}, [theme.isDark]); // Depend on mode change
```

---

## 🆘 Getting Help

### Check These Files First:
1. **THEME_SYSTEM.md** - Comprehensive guide
2. **THEME_GUIDE.md** - Quick reference
3. **dashboard.tsx** - Working example
4. **ThemedText.tsx** - Component example

### Review Examples:
- See dashboard.tsx for full implementation
- See ThemedText.tsx for hook usage
- See Card.tsx for component pattern
- See ThemeContext.tsx for provider setup

### Test Your Code:
1. Copy working example
2. Modify step-by-step
3. Test in both modes
4. Check console for errors

---

## ✅ Verification Checklist

Before asking for help:
- [ ] Using correct import paths
- [ ] Component wrapped in ThemeProvider
- [ ] Using theme-aware components
- [ ] No hardcoded colors
- [ ] Tested in both modes
- [ ] Checked console errors
- [ ] Reloaded Expo (press 'r')
- [ ] Read the documentation

---

## 🎯 Common Patterns

### Pattern 1: Mode-Specific Content
```tsx
{theme.isDark ? (
  <GlowCard>Content</GlowCard>
) : (
  <FlatCard>Content</FlatCard>
)}
```

### Pattern 2: Conditional Styling
```tsx
style={[
  baseStyle,
  {
    ...theme.shadows[theme.isDark ? 'md' : 'none'],
  },
]}
```

### Pattern 3: Color Selection
```tsx
const accentColor = variant === 'energy' 
  ? theme.colors.accent2 
  : theme.colors.accent;
```

---

## 📞 Still Stuck?

1. Read THEME_SYSTEM.md carefully
2. Review working example (dashboard.tsx)
3. Check component source code
4. Look at ThemeContext implementation
5. Try simpler version first
6. Reload Expo completely
7. Check for console errors
8. Search codebase for similar pattern

Most issues are:
- Hardcoded colors → Use theme
- Wrong import path → Check path
- Not in provider → Wrap with ThemeProvider
- Mode not detected → Check hooks usage

**You've got this!** 💪
