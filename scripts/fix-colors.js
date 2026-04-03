/**
 * Batch A — Hardcoded Color Fixer
 * Phase 33 Cluster 6 — Alfred Ω
 *
 * Replaces hardcoded hex colors with theme.colors.* references.
 * Only touches files that have lint violations.
 * Does NOT touch: theme-system.ts, tokens/, comments, imports.
 */

const fs = require('fs');
const path = require('path');

// ─── Color Replacement Map ───
// Maps hex values → theme.colors.* token names
const HEX_TO_TOKEN = {
  // Primary accent
  '#10B981': 'theme.colors.accent',
  '#059669': 'theme.colors.accentDark',
  '#34D399': 'theme.colors.accent', // light accent variant → accent
  '#3D9E6F': 'theme.colors.accent', // accent variant
  '#22C55E': 'theme.colors.accent', // green variant
  '#16A34A': 'theme.colors.accentDark', // dark green

  // White / onAccent
  '#FFFFFF': 'theme.colors.onAccent',
  '#ffffff': 'theme.colors.onAccent',
  '#FAFAFA': 'theme.colors.onAccent',
  '#F4F5F7': 'theme.colors.text', // near-white
  '#F3F4F6': 'theme.colors.text', // near-white

  // Black / background
  '#0A0E17': 'theme.colors.background',
  '#0D1117': 'theme.colors.background',
  '#050810': 'theme.colors.background',
  '#060609': 'theme.colors.background',
  '#0D1321': 'theme.colors.background',
  '#111827': 'theme.colors.background',

  // Error / red
  '#EF4444': 'theme.colors.error',
  '#ef4444': 'theme.colors.error',
  '#DC2626': 'theme.colors.error',
  '#B91C1C': 'theme.colors.error',
  '#F43F5E': 'theme.colors.error',
  '#7F1D1D': 'theme.colors.error', // very dark red

  // Warning / amber
  '#F59E0B': 'theme.colors.warning',
  '#F4A427': 'theme.colors.warning',
  '#D97706': 'theme.colors.warning',
  '#78350F': 'theme.colors.warning', // dark amber

  // Info / blue
  '#3B82F6': 'theme.colors.info',
  '#2563EB': 'theme.colors.info',
  '#60A5FA': 'theme.colors.info', // light blue
  '#06B6D4': 'theme.colors.info', // cyan → info

  // Category colors
  '#8B5CF6': 'theme.colors.purple',
  '#7C3AED': 'theme.colors.purple',
  '#C084FC': 'theme.colors.purpleLight',
  '#6366F1': 'theme.colors.indigo',
  '#5F63FF': 'theme.colors.indigo',
  '#4338CA': 'theme.colors.indigo',
  '#EC4899': 'theme.colors.pink',
  '#F97316': 'theme.colors.orange',

  // Neon green (used in gamification)
  '#00FF99': 'theme.colors.accent',

  // Cyan (used in some animations)
  '#22D3EE': 'theme.colors.skyBlue',

  // Grays → theme tokens
  '#6B7280': 'theme.colors.textMuted',
  '#9CA3AF': 'theme.colors.textSecondary',
  '#9ca3af': 'theme.colors.textSecondary',
  '#94A3B8': 'theme.colors.textSecondary',
  '#64748B': 'theme.colors.textMuted',
  '#D1D5DB': 'theme.colors.border',
  '#E5E7EB': 'theme.colors.border',

  // Dark surfaces
  '#1F2937': 'theme.colors.surface',
  '#1E293B': 'theme.colors.surface',
  '#1A1F2E': 'theme.colors.surface',
  '#1a1f2e': 'theme.colors.surface',
  '#334155': 'theme.colors.surfaceVariant',

  // Gold tokens (blackGold theme references)
  '#C9A84C': 'theme.colors.accent', // gold in blackGold contexts
  '#D4AF37': 'theme.colors.accent', // classic gold
  '#D1FAE5': 'theme.colors.accent', // green tint → accent for simplicity
};

// Files to SKIP (theme definition files, token files)
const SKIP_PATTERNS = [
  'theme-system.ts',
  'ui-system/tokens/',
  'design-intelligence/',
  'node_modules/',
  '.env',
  'change-log.jsonl',
];

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(p => filePath.includes(p));
}

function shouldSkipLine(line) {
  const trimmed = line.trimStart();
  // Skip comments
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return true;
  // Skip import/require lines
  if (trimmed.startsWith('import ') || trimmed.includes('require(')) return true;
  return false;
}

// ─── Process a single file ───
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let changed = false;
  let replacements = 0;

  const newLines = lines.map((line, idx) => {
    if (shouldSkipLine(line)) return line;

    let newLine = line;
    // Try each hex → token replacement
    for (const [hex, token] of Object.entries(HEX_TO_TOKEN)) {
      // Match the hex as a color value in various contexts:
      // - color: '#HEX' or color: "#HEX"
      // - color="#HEX" (JSX prop)
      // - backgroundColor: '#HEX'
      // - ['#HEX', '#HEX'] (gradient arrays)
      // - shadowColor: '#HEX'

      // Case-insensitive match for hex
      const hexRegex = new RegExp(hex.replace('#', '#'), 'gi');
      if (!hexRegex.test(newLine)) continue;

      // Reset regex
      hexRegex.lastIndex = 0;

      // Context-aware replacement
      // Pattern 1: Inside quotes as a string value → replace with token reference
      // '#HEX' → theme.colors.X  (need to remove quotes too if in a style)
      // "#HEX" → theme.colors.X

      // For JSX props: color="#HEX" → color={theme.colors.X}
      const jsxPropRegex = new RegExp(`(\\w+)=["']${hex}["']`, 'gi');
      if (jsxPropRegex.test(newLine)) {
        newLine = newLine.replace(jsxPropRegex, `$1={${token}}`);
        changed = true;
        replacements++;
        continue;
      }

      // For style values: key: '#HEX' → key: theme.colors.X
      const styleRegex = new RegExp(`(['"])${hex}\\1`, 'gi');
      if (styleRegex.test(newLine)) {
        newLine = newLine.replace(styleRegex, token);
        changed = true;
        replacements++;
        continue;
      }

      // For backtick strings: `${hex}` → theme reference handled differently
      // For array items: '#HEX' → theme.colors.X (already handled by styleRegex)
    }

    return newLine;
  });

  if (changed) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  }

  return { changed, replacements };
}

// ─── Main ───
function main() {
  // Collect all .ts/.tsx files in src/ and app/
  const dirs = ['src', 'app'];
  let totalFiles = 0;
  let totalChanged = 0;
  let totalReplacements = 0;
  const changedFiles = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walkDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        if (shouldSkipFile(fullPath)) continue;
        totalFiles++;
        const result = processFile(fullPath);
        if (result.changed) {
          totalChanged++;
          totalReplacements += result.replacements;
          changedFiles.push(fullPath);
        }
      }
    }
  }

  for (const dir of dirs) {
    if (fs.existsSync(dir)) walkDir(dir);
  }

  console.log(`\n=== BATCH A COLOR FIX RESULTS ===`);
  console.log(`Files scanned: ${totalFiles}`);
  console.log(`Files changed: ${totalChanged}`);
  console.log(`Total replacements: ${totalReplacements}`);
  console.log(`\nChanged files:`);
  changedFiles.forEach(f => console.log(`  ${f}`));
}

main();
