# FitQuest 2.0 — Translation Gap Analysis Report

**Date**: 24 March 2026
**Scope**: `src/i18n/translations.ts` (~20,000 lines), 15 languages
**Schema Version**: 20 (exercise_translations table)

---

## 1. Key Count Summary

| Language | Code | Total Keys | Delta vs EN |
|----------|------|-----------|-------------|
| English | `en` | **1,243** | — (reference) |
| Afrikaans | `af` | 1,209 | **-34** |
| isiZulu | `zu` | 1,209 | **-34** |
| isiXhosa | `xh` | 1,209 | **-34** |
| Sesotho | `st` | 1,209 | **-34** |
| Español | `es` | 1,209 | **-34** |
| Français | `fr` | 1,209 | **-34** |
| Deutsch | `de` | 1,209 | **-34** |
| Português | `pt` | 1,209 | **-34** |
| 中文 | `zh` | 1,209 | **-34** |
| 日本語 | `ja` | 1,209 | **-34** |
| 한국어 | `ko` | 1,209 | **-34** |
| العربية | `ar` | 1,209 | **-34** |
| हिन्दी | `hi` | 1,209 | **-34** |
| Kiswahili | `sw` | 1,212 | **-34**, +3 extra |

**Swahili extra keys**: `code`, `flag`, `name` — language metadata accidentally included. Cosmetic only.

---

## 2. Engine Key Coverage

**113/113 engine keys present in ALL 15 languages** ✅

| Prefix | Count |
|--------|-------|
| `signal.*` | 27 |
| `memory.*` | 27 |
| `failure.*` | 27 |
| `trial.*` | 20 |
| `simulation.*` | 11 |
| `gating.*` | 1 |

**5 engines** actively import `t()` from `engine-i18n.ts`:
- BehavioralSignalEngine.ts
- AdaptiveMemoryEngine.ts
- FailureAnalysisEngine.ts
- TrialProgressionEngine.ts
- StateSimulationEngine.ts

---

## 3. Missing Non-Engine Keys (34 keys × 14 languages = 476 total gaps)

All 14 non-English languages are identically missing the same 34 keys:

### `onboarding.*` — 20 keys (CRITICAL — compliance screens)
- `onboarding.ageGate.title` — Age Verification
- `onboarding.ageGate.description` — Privacy compliance prompt
- `onboarding.ageGate.confirm` — Age confirmation checkbox
- `onboarding.consent.title` — Data control heading
- `onboarding.consent.subtitle` — Introduction text
- `onboarding.consent.item.workout` — Workout history description
- `onboarding.consent.item.health` — Health metrics encryption notice
- `onboarding.consent.item.location` — Location usage description
- `onboarding.consent.item.storage` — AES-256 encryption notice
- `onboarding.consent.item.noShare` — No data sharing pledge
- `onboarding.consent.accept` — Consent button
- `onboarding.consent.readPolicy` — Privacy policy link
- `onboarding.disclaimer.title` — Health disclaimer heading
- `onboarding.disclaimer.subtitle` — Acknowledgement prompt
- `onboarding.disclaimer.item.notMedical` — Not a medical device
- `onboarding.disclaimer.item.consultDoctor` — Doctor consultation
- `onboarding.disclaimer.item.healthData` — Approximate health data
- `onboarding.disclaimer.item.stopIfPain` — Stop if pain
- `onboarding.disclaimer.item.responsibility` — Exercise at own risk
- `onboarding.disclaimer.accept` — Accept button

### `analytics.*` — 6 keys
- `analytics.sessionDetail`, `analytics.exercises`, `analytics.duration`
- `analytics.completed`, `analytics.noWorkouts`, `analytics.minAbbrev`

### `health.*` — 6 keys
- `health.noDataYet`, `health.sleepBedtime`, `health.sleepWakeTime`
- `health.sleepSaved`, `health.sleepInvalidTimes`, `health.sleepTooLong`

### `legal.*` — 2 keys
- `legal.privacy.bullets.thirdPartyExpo`
- `legal.privacy.bullets.thirdPartyPostHog`

---

## 4. Exercise Translation Table Status

| Item | Status |
|------|--------|
| Schema table `exercise_translations` | ✅ Created in migration v20 |
| ExerciseLocalizationService | ✅ Fully implemented |
| Fallback behavior | ✅ Falls back to English |
| **Current data** | **🔴 EMPTY** — no rows populated |
| Translation debt | ~400 exercises × 14 languages = ~5,600 rows needed |

---

## 5. engine-i18n.ts Sync Status

| Check | Status |
|-------|--------|
| Module exists | ✅ `src/i18n/engine-i18n.ts` |
| `setCurrentLanguage()` synced from LanguageContext | ✅ |
| `t()` with EN fallback + key fallback | ✅ |
| `{{var}}` interpolation | ✅ |
| Used by all 5 engines | ✅ |

---

## 6. Severity Assessment

| Gap | Severity | Impact |
|-----|----------|--------|
| 20 onboarding keys missing | 🔴 CRITICAL | Legal/compliance blocker for Google Play |
| 6 analytics keys missing | 🟡 MEDIUM | Raw keys shown on analytics screen |
| 6 health sleep keys missing | 🟡 MEDIUM | Raw keys in sleep logging UI |
| 2 legal privacy keys missing | 🟠 HIGH | Untranslated privacy policy descriptions |
| 3 extra keys in Swahili | 🟢 LOW | Cosmetic, no runtime impact |
| Exercise translations empty | 🟡 MEDIUM | Fallback to English works |

---

## 7. Recommendations

### Immediate (before next release)
1. Translate 34 missing keys into 14 languages — prioritize 20 onboarding compliance keys
2. Remove 3 stray metadata keys from Swahili

### Short-term
3. Populate `exercise_translations` table — start with top 6 languages
4. Add CI check comparing all language key counts to English

### Medium-term
5. Build exercise translation import pipeline
6. Consider splitting `translations.ts` into per-language files for maintainability
