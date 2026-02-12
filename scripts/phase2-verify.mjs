import { spawn } from 'node:child_process';

const STEPS = [
  {
    label: 'OAuth preflight',
    command: 'npm',
    args: ['run', 'preflight:oauth'],
  },
  {
    label: 'TypeScript typecheck',
    command: 'npm',
    args: ['run', 'typecheck'],
  },
  {
    label: 'Unit tests',
    command: 'npm',
    args: ['test'],
    env: { CI: '1' },
  },
  {
    label: 'Backend smoke (Phase 2)',
    command: 'npm',
    args: ['--prefix', 'server', 'run', 'smoke:phase2'],
  },
];

function runStep(step) {
  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        ...(step.env || {}),
      },
    });

    child.on('close', (code) => {
      resolve(Number(code || 0));
    });
  });
}

async function main() {
  console.log('FitQuest Phase 2 verification pipeline');
  console.log('===================================');

  for (const step of STEPS) {
    console.log(`\n→ ${step.label}`);
    const code = await runStep(step);
    if (code !== 0) {
      console.error(`\n✗ Failed at: ${step.label} (exit ${code})`);
      process.exit(code);
    }
    console.log(`✓ ${step.label}`);
  }

  console.log('\n✅ Phase 2 verification passed');
}

main().catch((error) => {
  console.error(`Pipeline failed: ${error.message}`);
  process.exit(1);
});
