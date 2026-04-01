/**
 * Pinterest Pattern Extractor — Phase 29.5: UI Intelligence Layer
 *
 * Connects to Pinterest API v5, fetches boards/pins for UI inspiration,
 * extracts layout patterns, color schemes, and component insights.
 *
 * Usage:
 *   node pinterestExtractor.js                      — fetch user boards + recent pins
 *   node pinterestExtractor.js <board_id>           — fetch pins from specific board
 *
 * Env:
 *   PINTEREST_TOKEN — Pinterest API access token
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const https = require('https');
const fs = require('fs');
const path = require('path');

const PINTEREST_TOKEN = process.env.PINTEREST_TOKEN;
const OUTPUT_DIR = path.join(__dirname, 'patterns');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pinterest_patterns.json');

function pinterestRequest(endpoint) {
  return new Promise((resolve, reject) => {
    if (!PINTEREST_TOKEN) {
      return reject(new Error('PINTEREST_TOKEN not set in environment'));
    }

    const url = new URL(`https://api.pinterest.com/v5${endpoint}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PINTEREST_TOKEN}`,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Pinterest API ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse Pinterest response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch user info to verify connection.
 */
async function getUserInfo() {
  try {
    const user = await pinterestRequest('/user_account');
    console.log(`  Pinterest user: ${user.username || user.id}`);
    return user;
  } catch (err) {
    console.log(`  ⚠️ Could not fetch Pinterest user: ${err.message}`);
    return null;
  }
}

/**
 * Fetch user's boards.
 */
async function getBoards() {
  try {
    const response = await pinterestRequest('/boards?page_size=25');
    return response.items || [];
  } catch (err) {
    console.log(`  ⚠️ Could not fetch boards: ${err.message}`);
    return [];
  }
}

/**
 * Fetch pins from a specific board.
 * @param {string} boardId
 */
async function getBoardPins(boardId) {
  try {
    const response = await pinterestRequest(`/boards/${encodeURIComponent(boardId)}/pins?page_size=25`);
    return response.items || [];
  } catch (err) {
    console.log(`  ⚠️ Could not fetch pins from board ${boardId}: ${err.message}`);
    return [];
  }
}

/**
 * Fetch user's recent pins.
 */
async function getRecentPins() {
  try {
    const response = await pinterestRequest('/pins?page_size=25');
    return response.items || [];
  } catch (err) {
    console.log(`  ⚠️ Could not fetch recent pins: ${err.message}`);
    return [];
  }
}

/**
 * Extract pattern data from pins.
 * Analyzes pin metadata for UI-relevant patterns.
 */
function extractPatterns(pins) {
  const patterns = {
    layout_types: new Map(),
    color_themes: [],
    categories: new Map(),
    image_dimensions: [],
    descriptions: [],
  };

  for (const pin of pins) {
    // Extract categories from board/section
    if (pin.board_section_id) {
      patterns.categories.set(pin.board_section_id, (patterns.categories.get(pin.board_section_id) || 0) + 1);
    }

    // Extract image dimensions (aspect ratios indicate layout type)
    if (pin.media && pin.media.images) {
      const orig = pin.media.images.originals || pin.media.images['600x'];
      if (orig) {
        const ratio = orig.width / orig.height;
        let layout;
        if (ratio > 1.3) layout = 'landscape';
        else if (ratio < 0.7) layout = 'portrait';
        else layout = 'square';

        patterns.layout_types.set(layout, (patterns.layout_types.get(layout) || 0) + 1);
        patterns.image_dimensions.push({ width: orig.width, height: orig.height, ratio: ratio.toFixed(2) });
      }
    }

    // Extract dominant colors if available
    if (pin.dominant_color) {
      patterns.color_themes.push(pin.dominant_color);
    }

    // Extract description keywords
    if (pin.description) {
      patterns.descriptions.push(pin.description.slice(0, 100));
    }
  }

  return {
    layout_distribution: Object.fromEntries(patterns.layout_types),
    dominant_colors: [...new Set(patterns.color_themes)],
    total_pins_analyzed: pins.length,
    sample_dimensions: patterns.image_dimensions.slice(0, 10),
    description_samples: patterns.descriptions.slice(0, 5),
  };
}

// ── Main ──

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Pinterest Pattern Extractor                  ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (!PINTEREST_TOKEN) {
    console.log('  ❌ PINTEREST_TOKEN not found in .env');
    console.log('  Set PINTEREST_TOKEN in your root .env file');
    process.exit(1);
  }

  const user = await getUserInfo();

  const boardId = process.argv[2];
  let pins = [];
  let boards = [];

  if (boardId) {
    console.log(`  Fetching pins from board: ${boardId}`);
    pins = await getBoardPins(boardId);
  } else {
    boards = await getBoards();
    console.log(`  Found ${boards.length} boards`);

    pins = await getRecentPins();
    console.log(`  Found ${pins.length} recent pins`);
  }

  const analysis = extractPatterns(pins);

  const output = {
    meta: {
      source: 'pinterest',
      user: user ? (user.username || user.id) : 'unknown',
      connected: !!user,
      extracted_at: new Date().toISOString(),
    },
    boards: boards.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
      pin_count: b.pin_count,
    })),
    patterns: analysis,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`  ✅ Pinterest patterns written to ${OUTPUT_FILE}`);
  console.log(`     Boards: ${boards.length}, Pins analyzed: ${pins.length}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { getUserInfo, getBoards, getBoardPins, getRecentPins, extractPatterns };
