# Chat UI Research Notes — AI Coach Screen Redesign

## Research Date: 20 February 2026
## Source: Toptal Chatbot UX Best Practices + Industry Patterns

---

## Key Chat Screen UI Patterns

### 1. Message Layout
- **Bot messages**: Left-aligned, neutral/subtle background (glass card style), rounded corners with flat bottom-left
- **User messages**: Right-aligned, accent/gradient background, rounded corners with flat bottom-right
- **Avatar**: Small bot avatar icon inline with bot messages (builds personality)
- **Timestamps**: Subtle, below message, right-aligned
- **Date separators**: Centered pill badge ("Today", "Yesterday")

### 2. Input Bar (Critical)
- **Always visible** at bottom of screen, above keyboard when active
- **Free text input** is PRIMARY — users must be able to type anything
- **Send button**: Accent-colored when input has text, muted when empty
- **Placeholder text**: "Ask me anything..." or "Type a message..."
- **Single-line by default**, expands to multi-line for long messages
- **Return key**: Should send message (returnKeyType="send")
- **KeyboardAvoidingView**: Essential for iOS (behavior="padding")

### 3. Suggestions / Quick Replies
- **Shown BELOW the last bot message**, not as a permanent grid
- **Horizontal scrollable chips** (not a full-screen grid) — keeps focus on conversation
- **Contextual**: Change based on the last response topic
- **Disappear** after user sends a message (replaced by new ones after bot responds)
- **Max 3-5 suggestions** visible at a time

### 4. Typing Indicator
- Three animated dots in a bot message bubble
- Appears immediately after user sends message
- Duration: 500-1500ms simulated delay for rule-based bots

### 5. Bot Personality
- Warm, encouraging tone (not robotic)
- Use emojis sparingly but meaningfully
- Greeting adapts to context (streak, last workout, time of day)
- Fallback responses are varied (not repetitive)

### 6. Conversation Flow
- **Welcome message**: Sets expectations ("I can help with training, nutrition, recovery...")
- **Guided suggestions**: Help users discover capabilities without reading docs
- **Follow-up suggestions**: After each response, offer 2-3 related topics
- **Error handling**: "I'm not sure about that, but here's what I can help with..."

### 7. Visual Design (Dark Theme)
- Message area: Full width, no side gutters on bubbles
- Bot bubble: `surfaceVariant` background + `border` outline → glass effect
- User bubble: Gradient (accent → indigo) — stands out
- Input bar: Slightly elevated from chat area, `surface` background, rounded pill input
- Header: Bot name + avatar + online indicator (PulseDot)

### 8. Performance
- FlatList with `inverted` or `onContentSizeChange` auto-scroll
- `initialNumToRender`: Keep low (10-15)
- Keyboard handling: Platform-specific (iOS: padding, Android: manual offset or resize)

---

## How Rule-Based Bots Function (Mini LLM Pattern)

### Architecture
1. **Intent Detection**: Match user input keywords to predefined categories
2. **Context Injection**: Pull user data (streak, fatigue, goals) into response templates
3. **Response Templates**: Pre-written, topic-specific responses with dynamic data
4. **Follow-up Engine**: After each response, suggest related topics
5. **Fallback**: When no intent matches, show capability list

### Best Practices for Rule-Based Coaches
- **Topic detection**: Use keyword matching with fuzzy tolerance
- **Personalization**: Inject real user stats (streak, workout count, fatigue)
- **Conversation context**: Track last topic for follow-up suggestions
- **Don't pretend to be AI**: Use "BETA" badge, honest about capabilities
- **Redirect to actions**: "Would you like me to generate a workout?" → navigate to trainer

---

## FitQuest Coach Screen Implementation Plan

### Current State (Good)
- Already has TextInput with send button
- Already has typing indicator component
- Already has suggestion chips (but shown as a grid, not inline)
- Already has context loading (streak, fatigue, XP, goal)
- Already uses IntentRouter for smarter classification

### Changes Needed
1. **Make suggestions horizontal scrollable chips** (not full-screen grid)
2. **Show suggestions inline after bot messages** (not as a footer component)
3. **Ensure free text input is prominent and always accessible**
4. **Add time-of-day greeting** ("Good morning!" / "Good evening!")  
5. **Improve fallback responses** — more varied, less generic
6. **Better keyboard handling** — the input bar should stay visible above keyboard
7. **Add quick action buttons** that navigate (e.g., "Start Workout" → router.push)

---

## Black & Gold Theme Reference

### Color Palette
- **Background**: `#0D0D0D` (pure black)
- **Surface**: `#1A1A1A` (dark charcoal)
- **Surface Variant**: `#242424` (elevated)
- **Accent/Primary**: `#D4AF37` (classic gold)
- **Accent Secondary**: `#FFD700` (bright gold)
- **Text**: `#F5F0E1` (warm off-white)
- **Text Secondary**: `#B8A88A` (muted gold-beige)
- **Text Muted**: `#7A6F5D` (dark beige)
- **Border**: `#3D3428` (dark gold border)
- **Success**: `#D4AF37` (gold)
- **Warning**: `#E8A317` (amber gold)
- **Error**: `#C41E3A` (deep crimson)
- **On Accent**: `#0D0D0D` (black text on gold)

---
