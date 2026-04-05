# FitQuest UI/UX Enhancement Plan v1.2.0
## Comprehensive Audit & Strategic Roadmap

**Status**: Plan Phase  
**Prepared**: 2026-04-05  
**Target**: v1.2.0 (6-week sprint)  
**Priority**: Revenue-critical (Play Store launch readiness)

---

## EXECUTIVE SUMMARY

### Current State
- ✅ App is functionally stable (auth fixed, APK builds successfully)
- ⚠️ UI has consistency issues:
  - **Settings panel fonts too large** (bodyMid 15px for labels when body 16px is standard)
  - **Coach input bar keyboard overlap** (missing KeyboardAvoidingView adjustments)
  - **Image loading not optimized** (no placeholder states, inconsistent loading)
  - **No sign-in management in Settings** (critical for multi-account scenarios)
  - **AI Coach activation incomplete** (missing input feedback, no suggestion pills redesign)
  - **Notification system missing** (no in-app notification bar)
  - **Screen-level inconsistencies** (padding, typography hierarchy, spacing)

### Recommendation
**PAUSE advanced features.** Focus on consistency, polish, and revenue infrastructure:
1. **Typography audit** — normalize all screens to hierarchy
2. **Coach screen UX** — fix keyboard, redesign input, add activation flow
3. **Settings refactor** — compact sizing, add sign-in management
4. **Notification system** — lightweight in-app bar (no heavy alerts)
5. **Image optimization** — skeleton loading, lazy load, caching

---

## PART 1: TYPOGRAPHY & SIZING AUDIT

### Current Typography Scale (theme-system.ts)
```
mega:       120px  (hero splash screens only)
jumbo:       56px  (onboarding headings)
hero:        48px  (main headers)
displayLg:   40px  (section titles)
display:     36px  (section titles)
h1:          32px  (screen titles)
h1Sm:        28px  (compact titles)
h2:          24px  (subsection)
h3:          20px  (card headers)
h4:          18px  (labels)
body:        16px  ← STANDARD (main text)
bodyMid:     15px  ← ISSUE: Settings use this for labels
bodySmall:   14px  ← Should be for descriptions
label:       13px  ← Should be secondary labels
caption:     12px  ← Meta info, timestamps
captionSm:   11px  ← Minimal text
```

### Problem Identified
**Settings menu items (ProfileParts.tsx) use `bodyMid` (15px) for labels**
- Should be `body` (16px) for primary labels
- Menu sublabels use `label` (13px) — acceptable but could be `caption` (12px) for density

### Issue: Profile Screen Spacing
```tsx
// Current: MenuItem takes full width with large padding
menuStyles.menuItem: {
  padding: spacing[4],           // 16px — too generous
  marginBottom: spacing[2.5],    // 10px gap
  gap: spacing[3],               // 12px icon-to-text gap
}

// Result: Each menu item = 68px height (too large)
```

### Issue: Settings Presentation
The profile screen uses **large, card-based** layout suitable for dark mode drama but **wasteful for information density**. When launched on Play Store, users expect:
- **Compact settings** (mobile.twitter.com style, not settings.apple.com)
- **Inline toggles** (switches in-row, not as separate cards)
- **Minimal vertical scroll** (all essential settings visible without scrolling)

---

## PART 2: COACH SCREEN ISSUES

### Issue 1: Keyboard Overlap
**Current code (coach/index.tsx)**
```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
>
  {/* FlatList + InputBar */}
</KeyboardAvoidingView>
```

**Problems:**
1. Android uses `undefined` behavior — no avoidance
2. Bottom padding calculation is fragile:
   ```tsx
   paddingBottom: vm.keyboardVisible
     ? 12
     : Math.max(12, Math.max(8, insets.bottom + 2) + 64 + Math.max(0, insets.bottom - 4) + 4)
   ```
   → Formula is unmaintainable, doesn't account for Android nav bar

### Issue 2: Input Bar Not Prominent
- Input field has `maxHeight: 100` but no visual feedback during typing
- Send button is small (icon only)
- No character count, no "typing" indicator for user

### Issue 3: Quick Suggestions Misaligned
- Horizontal scroll of suggestion pills is good
- But pills don't wrap naturally — on small screens, only 2-3 visible
- Missing pagination dots

