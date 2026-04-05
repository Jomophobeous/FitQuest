# FitQuest UI Component Specification v1.2.0
## New Widgets & Redesigned Components

---

## 1. NotificationBar Component

### Purpose
System-wide toast notifications (success, error, info, warning) that appear at top of screen without blocking interaction.

### Design Spec

```
Position:     Top (4px below status bar + safe area)
Width:        Full width - 8px margin
Height:       48px (with padding)
Z-Index:      9999 (above all content)
Animation:    SlideInDown 200ms, SlideOutUp 200ms
Max Stack:    2 notifications visible (3rd queued)
Auto-dismiss: 2s (success/info), 5s (error/warning), manual for critical
```

### Color Scheme
```
Success:  #10B981 (emerald green, accent color)
Error:    #EF4444 (red)
Info:     #3B82F6 (blue)
Warning:  #F4A427 (amber)
Text:     #FFFFFF (always white on colored bg)
```

### Anatomy
```
┌─────────────────────────────────┐
│ ✓ 📌 Message text               │
└─────────────────────────────────┘
 icon  |     content       | (x optional)
```

### States
- **Default**: Visible, auto-timer running
- **Hoverable**: User can tap to dismiss (X button right side, optional)
- **Stacked**: When 2+ queued, only top 2 visible
- **Exiting**: Slide out top, then removed from queue

### Code Structure
```tsx
// src/components/ui/NotificationBar.tsx

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;  // ms, 0 = manual dismiss only
  action?: {          // optional action button
    label: string;
    onPress: () => void;
  };
}

export function NotificationBar({ 
  notification, 
  onDismiss 
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  // Auto-dismiss timer
  // Icon mapping by type
  // Color mapping by type
  // Swipe-to-dismiss gesture
}
```

### Usage Context
```tsx
// In _layout.tsx, at top level
export const useNotification = (callback?: (n: Notification) => void) => {
  return {
    success: (msg: string, duration = 2000) => callback?.({ type: 'success', message: msg, duration }),
    error: (msg: string, duration = 5000) => callback?.({ type: 'error', message: msg, duration }),
    info: (msg: string, duration = 2000) => callback?.({ type: 'info', message: msg, duration }),
    warning: (msg: string, duration = 3000) => callback?.({ type: 'warning', message: msg, duration }),
  };
};

// In any component:
const { notify } = useNotification();
notify.success('Workout saved!');
notify.error('Failed to save. Retry?');
```

---

## 2. Coach Input Bar - Redesigned

### Problem
- Current: Circular send button (20px icon), hard to tap on Android
- Current: Variable height input (maxHeight: 100)
- Current: Android keyboard overlap not handled
- Current: No visual feedback during typing

### Solution

#### Layout (New)
```
┌─────────────────────────────────────────┐ height: 48px
│ 📎 [text input placeholder...] [📤]     │ flex row
└─────────────────────────────────────────┘

Icon (optional): 20px
Input field:     flex: 1, 32px
Send button:     40x40px (square with radius)
Spacing:         spacing[2] (8px) between elements
```

#### Input Field
```tsx
textInput: {
  flex: 1,
  height: 32,
  paddingVertical: spacing[1],
  paddingHorizontal: spacing[2],
  fontSize: typography.sizes.body,
  fontFamily: 'Inter-Regular',
  maxHeight: 80,  // allow 2-line messages
  color: theme.colors.text,
  backgroundColor: 'transparent',
}
```

#### Send Button (New Prominence)
```tsx
sendButton: {
  width: 40,
  height: 40,
  borderRadius: radius.md,
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: spacing[1],
}

// When disabled (empty input):
// backgroundColor: theme.colors.surfaceVariant
// opacity: 0.5

// When enabled:
// backgroundColor: theme.colors.accent (#10B981)
// Icon: arrow-up, size 20, color white
```

#### States
1. **Default** (idle, empty): Button disabled, muted color
2. **Typing**: Input focused, cursor visible, button enabled & vibrant
3. **Sending**: Button shows loading spinner (10ms rotation)
4. **Stopped** (user hits stop): Button shows X, allows cancel

