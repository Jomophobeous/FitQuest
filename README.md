# FitApp2 — Mobile (scaffold)

Quick notes for the design-system scaffold and how to run locally.

## Install
1. From the `mobile` folder run:

   npm install

2. Expo + native modules:
   - `react-native-reanimated` requires the Babel plugin. Add to `babel.config.js` (see Reanimated docs).
   - `lottie-react-native` may require additional native setup for bare projects (Expo-managed should work via `expo prebuild`/EAS).

## Dev
- Start the app (quick Expo Go smoke): `npm start` (then open in Expo Go or emulator).
- Open `App.tsx` to see `DesignSystemGallery` — a visual checklist of components.

## Objectives

See the project roadmap and execution plan in [OBJECTIVES.md](OBJECTIVES.md).

## Native / dev-client (Android) — required for Reanimated & Lottie
Follow these steps to run a native/dev-client build on Android (recommended for accurate native behavior):

1. Ensure Android Studio + an AVD are installed and running.
2. From `mobile/` run:

   npm install
   npx expo prebuild
   npx expo run:android

- Alternative (EAS dev client, more robust):
  - `eas build --profile development --platform android` then `npx expo start --dev-client`.

## Next manual steps (recommended)
- Verify `babel.config.js` includes `'react-native-reanimated/plugin'` (already added).
- If you see a crash on startup, run Metro with a clean cache: `npx expo start -c`.
- If native modules are missing in Expo Go, use the dev-client flow above (Expo Go won't include custom native modules).

## Troubleshooting
- Gradle / SDK errors: confirm `ANDROID_SDK_ROOT` and that Android Studio has SDK 31+ installed.
- Reanimated errors on startup: ensure the Reanimated plugin is the last plugin in `babel.config.js`, then restart Metro.
- If you need me to run the native build here, I can start it and report any errors I encounter.

I will next run the install + prebuild + an Android dev build and report results.
