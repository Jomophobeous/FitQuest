# ⚡ FitQuest Mobile Theme System - Quick Start Card

**TL;DR**: You have a complete dark & light theme system. Here's what to do.

---

## 🎬 See It Running Right Now

### Option A: Web (Fastest)
1. Check that Expo is running (`ps aux | grep expo`)
2. If not running: `cd mobile && npx expo start --clear`
3. Press `w` in terminal to open web view
4. Toggle theme to see dark ↔ light

### Option B: Mobile Device
1. Scan QR code from Expo terminal with Expo Go or Camera
2. App loads with mock data
3. Look for settings/profile to add ThemeToggle

---

## 🎨 What You Have

### Colors
- **Dark**: Matte black (#0A0E17) + glowing accents
- **Light**: Soft gray (#F4F5F7) + clean design
- **Both**: Same accent colors (#5F63FF, #F4A427, #10B981)

### Components
```
ThemedText    → Text with variants
Card          → Elevated/flat cards
Button        → 4 variants
StatRing      → Progress circles
ProgressBar   → Progress bars
ThemeToggle   → Switch modes
```

### Hooks
```
useTheme()    → Get theme & controls
useColors()   → Quick color access
```

---

## 🚀 Update Any Screen in 3 Steps

**Step 1: Add hook**
```tsx
import { useTheme } from '../context/ThemeContext';
const { theme } = useTheme();
```

**Step 2: Replace colors**
```tsx
backgroundColor: theme.colors.background  // Instead of hardcoded hex
color: theme.colors.text
```

**Step 3: Use components**
```tsx
<ThemedText variant="h2">Title</ThemedText>           // Instead of <Text>
<Card variant={theme.isDark ? 'elevated' : 'flat'}>   // Instead of <View>
<Button variant="primary">Click</Button>
```

**Done!** 🎉

---

## 📚 Documentation

| Need | File |
|------|------|
| Everything | **THEME_SYSTEM.md** ⭐ |
| Quick ref | THEME_GUIDE.md |
| Issues? | THEME_TROUBLESHOOTING.md |
| Summary | DESIGN_SYSTEM_COMPLETE.md |
| Checklist | README_DESIGN_SYSTEM.md |

**Start with THEME_SYSTEM.md** - it answers 99% of questions.

---

## 🔍 See Full Example

**Dashboard**: `app/dashboard.tsx` - Shows complete implementation
**Style Guide**: `app/style-guide.tsx` - Interactive color/component showcase

---

## ⚡ Quickest Wins

### Add Theme Toggle to Settings
```tsx
import ThemeToggle from '../components/ThemeToggle';

<ThemeToggle /> // That's it!
```

### Verify Colors Match Design
1. Open `app/style-guide.tsx` on device
2. See all colors side-by-side
3. Check they match your design mockups

### Test Light Mode Contrast
1. Toggle to light mode
2. Check text is readable
3. Verify no eye strain

---

## 🎯 Files to Know

```
src/design/theme-system.ts     ← Colors & tokens (edit here for changes)
src/context/ThemeContext.tsx   ← Provider & hooks
app/dashboard.tsx              ← Working example (copy patterns)
THEME_SYSTEM.md                ← Everything explained (read this)
```

---

## ✅ Status

- ✅ Dark mode implemented
- ✅ Light mode implemented  
- ✅ Components themed
- ✅ Documentation complete
- ✅ Example screens ready
- ✅ Hook system working
- ✅ Mock API active
- ✅ Ready to use!

**No additional setup needed.** Everything works out of the box! 🚀

---

## 🆘 Something Doesn't Work?

### Theme not toggling?
→ Check ThemeProvider wraps App in App.tsx

### Colors wrong?
→ Using theme.colors.* not hardcoded hex? If not, replace.

### Text not themed?
→ Using `<ThemedText>` component? If not, switch to it.

### Still stuck?
→ Read THEME_TROUBLESHOOTING.md (has solutions for common issues)

---

## 🚀 Next: Update Your Screens

1. Pick a screen (exercises.tsx, profile.tsx, etc.)
2. Copy pattern from dashboard.tsx
3. Replace colors with theme tokens
4. Replace text with ThemedText
5. Test in both modes
6. Repeat for all screens

That's it! You're building with the design system now. 🎉

---

**Questions?** → See THEME_SYSTEM.md  
**Example?** → Check app/dashboard.tsx  
**Quick help?** → Look at THEME_GUIDE.md

You're all set! Build amazing UIs with this system! ✨