#### Keyboard Handling (Android Fix)
```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.select({
    ios: insets.top + 44,  // Nav bar
    android: 0,            // Let native Android handle
  })}
>
  {/* FlatList + InputBar */}
</KeyboardAvoidingView>
```

### Animation
- **Press**: Scale 0.92 → 1.0 (150ms)
- **Focus**: Input border fade in (100ms)
- **Send**: Button pulse 1x (200ms)

---

## 3. Coach Screen - Quick Suggestion Pills (Redesigned)

### Problem
- Current: Horizontal ScrollView, only 2-3 pills visible on 375px screen
- Current: No pagination indicator
- Current: Pills don't hint at what coach can do

### Solution

#### Layout (New)
```
┌────────────────────────────────────┐
│ What can I help with?              │  label
│                                     │
│ 💪 [Design workout]  [Tired today] │  pill row 1
│ 📊 [Progress?]       [Eat better]  │  pill row 2
│ 🔥 [Warm-up]         [Recovery]    │  pill row 3
│                                     │
│ ← Suggested topics (swipe for more)│  pagination
└────────────────────────────────────┘
```

#### Pill Spec
```
Height:       36px
Padding:      spacing[2] horizontal, spacing[1.5] vertical
Border:       1px, radius.lg
Icon size:    14px
Font:         label (13px), weight 500
Gap:          spacing[2] between pills
```

#### Row Wrapping Logic
```tsx
// Instead of horizontal scroll, use FlatList with numColumns=2
<FlatList
  numColumns={2}
  data={quickSuggestions}
  columnWrapperStyle={{ gap: spacing[2], marginBottom: spacing[2] }}
  renderItem={({ item }) => <SuggestionPill ... />}
/>
```

#### States
- **Default**: Muted colors, slightly transparent
- **Press**: Scale 0.95, opacity pulse
- **Active**: After selection, pill fades out (200ms)

---

## 4. Coach Onboarding / Activation Flow

### Problem
- Current: User lands on empty chat, sees suggestions, doesn't know what coach does
- Current: No tutorial or "welcome to AI coach" state

### Solution

#### Activation Screen (First Load)
```
┌─────────────────────────────────┐
│        🤖 AI Coach               │  icon (50px)
│                                 │
│    Your Personal Trainer        │  h3
│                                 │
│ Get workout plans, nutrition    │  body (description)
│ tips, recovery advice, and      │
│ motivation—all in chat.          │
│                                 │
│  ✓ Personalized workouts        │  bullet point
│  ✓ Form tips & safety advice    │
│  ✓ Nutrition guidance           │
│  ✓ Recovery optimization        │
│                                 │
│ [Get Started →]                 │  full-width CTA
└─────────────────────────────────┘
```

#### UX Flow
1. User taps coach tab for first time
2. Shows activation screen (not full chat)
3. User taps "Get Started"
4. Transitions to chat with greeting message
5. Suggests 6 quick action pills
6. Input bar is ready for typing

#### Greeting Message (AI Coach)
```
"Hi [name]! 👋 I'm your AI Coach. I can:

💪 Design custom workouts
📊 Analyze your progress  
🍎 Give nutrition advice
🧘 Recommend recovery techniques
🔥 Keep you motivated

What would you like help with?"
```

---

## 5. Settings Panel - Redesigned (Compact)

### Problem
- Current: Menu items are 68px tall, require massive scroll
- Current: Padding is excessive (spacing[4] all sides)
- Current: Font sizes too large (bodyMid instead of body)

### Solution

#### New Specifications
```
Item Height:       48px (reduced from 68px)
Vertical Padding:  spacing[2.5] (10px)
Horizontal Pad:    spacing[3] (12px)
Margin Between:    spacing[1] (4px, tighter list)
Gap Icon→Text:     spacing[2] (8px)
Icon Size:         18px (from 18px, keep same)
Icon Bg Size:      32x32px (from 38x38px)
```

