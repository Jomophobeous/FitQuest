#!/bin/bash
# Deploy exercise images to Android device/emulator via adb
#
# Usage:
#   npm run deploy:images
#   ./scripts/deploy-exercise-images.sh [--emulator]
#
# This copies exercise images from workspace-repos/exercise-content/free-exercise-db/exercises/
# to the app's document directory on the connected Android device.
#
# Prerequisites:
#   - adb in PATH
#   - Device/emulator connected
#   - App installed (document directory must exist)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$PROJECT_ROOT/workspace-repos/exercise-content/free-exercise-db/exercises"
PACKAGE_NAME="com.hugelet.fitquest"

# App document directory on Android
APP_DIR="/data/data/$PACKAGE_NAME/files/exercises"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: Source directory not found: $SOURCE_DIR"
  exit 1
fi

if ! command -v adb &> /dev/null; then
  echo "ERROR: adb not found in PATH"
  echo "Install Android SDK Platform Tools or add to PATH"
  exit 1
fi

# Check for connected device
DEVICE_COUNT=$(adb devices | grep -v "^List" | grep -c .)
if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "ERROR: No Android device/emulator connected"
  echo "Start an emulator or connect a device via USB"
  exit 1
fi

echo "=== FitQuest Exercise Image Deployer ==="
echo "Source: $SOURCE_DIR"
echo "Target: $APP_DIR"
echo ""

# Count source images
TOTAL_IMAGES=$(find "$SOURCE_DIR" -name "*.jpg" | wc -l)
echo "Found $TOTAL_IMAGES image files to deploy"

# Create temp directory with the right structure
TEMP_DIR=$(mktemp -d)
trap 'rm -rf $TEMP_DIR' EXIT

echo "Preparing images..."
COPIED=0
for EXERCISE_DIR in "$SOURCE_DIR"/*/; do
  # Ensure we only process directories
  [ -d "$EXERCISE_DIR" ] || continue

  EXERCISE_NAME=$(basename "$EXERCISE_DIR")
  TARGET_EXERCISE_DIR="$TEMP_DIR/$EXERCISE_NAME"
  mkdir -p "$TARGET_EXERCISE_DIR"

  # Copy jpg files directly (flat structure: ExerciseName/0.jpg, ExerciseName/1.jpg)
  for IMG in "$EXERCISE_DIR"*.jpg; do
    [ -f "$IMG" ] || continue
    cp "$IMG" "$TARGET_EXERCISE_DIR/"
    COPIED=$((COPIED + 1))
  done
done

echo "Prepared $COPIED images in temp directory"
echo ""
echo "Pushing to device via /data/local/tmp (fast bulk transfer)..."

# Step 1: Push all files to /data/local/tmp/exercises/ (accessible by run-as)
adb push "$TEMP_DIR/." "/data/local/tmp/exercises/"

# Step 2: Ensure exercise directories exist in app storage
adb shell "run-as $PACKAGE_NAME mkdir -p files/exercises" 2>/dev/null || true

# Step 3: Create a device-side copy script for batch operation
COPY_SCRIPT=$(mktemp)
cat > "$COPY_SCRIPT" << 'DEVSCRIPT'
SRC=/data/local/tmp/exercises
DST=files/exercises
COUNT=0

# Iterate using globbing, not ls output
for DIR in "$SRC"/*/; do
  [ -d "$DIR" ] || continue
  BASENAME=$(basename "$DIR")

  case "$BASENAME" in
    *.json) continue ;;
  esac

  mkdir -p "$DST/$BASENAME" 2>/dev/null
  for F in "$DIR"*.jpg; do
    [ -f "$F" ] || continue
    cp "$F" "$DST/$BASENAME/" 2>/dev/null && COUNT=$((COUNT + 1))
  done
done

echo "Copied $COUNT images"
DEVSCRIPT

adb push "$COPY_SCRIPT" /data/local/tmp/copy-images.sh
rm -f "$COPY_SCRIPT"
adb shell "chmod 755 /data/local/tmp/copy-images.sh"

echo "Copying images to app storage (single-session batch)..."
adb shell "run-as $PACKAGE_NAME sh /data/local/tmp/copy-images.sh"

# Cleanup temp on device
adb shell "rm -rf /data/local/tmp/exercises /data/local/tmp/copy-images.sh" 2>/dev/null || true

echo ""
echo "=== Deployment Summary ==="
echo "Images deployed: $COPIED"
echo "Restart the app to see exercise images"
echo ""
echo "Verify with: adb shell run-as $PACKAGE_NAME ls files/exercises/ | head -10"
