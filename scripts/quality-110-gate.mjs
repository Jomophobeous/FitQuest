import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'reports', 'simulation-lite-latest.md');

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

async function getSimulationStretchScore() {
  try {
    const raw = await fs.readFile(REPORT_PATH, 'utf8');
    const overallPass = raw.includes('- Overall: PASS');
    const contractsPass = raw.includes('- Static contract checks: 8/8 passed');

    let score = 0;
    if (overallPass) score += 5;
    if (contractsPass) score += 5;

    return {
      score,
      overallPass,
      contractsPass,
      reportFound: true,
    };
  } catch {
    return {
      score: 0,
      overallPass: false,
      contractsPass: false,
      reportFound: false,
    };
  }
}

async function main() {
  console.log('FitQuest Quality 110 Gate');
  console.log('========================');

  let score = 0;

  await runStep('Phase 10 lite verification', 'npm', ['run', 'verify:phase10:lite']);
  score += 35;

  await runStep('Simulation lite verification', 'npm', ['run', 'verify:simulation:lite']);
  score += 35;

  await runStep('Typecheck', 'npm', ['run', 'typecheck']);
  score += 10;

  await runStep(
    'Targeted quality tests',
    'npx',
    [
      'vitest',
      'run',
      'tests/adaptiveTrainingService.test.ts',
      'tests/phaseFoundation.test.ts',
      'tests/phase710Foundations.test.ts',
      'tests/progressionEngine.test.ts',
      'tests/loggerRedaction.test.ts',
      'tests/securityPolicy.test.ts',
      '--reporter',
      'basic',
    ],
  );
  score += 15;

  await runStep('Monetization verification', 'npm', ['run', 'verify:monetization:lite']);
  score += 5;

  await runStep('Food DB verification', 'npm', ['run', 'verify:food-db']);

  const stretch = await getSimulationStretchScore();
  score += stretch.score;

  console.log('\nQuality Breakdown');
  console.log('-----------------');
  console.log(`Core score: ${score - stretch.score}/100`);
  console.log(`Stretch score: ${stretch.score}/10`);
  console.log(`Total quality score: ${score}/110`);

  console.log(`Simulation report found: ${stretch.reportFound ? 'yes' : 'no'}`);
  console.log(`Simulation overall PASS marker: ${stretch.overallPass ? 'yes' : 'no'}`);
  console.log(`Static contracts 8/8 marker: ${stretch.contractsPass ? 'yes' : 'no'}`);

  if (score < 100) {
    throw new Error(`Quality score below release threshold: ${score}/110`);
  }

  console.log('\n✅ Quality 110 gate passed');
}

main().catch((error) => {
  console.error(`\n❌ Quality 110 gate failed: ${error.message}`);
  process.exit(1);
});