### Issue 4: No AI Coach "Activation" State
- User lands on coach screen → sees suggestions
- No tutorial/onboarding for coach feature
- No "What can I ask?" section with category hints

---

## PART 3: IMAGE LOADING & INCONSISTENCIES

### Current Issues
1. **Exercise images**: No fallback if image fails to load
   - Profile pictures load from local storage (good)
   - Exercise photos load from API — no skeleton state while loading
   
2. **Inconsistent use of ExerciseImage component**
   - Some screens use it, some use raw Image
   - No cached images (every load = fresh request)

3. **Network state handling**
   - App shows "offline" badge but doesn't adjust image behavior
   - No retry button for failed image loads

### Recommendation
- Implement **SkeletonLoader** for all image-heavy screens
- Use **react-native-fast-image** for caching + retry
- Add **error boundary per image** (show icon fallback, not white space)

---

## PART 4: MISSING SIGN-IN MANAGEMENT

### Current State
- Settings panel has NO way to view current account or sign out
- If user wants to switch accounts, no UI path
- Password change not available

### Solution Needed
**New "Account" Section in Settings:**
```
┌─ Account
│  ├─ Email: tumisang@example.com
│  ├─ Password (change)
│  ├─ Sign out
│  └─ Delete Account
```

This is **revenue-critical**:
- Users on free trial need to manage subscriptions
- Multi-device users need account view
- Support requests will spike without this

---

## PART 5: MISSING NOTIFICATION SYSTEM

### Current State
- No in-app notification bar
- All feedback is modal-based (blocks interaction)
- No toast for "copied to clipboard", "saved", etc.

### Recommendation
**Lightweight Notification Bar** (top-slide):
```
┌─────────────────────────────────┐
│ ✓ Workout saved!                │  (2s auto-dismiss)
└─────────────────────────────────┘
```

**Design:**
- Position: Top (below status bar), 4px margin
- Colors: 
  - Success: #10B981 (emerald)
  - Error: #EF4444 (red)
  - Info: #3B82F6 (blue)
  - Warning: #F4A427 (amber)
- Auto-dismiss: 2s (success/info), 5s (error/warning)
- Allow manual dismiss (swipe/tap)

---

## PART 6: SCREEN-BY-SCREEN CONSISTENCY GAPS

### Dashboard (app/dashboard.tsx)
| Check | Status | Issue |
|-------|--------|-------|
| Typography hierarchy | ⚠️ Mixed | H1 sometimes 32px, sometimes display |
| Spacing consistency | ✅ Good | Uses spacing[N] correctly |
| Button sizing | ✅ Good | CTA breathing pulse is nice |
| Empty state | ✅ Present | EmptyState component used |

**Action**: Audit all text sizes, normalize to h3/body/caption only

### Profile (app/profile.tsx)
| Check | Status | Issue |
|-------|--------|-------|
| Menu item height | ❌ Large | 68px per item = 8-item scroll = 1000vh+ |
| Font sizes | ❌ Inconsistent | bodyMid (15px) instead of body (16px) |
| Padding | ❌ Excessive | spacing[4] = 16px padding per side |
| Section headers | ✅ Good | SectionHeader component clean |

**Action**: Reduce padding to spacing[3], normalize fonts, optimize item height to 56px

### Coach (app/coach/index.tsx)
| Check | Status | Issue |
|-------|--------|-------|
| Keyboard handling | ❌ Broken | Android has no avoidance |
| Input bar | ⚠️ Small | Send button barely visible |
| Message bubbles | ✅ Good | MessageBubble component solid |
| Suggestions | ⚠️ Cramped | Horizontal scroll gets stuck |

**Action**: Redesign input bar, fix KeyboardAvoidingView for Android

### Onboarding (app/onboarding.tsx)
| Check | Status | Issue |
|-------|--------|-------|
| Typography | ✅ Good | Uses hero/display scale appropriately |
| Spacing | ✅ Good | Breathing room for immersion |
| Image reference | Your design | Age Verification screen is EXCELLENT |

**Action**: Use Age Verification as template for all onboarding screens

### Login/Register (app/login.tsx, app/register.tsx)
| Check | Status | Issue |
|-------|--------|-------|
| Font sizes | ❌ Large | Input labels oversized |
| Input field height | ⚠️ Varies | Inconsistent touch target |
| Button sizing | ✅ Good | Full-width CTA is correct |
| Error messages | ⚠️ Hidden | No visible validation feedback |

