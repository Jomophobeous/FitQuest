# FitQuest AI Proxy

Minimal Cloudflare Worker that proxies AI requests from the mobile app to Groq/Grok/OpenRouter. API keys live server-side — never shipped in the client bundle.

## Setup

```bash
cd server/ai-proxy
npm install
```

## Configure Secrets

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GROK_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put PROXY_APP_KEY
```

Create the KV namespace for rate limiting:
```bash
npx wrangler kv:namespace create RATE_LIMITER
# Copy the id into wrangler.toml
```

## Local Dev

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Client Integration

The mobile app sends requests to the proxy with:
- `X-App-Key` header (shared secret)
- `X-Device-Id` header (for rate limiting)
- Body: `{ provider, model, messages, max_tokens, temperature, top_p }`

The proxy adds the real API key and forwards to the provider.

## Rate Limits

- 60 requests per minute per device
- 64KB max request body
- max_tokens capped at 2000
