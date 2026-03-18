#!/usr/bin/env bash
# Converts exercise images (JPG/PNG) to WebP in-place for APK size reduction.
# Resizes to max 512px (phone screens), quality 80.
# Requires: ImageMagick 7+ (magick command)
set -euo pipefail

ASSETS_DIR="android/app/src/main/assets/exercises"

if [[ ! -d "$ASSETS_DIR" ]]; then
  echo "ERROR: $ASSETS_DIR does not exist. Run prebuild + copy:images first."
  exit 1
fi

BEFORE_SIZE=$(du -sb "$ASSETS_DIR" | cut -f1)
echo "Before: $(du -sh "$ASSETS_DIR" | cut -f1)"

COUNT=0
TOTAL=$(find "$ASSETS_DIR" -type f \( -name "*.jpg" -o -name "*.png" \) | wc -l)
echo "Converting $TOTAL images to WebP..."

find "$ASSETS_DIR" -type f \( -name "*.jpg" -o -name "*.png" \) | while read -r img; do
  WEBP="${img%.*}.webp"
  magick "$img" -resize '512x512>' -quality 80 "$WEBP" && rm -f "$img"
  COUNT=$((COUNT + 1))
  if (( COUNT % 200 == 0 )); then
    echo "  Converted $COUNT / $TOTAL ..."
  fi
done

AFTER_SIZE=$(du -sb "$ASSETS_DIR" | cut -f1)
echo "After:  $(du -sh "$ASSETS_DIR" | cut -f1)"
echo "Saved:  $(( (BEFORE_SIZE - AFTER_SIZE) / 1024 / 1024 )) MB"
echo "Done."
