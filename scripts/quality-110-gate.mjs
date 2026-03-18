import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'reports', 'simulation-lite-latest.md');
const SELF_TEST_MODE = process.env.FITQUEST_QUALITY_GATE_SELF_TEST === '1';
const QUALITY_REPORT_BASENAME = SELF_TEST_MODE ? 'quality-110-self-test-latest' : 'quality-110-latest';
const QUALITY_JSON_REPORT_PATH = path.join(ROOT, 'reports', `${QUALITY_REPORT_BASENAME}.json`);
const QUALITY_MD_REPORT_PATH = path.join(ROOT, 'reports', `${QUALITY_REPORT_BASENAME}.md`);
const HEARTBEAT_INTERVAL_MS = 5000;
const STALE_AFTER_MS = 20000;
let currentState = null;
let isFinalizing = false;
let heartbeatTimer = null;

const STEP_DEFINITIONS = SELF_TEST_MODE
  ? [
      {
        id: 'self-test-core-a',
        name: 'Self-test core step A',
        command: 'node',
        args: ['-e', "console.log('self-test step A');"],
        points: 40,
      },
      {
        id: 'self-test-core-b',
        name: 'Self-test core step B',
        command: 'node',
        args: ['-e', "console.log('self-test step B');"],
        points: 40,
      },
      {
        id: 'self-test-core-c',
        name: 'Self-test core step C',
        command: 'node',
        args: ['-e', "console.log('self-test step C');"],
        points: 20,
      },
    ]
  : [
      {
        id: 'phase10-lite',
        name: 'Phase 10 lite verification',
        command: 'npm',
        args: ['run', 'verify:phase10:lite'],
        points: 35,
      },
      {
        id: 'simulation-lite',
        name: 'Simulation lite verification',
        command: 'npm',
        args: ['run', 'verify:simulation:lite'],
        points: 35,
      },
      {
        id: 'typecheck',
        name: 'Typecheck',
        command: 'npm',
        args: ['run', 'typecheck'],
        points: 10,
      },
      {
        id: 'targeted-quality-tests',
        name: 'Targeted quality tests',
        command: 'npx',
        args: [
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
        points: 15,
      },
      {
        id: 'monetization-lite',
        name: 'Monetization verification',
        command: 'npm',
        args: ['run', 'verify:monetization:lite'],
        points: 5,
      },
      {
        id: 'food-db',
        name: 'Food DB verification',
        command: 'npm',
        args: ['run', 'verify:food-db'],
        points: 0,
      },
    ];

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

function createInitialState() {
  const now = new Date().toISOString();
  const staleAfterAt = new Date(Date.now() + STALE_AFTER_MS).toISOString();

  return {
    generatedAt: now,
    startedAt: now,
    finishedAt: null,
    pid: process.pid,
    mode: SELF_TEST_MODE ? 'self-test' : 'standard',
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    staleAfterMs: STALE_AFTER_MS,
    lastHeartbeatAt: now,
    staleAfterAt,
    overall: 'RUNNING',
    threshold: 100,
    maxScore: 110,
    coreScore: 0,
    stretchScore: 0,
    totalScore: 0,
    simulationReport: {
      reportFound: false,
      overallPass: false,
      contractsPass: false,
    },
    steps: STEP_DEFINITIONS.map((step) => ({
      id: step.id,
      name: step.name,
      points: step.points,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      error: null,
    })),
    failure: null,
  };
}

function updateScores(state, stretch = state.simulationReport) {
  const coreScore = state.steps
    .filter((step) => step.status === 'passed')
    .reduce((sum, step) => sum + step.points, 0);

  state.coreScore = coreScore;
  state.stretchScore = stretch.score ?? state.stretchScore;
  state.totalScore = state.coreScore + state.stretchScore;
  state.simulationReport = {
    reportFound: stretch.reportFound,
    overallPass: stretch.overallPass,
    contractsPass: stretch.contractsPass,
  };
}

function formatStepStatus(step) {
  if (step.status === 'passed') {
    return `PASS (+${step.points})`;
  }

  if (step.status === 'failed') {
    return `FAIL (${step.error ?? 'unknown error'})`;
  }

  if (step.status === 'running') {
    return 'RUNNING';
  }

  return 'PENDING';
}

function buildMarkdownReport(state) {
  const lines = [
    '# Quality 110 Gate Report',
    '',
    `- Generated at: ${state.generatedAt}`,
    `- Started at: ${state.startedAt}`,
    `- Finished at: ${state.finishedAt ?? 'in-progress'}`,
    `- PID: ${state.pid ?? 'unknown'}`,
    `- Mode: ${state.mode ?? 'standard'}`,
    `- Last heartbeat at: ${state.lastHeartbeatAt ?? 'unknown'}`,
    `- Stale after: ${state.staleAfterAt ?? 'unknown'}`,
    `- Overall: ${state.overall}`,
    `- Total score: ${state.totalScore}/${state.maxScore}`,
    `- Core score: ${state.coreScore}/100`,
    `- Stretch score: ${state.stretchScore}/10`,
    `- Release threshold met: ${state.totalScore >= state.threshold ? 'yes' : 'no'}`,
    '',
    '## Steps',
    '| Step | Status |',
    '|---|---|',
    ...state.steps.map((step) => `| ${step.name} | ${formatStepStatus(step)} |`),
    '',
    '## Simulation Stretch',
    `- Report found: ${state.simulationReport.reportFound ? 'yes' : 'no'}`,
    `- Overall PASS marker: ${state.simulationReport.overallPass ? 'yes' : 'no'}`,
    `- Contracts 8/8 marker: ${state.simulationReport.contractsPass ? 'yes' : 'no'}`,
  ];

  if (state.failure) {
    lines.push('', '## Failure', `- ${state.failure}`);
  }

  return `${lines.join('\n')}\n`;
}

function touchHeartbeat(state) {
  const now = new Date().toISOString();
  state.lastHeartbeatAt = now;
  state.staleAfterAt = new Date(Date.now() + STALE_AFTER_MS).toISOString();
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function reconcilePreviousRunningState() {
  try {
    const existing = JSON.parse(await fs.readFile(QUALITY_JSON_REPORT_PATH, 'utf8'));

    if (existing.overall !== 'RUNNING') {
      return;
    }

    if (existing.pid === process.pid) {
      return;
    }

    const staleByTimeout = typeof existing.staleAfterAt === 'string' && Date.parse(existing.staleAfterAt) <= Date.now();

    if (!staleByTimeout && isProcessAlive(existing.pid)) {
      return;
    }

    existing.finishedAt = new Date().toISOString();
    existing.overall = 'FAIL';
    existing.failure ??= staleByTimeout
      ? `Previous run (pid ${existing.pid ?? 'unknown'}) exceeded heartbeat timeout`
      : `Previous run (pid ${existing.pid ?? 'unknown'}) exited before finalizing status`;
    updateScores(existing);
    await writeQualityArtifacts(existing);
  } catch {
    // No previous artifact or unreadable artifact; nothing to reconcile.
  }
}

async function writeQualityArtifacts(state) {
  touchHeartbeat(state);
  state.generatedAt = new Date().toISOString();
  await fs.mkdir(path.join(ROOT, 'reports'), { recursive: true });
  await fs.writeFile(QUALITY_JSON_REPORT_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.writeFile(QUALITY_MD_REPORT_PATH, buildMarkdownReport(state), 'utf8');
}

function writeQualityArtifactsSync(state) {
  touchHeartbeat(state);
  state.generatedAt = new Date().toISOString();
  fsSync.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
  fsSync.writeFileSync(QUALITY_JSON_REPORT_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fsSync.writeFileSync(QUALITY_MD_REPORT_PATH, buildMarkdownReport(state), 'utf8');
}

function stopHeartbeatTimer() {
  if (!heartbeatTimer) {
    return;
  }

  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function startHeartbeatTimer() {
  stopHeartbeatTimer();
  heartbeatTimer = setInterval(() => {
    if (!currentState || currentState.overall !== 'RUNNING' || isFinalizing) {
      return;
    }

    writeQualityArtifacts(currentState).catch(() => {
      // Best-effort heartbeat writing only.
    });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();
}

async function markStepStatus(state, stepId, status, error = null) {
  const step = state.steps.find((entry) => entry.id === stepId);
  if (!step) {
    return;
  }

  const now = new Date().toISOString();
  step.status = status;
  step.error = error;

  if (status === 'running') {
    step.startedAt = now;
  }

  if (status === 'passed' || status === 'failed') {
    step.finishedAt = now;
  }

  updateScores(state);
  await writeQualityArtifacts(state);
}

async function finalizeState(state, overall, failure = null) {
  if (!state) {
    return;
  }

  stopHeartbeatTimer();
  state.finishedAt = new Date().toISOString();
  state.overall = overall;
  state.failure = failure;
  updateScores(state);
  await writeQualityArtifacts(state);
}

async function finalizeFailureFromDisk(message) {
  try {
    const existing = await fs.readFile(QUALITY_JSON_REPORT_PATH, 'utf8');
    const state = JSON.parse(existing);
    await finalizeState(state, 'FAIL', message);
  } catch {
    const fallbackState = createInitialState();
    fallbackState.startedAt = new Date().toISOString();
    await finalizeState(fallbackState, 'FAIL', message);
  }
}

function registerTerminationHandlers() {
  const handleTermination = (signal) => {
    if (isFinalizing) {
      return;
    }

    isFinalizing = true;
    const message = `Quality 110 gate interrupted by ${signal}`;
    console.error(`\n❌ ${message}`);

    const writeFailure = currentState
      ? finalizeState(currentState, 'FAIL', message)
      : finalizeFailureFromDisk(message);

    writeFailure.finally(() => {
      process.exit(1);
    });
  };

  process.on('SIGINT', () => handleTermination('SIGINT'));
  process.on('SIGTERM', () => handleTermination('SIGTERM'));
  process.on('exit', () => {
    if (!currentState || currentState.overall !== 'RUNNING') {
      return;
    }

    stopHeartbeatTimer();
    currentState.finishedAt = new Date().toISOString();
    currentState.overall = 'FAIL';
    currentState.failure ??= 'Quality 110 gate exited before finalizing status';
    updateScores(currentState);
    writeQualityArtifactsSync(currentState);
  });
}

async function getSimulationStretchScore() {
  if (SELF_TEST_MODE) {
    return {
      score: 10,
      overallPass: true,
      contractsPass: true,
      reportFound: true,
    };
  }

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

  await reconcilePreviousRunningState();

  const state = createInitialState();
  currentState = state;
  startHeartbeatTimer();
  await writeQualityArtifacts(state);

  for (const stepDefinition of STEP_DEFINITIONS) {
    await markStepStatus(state, stepDefinition.id, 'running');
    try {
      await runStep(stepDefinition.name, stepDefinition.command, stepDefinition.args);
      await markStepStatus(state, stepDefinition.id, 'passed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markStepStatus(state, stepDefinition.id, 'failed', message);
      throw error;
    }
  }

  const stretch = await getSimulationStretchScore();
  updateScores(state, stretch);
  await writeQualityArtifacts(state);

  const score = state.totalScore;

  console.log('\nQuality Breakdown');
  console.log('-----------------');
  console.log(`Core score: ${score - stretch.score}/100`);
  console.log(`Stretch score: ${stretch.score}/10`);
  console.log(`Total quality score: ${score}/110`);

  console.log(`Simulation report found: ${stretch.reportFound ? 'yes' : 'no'}`);
  console.log(`Simulation overall PASS marker: ${stretch.overallPass ? 'yes' : 'no'}`);
  console.log(`Static contracts 8/8 marker: ${stretch.contractsPass ? 'yes' : 'no'}`);

  if (score < 100) {
    await finalizeState(state, 'FAIL', `Quality score below release threshold: ${score}/110`);
    throw new Error(`Quality score below release threshold: ${score}/110`);
  }

  await finalizeState(state, 'PASS', null);

  console.log('\n✅ Quality 110 gate passed');
}

registerTerminationHandlers();

main().catch((error) => {
  if (isFinalizing) {
    return;
  }

  isFinalizing = true;
  console.error(`\n❌ Quality 110 gate failed: ${error.message}`);
  fs.mkdir(path.join(ROOT, 'reports'), { recursive: true })
    .then(async () => {
      if (currentState) {
        await finalizeState(currentState, 'FAIL', error.message);
      } else {
        await finalizeFailureFromDisk(error.message);
      }
    })
    .finally(() => {
      process.exit(1);
    });
});