#### Typography
```
Label:   body (16px, was bodyMid 15px)
Sublabel: caption (12px, was label 13px)
```

#### Visual Change
```
BEFORE:                         AFTER:
┌──────────────────────┐        ┌──────────────────────┐
│  🎯 Training Goal    │ 68px   │ 🎯 Training Goal     │ 48px
│     Strength         │        │    Strength          │
├──────────────────────┤        ├──────────────────────┤
│  📅 Training Days    │ 68px   │ 📅 Training Days     │ 48px
│     3 days / week    │        │    3 days / week     │
├──────────────────────┤        ├──────────────────────┤
│  ⏱️  Session Length   │ 68px   │ ⏱️  Session Length    │ 48px
│     30 minutes       │        │    30 minutes        │
├──────────────────────┤        ├──────────────────────┤
│  📊 Experience       │ 68px   │ 📊 Experience        │ 48px
│     Beginner         │        │    Beginner          │
└──────────────────────┘        └──────────────────────┘

Total: 272px + gaps              Total: 192px + gaps
= 400vh scroll (ouch!)           = 80vh scroll (much better)
```

#### Account Section (New)
```
┌────────────────────────────────┐
│ Account                         │  section header
├────────────────────────────────┤
│ 📧 Email                        │ 48px
│    tumisang@gmail.com          │
├────────────────────────────────┤
│ 🔐 Change Password              │ 48px
│    Update your password        │
├────────────────────────────────┤
│ Danger Zone                     │  section header (red)
├────────────────────────────────┤
│ 🚪 Sign Out                      │ 48px (warning color)
├────────────────────────────────┤
│ ⚠️  Delete Account               │ 48px (error color)
│    This cannot be undone       │
└────────────────────────────────┘
```

---

## 6. ImageWithLoading Component

### Purpose
Skeleton loading + error fallback for all images (exercise photos, profile pictures, etc.)

### Spec
```
Default Size:      64x64px
States:            loading (skeleton), loaded, failed
Fallback Icon:     image-off (24px, textMuted color)
Loading Animation: Pulse (opacity 0.5 → 1.0, 1000ms cycle)
Error Icon:        image-off (muted color)
Border Radius:     radius.md (8px)
```

### Code
```tsx
// src/components/ui/ImageWithLoading.tsx

interface ImageWithLoadingProps {
  uri: string;
  size?: number;  // 64 by default
  borderRadius?: number;  // 8 by default
  onLoad?: () => void;
  onError?: () => void;
  cacheKey?: string;  // for fast-image
}

export function ImageWithLoading({
  uri,
  size = 64,
  borderRadius = 8,
  onLoad,
  onError,
  cacheKey,
}: ImageWithLoadingProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  
  return (
    <View style={{ width: size, height: size, borderRadius, overflow: 'hidden' }}>
      {!loaded && <SkeletonPulse width={size} height={size} />}
      
      {failed ? (
        <View style={{ justifyContent: 'center', alignItems: 'center', width: size, height: size }}>
          <Icon name="image-off" size={24} color={colors.textMuted} />
        </View>
      ) : (
        <FastImage
          source={{ uri, cacheKey }}
          style={{ width: size, height: size }}
          onLoadEnd={() => { setLoaded(true); onLoad?.(); }}
          onError={() => { setFailed(true); onError?.(); }}
        />
      )}
    </View>
  );
}
```

---

## 7. Inline Toggle Component (Settings Optimization)

### Problem
- Current: Toggles are separate menu items
- Result: Takes extra vertical space
- Solution: Put toggles inline (right side of row)

### Implementation
```tsx
// In ProfileParts.tsx, add rightContent to MenuItem

<MenuItem
  icon="bell-outline"
  label="Notifications"
  sublabel="Push & in-app alerts"
  color={theme.colors.blue}
  rightContent={
    <Switch
      value={notificationsEnabled}
      onValueChange={handleToggle}
      trackColor={{ false: theme.colors.border, true: theme.colors.accent + '40' }}
      thumbColor={notificationsEnabled ? theme.colors.accent : theme.colors.textMuted}
    />
  }
/>
```

