#!/bin/bash
# Copy exercise images to Android assets during prebuild.
#
# Called by the "postinstall" npm script or manually before building.
# This ensures the images survive `npx expo prebuild --clean`.
#
# Usage:
#   npm run copy:images
#   ./scripts/copy-exercise-assets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$PROJECT_ROOT/workspace-repos/exercise-content/free-exercise-db/exercises"
TARGET_DIR="$PROJECT_ROOT/android/app/src/main/assets/exercises"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "[copy-exercise-assets] Source not found: $SOURCE_DIR — skipping."
  exit 0
fi

# Only copy if android dir exists (after prebuild)
if [ ! -d "$PROJECT_ROOT/android/app/src/main/assets" ]; then
  echo "[copy-exercise-assets] Android assets dir doesn't exist yet — skipping."
  exit 0
fi

# Skip if already populated (idempotent)
if [ -d "$TARGET_DIR" ]; then
  EXISTING=$(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$EXISTING" -gt 800 ]; then
    echo "[copy-exercise-assets] Already have $EXISTING exercise dirs — skipping."
    exit 0
  fi
fi

echo "[copy-exercise-assets] Copying exercise images to Android assets..."
mkdir -p "$TARGET_DIR"
cp -r "$SOURCE_DIR"/* "$TARGET_DIR"/

COUNT=$(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "[copy-exercise-assets] Done. $COUNT exercise directories copied."
