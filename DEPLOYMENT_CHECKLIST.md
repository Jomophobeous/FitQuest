# Deployment Checklist

Target: Expo SDK 54, offline-first mobile app.

## Build & Release
- [ ] Verify `app.json` metadata: name, slug, version, icon, splash, scheme.
- [ ] Confirm `userInterfaceStyle` matches intended default (dark if required).
- [ ] Confirm `expo-updates` runtimeVersion policy and update URL.
- [ ] Verify Reanimated plugin is last in `babel.config.js`.
- [ ] Validate native permissions list (camera, notifications, location).

## Data & Migrations
- [ ] Single source of truth for schema in `src/database/schema.ts`.
- [ ] Increment `SCHEMA_VERSION` for any core table changes.
- [ ] Ensure seed runs after table creation; verify exercise seed counts.

## Security & Privacy
- [x] AES-256-GCM in encrypted storage.
- [x] No AsyncStorage usage for any persisted data.
- [x] Health metrics encrypted at rest.
- [x] Biometric session validation enforced for protected screens.
- [ ] Privacy disclosure + consent toggle for analytics.

## Monetization
- [x] RevenueCat configured with real API keys and entitlements.
- [ ] StoreKit / Play Billing compliance checks.
- [x] Restore purchases flow verified.
- [x] Offline license rules defined and tested.

## QA / Observability
- [x] Typecheck and lint in CI.
- [ ] Smoke tests for DB init, FitMind, encryptedDB.
- [x] Crash and error reporting configured.
- [x] Performance profiling for sensors and ML inference.
