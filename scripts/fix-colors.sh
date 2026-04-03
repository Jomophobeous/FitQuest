#!/bin/bash
# Batch A — Color Fix — Alfred Ω Cluster 6
set -e

FILES=$(find src app -name '*.ts' -o -name '*.tsx' | grep -v 'theme-system\|ui-system/tokens\|design-intelligence\|node_modules')

COUNT=0
CHANGED=0

for f in $FILES; do
  BEFORE=$(grep -c '#[0-9A-Fa-f]\{6\}' "$f" 2>/dev/null || true)
  if [ "$BEFORE" = "0" ]; then continue; fi

  # Greens
  sed -i "s/'#10B981'/theme.colors.accent/g" "$f"
  sed -i 's/"#10B981"/theme.colors.accent/g' "$f"
  sed -i "s/'#059669'/theme.colors.accentDark/g" "$f"
  sed -i 's/"#059669"/theme.colors.accentDark/g' "$f"
  sed -i "s/'#34D399'/theme.colors.accent/g" "$f"
  sed -i 's/"#34D399"/theme.colors.accent/g' "$f"
  sed -i "s/'#3D9E6F'/theme.colors.accent/g" "$f"
  sed -i 's/"#3D9E6F"/theme.colors.accent/g' "$f"
  sed -i "s/'#22C55E'/theme.colors.accent/g" "$f"
  sed -i 's/"#22C55E"/theme.colors.accent/g' "$f"
  sed -i "s/'#16A34A'/theme.colors.accentDark/g" "$f"
  sed -i 's/"#16A34A"/theme.colors.accentDark/g' "$f"
  sed -i "s/'#00FF99'/theme.colors.accent/g" "$f"
  sed -i 's/"#00FF99"/theme.colors.accent/g' "$f"

  # White/onAccent
  sed -i "s/'#FFFFFF'/theme.colors.onAccent/g" "$f"
  sed -i 's/"#FFFFFF"/theme.colors.onAccent/g' "$f"
  sed -i "s/'#ffffff'/theme.colors.onAccent/g" "$f"
  sed -i 's/"#ffffff"/theme.colors.onAccent/g' "$f"
  sed -i "s/'#FAFAFA'/theme.colors.onAccent/g" "$f"
  sed -i 's/"#FAFAFA"/theme.colors.onAccent/g' "$f"
  sed -i "s/'#F4F5F7'/theme.colors.text/g" "$f"
  sed -i 's/"#F4F5F7"/theme.colors.text/g' "$f"
  sed -i "s/'#F3F4F6'/theme.colors.text/g" "$f"
  sed -i 's/"#F3F4F6"/theme.colors.text/g' "$f"

  # Background/black
  sed -i "s/'#0A0E17'/theme.colors.background/g" "$f"
  sed -i 's/"#0A0E17"/theme.colors.background/g' "$f"
  sed -i "s/'#0D1117'/theme.colors.background/g" "$f"
  sed -i 's/"#0D1117"/theme.colors.background/g' "$f"
  sed -i "s/'#050810'/theme.colors.background/g" "$f"
  sed -i 's/"#050810"/theme.colors.background/g' "$f"
  sed -i "s/'#060609'/theme.colors.background/g" "$f"
  sed -i 's/"#060609"/theme.colors.background/g' "$f"
  sed -i "s/'#0D1321'/theme.colors.background/g" "$f"
  sed -i 's/"#0D1321"/theme.colors.background/g' "$f"
  sed -i "s/'#111827'/theme.colors.background/g" "$f"
  sed -i 's/"#111827"/theme.colors.background/g' "$f"

  # Red/error
  sed -i "s/'#EF4444'/theme.colors.error/g" "$f"
  sed -i 's/"#EF4444"/theme.colors.error/g' "$f"
  sed -i "s/'#ef4444'/theme.colors.error/g" "$f"
  sed -i 's/"#ef4444"/theme.colors.error/g' "$f"
  sed -i "s/'#DC2626'/theme.colors.error/g" "$f"
  sed -i 's/"#DC2626"/theme.colors.error/g' "$f"
  sed -i "s/'#B91C1C'/theme.colors.error/g" "$f"
  sed -i 's/"#B91C1C"/theme.colors.error/g' "$f"
  sed -i "s/'#F43F5E'/theme.colors.error/g" "$f"
  sed -i 's/"#F43F5E"/theme.colors.error/g' "$f"
  sed -i "s/'#7F1D1D'/theme.colors.error/g" "$f"
  sed -i 's/"#7F1D1D"/theme.colors.error/g' "$f"

  # Warning/amber
  sed -i "s/'#F59E0B'/theme.colors.warning/g" "$f"
  sed -i 's/"#F59E0B"/theme.colors.warning/g' "$f"
  sed -i "s/'#F4A427'/theme.colors.warning/g" "$f"
  sed -i 's/"#F4A427"/theme.colors.warning/g' "$f"
  sed -i "s/'#D97706'/theme.colors.warning/g" "$f"
  sed -i 's/"#D97706"/theme.colors.warning/g' "$f"
  sed -i "s/'#78350F'/theme.colors.warning/g" "$f"
  sed -i 's/"#78350F"/theme.colors.warning/g' "$f"

  # Blue/info
  sed -i "s/'#3B82F6'/theme.colors.info/g" "$f"
  sed -i 's/"#3B82F6"/theme.colors.info/g' "$f"
  sed -i "s/'#2563EB'/theme.colors.info/g" "$f"
  sed -i 's/"#2563EB"/theme.colors.info/g' "$f"
  sed -i "s/'#60A5FA'/theme.colors.info/g" "$f"
  sed -i 's/"#60A5FA"/theme.colors.info/g' "$f"
  sed -i "s/'#06B6D4'/theme.colors.info/g" "$f"
  sed -i 's/"#06B6D4"/theme.colors.info/g' "$f"

  # Cyan/skyBlue
  sed -i "s/'#22D3EE'/theme.colors.skyBlue/g" "$f"
  sed -i 's/"#22D3EE"/theme.colors.skyBlue/g' "$f"
  sed -i "s/'#38BDF8'/theme.colors.skyBlue/g" "$f"
  sed -i 's/"#38BDF8"/theme.colors.skyBlue/g' "$f"

  # Category colors
  sed -i "s/'#8B5CF6'/theme.colors.purple/g" "$f"
  sed -i 's/"#8B5CF6"/theme.colors.purple/g' "$f"
  sed -i "s/'#7C3AED'/theme.colors.purple/g" "$f"
  sed -i 's/"#7C3AED"/theme.colors.purple/g' "$f"
  sed -i "s/'#C084FC'/theme.colors.purpleLight/g" "$f"
  sed -i 's/"#C084FC"/theme.colors.purpleLight/g' "$f"
  sed -i "s/'#6366F1'/theme.colors.indigo/g" "$f"
  sed -i 's/"#6366F1"/theme.colors.indigo/g' "$f"
  sed -i "s/'#5F63FF'/theme.colors.indigo/g" "$f"
  sed -i 's/"#5F63FF"/theme.colors.indigo/g' "$f"
  sed -i "s/'#4338CA'/theme.colors.indigo/g" "$f"
  sed -i 's/"#4338CA"/theme.colors.indigo/g' "$f"
  sed -i "s/'#EC4899'/theme.colors.pink/g" "$f"
  sed -i 's/"#EC4899"/theme.colors.pink/g' "$f"
  sed -i "s/'#F97316'/theme.colors.orange/g" "$f"
  sed -i 's/"#F97316"/theme.colors.orange/g' "$f"

  # Grays
  sed -i "s/'#6B7280'/theme.colors.textMuted/g" "$f"
  sed -i 's/"#6B7280"/theme.colors.textMuted/g' "$f"
  sed -i "s/'#9CA3AF'/theme.colors.textSecondary/g" "$f"
  sed -i 's/"#9CA3AF"/theme.colors.textSecondary/g' "$f"
  sed -i "s/'#9ca3af'/theme.colors.textSecondary/g" "$f"
  sed -i 's/"#9ca3af"/theme.colors.textSecondary/g' "$f"
  sed -i "s/'#94A3B8'/theme.colors.textSecondary/g" "$f"
  sed -i 's/"#94A3B8"/theme.colors.textSecondary/g' "$f"
  sed -i "s/'#64748B'/theme.colors.textMuted/g" "$f"
  sed -i 's/"#64748B"/theme.colors.textMuted/g' "$f"
  sed -i "s/'#D1D5DB'/theme.colors.border/g" "$f"
  sed -i 's/"#D1D5DB"/theme.colors.border/g' "$f"
  sed -i "s/'#E5E7EB'/theme.colors.border/g" "$f"
  sed -i 's/"#E5E7EB"/theme.colors.border/g' "$f"

  # Dark surfaces
  sed -i "s/'#1F2937'/theme.colors.surface/g" "$f"
  sed -i 's/"#1F2937"/theme.colors.surface/g' "$f"
  sed -i "s/'#1E293B'/theme.colors.surface/g" "$f"
  sed -i 's/"#1E293B"/theme.colors.surface/g' "$f"
  sed -i "s/'#1A1F2E'/theme.colors.surface/g" "$f"
  sed -i 's/"#1A1F2E"/theme.colors.surface/g' "$f"
  sed -i "s/'#1a1f2e'/theme.colors.surface/g" "$f"
  sed -i 's/"#1a1f2e"/theme.colors.surface/g' "$f"
  sed -i "s/'#334155'/theme.colors.surfaceVariant/g" "$f"
  sed -i 's/"#334155"/theme.colors.surfaceVariant/g' "$f"

  # Gold
  sed -i "s/'#C9A84C'/theme.colors.accent/g" "$f"
  sed -i 's/"#C9A84C"/theme.colors.accent/g' "$f"
  sed -i "s/'#D4AF37'/theme.colors.accent/g" "$f"
  sed -i 's/"#D4AF37"/theme.colors.accent/g' "$f"
  sed -i "s/'#D1FAE5'/theme.colors.accent/g" "$f"
  sed -i 's/"#D1FAE5"/theme.colors.accent/g' "$f"

  AFTER=$(grep -c '#[0-9A-Fa-f]\{6\}' "$f" 2>/dev/null || true)
  if [ "$BEFORE" != "$AFTER" ]; then
    CHANGED=$((CHANGED + 1))
    echo "  $f: $BEFORE -> $AFTER hex values"
  fi
  COUNT=$((COUNT + 1))
done

echo ""
echo "=== BATCH A RESULTS ==="
echo "Files processed: $COUNT"
echo "Files changed: $CHANGED"
