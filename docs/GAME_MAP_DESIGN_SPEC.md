# FitQuest Game Map — Figma Design Spec

## Overview

A **game-like map visualization** embedded in the Move tab, displayed when a jog/walk is active or when reviewing past routes. Not a traditional Google Maps clone — this is a **stylized, heads-up-display (HUD) map** that makes running feel like navigating a sci-fi game world.

The map lives inside `app/move.tsx` as a new expandable card. When a jog starts, it auto-expands to a full-screen overlay. When idle, it shows a mini-map preview of the last route.

---

## Screen: `MoveGameMap`

**Container**: Full-screen overlay during active jog, collapsible GlassCard when idle.

### Layout (Top → Bottom)

```
┌──────────────────────────────────────────┐
│  [Status Bar — transparent]              │
│                                          │
│  ┌─ HUD Top Bar ──────────────────────┐  │
│  │  ← Back    LIVE ●    0:12:34       │  │
│  │            3.2 km                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ MAP CANVAS (fills remaining) ─────┐  │
│  │                                    │  │
│  │      ╱ route trail                 │  │
│  │     ╱  (glowing neon line)         │  │
│  │    ●━━━━━━━━━━━━●───────           │  │
│  │   start        YOU ◉              │  │
│  │                 ↑ heading cone     │  │
│  │                                    │  │
│  │   [1km] ──●── [2km] ──●── [3km]  │  │
│  │         split markers              │  │
│  │                                    │  │
│  │  ┌─ Compass Rose ─┐               │  │
│  │  │     N           │               │  │
│  │  │  W ● E          │               │  │
│  │  │     S           │               │  │
│  │  └─────────────────┘               │  │
│  │                                    │  │
│  │         ◌ Radar pulse ring         │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ Bottom Stats Tray ───────────────┐  │
│  │ ⚡ Pace   ↕ Elev   🔥 Cal   👟 Cad │  │
│  │ 5:23/km   +12m    187     162    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ ■ STOP JOG ]  (GradientButton)       │
│                                          │
└──────────────────────────────────────────┘
```

---

## 1. Axis Shift (Camera Follows User Heading)

**The entire map canvas rotates so the user's direction of travel is always "up".**

### Behavior
- Map orientation = compass heading of the device (via `expo-sensors` Magnetometer)
- When user turns right, the map rotates left — the route and landmarks shift, but "forward" is always screen-top
- Smooth rotation with spring animation (damping: 15, stiffness: 120) — no jank
- North indicator stays fixed to show true-north relative to current heading

### Figma Elements
- **Map canvas**: Dark background `#0A0E17` (matches app background)
- **Grid overlay**: Very subtle `#1E1E24` (border color) grid lines at 45° intervals that rotate with the map — gives sense of spatial movement
- **Compass rose**: Small 40x40 diamond in top-right of map canvas. Rotates opposite to the map. Shows N/S/E/W. Color: `#6B7590` (textMuted) with N arrow in `#10B981` (accent)

### Design Notes
- Draw 2-3 frames showing the map at different headings (0°, 45°, 90°) to demonstrate the rotation
- The route trail should curve naturally — don't use straight lines

---

## 2. User Position Marker

**A glowing dot with a heading cone showing direction of movement.**

### Visual
- **Outer glow**: 24px circle, radial gradient from `#10B981` at 60% opacity → transparent
- **Inner dot**: 12px solid circle `#10B981`
- **Core**: 4px white `#FFFFFF` center dot
- **Heading cone**: 60° arc extending 48px forward from the dot in the direction of travel. Gradient from `#10B981` at 20% opacity → transparent. Like a flashlight beam showing "where you're looking"

### Behavior
- Dot smoothly interpolates position (no teleporting)
- Heading cone rotates with device magnetometer
- When speed > 2 m/s (running), inner dot gains a subtle pulsing border animation (breathing at 1.5s cycle)
- When stationary, the heading cone fades to 5% opacity

### Figma Elements
- Draw the marker at 3x scale in a component sheet
- Show variants: `moving` (full glow + cone), `stationary` (dim glow, faded cone), `gps-lost` (orange dot `#F4A427`, no cone)

---

## 3. Radar Pulse (Beep Animation)

**A sonar-style pulse ring that emanates from the user's position at regular intervals.**

### Visual
- Ring starts at the user dot (12px radius) and expands to 120px radius over 2 seconds
- Color: `#10B981` starting at 30% opacity → 0% at full expansion
- Ring stroke width: 2px → 1px as it fades
- **Two rings** at any time — staggered 1 second apart for continuous rhythm

### Trigger Conditions
- **Every kilometer split**: Double-pulse (2 rapid rings in 0.5s) + haptic — celebration moment
- **Normal cadence**: Single pulse every 4 seconds during active jog
- **Idle**: No pulse when stationary

### Figma Elements
- Show 3 keyframes of the pulse: start (tight, opaque), mid (expanding, fading), end (full radius, transparent)
- Component variant: `normal`, `split-celebration` (uses `#F4A427` warning amber for the celebration pulse)

