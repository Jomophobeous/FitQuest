/**
 * Pexels Adapter — Backgrounds & mood imagery (SUPPORT source)
 * API: https://api.pexels.com/v1/
 * Auth: API Key in Authorization header
 * Rate limit: 200 requests/hour, 20,000/month
 */

const https = require('https');

const BASE_URL = 'https://api.pexels.com/v1';
const MAX_PER_RUN = 5;

function getApiKey() {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY not set in environment');
  return key;
}

/**
 * Make a GET request to Pexels API
 */
function pexelsGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Authorization': getApiKey(),
        'User-Agent': 'FitQuest-DesignIntelligence/1.0',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body),
            rateLimit: {
              limit: res.headers['x-ratelimit-limit'],
              remaining: res.headers['x-ratelimit-remaining'],
              reset: res.headers['x-ratelimit-reset'],
            },
          });
        } catch {
          reject(new Error(`Pexels parse error: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Pexels request timeout')); });
    req.end();
  });
}

/**
 * Search Pexels for photos
 * @param {string} query - Search term
 * @param {object} opts - Options (limit, orientation, color, size)
 * @returns {Promise<Array>} Normalized results
 */
async function search(query, opts = {}) {
  const limit = Math.min(opts.limit || MAX_PER_RUN, MAX_PER_RUN);
  const params = new URLSearchParams({
    query,
    per_page: String(limit),
  });

  if (opts.orientation) params.set('orientation', opts.orientation); // landscape, portrait, square
  if (opts.color) params.set('color', opts.color);
  if (opts.size) params.set('size', opts.size); // large, medium, small

  const res = await pexelsGet(`/search?${params.toString()}`);

  if (res.status !== 200) {
    throw new Error(`Pexels search failed: ${res.status} — ${JSON.stringify(res.data).slice(0, 200)}`);
  }

  const results = (res.data.photos || []).map((photo) => ({
    source: 'pexels',
    id: photo.id,
    title: photo.alt || '',
    creator: photo.photographer || 'Unknown',
    creator_url: photo.photographer_url,
    image_url: photo.src.original,
    thumbnail: photo.src.medium,
    preview: photo.src.small,
    width: photo.width,
    height: photo.height,
    avg_color: photo.avg_color,
    license: 'Pexels License',
    attribution: `Photo by ${photo.photographer} on Pexels`,
    pexels_url: photo.url,
  }));

  return {
    results,
    rateLimit: res.rateLimit,
  };
}

/**
 * Get a photo by ID
 */
async function getPhoto(id) {
  const res = await pexelsGet(`/photos/${encodeURIComponent(id)}`);
  if (res.status !== 200) {
    throw new Error(`Pexels photo failed: ${res.status}`);
  }
  return res.data;
}

/**
 * Get curated photos (editorial picks)
 */
async function getCurated(limit = 5) {
  const params = new URLSearchParams({ per_page: String(Math.min(limit, MAX_PER_RUN)) });
  const res = await pexelsGet(`/curated?${params.toString()}`);
  if (res.status !== 200) {
    throw new Error(`Pexels curated failed: ${res.status}`);
  }
  return res.data;
}

module.exports = { search, getPhoto, getCurated, MAX_PER_RUN };
