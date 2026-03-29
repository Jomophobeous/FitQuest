/**
 * FitQuest AI Proxy — Cloudflare Worker
 *
 * Minimal proxy that hides API keys from the client bundle.
 * Accepts requests from the FitQuest mobile app, forwards to
 * Groq / Grok / OpenRouter with server-side keys.
 *
 * Security:
 *   - API keys live in Cloudflare Worker secrets (env bindings)
 *   - Per-device rate limiting (60 req/min per device)
 *   - Request size caps (body ≤ 64KB)
 *   - App-key verification header
 *
 * Deploy:
 *   npx wrangler deploy
 *
 * Secrets:
 *   npx wrangler secret put GROQ_API_KEY
 *   npx wrangler secret put GROK_API_KEY
 *   npx wrangler secret put OPENROUTER_API_KEY
 *   npx wrangler secret put PROXY_APP_KEY
 */

export interface Env {
  GROQ_API_KEY: string;
  GROK_API_KEY: string;
  OPENROUTER_API_KEY: string;
  PROXY_APP_KEY: string; // shared secret the client sends to prove it's FitQuest
  RATE_LIMITER: KVNamespace;
}

interface ProxyRequest {
  provider: 'groq' | 'grok' | 'openrouter';
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  grok: 'https://api.x.ai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

const MAX_BODY_BYTES = 65_536; // 64KB
const RATE_WINDOW_SECONDS = 60;
const RATE_MAX_REQUESTS = 60;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

/** Simple per-device sliding-window rate limiter using KV */
async function checkRateLimit(deviceId: string, kv: KVNamespace): Promise<boolean> {
  const key = `rl:${deviceId}`;
  const raw = await kv.get(key);
  const now = Math.floor(Date.now() / 1000);

  let timestamps: number[] = raw ? JSON.parse(raw) : [];
  // Prune entries outside the window
  timestamps = timestamps.filter((t) => now - t < RATE_WINDOW_SECONDS);

  if (timestamps.length >= RATE_MAX_REQUESTS) return false;

  timestamps.push(now);
  await kv.put(key, JSON.stringify(timestamps), { expirationTtl: RATE_WINDOW_SECONDS * 2 });
  return true;
}

function getProviderKey(provider: string, env: Env): string {
  switch (provider) {
    case 'groq': return env.GROQ_API_KEY;
    case 'grok': return env.GROK_API_KEY;
    case 'openrouter': return env.OPENROUTER_API_KEY;
    default: return '';
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-App-Key, X-Device-Id',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Verify app key — prevents random internet callers
    const appKey = request.headers.get('X-App-Key');
    if (!appKey || appKey !== env.PROXY_APP_KEY) {
      return errorResponse('Unauthorized', 401);
    }

    // Rate limiting by device ID
    const deviceId = request.headers.get('X-Device-Id') || 'anonymous';
    const allowed = await checkRateLimit(deviceId, env.RATE_LIMITER);
    if (!allowed) {
      return errorResponse('Rate limit exceeded', 429);
    }

    // Body size check
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return errorResponse('Request too large', 413);
    }

    let body: ProxyRequest;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) {
        return errorResponse('Request too large', 413);
      }
      body = JSON.parse(raw);
    } catch {
      return errorResponse('Invalid JSON', 400);
    }

    // Validate provider
    const { provider, model, messages, max_tokens, temperature, top_p } = body;
    if (!provider || !PROVIDER_ENDPOINTS[provider]) {
      return errorResponse('Invalid provider', 400);
    }
    if (!model || typeof model !== 'string') {
      return errorResponse('Invalid model', 400);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse('Messages required', 400);
    }

    const apiKey = getProviderKey(provider, env);
    if (!apiKey) {
      return errorResponse('Provider not configured', 503);
    }

    const endpoint = PROVIDER_ENDPOINTS[provider];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://fitquest.app';
      headers['X-Title'] = 'FitQuest Coach';
    }

    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: typeof temperature === 'number' ? temperature : 0.7,
          max_tokens: typeof max_tokens === 'number' ? Math.min(max_tokens, 2000) : 500,
          top_p: typeof top_p === 'number' ? top_p : 0.9,
        }),
      });

      // Stream the upstream response back to the client
      const responseHeaders = new Headers({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (e) {
      return errorResponse('Upstream request failed', 502);
    }
  },
};
