# Workspace Repository Feature Synchronization Plan

> **Created**: 2026-02-18  
> **Status**: Active  
> **Priority**: High

## Executive Summary

This document outlines a phased integration strategy for synchronizing features from workspace repositories into FitQuest 2.0 Mobile. Each integration maintains app integrity through compatibility validation, incremental rollout, and rollback procedures.

---

## 1. Workspace Repository Inventory

### 1.1 Exercise Content (`workspace-repos/exercise-content/`)

| Repository | Description | Exercises | Data Quality |
|------------|-------------|-----------|--------------|
| `free-exercise-db` | Open-source exercise database | 870+ | High - JSON format, images, instructions |
| `exercises.json` | Alternative exercise catalog | 870+ | High - Similar schema, compatible |

**Current App State**: 720+ exercises in `src/database/seed.ts` via `exerciseGeneratorExpanded.ts`

**Gap Analysis**:
- External DBs have richer metadata (force type, mechanic, level)
- External DBs include exercise images (0.jpg, 1.jpg per exercise)
- Missing from current: Secondary muscle effectiveness ratings
- Missing from current: Video/GIF demonstrations

### 1.2 Health Integrations (`workspace-repos/health-integrations/`)

| Repository | Platform | Features |
|------------|----------|----------|
| `react-native-health-connect` | Android 8+ | Steps, heart rate, sleep, workouts, nutrition |
| `react-native-health` | iOS (HealthKit) | Same metrics via Apple Health |
| `react-native-google-fit` | Android (Legacy) | Deprecated - use Health Connect instead |

**Current App State**: On-device-only via `SensorFusionEngine.ts` (accelerometer/gyroscope)

**Gap Analysis**:
- No wearable sync (Fitbit, Garmin, Samsung, Apple Watch)
- No background health data collection
- Limited to device sensors only

### 1.3 Visualization (`workspace-repos/visualization/`)

| Repository | Version | Features |
|------------|---------|----------|
| `victory-native` | 35.5.5 | Full-featured charts (bar, line, pie, area, scatter) |
| `react-native-chart-kit` | 6.11.0 | Simple charts with Expo compatibility |
| `react-native-reanimated` | (Present) | Animation primitives (already in use) |

**Current App State**: Basic analytics in `app/analytics.tsx`, uses simple views

**Gap Analysis**:
- No trend visualization (7/30/90 day charts)
- No comparative analytics (week-over-week)
- No interactive charts (tap for details)

### 1.4 Document Viewing (`workspace-repos/top5/`)

| Repository | Purpose | Notes |
|------------|---------|-------|
| `react-native-pdf` | PDF viewing | Native performance, requires react-native-blob-util |
| `pdf.js` | PDF parsing | Mozilla's parser, web-based |
| `react-native-skia` | High-perf rendering | Skia graphics engine |
| `react-native-webview` | Web content | Fallback for complex documents |

**Current App State**: `fitmind-reader.tsx` uses web-based PDF approach (broken)

**Gap Analysis**:
- PDF viewing crashes (getConstants of null error - FIXED)
- EPUB reading not implemented
- No annotation persistence to native views

### 1.5 EPUB Reading (`workspace-repos/epub-alternatives/`)

| Repository | Description |
|------------|-------------|
| `epub.js` | JavaScript EPUB parser |
| `epub-js-intity` | Fork with fixes |
| `readium-r2-navigator-js` | Advanced navigation |

---

## 2. Feature Synchronization Phases

### Phase 1: Exercise Database Enhancement (Priority: HIGH)

**Objective**: Enrich exercise catalog with external data while preserving existing structure.

#### 1.1 Data Schema Mapping

```typescript
// External DB Schema → FitQuest Schema Mapping
interface ExternalExercise {
  name: string;           // → exercises.name
  force: 'push' | 'pull' | 'static';  // → NEW: force_type column
  level: string;          // → exercises.difficulty (with mapping)
  mechanic: 'compound' | 'isolation';  // → NEW: mechanic column
  equipment: string;      // → exercise_equipment (requires parsing)
  primaryMuscles: string[];    // → exercise_muscles (is_primary = 1)
  secondaryMuscles: string[];  // → exercise_muscles (is_primary = 0)
  instructions: string[];      // → exercises.instructions (JSON)
  category: string;            // → exercises.category (with mapping)
  images: string[];            // → NEW: exercise_images table
  id: string;                  // → exercises.id
}
```

