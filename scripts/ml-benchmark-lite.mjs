import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'reports', 'ml-benchmark-lite.md');

async function timeOperation(label, fn, iterations = 200) {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    fn();
  }
  const duration = performance.now() - start;
  return {
    label,
    iterations,
    totalMs: duration,
    avgMs: duration / iterations,
  };
}

async function getModelAssets() {
  const modelDir = path.join(ROOT, 'assets', 'models');
  const names = await fs.readdir(modelDir);
  const selected = names.filter((name) => /model|intent|activity|ar/i.test(name)).slice(0, 12);
  const stats = [];

  for (const name of selected) {
    const filePath = path.join(modelDir, name);
    const stat = await fs.stat(filePath);
    stats.push({ name, bytes: stat.size });
  }

  return stats;
}

async function main() {
  console.log('FitQuest ML benchmark (lite)');
  console.log('===========================');

  const assets = await getModelAssets();

  const results = [];
  results.push(await timeOperation('vector dot product (512 dims)', () => {
    let sum = 0;
    for (let i = 0; i < 512; i += 1) sum += i * (512 - i);
    return sum;
  }, 1200));

  results.push(await timeOperation('token scoring (intent-like)', () => {
    const query = 'build strength and mobility with recovery focus and safe progression';
    const tokens = query.split(' ');
    return tokens.reduce((acc, token) => acc + (token.length % 3), 0);
  }, 1500));

  const report = [
    '# ML Benchmark Lite',
    '',
    `- Generated at: ${new Date().toISOString()}`,
    '',
    '## Asset Snapshot',
    '| Asset | Size (bytes) |',
    '|---|---|',
    ...assets.map((asset) => `| ${asset.name} | ${asset.bytes} |`),
    '',
    '## Micro-benchmark Results',
    '| Operation | Iterations | Total (ms) | Avg (ms) |',
    '|---|---:|---:|---:|',
    ...results.map((result) => `| ${result.label} | ${result.iterations} | ${result.totalMs.toFixed(2)} | ${result.avgMs.toFixed(4)} |`),
  ].join('\n');

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, report, 'utf8');

  console.log(`✓ ML benchmark report: ${path.relative(ROOT, REPORT_PATH)}`);
  console.log('✅ ML benchmark lite complete');
}

main().catch((error) => {
  console.error(`\n❌ ML benchmark lite failed: ${error.message}`);
  process.exit(1);
});
