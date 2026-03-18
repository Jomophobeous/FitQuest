import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

function parseEnv(raw) {
  const out = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function getByRegex(text, regex) {
  const match = String(text || '').match(regex);
  return match?.[1] ?? null;
}

function printCheck(ok, label, detail = '') {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
}

function isTruthy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

async function run() {
  console.log('FitQuest OAuth preflight');
  console.log('=======================');

  const rootEnvRaw = await readText(path.join(ROOT, '.env'));
  const rootEnvLocalRaw = await readText(path.join(ROOT, '.env.local'));
  const serverEnvRaw = await readText(path.join(ROOT, 'server', '.env'));
  const appJsonRaw = await readText(path.join(ROOT, 'app.json'));
  const gradleRaw = await readText(path.join(ROOT, 'android', 'app', 'build.gradle'));

  const rootEnv = {
    ...parseEnv(rootEnvRaw),
    ...parseEnv(rootEnvLocalRaw),
  };
  const serverEnv = parseEnv(serverEnvRaw);

  const appJsonPackage = getByRegex(appJsonRaw, /"package"\s*:\s*"([^"]+)"/);
  const gradlePackage = getByRegex(gradleRaw, /applicationId\s+'([^']+)'/);

  const mobileAndroidClient = rootEnv.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const mobileWebClient = rootEnv.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const mobileIosClient = rootEnv.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  const androidOnlyMode = isTruthy(rootEnv.EXPO_PUBLIC_OAUTH_ANDROID_ONLY);
  const serverGoogleClient = serverEnv.GOOGLE_CLIENT_ID || '';

  const hasAndroidClient = Boolean(mobileAndroidClient);
  const hasFallbackClient = Boolean(mobileWebClient || mobileIosClient);
  const hasMobileClient = Boolean(mobileAndroidClient || mobileWebClient || mobileIosClient);
  const hasServerClient = Boolean(serverGoogleClient);
  const packageAligned = Boolean(appJsonPackage && gradlePackage && appJsonPackage === gradlePackage);

  const blockers = [];
  const warnings = [];

  printCheck(Boolean(rootEnvRaw), 'Root .env exists');
  if (!rootEnvRaw) blockers.push('Root .env is missing');

  printCheck(Boolean(rootEnvLocalRaw) || Boolean(rootEnvRaw), 'Root env source available', rootEnvLocalRaw ? '.env.local override loaded' : '.env only');

  printCheck(Boolean(serverEnvRaw), 'Server .env exists');
  if (!serverEnvRaw) blockers.push('server/.env is missing');

  printCheck(Boolean(mobileAndroidClient || mobileWebClient || mobileIosClient), 'At least one Google mobile client ID present');
  if (!hasMobileClient) blockers.push('Missing Google client IDs in root env (.env or .env.local)');

  printCheck(Boolean(mobileAndroidClient) || hasFallbackClient, 'Android sign-in client configuration present', hasAndroidClient ? 'android client' : hasFallbackClient ? 'fallback client' : 'none');
  if (!hasAndroidClient && hasFallbackClient) {
    warnings.push('Android-specific Google client ID is missing; using web/iOS fallback for Expo AuthSession');
  }

  printCheck(
    Boolean(mobileWebClient || mobileIosClient || androidOnlyMode),
    'Google web/iOS fallback client present',
    androidOnlyMode ? 'android-only mode' : (mobileWebClient ? 'web' : mobileIosClient ? 'ios' : 'none')
  );
  if (!androidOnlyMode && !mobileWebClient && !mobileIosClient) {
    warnings.push('Missing web/iOS fallback client IDs (optional but recommended)');
  }

  printCheck(Boolean(serverGoogleClient), 'GOOGLE_CLIENT_ID present in server/.env');
  if (!serverGoogleClient) blockers.push('Missing GOOGLE_CLIENT_ID in server/.env');

  if (hasMobileClient && hasServerClient) {
    const anyMatch = [mobileAndroidClient, mobileWebClient, mobileIosClient]
      .filter(Boolean)
      .some((value) => value === serverGoogleClient);
    printCheck(anyMatch, 'Mobile and server Google client IDs aligned');
    if (!anyMatch) blockers.push('Server GOOGLE_CLIENT_ID does not match any mobile Google client ID');
  } else {
    printCheck(false, 'Mobile and server Google client IDs aligned', 'missing one side');
    blockers.push('Cannot confirm client ID alignment because one side is missing');
  }

  if (appJsonPackage && gradlePackage) {
    printCheck(packageAligned, 'Android package aligned (app.json vs build.gradle)', `${appJsonPackage} vs ${gradlePackage}`);
    if (!packageAligned) {
      warnings.push('Android package mismatch between app.json and android/app/build.gradle');
    }
  } else {
    printCheck(false, 'Android package aligned (app.json vs build.gradle)', 'could not parse package values');
    warnings.push('Could not parse package values from app.json/build.gradle');
  }

  const ready = blockers.length === 0 && (hasAndroidClient || hasFallbackClient);
  console.log('');

  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
    console.log('');
  }

  if (ready) {
    console.log('Result: OAuth configuration is ready for Google sign-in.');
    if (!packageAligned) {
      console.log('Note: current native build uses build.gradle applicationId. Keep Google OAuth package consistent with that value until you align package names.');
    }
    process.exit(0);
  }

  console.log('Result: OAuth configuration blocked.');
  console.log('Fix these blockers:');
  for (const blocker of blockers) {
    console.log(`- ${blocker}`);
  }
  process.exit(1);
}

run().catch((error) => {
  console.error(`Preflight failed: ${error.message}`);
  process.exit(1);
});