#### 1.2 Implementation Steps

1. **Schema Migration (v10)**:
   ```sql
   -- New columns
   ALTER TABLE exercises ADD COLUMN force_type TEXT;
   ALTER TABLE exercises ADD COLUMN mechanic TEXT;
   
   -- New images table
   CREATE TABLE exercise_images (
     exercise_id TEXT NOT NULL,
     image_path TEXT NOT NULL,
     image_order INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (exercise_id, image_order),
     FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
   );
   ```

2. **Import Script**: Create `scripts/import-external-exercises.ts`
   - Parse both external DBs
   - Deduplicate by normalized name (lowercase, no spaces)
   - Merge metadata where FitQuest exercise exists
   - Insert new exercises with proper category mapping
   - Copy images to `assets/exercises/` directory

3. **Category Mapping**:
   ```typescript
   const categoryMap: Record<string, Category> = {
     'strength': 'building_muscle',
     'stretching': 'flexible',
     'cardio': 'faster',
     'plyometrics': 'faster',
     'strongman': 'building_muscle',
     'powerlifting': 'building_muscle',
     'olympic weightlifting': 'building_muscle',
   };
   ```

4. **Validation Criteria**:
   - Exercise name doesn't conflict with existing
   - All required fields present
   - Muscle groups map to `TargetMuscle` enum
   - Equipment maps to `EquipmentItem` enum

#### 1.3 Rollout Strategy

- Week 1: Schema migration + import script development
- Week 2: Test import with 100 exercises (validation)
- Week 3: Full import (870+ exercises)
- Week 4: UI updates to display images

---

### Phase 2: Workout Generator Restructure (Priority: HIGH)

**Objective**: Rebuild workout generation with cleaner architecture and better algorithms.

#### 2.1 Current Architecture Issues

- Monolithic `workoutGenerator.ts` (602 lines)
- Tightly coupled to database queries
- Limited customization options
- No A/B testing capability

#### 2.2 New Architecture

```
src/engines/workout/
├── WorkoutEngine.ts          # Main orchestrator
├── selectors/
│   ├── ExerciseSelector.ts   # Filters exercises by criteria
│   ├── MuscleBalancer.ts     # Ensures balanced muscle targeting
│   └── ProgressionSelector.ts # Picks appropriate difficulty
├── algorithms/
│   ├── FatigueAlgorithm.ts   # Fatigue decay model
│   ├── VolumeAlgorithm.ts    # Sets/reps calculation
│   └── RecoveryAlgorithm.ts  # Recovery time estimation
├── templates/
│   ├── FullBodyTemplate.ts
│   ├── PushPullTemplate.ts
│   ├── UpperLowerTemplate.ts
│   └── CustomTemplate.ts
└── types.ts                   # Shared interfaces
```

#### 2.3 Algorithm Improvements

1. **Enhanced Fatigue Model**:
   ```typescript
   // Current: simple decay
   fatigue = previous * 0.9;
   
   // Improved: exponential decay with muscle-specific rates
   fatigue = previous * Math.exp(-λ * hoursSinceWorkout);
   // λ varies by muscle group (larger muscles recover slower)
   ```

2. **Volume Landmarks**:
   ```typescript
   interface VolumeLandmarks {
     MV: number;   // Maintenance Volume (sets/week)
     MEV: number;  // Minimum Effective Volume
     MAV: number;  // Maximum Adaptive Volume
     MRV: number;  // Maximum Recoverable Volume
   }
   // Track volume per muscle group per week
   ```

3. **Progressive Overload**:
   - Track performance trend (last 4 sessions)
   - Auto-adjust reps/sets based on trend
   - Deload detection improved (fatigue > threshold + performance decline)

