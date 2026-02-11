# Expo OTA Updates - Fix Documentation

## Problem
Remote updates were failing to download on Expo Go because the app was missing the `expo-updates` package and proper configuration in `app.json`.

## Root Cause
1. **Missing `expo-updates` package** - The dependency wasn't installed
2. **Missing `updates` configuration** in app.json - No URL or settings for OTA updates
3. **Missing `runtimeVersion`** - Required for update compatibility checking
4. **Missing `eas.json`** - EAS Build configuration for channels
5. **Inconsistent package identifiers** - Android package was `com.anonymous.mobile` instead of proper identifier

## Solution Applied

### 1. Installed expo-updates package
```bash
npm install expo-updates --legacy-peer-deps
```

### 2. Updated app.json with proper configuration

**Added `runtimeVersion`:**
```json
"runtimeVersion": {
  "policy": "appVersion"
}
```
This ensures updates are only applied to compatible app versions.

**Added `updates` configuration:**
```json
"updates": {
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 30000,
  "url": "https://u.expo.dev/5952667d-bab3-4bce-9cb0-be0106c98d01"
}
```
- `enabled: true` - Enables OTA updates
- `checkAutomatically: "ON_LOAD"` - Checks for updates when app starts
- `fallbackToCacheTimeout: 30000` - 30 second timeout before falling back to cached bundle
- `url` - Points to your EAS project's update server

**Added `expo-updates` plugin:**
```json
"plugins": [
  "expo-router",
  "expo-updates"
]
```

**Fixed package identifiers:**
- iOS bundleIdentifier: `com.hugelet.fitquest`
- Android package: `com.hugelet.fitquest`

### 3. Created eas.json for EAS Build

Configured three build channels:
- **development** - For development builds with dev client
- **preview** - Internal distribution for testing
- **production** - Production builds with auto-incrementing version

## How to Publish Updates

### First-time setup (if not already done):
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to your Expo account
eas login

# Configure project (only needed once)
eas build:configure
```

### Publishing an OTA update:
```bash
# Publish to development channel
eas update --channel development --message "Your update message"

# Publish to preview channel
eas update --channel preview --message "Your update message"

# Publish to production channel
eas update --channel production --message "Your update message"
```

### Building a new app version:
```bash
# Development build (with dev client)
eas build --platform android --profile development

# Preview build (internal testing)
eas build --platform android --profile preview

# Production build
eas build --platform android --profile production
```

## Verification

After applying these fixes:
1. Run `npx expo start --clear` to restart Metro with clean cache
2. Reload the app on your device
3. Check the Metro logs for any update-related errors
4. Publish a test update with `eas update --channel development --message "test"`

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added `expo-updates` dependency |
| `app.json` | Added `runtimeVersion`, `updates` config, `expo-updates` plugin, fixed package IDs |
| `eas.json` | Created new file with build/channel configuration |

## Date Fixed
February 6, 2026
