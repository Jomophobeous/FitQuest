import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'simulation-lite-latest.md');

function runStep(name, command, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    console.log(`\n→ ${name}`);
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✓ ${name}`);
        resolve();
      } else {
        reject(new Error(`${name} failed with exit code ${code ?? 'unknown'}`));
      }
    });
  });
}

async function verifyStaticContracts() {
  const layoutPath = path.join(ROOT, 'app', '_layout.tsx');
  const menuPath = path.join(ROOT, 'src', 'components', 'DropdownMenu.tsx');

  const [layoutContent, menuContent] = await Promise.all([
    fs.readFile(layoutPath, 'utf8'),
    fs.readFile(menuPath, 'utf8'),
  ]);

  const checks = [
    { id: 'route.platform-studio', ok: layoutContent.includes('name="platform-studio"') },
    { id: 'route.autonomous-center', ok: layoutContent.includes('name="autonomous-center"') },
    { id: 'route.federation-hub', ok: layoutContent.includes('name="federation-hub"') },
    { id: 'route.enterprise-hardening', ok: layoutContent.includes('name="enterprise-hardening"') },
    { id: 'menu.platform-studio', ok: menuContent.includes("id: 'platform-studio'") },
    { id: 'menu.autonomous-center', ok: menuContent.includes("id: 'autonomous-center'") },
    { id: 'menu.federation-hub', ok: menuContent.includes("id: 'federation-hub'") },
    { id: 'menu.enterprise-hardening', ok: menuContent.includes("id: 'enterprise-hardening'") },
  ];

  return checks;
}

async function writeReport(results) {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const now = new Date();
  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  const overall = failed === 0 ? 'PASS' : 'FAIL';

  const rows = results
    .map((result) => `| ${result.id} | ${result.ok ? 'PASS' : 'FAIL'} |`)
    .join('\n');

  const content = [
    '# Simulation Lite Report',
    '',
    `- Generated at: ${now.toISOString()}`,
    `- Overall: ${overall}`,
    `- Static contract checks: ${passed}/${results.length} passed`,
    '',
    '## Contract Checks',
    '| Check | Result |',
    '|---|---|',
    rows,
    '',
    '## Automated Flow',
    '- `npm run verify:phase10:lite`',
    '- `npx vitest run tests/adaptiveTrainingService.test.ts tests/phaseFoundation.test.ts tests/phase710Foundations.test.ts --reporter basic`',
  ].join('\n');

  await fs.writeFile(REPORT_PATH, content, 'utf8');
  return { overall, failed };
}

async function main() {
  console.log('FitQuest Simulation verification (lite)');
  console.log('====================================');

  await runStep('Phase 10 lite verification', 'npm', ['run', 'verify:phase10:lite']);
  await runStep(
    'Targeted simulation tests',
    'npx',
    [
      'vitest',
      'run',
      'tests/adaptiveTrainingService.test.ts',
      'tests/phaseFoundation.test.ts',
      'tests/phase710Foundations.test.ts',
      '--reporter',
      'basic',
    ],
  );

  const checks = await verifyStaticContracts();
  const failedChecks = checks.filter((check) => !check.ok);

  for (const check of checks) {
    console.log(`${check.ok ? '✓' : '✗'} ${check.id}`);
  }

  const report = await writeReport(checks);
  console.log(`\n✓ Simulation report: ${path.relative(ROOT, REPORT_PATH)}`);

  if (failedChecks.length > 0 || report.failed > 0) {
    throw new Error('Static contract checks failed');
  }

  console.log('\n✅ Simulation lite verification passed');
}

main().catch((error) => {
  console.error(`\n❌ Simulation lite verification failed: ${error.message}`);
  process.exit(1);
});