**Action**: Standardize input height, add inline validation feedback

---

## PART 7: DETAILED SOLUTIONS

### Solution 1: Normalize Typography (Urgent)

**Before:**
```tsx
// profile/ProfileParts.tsx
menuLabel: {
  fontSize: typography.sizes.bodyMid,   // 15px ← WRONG
  fontWeight: '600',
}
```

**After:**
```tsx
// CANONICAL: All primary labels use body (16px)
menuLabel: {
  fontSize: typography.sizes.body,       // 16px ✅
  fontWeight: '600',
}

// Sublabels use caption (12px) for density
menuSublabel: {
  fontSize: typography.sizes.caption,    // 12px ← reduced from label (13px)
  fontWeight: '400',
}
```

**Affected Files:**
- `src/components/profile/ProfileParts.tsx` — menuLabel, optionText
- `src/components/profile/ProfileModals.tsx` — modal option sizes
- `src/components/coach/ChatComponents.tsx` — message bubble text
- `src/components/profile/InlinePickers.tsx` — pill text

**Estimated effort**: 2 hours (global find-replace + testing)

---

### Solution 2: Compact Profile Menu (Urgent)

**Before:**
```tsx
menuItem: {
  padding: spacing[4],           // 16px all sides = 68px height
  marginBottom: spacing[2.5],    // 10px gap
}
// Result: 10-item menu = 1000vh scroll needed
```

**After:**
```tsx
menuItem: {
  paddingVertical: spacing[2.5], // 10px top/bottom = 48px height
  paddingHorizontal: spacing[3], // 12px left/right
  marginBottom: spacing[1],      // 4px gap (tighter list)
  gap: spacing[2],               // 8px icon-to-text (reduced)
}
// Result: 10-item menu = 480px = fits in viewport
```

**Additional Changes:**
```tsx
menuIconWrap: {
  width: 32,   // reduced from 38
  height: 32,
  // Icon size: 16 (reduced from 18)
}
```

**Estimated effort**: 1 hour

---

### Solution 3: Coach Input Bar Redesign (High Priority)

**Current Issue**: Send button is tiny circle, hard to tap on Android

**New Design:**
```tsx
// Input row: 48px height instead of variable
inputRow: {
  height: 48,
  paddingHorizontal: spacing[3],
  borderRadius: radius.lg,
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing[2],
}

// Send button: 40x40 (standard touch target)
sendButton: {
  width: 40,
  height: 40,
  borderRadius: radius.md,
  justifyContent: 'center',
  alignItems: 'center',
}

// Text input: fills remaining space
textInput: {
  flex: 1,
  height: 32,  // fits in 48px row with padding
  fontSize: typography.sizes.body,
  maxHeight: 80,  // allow 2-line expansion
}
```

**Android KeyboardAvoidingView Fix:**
```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.select({
    ios: insets.top + 44,  // Nav bar on iOS
    android: 0,            // Android handles it natively
  })}
>
```

**Estimated effort**: 3 hours (testing on both platforms)

---

### Solution 4: In-App Notification Bar

**New Component**: `src/components/ui/NotificationBar.tsx`

```tsx
interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;  // ms, 0 = manual dismiss
}

export function NotificationBar({ notification, onDismiss }: Props) {
  const { theme } = useTheme();
  
  const colorMap = {
    success: theme.colors.accent,      // #10B981
    error: theme.colors.error,         // #EF4444
    info: theme.colors.info,           // #3B82F6
    warning: theme.colors.warning,     // #F4A427
  };

  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={SlideOutUp.duration(200)}
      style={{
        backgroundColor: colorMap[notification.type],
        paddingVertical: spacing[2.5],
        paddingHorizontal: spacing[4],
        marginHorizontal: spacing[2],
        marginTop: spacing[2],
        borderRadius: radius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
      }}
    >
      <Icon name={iconMap[notification.type]} size={18} color={theme.colors.onAccent} />
      <Text style={{ color: theme.colors.onAccent, flex: 1 }}>
        {notification.message}
      </Text>
    </Animated.View>
  );
}
```

