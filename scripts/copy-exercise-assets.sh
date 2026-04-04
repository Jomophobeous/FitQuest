#!/usr/bin/env bash
# copy-exercise-assets.sh — Copy exercise images into the Android APK assets folder
#
# Source: workspace-repos/exercise-content/free-exercise-db/exercises/
# Target: android/app/src/main/assets/exercises/
#
# Each exercise folder contains 0.jpg (start pose) and 1.jpg (end pose).
# The ExerciseImage component loads from file:///android_asset/exercises/{name}/{frame}.jpg
#
# Usage:
#   bash scripts/copy-exercise-assets.sh          # copy as-is (jpg)
#   bash scripts/copy-exercise-assets.sh --webp   # convert to webp (requires cwebp)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_DIR="$PROJECT_ROOT/workspace-repos/exercise-content/free-exercise-db/exercises"
TARGET_DIR="$PROJECT_ROOT/android/app/src/main/assets/exercises"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: Source directory not found: $SOURCE_DIR"
  echo "Ensure workspace-repos/exercise-content/free-exercise-db/ is cloned."
  exit 1
fi

# Ensure target directory exists
mkdir -p "$TARGET_DIR"

USE_WEBP=false
if [ "${1:-}" = "--webp" ]; then
  if ! command -v cwebp &>/dev/null; then
    echo "WARNING: cwebp not found. Install with: sudo apt install webp"
    echo "Falling back to jpg copy."
  else
    USE_WEBP=true
  fi
fi

copied=0
skipped=0

# Copy only directories (exercise folders), not .json files
for exercise_dir in "$SOURCE_DIR"/*/; do
  [ -d "$exercise_dir" ] || continue
  
  exercise_name="$(basename "$exercise_dir")"
  target_exercise_dir="$TARGET_DIR/$exercise_name"
  mkdir -p "$target_exercise_dir"

  for img in "$exercise_dir"*.jpg "$exercise_dir"*.png; do
    [ -f "$img" ] || continue
    filename="$(basename "$img")"

    if [ "$USE_WEBP" = true ]; then
      webp_name="${filename%.*}.webp"
      target_file="$target_exercise_dir/$webp_name"
      if [ -f "$target_file" ]; then
        skipped=$((skipped + 1))
        continue
      fi
      cwebp -q 80 -quiet "$img" -o "$target_file"
    else
      target_file="$target_exercise_dir/$filename"
      if [ -f "$target_file" ]; then
        skipped=$((skipped + 1))
        continue
      fi
      cp "$img" "$target_file"
    fi
    copied=$((copied + 1))
  done
done

echo "Exercise assets deployed: $copied copied, $skipped skipped (already existed)"
echo "Target: $TARGET_DIR"
echo "Folders: $(find "$TARGET_DIR" -maxdepth 1 -type d | wc -l) exercise directories"
