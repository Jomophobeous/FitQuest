/**
 * Figma Design Token Extractor — Phase 29.5: UI Intelligence Layer
 *
 * Connects to Figma API, extracts design tokens (colors, typography, spacing),
 * and writes structured output to patterns/design_tokens.json.
 *
 * Usage:
 *   node figmaExtractor.js                         — extract from default file
 *   node figmaExtractor.js <file_key>              — extract from specific file
 *
 * Env:
 *   FIGMA_TOKEN — Figma personal access token
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const https = require('https');
const fs = require('fs');
const path = require('path');

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const OUTPUT_DIR = path.join(__dirname, 'patterns');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'design_tokens.json');

function figmaRequest(endpoint) {
  return new Promise((resolve, reject) => {
    if (!FIGMA_TOKEN) {
      return reject(new Error('FIGMA_TOKEN not set in environment'));
    }

    const url = new URL(`https://api.figma.com/v1${endpoint}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-Figma-Token': FIGMA_TOKEN,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Figma API ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse Figma response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Extract colors from Figma document styles.
 */
function extractColors(document) {
  const colors = new Map();

  function walkNode(node) {
    // Extract fill colors
    if (node.fills && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const { r, g, b, a } = fill.color;
          const hex = rgbaToHex(r, g, b, a ?? 1);
          const key = hex.toUpperCase();
          if (!colors.has(key)) {
            colors.set(key, {
              hex: key,
              rgba: { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: a ?? 1 },
              source: node.name || 'unnamed',
            });
          }
        }
      }
    }

    // Recurse children
    if (node.children) {
      for (const child of node.children) {
        walkNode(child);
      }
    }
  }

  walkNode(document);
  return Array.from(colors.values());
}

/**
 * Extract typography styles from Figma document.
 */
function extractTypography(document) {
  const typography = new Map();

  function walkNode(node) {
    if (node.style && (node.style.fontFamily || node.style.fontSize)) {
      const key = `${node.style.fontFamily}-${node.style.fontSize}-${node.style.fontWeight}`;
      if (!typography.has(key)) {
        typography.set(key, {
          fontFamily: node.style.fontFamily || 'Unknown',
          fontSize: node.style.fontSize || 16,
          fontWeight: node.style.fontWeight || 400,
          lineHeight: node.style.lineHeightPx || null,
          letterSpacing: node.style.letterSpacing || 0,
          source: node.name || 'unnamed',
        });
      }
    }

    if (node.children) {
      for (const child of node.children) {
        walkNode(child);
      }
    }
  }

  walkNode(document);
  return Array.from(typography.values());
}

/**
 * Extract spacing/sizing patterns from Figma document.
 */
function extractSpacing(document) {
  const spacings = new Set();

  function walkNode(node) {
    // Auto-layout padding/spacing
    if (node.paddingLeft != null) spacings.add(node.paddingLeft);
    if (node.paddingRight != null) spacings.add(node.paddingRight);
    if (node.paddingTop != null) spacings.add(node.paddingTop);
    if (node.paddingBottom != null) spacings.add(node.paddingBottom);
    if (node.itemSpacing != null) spacings.add(node.itemSpacing);

    // Absolute bounds-based sizing
    if (node.absoluteBoundingBox) {
      const { width, height } = node.absoluteBoundingBox;
      if (width > 0 && width <= 200) spacings.add(Math.round(width));
      if (height > 0 && height <= 200) spacings.add(Math.round(height));
    }

    if (node.children) {
      for (const child of node.children) {
        walkNode(child);
      }
    }
  }

  walkNode(document);
  return Array.from(spacings).filter(v => v > 0 && v <= 200).sort((a, b) => a - b);
}

function rgbaToHex(r, g, b, a) {
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a < 1) return `${hex}${toHex(a)}`;
  return hex;
}

/**
 * List user's Figma files (teams/projects).
 */
async function listFiles() {
  try {
    const me = await figmaRequest('/me');
    console.log(`  Figma user: ${me.handle} (${me.email})`);
    return me;
  } catch (err) {
    console.log(`  ⚠️ Could not fetch Figma user: ${err.message}`);
    return null;
  }
}

/**
 * Extract tokens from a Figma file.
 * @param {string} fileKey — Figma file key (from URL)
 */
async function extractFromFile(fileKey) {
  console.log(`  Fetching Figma file: ${fileKey}...`);
  const file = await figmaRequest(`/files/${encodeURIComponent(fileKey)}?depth=3`);

  const colors = extractColors(file.document);
  const typography = extractTypography(file.document);
  const spacing = extractSpacing(file.document);

  const tokens = {
    meta: {
      source: 'figma',
      file_key: fileKey,
      file_name: file.name,
      extracted_at: new Date().toISOString(),
      version: file.version,
    },
    colors,
    typography,
    spacing,
    summary: {
      total_colors: colors.length,
      total_typography_styles: typography.length,
      total_spacing_values: spacing.length,
    },
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tokens, null, 2));
  console.log(`  ✅ Design tokens written to ${OUTPUT_FILE}`);
  console.log(`     Colors: ${colors.length}, Typography: ${typography.length}, Spacing: ${spacing.length}`);

  return tokens;
}

// ── Main ──

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Figma Design Token Extractor                ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (!FIGMA_TOKEN) {
    console.log('  ❌ FIGMA_TOKEN not found in .env');
    console.log('  Set FIGMA_TOKEN in your root .env file');
    process.exit(1);
  }

  const user = await listFiles();
  if (!user) {
    process.exit(1);
  }

  const fileKey = process.argv[2];
  if (!fileKey) {
    console.log('  ℹ️  No file key provided. Use: node figmaExtractor.js <file_key>');
    console.log('  ℹ️  File key is the ID from the Figma URL: figma.com/file/<FILE_KEY>/...');
    console.log('  ℹ️  Skipping token extraction (user verified).');

    // Write minimal output confirming connection
    const minTokens = {
      meta: {
        source: 'figma',
        user: user.handle,
        connected: true,
        extracted_at: new Date().toISOString(),
      },
      colors: [],
      typography: [],
      spacing: [],
      summary: { total_colors: 0, total_typography_styles: 0, total_spacing_values: 0 },
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(minTokens, null, 2));
    console.log(`  ✅ Connection verified. Minimal tokens file written.`);
    return;
  }

  await extractFromFile(fileKey);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { extractFromFile, listFiles, extractColors, extractTypography, extractSpacing };
