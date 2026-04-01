/**
 * Openverse Adapter — Generic visual assets (SECONDARY source)
 * API: https://api.openverse.org/v1/
 * Auth: None required for basic usage (anonymous rate limits apply)
 * Docs: https://api.openverse.org/v1/ (OpenAPI spec)
 */

const https = require('https');

const BASE_URL = 'https://api.openverse.org/v1';
const MAX_PER_RUN = 5;

/**
 * Make a GET request to Openverse API (with AbortController timeout)
 */
function openverseGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${endpoint}`;
    const parsed = new URL(url);
    let done = false;

    const finish = (fn, val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(val);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error('Openverse timeout (3s)'));
      try { req.destroy(); } catch {}
    }, 3000);

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'FitQuest-DesignIntelligence/1.0',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          finish(resolve, { status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          finish(reject, new Error(`Openverse parse error: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => finish(reject, err));
    req.end();
  });
}

/**
 * Search Openverse for images
 * @param {string} query - Search term
 * @param {object} opts - Options
 * @returns {Promise<Array>} Normalized results
 */
async function search(query, opts = {}) {
  const limit = Math.min(opts.limit || MAX_PER_RUN, MAX_PER_RUN);
  const params = new URLSearchParams({
    q: query,
    page_size: String(limit),
    license_type: 'commercial',
    mature: 'false',
  });

  if (opts.category) params.set('category', opts.category);

  const res = await openverseGet(`/images/?${params.toString()}`);

  if (res.status !== 200) {
    throw new Error(`Openverse search failed: ${res.status} — ${JSON.stringify(res.data).slice(0, 200)}`);
  }

  const results = (res.data.results || []).map((item) => ({
    source: 'openverse',
    id: item.id,
    title: item.title || '',
    creator: item.creator || 'Unknown',
    image_url: item.url,
    thumbnail: item.thumbnail || item.url,
    license: item.license,
    license_version: item.license_version,
    tags: (item.tags || []).map((t) => t.name),
    width: item.width,
    height: item.height,
    detail_url: item.detail_url,
    foreign_landing_url: item.foreign_landing_url,
    attribution: item.attribution,
  }));

  return results;
}

/**
 * Get image details by ID
 */
async function getDetail(identifier) {
  const res = await openverseGet(`/images/${encodeURIComponent(identifier)}/`);
  if (res.status !== 200) {
    throw new Error(`Openverse detail failed: ${res.status}`);
  }
  return res.data;
}

/**
 * Get available sources/stats
 */
async function getStats() {
  const res = await openverseGet('/images/stats/');
  if (res.status !== 200) {
    throw new Error(`Openverse stats failed: ${res.status}`);
  }
  return res.data;
}

module.exports = { search, getDetail, getStats, MAX_PER_RUN };
