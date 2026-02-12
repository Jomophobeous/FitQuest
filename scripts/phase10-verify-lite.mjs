import { spawn } from 'node:child_process';
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

async function main() {
  console.log('FitQuest Phase 10 verification (lite)');
  console.log('=====================================');

  await runStep('Phase 9 lite baseline', 'npm', ['run', 'verify:phase9:lite']);
  await runStep('Typecheck', 'npm', ['run', 'typecheck']);
  await runStep('Phase foundation tests', 'npx', ['vitest', 'run', 'tests/phaseFoundation.test.ts', 'tests/phase710Foundations.test.ts', '--reporter', 'basic']);

  console.log('\n✅ Phase 10 lite verification passed');
}

main().catch((error) => {
  console.error(`\n❌ Phase 10 lite verification failed: ${error.message}`);
  process.exit(1);
});
