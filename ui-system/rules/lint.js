/**
 * UI Lint Rule Engine — Phase 31
 * 
 * Static analysis rules for FitQuest UI enforcement.
 * Scans source files for violations against the design system.
 * 
 * Usage: node ui-system/rules/lint.js [--fix] [--file <path>]
 */

const fs = require('fs');
const path = require('path');

// ─── LOAD TOKENS ───
const TOKENS_DIR = path.join(__dirname, '..', 'tokens');
const colors = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'colors.json'), 'utf-8'));
const spacing = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'spacing.json'), 'utf-8'));

// ─── ALLOWED VALUES ───
const ALLOWED_SPACING = Object.values(spacing.spacing);
const ALLOWED_RADIUS = Object.values(spacing.radius);
const DARK_COLORS = Object.values(colors.dark);
const LIGHT_COLORS = Object.values(colors.light);
const SEMANTIC_COLORS = Object.values(colors.semantic);
const ALL_ALLOWED_COLORS = [...new Set([...DARK_COLORS, ...LIGHT_COLORS, ...SEMANTIC_COLORS, ...Object.values(colors.category)])].filter(c => typeof c === 'string');

// ─── RULE DEFINITIONS ───

const rules = [
  {
    id: 'no-hardcoded-colors',
    severity: 'error',
    description: 'No hardcoded hex colors — use theme.colors.*',
    pattern: /#[0-9A-Fa-f]{6}\b/g,
    test(match, line, filePath) {
      // Allow in token files, theme-system, comments
      if (filePath.includes('ui-system/tokens/')) return null;
      if (filePath.includes('theme-system')) return null;
      if (filePath.includes('design-intelligence/')) return null;
      if (filePath.includes('database/schema')) return null;
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return null;
      // Allow in imports/requires
      if (line.includes('require(') || line.includes('import ')) return null;
      return `Hardcoded color ${match} — use theme.colors.* token`;
    },
  },

  {
    id: 'no-spacing-md',
    severity: 'error',
    description: 'Never use theme.spacing.md — use numeric keys',
    pattern: /theme\.spacing\.(sm|md|lg|xl|xs|xxl)\b/g,
    test(match) {
      return `${match} — spacing uses NUMERIC keys: theme.spacing[4]`;
    },
  },

  {
    id: 'no-bg-white',
    severity: 'error',
    description: 'No white/light backgrounds in dark theme context',
    pattern: /bg-white|bg-gray-50|backgroundColor:\s*['"]#[Ff]{6}['"]/g,
    test(match, line, filePath) {
      if (filePath.includes('ui-system/')) return null;
      return `${match} — dark theme requires theme.colors.surface`;
    },
  },

  {
    id: 'no-inline-fontsize',
    severity: 'warning',
    description: 'Avoid inline fontSize — use ThemedText variant',
    pattern: /fontSize:\s*\d+/g,
    test(match, line, filePath) {
      if (filePath.includes('GlassUI')) return null; // component internals OK
      if (filePath.includes('ui-system/')) return null;
      if (filePath.includes('theme-system')) return null;
      if (line.includes('// lint-ok')) return null;
      if (line.includes('typography.sizes')) return null;
      return `${match} — use ThemedText variant prop instead`;
    },
  },

  {
    id: 'no-new-button',
    severity: 'error',
    description: 'No new button components — use GradientButton',
    pattern: /export\s+(const|function)\s+\w*[Bb]utton\b/g,
    test(match, line, filePath) {
      if (filePath.includes('GlassUI')) return null;
      if (filePath.includes('ui-system/')) return null;
      return `${match} — all buttons must use GradientButton from GlassUI`;
    },
  },

  {
    id: 'no-raw-touchable-button',
    severity: 'warning',
    description: 'Avoid raw TouchableOpacity styled as buttons',
    pattern: /<TouchableOpacity[^>]*style=\{[^}]*padding[^}]*backgroundColor/g,
    test(match, line, filePath) {
      if (filePath.includes('GlassUI')) return null;
      if (filePath.includes('ui-system/')) return null;
      return 'TouchableOpacity styled as button — use GradientButton';
    },
  },

  {
    id: 'named-import-themed-text',
    severity: 'error',
    description: 'ThemedText is a DEFAULT export — no named import',
    pattern: /\{\s*ThemedText\s*\}/g,
    test(match) {
      return `Named import { ThemedText } — it's a DEFAULT export: import ThemedText from '...'`;
    },
  },

  {
    id: 'no-async-storage',
    severity: 'error',
    description: 'No AsyncStorage — use SecureStore or SQLite',
    pattern: /AsyncStorage/g,
    test(match, line) {
      if (line.includes('// legacy') || line.includes('// migration')) return null;
      return 'AsyncStorage usage — use SecureStore or SQLite';
    },
  },

  {
    id: 'no-settimeout-fix',
    severity: 'warning',
    description: 'No setTimeout as logic fix — use explicit state gates',
    pattern: /setTimeout\s*\(/g,
    test(match, line, filePath) {
      if (filePath.includes('design-intelligence/')) return null;
      if (filePath.includes('ui-system/')) return null;
      if (line.includes('// animation') || line.includes('// debounce') || line.includes('// streaming-delay') || line.includes('// abort-timeout') || line.includes('// deferred-') || line.includes('// batch-') || line.includes('// backoff-delay') || line.includes('// retry-delay')) return null;
      return 'setTimeout detected — ensure this is not a timing hack; use state gates';
    },
  },

  {
    id: 'no-raw-spacing',
    severity: 'warning',
    description: 'Use theme.spacing[n] instead of raw spacing values',
    pattern: /(margin|padding|gap|marginTop|marginBottom|marginLeft|marginRight|marginHorizontal|marginVertical|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingHorizontal|paddingVertical):\s*\d+/g,
    test(match, line, filePath) {
      if (filePath.includes('GlassUI')) return null;
      if (filePath.includes('ui-system/')) return null;
      if (filePath.includes('theme-system')) return null;
      if (line.includes('theme.spacing') || line.includes('spacing[')) return null;
      return `${match} — use theme.spacing[n]`;
    },
  },

  {
    id: 'no-math-random-security',
    severity: 'error',
    description: 'No Math.random() for security — use expo-random',
    pattern: /Math\.random\(\)/g,
    test(match, line, filePath) {
      if (filePath.includes('ui-system/')) return null;
      if (line.includes('// non-security') || line.includes('// visual')) return null;
      return 'Math.random() — if used for security, replace with expo-random';
    },
  },
];

// ─── SCANNER ───

function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const rule of rules) {
      // Reset regex lastIndex
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        const msg = rule.test(match[0], line, filePath);
        if (msg) {
          violations.push({
            rule: rule.id,
            severity: rule.severity,
            file: filePath,
            line: i + 1,
            column: match.index + 1,
            message: msg,
          });
        }
      }
    }
  }

  return violations;
}