#### 2.4 Implementation Steps

1. Create new directory structure
2. Extract selectors from monolith
3. Implement new algorithms
4. Create template system
5. Add feature flag for A/B testing
6. Migrate gradually (old generator stays as fallback)

---

### Phase 3: Native Health Platform Integration (Priority: MEDIUM)

**Objective**: Connect to Android Health Connect and iOS HealthKit for comprehensive health data.

#### 3.1 Platform-Specific Implementation

**Android (Health Connect)**:
```typescript
// src/services/healthAdapters/HealthConnectAdapter.ts
import HealthConnect from 'react-native-health-connect';

export class HealthConnectAdapter implements HealthDataSource {
  async initialize(): Promise<boolean> {
    const available = await HealthConnect.isAvailable();
    if (!available) return false;
    
    return await HealthConnect.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'write', recordType: 'ExerciseSession' },
    ]);
  }
  
  async getSteps(startDate: Date, endDate: Date): Promise<StepRecord[]> {
    const records = await HealthConnect.readRecords('Steps', {
      timeRangeFilter: { startTime: startDate.toISOString(), endTime: endDate.toISOString() },
    });
    return records.map(r => ({ timestamp: r.startTime, count: r.count }));
  }
  
  async writeWorkout(session: WorkoutSession): Promise<void> {
    await HealthConnect.insertRecords([{
      recordType: 'ExerciseSession',
      startTime: session.startedAt,
      endTime: session.completedAt,
      exerciseType: HealthConnect.ExerciseType.STRENGTH_TRAINING,
    }]);
  }
}
```

**iOS (HealthKit)**:
```typescript
// src/services/healthAdapters/HealthKitAdapter.ts
import AppleHealthKit from 'react-native-health';

export class HealthKitAdapter implements HealthDataSource {
  async initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit({
        permissions: {
          read: ['Steps', 'HeartRate', 'SleepAnalysis'],
          write: ['Workout'],
        },
      }, (err) => resolve(!err));
    });
  }
  
  async getSteps(startDate: Date, endDate: Date): Promise<StepRecord[]> {
    return new Promise((resolve) => {
      AppleHealthKit.getDailyStepCountSamples(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        (err, results) => resolve(err ? [] : results.map(r => ({ 
          timestamp: r.startDate, 
          count: r.value 
        })))
      );
    });
  }
}
```

#### 3.2 Unified Adapter Interface

```typescript
// src/services/healthAdapters/types.ts
export interface HealthDataSource {
  initialize(): Promise<boolean>;
  getSteps(start: Date, end: Date): Promise<StepRecord[]>;
  getHeartRate(start: Date, end: Date): Promise<HeartRateRecord[]>;
  getSleep(start: Date, end: Date): Promise<SleepRecord[]>;
  writeWorkout(session: WorkoutSession): Promise<void>;
  syncToDevice(): Promise<void>;
}

// src/services/healthAdapters/index.ts
export function createHealthAdapter(): HealthDataSource {
  if (Platform.OS === 'ios') {
    return new HealthKitAdapter();
  } else if (Platform.OS === 'android') {
    return new HealthConnectAdapter();
  }
  return new LocalSensorAdapter(); // Fallback to existing SensorFusionEngine
}
```

#### 3.3 Data Flow

```
[Health Connect / HealthKit]
         ↓ (read)
[HealthDataSource adapter]
         ↓
[BackgroundHealthEngine] → [anomalyDetector]
         ↓
[encrypted_health_data (SQLite)]
         ↓
[Health Dashboard UI]
```

#### 3.4 Implementation Steps

