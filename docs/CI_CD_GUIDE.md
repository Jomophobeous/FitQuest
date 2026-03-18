# FitQuest CI/CD Pipeline Guide

> Created: 18 March 2026
> Status: Ready to implement once GitHub repository is set up

---

## Overview

This guide covers setting up a GitHub Actions CI/CD pipeline for FitQuest. The pipeline will:
1. **On every push/PR:** Run TypeScript checks + unit tests (catches bugs like ACCENT_AMBER)
2. **On tagged releases:** Build a signed Android APK and upload to GitHub Releases
3. **Future:** Deploy to Google Play via EAS Build

---

## Step 1: Repository Setup

### Prerequisites
- GitHub account with a repository for FitQuest
- Secrets stored in GitHub (Settings → Secrets and variables → Actions)

### Required GitHub Secrets

| Secret Name | Value | Where to find it |
|---|---|---|
| `KEYSTORE_BASE64` | Base64-encoded release keystore | `base64 android/app/fitquest-release.keystore` |
| `KEYSTORE_PASSWORD` | `fitquest2026` | Your keystore password |
| `KEY_ALIAS` | `fitquest-key` | Your key alias |
| `KEY_PASSWORD` | `fitquest2026` | Your key password |
| `SENTRY_DSN` | `https://1d0698...@...sentry.io/...` | Your .env file |
| `POSTHOG_API_KEY` | `phc_nZZ4P3n...` | Your .env file |
| `SENTRY_AUTH_TOKEN` | (from sentry.io) | Sentry → Settings → Auth Tokens |

### Encode your keystore:
```bash
base64 -w 0 android/app/fitquest-release.keystore > keystore.b64
# Copy the contents of keystore.b64 to GitHub Secrets as KEYSTORE_BASE64
rm keystore.b64
```

---

## Step 2: CI Workflow (Runs on Every Push & PR)

Create `.github/workflows/ci.yml`:

```yaml
name: CI — Typecheck & Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  typecheck-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npx vitest run

      - name: Check for lint errors
        run: npx eslint app/ src/ --max-warnings 0
        continue-on-error: true  # Make strict once existing warnings are fixed
```

### What this catches:
- Undefined variables (like ACCENT_AMBER)
- Type mismatches
- Broken imports
- All 224+ unit test regressions
- Lint violations

---

## Step 3: Android Build Workflow (Runs on Tags)

Create `.github/workflows/build-android.yml`:

```yaml
name: Build Android APK

on:
  push:
    tags:
      - 'v*'  # Triggers on version tags like v2.3.1
  workflow_dispatch:  # Manual trigger from GitHub UI

jobs:
  build-apk:
    runs-on: ubuntu-latest
    timeout-minutes: 45

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21

      - name: Install dependencies
        run: npm ci

      - name: Create .env file
        run: |
          echo "EXPO_PUBLIC_SENTRY_DSN=${{ secrets.SENTRY_DSN }}" >> .env
          echo "EXPO_PUBLIC_POSTHOG_API_KEY=${{ secrets.POSTHOG_API_KEY }}" >> .env
          echo "EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com" >> .env

      - name: Decode keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/fitquest-release.keystore

      - name: Build release APK
        working-directory: android
        run: |
          ./gradlew assembleRelease \
            --no-daemon \
            --max-workers=2 \
            -x lint \
            -x lintVitalRelease \
            -Pandroid.injected.signing.store.file=$PWD/app/fitquest-release.keystore \
            -Pandroid.injected.signing.store.password=${{ secrets.KEYSTORE_PASSWORD }} \
            -Pandroid.injected.signing.key.alias=${{ secrets.KEY_ALIAS }} \
            -Pandroid.injected.signing.key.password=${{ secrets.KEY_PASSWORD }}

      - name: Verify APK signing
        run: |
          $ANDROID_HOME/build-tools/34.0.0/apksigner verify \
            --print-certs \
            android/app/build/outputs/apk/release/app-release.apk

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: fitquest-release-${{ github.ref_name }}
          path: android/app/build/outputs/apk/release/app-release.apk

      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          files: android/app/build/outputs/apk/release/app-release.apk
          generate_release_notes: true
```

### To trigger a build:
```bash
# Bump version in app.config.ts, then:
git tag v2.3.1
git push origin v2.3.1
# GitHub Actions will build the APK and create a release automatically
```

---

## Step 4: How Copilot Can Help (With GitHub Access)

If you give Copilot access to your GitHub repository, it can:

1. **Create the workflow files** directly in `.github/workflows/`
2. **Create pull requests** with the CI/CD configuration
3. **Debug failed builds** by reading GitHub Actions logs
4. **Bump versions** and create tags for releases
5. **Review CI results** on PRs before merging

### What you need to do:
1. Create a GitHub repository
2. Push your code: `git remote add origin <url> && git push -u origin main`
3. Add the secrets listed above in GitHub Settings
4. Create the workflow files (or let Copilot do it via PR)

---

## Step 5: Future — EAS Build for Play Store

Once your Google Play developer account is ready:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build for Play Store (AAB format)
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

Add to `.github/workflows/release.yml`:
```yaml
      - name: EAS Build & Submit
        if: startsWith(github.ref, 'refs/tags/v') && contains(github.ref, '-release')
        run: |
          npx eas-cli build --platform android --profile production --non-interactive
          npx eas-cli submit --platform android --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## Quick Reference

| Action | Command |
|---|---|
| Run tests locally | `npx vitest run` |
| TypeScript check | `npx tsc --noEmit` |
| Lint check | `npx eslint app/ src/` |
| Build APK locally | `cd android && ./gradlew assembleRelease --no-daemon --max-workers=1 -x lint -x lintVitalRelease` |
| Tag a release | `git tag v2.3.1 && git push origin v2.3.1` |
| Manual CI trigger | GitHub → Actions → "Build Android APK" → Run workflow |

---

## Version Bumping Checklist

Before each release:
1. Update `versionCode` in `android/app/build.gradle` (increment by 1)
2. Update `versionName` in `android/app/build.gradle` (semantic version)
3. Update version in `app.config.ts` to match
4. Commit: `git commit -am "bump: v2.3.1"`
5. Tag: `git tag v2.3.1`
6. Push: `git push && git push --tags`