---

## 4. Route Trail (Neon Path)

**The path the user has traveled, rendered as a glowing neon line.**

### Visual
- **Trail line**: 4px stroke, color `#10B981`
- **Glow layer**: 12px stroke underneath, same color at 15% opacity (creates soft neon glow)
- **Gradient fade**: The trail fades from full opacity (recent) → 30% opacity (older segments)
- Trail only shows the last 2km of route to keep the canvas uncluttered — older path fades out

### Kilometer Split Markers
- Small diamond ◆ marker every 1km along the trail
- Diamond: 10px, filled with `#8B5CF6` (purple)
- Label below: "1km", "2km" etc. in 10px font, color `#A8B0C0` (textSecondary)

### Start Marker
- Pulsing circle at the jog start point
- 16px circle, `#3B82F6` (blue) with a soft glow ring
- Label: "START" in 9px caps, `#6B7590`

### Figma Elements
- Draw a sample route with curves (not straight) showing at least 3 splits
- Show the gradient fade on older segments
- Show how the route looks when the map is rotated (axis shift)

---

## 5. HUD Top Bar (Heads-Up Display)

**Floating glass-morphism bar at the top of the map showing live stats.**

### Layout
```
┌────────────────────────────────────────────┐
│  ← (back)     ● LIVE     ⏱ 0:12:34       │
│                                            │
│          ██████ 3.24 km ██████             │
│          (large, bold, centered)           │
└────────────────────────────────────────────┘
```

### Visual
- Background: `rgba(10, 14, 23, 0.85)` (dark with blur)
- `backdrop-filter: blur(20px)` (glass effect)
- Border-bottom: 1px `#1E1E24`
- "LIVE" badge: Pill shape, `#EF4444` (red) background, white text, with a `PulseDot` animation (existing component)
- Distance: 32px font, weight 900, `#F4F5F9` (text primary)
- Timer: 16px font, weight 600, `#A8B0C0` (textSecondary)

### Figma Elements
- Component with dark + light variants (use light theme colors for light mode)

---

## 6. Bottom Stats Tray

**Four-column stat bar at the bottom of the map, above the stop button.**

### Layout
```
┌──────┬──────┬──────┬──────┐
│ Pace │ Elev │  Cal │  Cad │
│5:23  │ +12m │ 187  │ 162  │
│/km   │      │      │ spm  │
└──────┴──────┴──────┴──────┘
```

### Visual
- Background: Glass card style, same as HUD top bar
- Each stat column:
  - Label: 10px, `#6B7590` (textMuted), uppercase
  - Value: 20px, weight 800, `#F4F5F9`
  - Unit: 10px, `#6B7590`
- Dividers between columns: Vertical line, 1px, `#1E1E24`
- When a stat changes dramatically (pace > 10% faster), the value text briefly flashes `#10B981` (accent) then returns to normal

### Figma Elements
- Component sheet with individual stat cells

---

## 7. Mini-Map Preview (Idle State)

**When not jogging, show a small preview card in the Move tab showing the last route.**

### Layout
```
┌─ GlassCard ────────────────────────────┐
│  📍 Last Run                   2.4 km │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │   (miniature route drawing)      │  │  ← 140px height
│  │   no map tiles, just the path    │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│  Yesterday · 24 min · 5:12/km avg     │
│                                       │
│  [ ▶ Start New Run ]  GradientButton  │
└───────────────────────────────────────┘
```

### Visual
- Card background: `surfaceVariant` with glass overlay
- Route drawing: Same neon trail style but scaled down and static
- Route centered and auto-fitted to card bounds with 16px padding
- Split markers visible as tiny dots
- If no previous run, show placeholder: dashed outline path with text "Your first route will appear here"

---

## 8. Additional Recommended Features

### 8a. Speed Gradient Trail
- Trail color shifts based on pace:
  - Fast pace (< 5:00/km): `#10B981` bright green
  - Medium pace (5:00–6:30/km): `#F4A427` amber
  - Slow/walking (> 6:30/km): `#EF4444` red
- Creates a heatmap-like trail showing where you sped up vs slowed down

### 8b. Distance Rings
- Concentric circles at 0.5km intervals centered on the start point
- Thin dashed lines, `#1E1E24` (border) color, very subtle
- Shows "how far from start" at a glance — like a target/radar
- Labels at 12 o'clock position: "0.5", "1.0", "1.5" in tiny text

### 8c. Elevation Profile Strip
- Thin strip (32px tall) at the very bottom edge of the map canvas, above the stats tray
- Simple area chart showing elevation over the route
- Fill: gradient from `#5F63FF` (indigo) 20% → transparent
- Current position highlighted with a vertical accent line

### 8d. Achievement Popups
- When hitting milestones (1km, 5km, new personal best pace), show a brief popup:
  ```
  ┌──────────────────────┐
  │  ⚡ 1 KM             │
  │  5:12 pace · +20 XP  │
  └──────────────────────┘
  ```
