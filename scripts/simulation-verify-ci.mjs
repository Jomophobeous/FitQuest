import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

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

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? '✓' : '✗'} ${check.id}`);
  }

  if (failed.length > 0) {
    throw new Error(`Static contracts failed: ${failed.map((check) => check.id).join(', ')}`);
  }
}

async function main() {
  console.log('FitQuest Simulation verification (ci)');
  console.log('===================================');

  await runStep('Typecheck', 'npm', ['run', 'typecheck']);
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

  await verifyStaticContracts();
  console.log('\n✅ Simulation CI verification passed');
}

main().catch((error) => {
  console.error(`\n❌ Simulation CI verification failed: ${error.message}`);
  process.exit(1);
});
