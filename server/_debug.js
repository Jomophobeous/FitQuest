#!/usr/bin/env node
'use strict';

// Start the server as a module on a clean port, then test  
const app = require('./index.js');

const PORT = parseInt(process.env.TEST_PORT, 10) || 3099;

const srv = app.listen(PORT, '127.0.0.1', async () => {
  console.log(`[debug] Listening on ${PORT}`);

  // Check router internals
  const router = app.router;
  if (router && router.stack) {
    console.log('[debug] Router stack length:', router.stack.length);
    router.stack.forEach((layer, i) => {
      const name = layer.name || 'anon';
      const path = layer.route ? layer.route.path : (layer.path || '*');
      console.log(`  ${i}: ${name} ${path}`);
    });
  } else {
    console.log('[debug] No .router.stack');
  }

  // Test /health
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/health`);
    const body = await r.text();
    console.log(`[debug] GET /health → ${r.status}: ${body}`);
  } catch (e) {
    console.error('[debug] fetch failed:', e.message);
  }

  srv.close(() => process.exit(0));
});