### Result
```
┌─────────────────────────────────────┐
│ 🔔 Notifications    [toggle: ON]   │  48px
└─────────────────────────────────────┘
```

---

## 8. Error Boundary Per Image

### Problem
- Current: One failed image crashes the whole exercise list
- Solution: Graceful fallback per image

### Code
```tsx
// Wrap each image in error boundary

<ErrorBoundary fallback={<IconFallback name="image-off" />}>
  <ImageWithLoading uri={exercise.imageUrl} size={48} />
</ErrorBoundary>
```

---

## 9. Coach Message Bubble Improvements

### Current Issues
- Message text sometimes hard to read (low contrast on light bg)
- Long messages don't wrap well
- No timestamp on every message

### Solution

#### User Message
```
┌──────────────────────────────┐
│ Design a leg workout please! │  background: accent (#10B981)
│                       2:34 PM │  text: white
└──────────────────────────────┘  alignment: right
```

#### Coach Message
```
┌──────────────────────────────┐
│ Sure! Here's a plan:         │  background: surfaceVariant
│ 1. Warm-up: 5 min            │  text: theme.text
│ 2. Squats: 4x8 reps          │  alignment: left
│ ...                           │  timestamp below message
│                       2:35 PM │
└──────────────────────────────┘
```

#### Bubble Padding & Sizing
```tsx
bubble: {
  maxWidth: '85%',  // don't stretch across screen
  paddingVertical: spacing[3],
  paddingHorizontal: spacing[3.5],
  borderRadius: radius.lg,
  marginVertical: spacing[1],
  marginHorizontal: spacing[2],
}

timestamp: {
  fontSize: typography.sizes.captionSm,  // 11px
  color: theme.colors.textMuted,
  marginTop: spacing[1],
  textAlign: 'right',  // user msgs aligned right
}
```

---

## 10. Skeleton Loading States

### Screens That Need Skeletons
1. **Dashboard**: Profile header, stats grid, upcoming workouts list
2. **Profile**: Header, stats, sections
3. **Workouts**: List of saved workouts, workout detail
4. **Coach**: Message list initial load

### Skeleton Spec
```
Height (lines):     16px
Spacing between:    spacing[2] (8px)
Corner radius:      radius.sm (4px)
Animation:          Shimmer 1000ms (left-to-right)
Color:              surfaceVariant + 50% opacity
```

### Animation (Shimmer)
```tsx
const shimmerAnim = useSharedValue(0);

useEffect(() => {
  shimmerAnim.value = withRepeat(
    withTiming(1, { duration: 1000 }),
    -1,
    false,
  );
}, []);

const shimmerStyle = useAnimatedStyle(() => ({
  opacity: shimmerAnim.value * 0.5 + 0.5,  // 0.5 → 1.0 → 0.5
}));
```

---

## Summary: Component Checklist

| Component | New | Updated | Priority | Est. Hours |
|-----------|-----|---------|----------|-----------|
| NotificationBar | ✅ | - | High | 4 |
| Coach InputBar | - | ✅ | High | 3 |
| Coach Suggestions | - | ✅ | Medium | 2 |
| Coach Activation | ✅ | - | High | 3 |
| Settings Menu | - | ✅ | High | 2 |
| Account Section | ✅ | - | High | 3 |
| ImageWithLoading | ✅ | - | Medium | 2 |
| InlineToggle | - | ✅ | Medium | 1 |
| Message Bubbles | - | ✅ | Low | 2 |
| Skeleton States | ✅ | - | Medium | 3 |

**Total Estimated**: 25 hours = 3-4 days intensive dev + 1 week polish

---

**Document ID**: FQ-COMPONENTS-SPEC-v1.2.0  
**Owner**: Alfred Ω  
**Status**: DRAFT (ready for code review)
