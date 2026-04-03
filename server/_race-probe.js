'use strict';
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const BASE = 'https://fitq-56sj.onrender.com';
const KEY = process.env.API_KEY;
const h = { 'Content-Type': 'application/json', 'X-App-Version': '2.0.0' };
if (KEY) h['Authorization'] = 'Bearer ' + KEY;

async function p(u, b) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 30000);
  try {
    const r = await fetch(BASE + u, { method: 'POST', headers: h, body: JSON.stringify(b), signal: c.signal });
    const j = await r.json().catch(() => ({}));
    return { s: r.status, j };
  } finally { clearTimeout(t); }
}
function cr(n, d) { return crypto.createHash('sha256').update(n + d + '2.0.0').digest('hex'); }
async function gc(d) { const { j } = await p('/auth/challenge', { user_id: 'user_local_001', device_id: d }); return j.data; }

(async () => {
  console.log('=== Race Condition Probe ===');

  // 1. Rotation race
  const d1 = 'rcprobe-' + Date.now();
  const c = await gc(d1);
  const r = await p('/device/register', { user_id: 'user_local_001', device_id: d1, app_version: '2.0.0', challenge_id: c.challenge_id, challenge_response: cr(c.nonce, d1) });
  console.log('Register:', r.s);
  const t = r.j.data?.device_token;
  if (!t) { console.log('NO TOKEN'); process.exit(1); }

  const c1 = await gc(d1);
  const c2 = await gc(d1);
  const [r1, r2] = await Promise.all([
    p('/device/rotate', { user_id: 'user_local_001', device_id: d1, device_token: t, app_version: '2.0.0', challenge_id: c1.challenge_id, challenge_response: cr(c1.nonce, d1) }),
    p('/device/rotate', { user_id: 'user_local_001', device_id: d1, device_token: t, app_version: '2.0.0', challenge_id: c2.challenge_id, challenge_response: cr(c2.nonce, d1) })
  ]);
  console.log('Rotation race:', r1.s, r2.s, '(want one 200, one ≠200)');

  // 2. Registration race (10 concurrent)
  const d2 = 'rcprobe2-' + Date.now();
  const challenges = [];
  for (let i = 0; i < 5; i++) challenges.push(await gc(d2));
  const regs = await Promise.all(challenges.map(ch =>
    p('/device/register', { user_id: 'user_local_001', device_id: d2, app_version: '2.0.0', challenge_id: ch.challenge_id, challenge_response: cr(ch.nonce, d2) })
  ));
  const tokens = regs.filter(r => r.s === 200).map(r => r.j.data?.device_token);
  const unique = [...new Set(tokens)];
  console.log('Reg race: statuses=[' + regs.map(r => r.s).join(',') + '] unique_tokens=' + unique.length + ' (want 1)');

  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