**Usage in App Layout**:
```tsx
// _layout.tsx
export default function RootLayout() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const notify = (type: string, message: string, duration = 2000) => {
    const id = uuid();
    setNotifications([...notifications, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(n => n.filter(x => x.id !== id));
      }, duration);
    }
  };

  return (
    <>
      {/* Notifications stack (max 2 visible) */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999 }}>
        {notifications.slice(0, 2).map(notif => (
          <NotificationBar 
            key={notif.id}
            notification={notif}
            onDismiss={() => /* remove */}
          />
        ))}
      </View>
      {/* ... rest of app */}
    </>
  );
}

// Export notify function globally
export const useNotification = () => ({ notify });
```

**Estimated effort**: 4 hours (component + integration + testing)

---

### Solution 5: Sign-In Management Section

**New Component**: `src/components/profile/AccountSection.tsx`

```tsx
interface AccountSectionProps {
  email: string;
  onChangePassword: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export function AccountSection({ email, onChangePassword, onSignOut, onDeleteAccount }: AccountSectionProps) {
  return (
    <View>
      <SectionHeader title="Account" />
      
      {/* Email (read-only) */}
      <MenuItem
        icon="email-outline"
        label="Email"
        sublabel={email}
        color={theme.colors.blue}
        rightContent={<MaterialCommunityIcons name="lock-outline" size={14} />}
      />
      
      {/* Password Change */}
      <MenuItem
        icon="lock-reset"
        label="Change Password"
        sublabel="Update your password"
        color={theme.colors.indigo}
        onPress={onChangePassword}
      />
      
      {/* Danger Zone */}
      <View style={{ marginTop: spacing[6], paddingTop: spacing[4], borderTopWidth: 1, borderTopColor: theme.colors.border }}>
        <SectionHeader title="Danger Zone" />
        <MenuItem
          icon="logout"
          label="Sign Out"
          color={theme.colors.warning}
          onPress={onSignOut}
        />
        <MenuItem
          icon="delete-forever"
          label="Delete Account"
          sublabel="This cannot be undone"
          color={theme.colors.error}
          onPress={onDeleteAccount}
        />
      </View>
    </View>
  );
}
```

**Integration**: Add to profile.tsx after "Subscription" section

**Estimated effort**: 3 hours (component + modals + backend calls)

---

### Solution 6: Image Loading States

**New Component**: `src/components/ui/ImagePlaceholder.tsx`

```tsx
export function ImageWithLoading({ uri, size = 64 }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(loaded ? 1 : 0);
  }, [loaded]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden' }}>
      {!loaded && (
        <View style={[
          { width: size, height: size },
          { backgroundColor: theme.colors.surfaceVariant },
        ]}>
          <Skeleton width={size} height={size} />
        </View>
      )}
      
      {failed ? (
        <View style={{ justifyContent: 'center', alignItems: 'center', width: size, height: size }}>
          <MaterialCommunityIcons name="image-off" size={24} color={theme.colors.textMuted} />
        </View>
      ) : (
        <Animated.Image
          source={{ uri }}
          style={[fadeStyle, { width: size, height: size }]}
          onLoadEnd={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
```

**Estimated effort**: 2 hours

---

## PART 8: SCREEN-BY-SCREEN REDESIGN CHECKLIST

### Phase 1: Typography & Spacing (Week 1)
- [ ] Normalize all font sizes to canonical scale (body, caption, label only)
- [ ] Reduce profile menu item height from 68px to 48px
- [ ] Audit all padding values (replace spacing[4] with spacing[3])
- [ ] Update THEME_GUIDE.md with normalized list

### Phase 2: Coach Screen (Week 2)
- [ ] Redesign input bar (40x40 send button, fixed height)
- [ ] Fix KeyboardAvoidingView for Android
- [ ] Add input placeholder animations
- [ ] Redesign quick suggestion pills (wrap on small screens)
- [ ] Add "What can I ask?" tutorial on first load

### Phase 3: Settings & Account (Week 2-3)
- [ ] Compact profile menu items
- [ ] Add Account section (email, password, sign out)
- [ ] Add Danger Zone (sign out, delete account)
- [ ] Inline toggles for social layer, notifications
- [ ] Test all screens at 375px width (small phones)