- Slides in from top, stays 2s, fades out
- Background: Glass with `#10B981` accent border-left (4px)
- XP integrates with existing `xpService`

### 8e. Ghost Trail (Future Feature)
- Show a previous run's route as a faded ghost trail (`#8B5CF6` purple at 15%)
- Your current position vs the ghost position shows if you're ahead or behind
- "Race yourself" mode

---

## Color Reference (Theme Tokens)

| Token              | Dark Mode   | Light Mode  | Use                        |
|--------------------| ----------- | ----------- | -------------------------- |
| `background`       | `#050507`   | `#F5F6F8`   | Map canvas background      |
| `surface`          | `#101014`   | `#FFFFFF`   | HUD bars, glass cards      |
| `surfaceVariant`   | `#18181D`   | `#EBEDF2`   | Secondary surfaces         |
| `text`             | `#F4F5F9`   | `#111318`   | Primary values             |
| `textSecondary`    | `#A8B0C0`   | `#4A4F5C`   | Labels                     |
| `textMuted`        | `#6B7590`   | `#6D7385`   | Units, meta text           |
| `border`           | `#1E1E24`   | `#D0D5DE`   | Grid lines, dividers       |
| `accent`           | `#10B981`   | `#10B981`   | Trail, user dot, actions   |
| `warning`          | `#F4A427`   | `#F4A427`   | Slow pace, celebrations    |
| `error`            | `#EF4444`   | `#EF4444`   | Very slow, stop button     |
| `purple`           | `#8B5CF6`   | `#8B5CF6`   | Split markers, ghost trail |
| `blue`             | `#3B82F6`   | `#3B82F6`   | Start marker               |
| `indigo`           | `#5F63FF`   | `#5F63FF`   | Elevation profile          |

---

## Code Integration Points

### Existing Data Sources (no new backend work needed)
| Data                | Source                                         |
| ------------------- | ---------------------------------------------- |
| GPS coordinates     | `DistanceEngine` → `GeoPoint[]` (lat, lng, altitude, speed, accuracy) |
| Heading/bearing     | `expo-sensors` Magnetometer (already in project deps) |
| Current pace        | `DistanceEngine` → `DistanceStats.currentPaceSecondsPerKm` |
| Kilometer splits    | `DistanceEngine` → `KilometerSplit[]`          |
| Total distance      | `DistanceEngine` → `DistanceStats.totalDistanceMeters` |
| Elevation           | `DistanceEngine` → `GeoPoint.altitude`         |
| Cadence             | `usePedometer()` → `cadence`                   |
| Calories            | `usePedometer()` → `jogStats.caloriesEstimate`  |
| Activity type       | `SensorFusionEngine` → `ActivityType`          |
| Route history       | `jog_sessions` table → `route_data` JSON column |
| XP awards           | `xpService.awardJogXP()`                       |

### New Component Structure
```
src/components/
  GameMap/
    GameMapOverlay.tsx      ← Full-screen active jog map
    GameMapPreview.tsx      ← Mini-map card for idle state
    RouteCanvas.tsx         ← Skia canvas drawing route + markers
    UserMarker.tsx          ← Glowing dot + heading cone
    RadarPulse.tsx          ← Sonar ring animation
    StatsHUD.tsx            ← Top bar + bottom stats tray
    CompassRose.tsx         ← Rotatable north indicator
    AchievementToast.tsx    ← Milestone popups
```

### Rendering Approach
- **`@shopify/react-native-skia`** for the route canvas (vector drawing, gradient trails, GPU-accelerated)
- **`react-native-reanimated`** for all animations (axis rotation, pulse, marker interpolation)
- **No map tile provider** — this is a pure vector/canvas visualization. No Mapbox, no Google Maps. The route is drawn on a blank canvas with a subtle grid. This keeps it lightweight, offline-capable, and game-like.

### Screen Entry Points
- `app/move.tsx` → imports `<GameMapPreview />` as an additional GlassCard
- `app/move.tsx` → when jog starts, renders `<GameMapOverlay />` as a full-screen Modal
- Connects to existing `usePedometer()` hook — no new state management needed

---

## Figma Deliverables Checklist

- [ ] **Full-screen active jog view** (dark mode)
- [ ] **Full-screen active jog view** (light mode)
- [ ] **Mini-map preview card** (idle, with route)
- [ ] **Mini-map preview card** (idle, no previous runs)
- [ ] **Component sheet**: User marker variants (moving, stationary, gps-lost)
- [ ] **Component sheet**: Radar pulse keyframes (normal, split-celebration)
- [ ] **Component sheet**: Split markers + start marker
- [ ] **Component sheet**: Achievement toast
- [ ] **Rotation demo**: 3 frames showing axis shift at 0°, 45°, 90°
- [ ] **Speed gradient trail**: Example showing pace color changes
- [ ] **Elevation strip**: Example with hills