function lintDirectory(dir, extensions = ['.tsx', '.ts', '.js']) {
  const results = [];

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, .git, build, android, ios
        if (['node_modules', '.git', 'build', 'android', 'ios', '.expo', 'web-build'].includes(entry.name)) continue;
        walk(full);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(...lintFile(full));
      }
    }
  }

  walk(dir);
  return results;
}

// ─── REPORTER ───

function report(violations) {
  if (violations.length === 0) {
    console.log('✓ No UI violations found');
    return 0;
  }

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  // Group by file
  const byFile = {};
  for (const v of violations) {
    const rel = path.relative(process.cwd(), v.file);
    if (!byFile[rel]) byFile[rel] = [];
    byFile[rel].push(v);
  }

  console.log(`\n━━━ UI LINT REPORT ━━━\n`);

  for (const [file, fileViolations] of Object.entries(byFile)) {
    console.log(`  ${file}`);
    for (const v of fileViolations) {
      const marker = v.severity === 'error' ? '✖' : '⚠';
      console.log(`    ${marker} L${v.line}:${v.column}  ${v.message}  [${v.rule}]`);
    }
    console.log();
  }

  console.log(`━━━ SUMMARY ━━━`);
  console.log(`  Errors:   ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Total:    ${violations.length}`);

  return errors.length > 0 ? 1 : 0;
}

// ─── CLI ───

if (require.main === module) {
  const args = process.argv.slice(2);
  let targetFile = null;
  let targetDir = path.join(process.cwd(), 'src');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) targetFile = args[++i];
    if (args[i] === '--dir' && args[i + 1]) targetDir = args[++i];
  }

  let violations;
  if (targetFile) {
    const fullPath = path.resolve(targetFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      process.exit(1);
    }
    violations = lintFile(fullPath);
  } else {
    // Also scan app/ directory
    violations = [
      ...lintDirectory(targetDir),
      ...lintDirectory(path.join(process.cwd(), 'app')),
    ];
  }

  const exitCode = report(violations);
  process.exit(exitCode);
}

module.exports = { rules, lintFile, lintDirectory, report };
