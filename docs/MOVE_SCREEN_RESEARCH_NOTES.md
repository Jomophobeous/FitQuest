# Move Screen Research Notes

## Overview
The Move screen (`app/move.tsx`) provides step counting and jog/walk tracking. This document captures research and design decisions for future reference.

## Stat Inconsistency Analysis

### Step Hero (Daily Tracking)
- **Source**: Native pedometer (`expo-sensors/Pedometer`) with SensorFusion fallback
- **Metrics displayed**:
  - `todaySteps` — Total steps since midnight (persisted in SQLite `daily_steps` table)
  - `distKm = todaySteps * 0.0007` — Estimated daily distance (assumes 0.7m average stride)
  - `calories = todaySteps * 0.04` — Estimated daily calories (~0.04 cal per step)
  - `activeMin = todaySteps / 100` — Estimated active minutes (~100 steps/min average)

### Jog Session (Session Tracking)
- **Source**: GPS (`distanceEngine.ts`) with accelerometer fallback (`stepCounterEngine.ts`)
- **Metrics displayed during active session**:
  - Timer elapsed (session duration)
  - Distance: `jogStats.totalDistanceMeters` (GPS) or `estimatedDistance` (step-based)
  - Pace: `jogStats.currentPaceSecondsPerKm` (GPS only) or cadence (steps/min)
  - Calories: `currentJog.distanceMeters * 0.06` (running ~60 cal/km)

### Why They Differ
| Metric | Step Hero | Jog Session |
|--------|-----------|-------------|
| **Scope** | Daily total | This session only |
| **Distance** | Step count × 0.7m | GPS tracking or stride-based |
| **Accuracy** | ±20% estimate | ±5m GPS or ±15% stride |
| **Persisted** | Yes (daily_steps table) | Yes (jog_sessions table) |

**Design Intent**: These are intentionally separate — step tracking is passive background utility, jog tracking is active workout mode.

## Scrollability Issue

### Problem
On smaller screens, the active jog card (`styles.activeJog`) with `minHeight: 180` could push the stop button below the fold, making it unreachable without scrolling. ScrollView was working but insufficient bottom padding.

### Solution Applied
1. Removed `minHeight: 180` from `activeJog` style to allow natural content flow
2. Increased `scrollContent.paddingBottom` from 32 to 100 for extra scroll room

### Testing Checklist
- [ ] Active jog on small screens (< 640px height)
- [ ] Stop button always visible/reachable
- [ ] GPS indicator + 3 stats + stop button fit without overflow

## Stop Button Visibility

### Button Location
Inside `GlassCard > activeJog > GradientButton` at bottom of jog card content.

### Accessibility
- High-contrast error colors (`theme.colors.error`)
- Clear "Stop Session" label with stop icon
- Haptic feedback on press

## GPS vs Accelerometer Fallback

### GPS Mode (Default)
- Uses `distanceEngine.startTracking()` → watches GPS position
- Updates every ~1-3 seconds with new coordinates
- Calculates cumulative distance, pace, elevation gain
- Shows "GPS Active" badge

### Fallback Mode (No GPS / Indoor)
- Uses `stepCounterEngine` stride estimation
- Estimates distance from step count × stride length (0.7m)
- Less accurate but works indoors
- No pace data, shows cadence instead

## XP Integration
- Jog completion awards XP via `awardJogXP(distanceMeters)`
- Formula: Base 50 XP + 10 XP per 100m
- Displayed in completion modal with animated counter

## Future Improvements
- [ ] Add "Session distance" vs "Daily distance" labels to clarify metrics
- [ ] Show session steps separately from daily total
- [ ] Add route visualization map (require react-native-maps)
- [ ] Heart rate integration (requires health connect)