### Phase 4: Image Handling (Week 3)
- [ ] Implement ImageWithLoading component
- [ ] Audit all image usage in app
- [ ] Replace hardcoded Image with ImageWithLoading
- [ ] Add react-native-fast-image for caching
- [ ] Test offline + slow network conditions

### Phase 5: Notification System (Week 4)
- [ ] Build NotificationBar component
- [ ] Integrate into _layout.tsx
- [ ] Add notify() hook to context
- [ ] Use throughout app for feedback
- [ ] Test stacking (max 2 notifications)

### Phase 6: Polish & Testing (Week 5-6)
- [ ] Cross-screen typography audit
- [ ] Spacing consistency check
- [ ] Animation timing audit
- [ ] Test on 5-8 device sizes
- [ ] Accessibility review (contrast, touch targets)

---

## PART 9: DESIGN TOKENS & GUIDELINES

### UI Structuring Guideline

#### Typography Hierarchy (CANONICAL)
```
Page Title:         h2 (24px), weight 700, letter-spacing 0.5px
Section Header:     h3 (20px), weight 700, letter-spacing 0.3px
Primary Label:      body (16px), weight 600, letter-spacing 0.2px
Secondary Label:    label (13px), weight 500
Description Text:   bodySmall (14px), weight 400
Meta Info:          caption (12px), weight 400, color = textMuted
```

#### Spacing Rules (MANDATORY)
```
Margin between screens:    spacing[6] (24px) top/bottom
Margin between sections:   spacing[4] (16px) top/bottom
Margin between items:      spacing[2] (8px) between list items
Padding inside cards:      spacing[4] (16px) all sides
Padding inside buttons:    spacing[3] vertical, spacing[4] horizontal
Padding inside input:      spacing[2] horizontal, spacing[2.5] vertical
Gap between icon+text:     spacing[2] (8px)
```

#### Touch Targets (MANDATORY)
```
Primary button:    min 48px height
Secondary button:  min 44px height
Icon button:       min 44x44px
Menu item:         min 48px height
Input field:       min 44px height
```

#### Border Radius (CANONICAL)
```
Buttons:           radius.lg (12px)
Cards:             radius.xl (16px)
Small elements:    radius.md (8px)
Icons:             radius.lg (12px)
```

#### Animation Timing (CANONICAL)
```
Fast (press feedback):     150ms
Standard (screen enter):   250ms
Slow (page transition):    400ms
Breathing pulse:           2000ms cycle
```

---

## PART 10: APPROVAL CHECKLIST

### Before Development
- [ ] Review this plan with Kheleli
- [ ] Confirm Phase priority (1-6)
- [ ] Allocate 6-week sprint window
- [ ] Identify any design customizations vs. defaults

### During Development
- [ ] Each phase ends with PR (with screenshots)
- [ ] Cross-screen consistency verified
- [ ] Tested on 375px, 412px, 480px widths
- [ ] Tested on Android 11+ and iOS 14+

### Before Play Store Launch
- [ ] All 6 phases complete
- [ ] No console errors or warnings
- [ ] Accessibility audit passed (WCAG AA)
- [ ] Performance audit (no jank, <60ms frames)
- [ ] Screenshot consistency across screens

---

## APPENDIX: REFERENCE INSPIRATION

**Your Age Verification Screen** is the gold standard:
- ✅ Emerald green accent (#10B981)
- ✅ Clear typography hierarchy (h1 for "Age Verification", body for description)
- ✅ Breathing room (large empty space = luxury)
- ✅ Single focal point (checkbox, then CTA)
- ✅ CTA is full-width, 52px height, color #10B981
- ✅ No clutter, no secondary navigation

**Apply this pattern to:**
1. Login screen (email input + password + CTA)
2. Onboarding screens (hero image + description + CTA)
3. Coach activation (intro + suggestion pills + CTA)

---

## NEXT STEPS

1. **Review & Approve**: Share this doc with Kheleli
2. **Prioritize**: Confirm which phases to tackle in which order
3. **Create Issues**: Spawn one GitHub issue per phase
4. **Assign**: Allocate 2-3 days per phase
5. **Sprint**: Execute phases in sequence with daily standups

---

**Document ID**: FQ-UIUX-PLAN-v1.2.0  
**Owner**: Alfred Ω  
**Status**: DRAFT (awaiting approval)  
**Next Review**: After phase 1 completion
