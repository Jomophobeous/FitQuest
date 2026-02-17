#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) {
    throw new Error(`Missing file: ${rel}`);
  }
  return readFileSync(abs, 'utf8');
}

const failures = [];

try {
  const packageJson = JSON.parse(read('package.json'));
  const deps = packageJson.dependencies || {};
  if (!deps['expo-notifications']) {
    failures.push('package.json missing dependency: expo-notifications');
  }
} catch (error) {
  failures.push(`Unable to parse package.json: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const appJson = JSON.parse(read('app.json'));
  const plugins = appJson?.expo?.plugins || [];
  const hasPlugin = Array.isArray(plugins)
    && plugins.some((entry) => (typeof entry === 'string' ? entry : entry?.[0]) === 'expo-notifications');
  if (!hasPlugin) {
    failures.push('app.json missing expo-notifications plugin');
  }
} catch (error) {
  failures.push(`Unable to parse app.json: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const layout = read('app/_layout.tsx');
  if (!layout.includes('reconcileNotificationReliability')) {
    failures.push('app/_layout.tsx missing reconcileNotificationReliability integration');
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

try {
  const profile = read('app/profile.tsx');
  const checks = [
    'enableDailyWorkoutReminder',
    'disableDailyWorkoutReminder',
    'scheduleDailyWorkoutReminder',
  ];
  for (const token of checks) {
    if (!profile.includes(token)) {
      failures.push(`app/profile.tsx missing notification handler usage: ${token}`);
    }
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length > 0) {
  console.error('❌ Notification reliability gate failed.');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('✅ Notification reliability gate passed.');
