import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'reports', 'monetization-test-matrix.md');

async function main() {
  console.log('FitQuest Monetization verification (lite)');
  console.log('========================================');

  const managerPath = path.join(ROOT, 'src', 'purchases', 'SubscriptionManager.ts');
  const paywallPath = path.join(ROOT, 'app', 'paywall.tsx');

  const [manager, paywall] = await Promise.all([
    fs.readFile(managerPath, 'utf8'),
    fs.readFile(paywallPath, 'utf8'),
  ]);

  const checks = [
    { id: 'revenuecat.env_key', ok: manager.includes('EXPO_PUBLIC_REVENUECAT_API_KEY') },
    { id: 'entitlement.validation', ok: manager.includes('ENTITLEMENT_ID') && manager.includes('entitlements?.active') },
    { id: 'restore.flow', ok: manager.includes('restorePurchases()') && paywall.includes('restorePurchases') },
    { id: 'offline.grace.rule', ok: manager.includes('OFFLINE_GRACE_MS') && manager.includes('offline_grace') },
    { id: 'offline.cache.persisted', ok: manager.includes('SUBSCRIPTION_CACHE_KEY') && manager.includes('SUBSCRIPTION_LAST_VERIFIED_KEY') },
  ];

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? '✓' : '✗'} ${check.id}`);
  }

  const content = [
    '# Monetization Test Matrix (Lite)',
    '',
    `- Generated at: ${new Date().toISOString()}`,
    `- Overall: ${failed.length === 0 ? 'PASS' : 'FAIL'}`,
    '',
    '## Automated Contract Checks',
    '| Check | Result |',
    '|---|---|',
    ...checks.map((check) => `| ${check.id} | ${check.ok ? 'PASS' : 'FAIL'} |`),
    '',
    '## Manual Verification Matrix',
    '| Scenario | Expected | Status |',
    '|---|---|---|',
    '| Fresh install trial start | `TRIAL` active with end date | Pending Manual |',
    '| Monthly purchase | `ACTIVE` entitlement | Pending Manual |',
    '| Annual purchase | `ACTIVE` entitlement | Pending Manual |',
    '| Restore purchases | Previous entitlement restored | Pending Manual |',
    '| RevenueCat unreachable within grace | Cached `offline_grace` access | Pending Manual |',
    '| RevenueCat unreachable beyond grace | Fallback to local state | Pending Manual |',
  ].join('\n');

  await fs.mkdir(path.dirname(MATRIX_PATH), { recursive: true });
  await fs.writeFile(MATRIX_PATH, content, 'utf8');
  console.log(`\n✓ Monetization matrix: ${path.relative(ROOT, MATRIX_PATH)}`);

  if (failed.length > 0) {
    throw new Error(`Monetization checks failed: ${failed.map((check) => check.id).join(', ')}`);
  }

  console.log('\n✅ Monetization lite verification passed');
}

main().catch((error) => {
  console.error(`\n❌ Monetization lite verification failed: ${error.message}`);
  process.exit(1);
});