1. Install dependencies: `react-native-health-connect`, `react-native-health`
2. Configure native projects (AndroidManifest.xml, Info.plist)
3. Create adapters with unified interface
4. Integrate with existing `BackgroundHealthEngine`
5. Add permission request UI flow
6. Test with real devices (emulator won't work for health APIs)

---

### Phase 4: Analytics Visualization (Priority: MEDIUM)

**Objective**: Replace basic analytics with interactive charts using Victory Native.

#### 4.1 Chart Components

```typescript
// src/components/charts/WorkoutTrendChart.tsx
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme } from 'victory-native';

export function WorkoutTrendChart({ data }: { data: DailyWorkoutData[] }) {
  return (
    <VictoryChart theme={VictoryTheme.material} domainPadding={20}>
      <VictoryAxis tickFormat={(t) => format(t, 'MMM d')} />
      <VictoryAxis dependentAxis tickFormat={(t) => `${t}m`} />
      <VictoryLine
        data={data}
        x="date"
        y="durationMinutes"
        style={{ data: { stroke: '#10B981' } }}
        animate={{ duration: 500 }}
      />
    </VictoryChart>
  );
}
```

#### 4.2 Charts to Implement

| Chart | Location | Data Source |
|-------|----------|-------------|
| Workout Duration Trend | analytics.tsx | workout_sessions |
| XP Progress | analytics.tsx | app_state (xp) |
| Muscle Group Distribution | analytics.tsx | session_exercises → exercises |
| Steps/Day | move.tsx | daily_steps |
| Jog Distance Over Time | move.tsx | jog_sessions |
| Heart Rate Zones | health-dashboard.tsx | heart_rate_readings |
| Sleep Quality Trend | health-dashboard.tsx | encrypted_health_data |
| Streak Calendar | dashboard.tsx | workout_streaks |

#### 4.3 Implementation Steps

1. Install `victory-native` and `react-native-svg`
2. Create themed chart wrapper component
3. Replace static analytics views with charts
4. Add touch interactions for data points
5. Implement date range selector (7d/30d/90d/1y)

---

### Phase 5: Enhanced Move Module (Priority: MEDIUM)

**Objective**: Improve step counter and jogging with detailed distance/pace tracking.

#### 5.1 Distance Measurement Improvements

```typescript
// src/engines/DistanceEngine.ts
import * as Location from 'expo-location';

export class DistanceEngine {
  private points: GeoPoint[] = [];
  private totalDistance = 0;
  
  async startTracking(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5, // Update every 5 meters
        timeInterval: 1000,  // Or every second
      },
      (location) => this.handleLocationUpdate(location)
    );
  }
  
  private handleLocationUpdate(location: LocationObject): void {
    const point: GeoPoint = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      altitude: location.coords.altitude,
      timestamp: location.timestamp,
      accuracy: location.coords.accuracy,
    };
    
    if (this.points.length > 0) {
      const prev = this.points[this.points.length - 1];
      const distance = this.haversineDistance(prev, point);
      
      // Filter out GPS jitter (ignore if accuracy worse than 20m)
      if (point.accuracy < 20 && distance > 2) {
        this.totalDistance += distance;
        this.points.push(point);
        this.emit('distance', this.totalDistance);
      }
    } else {
      this.points.push(point);
    }
  }
  
  private haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }
  
  // Calculate current pace (min/km)
  getCurrentPace(): number {
    if (this.points.length < 2) return 0;
    
    const lastPoints = this.points.slice(-10);
    const duration = (lastPoints[lastPoints.length - 1].timestamp - lastPoints[0].timestamp) / 1000 / 60;
    const distance = this.calculateSegmentDistance(lastPoints) / 1000;
    
    return duration / distance;
  }
}
```

#### 5.2 Enhanced Jog UI

- Live pace display (current, average, best)
- Elevation gain tracking
- Route map (using Mapbox/Google Maps SDK)
- Split times per kilometer
- Audio pace announcements

#### 5.3 Step Counter Enhancements

- Step stride estimation (height-based)
- Distance from steps (when GPS unavailable)
- Cadence tracking (steps per minute)
- Activity detection (walking vs running vs cycling)

---

### Phase 6: Document Reader Overhaul (Priority: LOW)

**Objective**: Fix PDF viewing and add EPUB support using native libraries.

#### 6.1 Architecture

```typescript
// src/fitmind/readers/ReaderFactory.ts
export function createReader(document: FitMindDocument): DocumentReader {
  switch (document.type) {
    case 'PDF':
      return new PDFReader(document);
    case 'EPUB':
      return new EPUBReader(document);
    case 'ARTICLE':
      return new ArticleReader(document);
    default:
      return new TextReader(document);
  }
}

// src/fitmind/readers/PDFReader.tsx
import Pdf from 'react-native-pdf';

export function PDFReaderView({ source, page, onPageChange }: PDFReaderProps) {
  return (
    <Pdf
      source={{ uri: source }}
      page={page}
      onPageChanged={onPageChange}
      style={{ flex: 1 }}
      trustAllCerts={false}
      enablePaging={true}
      horizontal={false}
    />
  );
}
```

#### 6.2 Implementation Steps

1. Remove broken web-based PDF viewer
2. Install `react-native-pdf` with blob util
3. Create native PDF component
4. Install epub.js for EPUB parsing
5. Create WebView-based EPUB renderer
6. Unify annotation system across readers

---

## 3. Dependencies & Prerequisites

### 3.1 New npm Packages

```json
{
  "dependencies": {
    "react-native-health-connect": "^3.0.0",
    "react-native-health": "^2.0.0",
    "victory-native": "^37.0.0",
    "react-native-pdf": "^7.0.0",
    "react-native-blob-util": "^0.19.0",
    "epub.js": "^0.3.0"
  }
}
```

### 3.2 Native Configuration

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.health.READ_STEPS"/>
<uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
<uses-permission android:name="android.permission.health.WRITE_EXERCISE"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
```

**iOS** (`ios/fitquest/Info.plist`):
```xml
<key>NSHealthShareUsageDescription</key>
<string>FitQuest uses health data to track your fitness progress</string>
<key>NSHealthUpdateUsageDescription</key>
<string>FitQuest records workouts to your health profile</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>FitQuest tracks your route during outdoor activities</string>
```

---

## 4. Risk Assessment & Rollback

### 4.1 Risk Matrix

| Phase | Risk | Impact | Mitigation |
|-------|------|--------|------------|
| Exercise Import | Schema corruption | High | Transaction-wrapped import, backup before migration |
| Workout Generator | Algorithm bugs | Medium | Feature flag, A/B testing, fallback to old generator |
| Health Integration | Permission failures | Low | Graceful degradation to local sensors |
| Visualization | Bundle size increase | Low | Lazy loading, tree shaking |
| Move Enhancement | GPS battery drain | Medium | Configurable tracking interval |
| Document Reader | Rendering issues | Low | Multiple reader fallbacks |

### 4.2 Rollback Procedures

Each phase has a dedicated rollback:

1. **Schema**: Keep migration down scripts in `src/database/migrations/`
2. **Feature**: Use feature flags in `src/services/featureFlags.ts`
3. **Package**: Pin versions in `package.json`, keep backup of working `package-lock.json`

---

## 5. Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Exercise DB | 2 weeks | None |
| Phase 2: Workout Generator | 3 weeks | Phase 1 complete |
| Phase 3: Health Integration | 2 weeks | Native build capability |
| Phase 4: Visualization | 1 week | Phase 3 partial |
| Phase 5: Move Enhancement | 2 weeks | Location permissions |
| Phase 6: Document Reader | 2 weeks | None |

**Total**: ~12 weeks (staggered, some parallel work possible)

---

## 6. Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Exercise count | 720 | 1,500+ | SELECT COUNT(*) FROM exercises |
| Workout variety score | N/A | >0.8 | Unique exercises per week / total |
| Health data sources | 1 (sensors) | 3+ (sensors + health platform + wearable) | Connected adapters |
| Chart interactions | 0 | 5+ per session | Analytics events |
| Move accuracy | ±15% | ±5% | Haversine vs GPS comparison |
| PDF load time | N/A (broken) | <2s | Performance monitoring |

---

## 7. Next Steps

1. **Immediate**: Review this plan with team
2. **Week 1**: Begin Phase 1 (exercise import script)
3. **Week 2**: Start Phase 2 design (workout generator architecture)
4. **Ongoing**: Update this document as phases complete

---

*Document maintained by: FitQuest Development Team*
