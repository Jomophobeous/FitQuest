/**
 * Dribbble Adapter — UI patterns (PRIMARY source)
 * API: https://api.dribbble.com/v2/
 * Auth: OAuth2 Bearer token (Client ID + Secret → token exchange)
 * 
 * Dribbble v2 API requires OAuth2 authorization code flow.
 * For server-to-server, we use the token obtained after OAuth consent.
 * 
 * Rate limit: 60 requests/minute (authenticated)
 */

const https = require('https');

const BASE_URL = 'https://api.dribbble.com/v2';
const MAX_PER_RUN = 5;

function getToken() {
  const token = process.env.DRIBBBLE_TOKEN;
  if (!token) throw new Error('DRIBBBLE_TOKEN not set — complete OAuth flow first');
  return token;
}

/**
 * Make a GET request to Dribbble API
 */
function dribbbleGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
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
            },
          });
        } catch {
          reject(new Error(`Dribbble parse error: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Dribbble request timeout')); });
    req.end();
  });
}

/**
 * Search Dribbble shots (uses popular shots endpoint — v2 has no public search)
 * Dribbble v2 API only exposes /user/shots for authenticated user.
 * For design discovery, we use popular shots and filter client-side.
 * 
 * @param {string} query - Search keywords (used for local filtering)
 * @param {object} opts - Options
 * @returns {Promise<Array>} Normalized results
 */
async function search(query, opts = {}) {
  const limit = Math.min(opts.limit || MAX_PER_RUN, MAX_PER_RUN);

  // Dribbble v2 only allows /user/shots for authenticated users
  // We fetch user's shots or popular shots and filter by query terms
  const params = new URLSearchParams({
    per_page: String(Math.min(limit * 3, 30)), // fetch more to filter
  });

  let res;
  try {
    res = await dribbbleGet(`/user/shots?${params.toString()}`);
  } catch (err) {
    // If no token or token expired, return gracefully
    return { results: [], error: err.message, needsAuth: true };
  }

  if (res.status === 401 || res.status === 403) {
    return { results: [], error: `Dribbble auth failed: ${res.status}`, needsAuth: true };
  }

  if (res.status !== 200) {
    throw new Error(`Dribbble failed: ${res.status} — ${JSON.stringify(res.data).slice(0, 200)}`);
  }

  const shots = Array.isArray(res.data) ? res.data : [];
  const queryTerms = query.toLowerCase().split(/\s+/);

  // Filter shots by query relevance
  const scored = shots.map((shot) => {
    const text = `${shot.title || ''} ${shot.description || ''} ${(shot.tags || []).join(' ')}`.toLowerCase();
    const matchCount = queryTerms.filter((term) => text.includes(term)).length;
    return { shot, score: matchCount };
  });

  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, limit).map(({ shot }) => ({
    source: 'dribbble',
    id: shot.id,
    title: shot.title || '',
    description: (shot.description || '').replace(/<[^>]*>/g, '').slice(0, 200),
    creator: shot.user?.name || 'Unknown',
    creator_url: shot.user?.html_url,
    image_url: shot.images?.hidpi || shot.images?.normal || shot.images?.teaser,
    thumbnail: shot.images?.teaser || shot.images?.normal,
    width: shot.width,
    height: shot.height,
    tags: shot.tags || [],
    views_count: shot.views_count,
    likes_count: shot.likes_count,
    html_url: shot.html_url,
    attribution: `Shot by ${shot.user?.name || 'Unknown'} on Dribbble`,
  }));

  return {
    results,
    rateLimit: res.rateLimit,
  };
}

/**
 * Get the authenticated user's profile
 */
async function getUser() {
  const res = await dribbbleGet('/user');
  if (res.status !== 200) {
    return { error: `Dribbble user failed: ${res.status}`, data: res.data };
  }
  return res.data;
}

/**
 * Generate OAuth authorization URL for user consent
 */
function getAuthUrl() {
  const clientId = process.env.DRIBBBLE_CLIENT_ID;
  if (!clientId) throw new Error('DRIBBBLE_CLIENT_ID not set');
  return `https://dribbble.com/oauth/authorize?client_id=${clientId}&scope=public`;
}

/**
 * Exchange authorization code for access token
 * Call this ONCE after user completes OAuth flow
 */
function exchangeToken(code) {
  return new Promise((resolve, reject) => {
    const clientId = process.env.DRIBBBLE_CLIENT_ID;
    const clientSecret = process.env.DRIBBBLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return reject(new Error('DRIBBBLE_CLIENT_ID and DRIBBBLE_CLIENT_SECRET required'));
    }

    const postData = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    const options = {
      hostname: 'dribbble.com',
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.access_token) {
            resolve(data.access_token);
          } else {
            reject(new Error(`Token exchange failed: ${body.slice(0, 200)}`));
          }
        } catch {
          reject(new Error(`Token parse error: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Token exchange timeout')); });
    req.write(postData);
    req.end();
  });
}

module.exports = { search, getUser, getAuthUrl, exchangeToken, MAX_PER_RUN };
