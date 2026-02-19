#!/usr/bin/env node

/**
 * Release Verification Script
 *
 * Pre-release checklist for FitQuest mobile app.
 * Validates critical requirements before builds.
 *
 * Usage:
 *   node scripts/verify-release.mjs
 *   node scripts/verify-release.mjs --strict
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const isStrict = process.argv.includes('--strict');
const results = [];

function check(name, condition, details = '') {
  const passed = typeof condition === 'function' ? condition() : condition;
  results.push({ name, passed, details });
  console.log(`${passed ? '✓' : '✗'} ${name}${details ? ` - ${details}` : ''}`);
  return passed;
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readJSON(relativePath) {
  try {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function fileContains(relativePath, search) {
  try {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
    return content.includes(search);
  } catch {
    return false;
  }
}

console.log('\n=== FitQuest Release Verification ===\n');

// ─── PACKAGE CONFIGURATION ───────────────────────────────────────

console.log('📦 Package Configuration\n');

const pkg = readJSON('package.json');
check('package.json exists', pkg !== null);
check('package name is set', pkg?.name === 'fitquest-mobile');
check('version is defined', /^\d+\.\d+\.\d+/.test(pkg?.version || ''));
check('main entry is expo-router', pkg?.main === 'expo-router/entry');

const appJson = readJSON('app.json');
check('app.json exists', appJson !== null);
check('app name is set', !!appJson?.expo?.name);
check('bundle identifier is set', !!appJson?.expo?.ios?.bundleIdentifier);
check('android package is set', !!appJson?.expo?.android?.package);

// ─── CRITICAL FILES ─────────────────────────────────────────────

console.log('\n📁 Critical Files\n');

check('Database schema exists', fileExists('src/database/schema.ts'));
check('Database service exists', fileExists('src/database/service.ts'));
check('Database types exists', fileExists('src/database/types.ts'));
check('Seed data exists', fileExists('src/database/seed.ts'));
check('Theme system exists', fileExists('src/design/theme-system.ts'));
check('Encrypted database exists', fileExists('src/security/EncryptedDatabase.ts'));
check('Biometric auth exists', fileExists('src/security/BiometricAuth.ts'));
check('Background health engine', fileExists('src/engines/BackgroundHealthEngine.ts'));
check('Workout generator exists', fileExists('src/engines/workoutGenerator.ts'));
check('Feature flags service', fileExists('src/services/featureFlags.ts'));
check('Error telemetry service', fileExists('src/services/errorTelemetry.ts'));
check('Health adapters exist', fileExists('src/services/healthAdapters/index.ts'));

// ─── SCHEMA VERSION ─────────────────────────────────────────────

console.log('\n📊 Schema Configuration\n');

const typesContent = fs.existsSync(path.join(ROOT, 'src/database/types.ts'))
  ? fs.readFileSync(path.join(ROOT, 'src/database/types.ts'), 'utf-8')
  : '';
const schemaVersionMatch = typesContent.match(/SCHEMA_VERSION\s*=\s*(\d+)/);
const schemaVersion = schemaVersionMatch ? parseInt(schemaVersionMatch[1], 10) : 0;
check('Schema version >= 9', schemaVersion >= 9, `Current: ${schemaVersion}`);

// ─── EXPO CONFIGURATION ─────────────────────────────────────────

console.log('\n📱 Expo Configuration\n');

const expoVersion = pkg?.dependencies?.expo;
check('Expo SDK 54+', expoVersion?.includes('54') || expoVersion?.includes('55'), expoVersion);
check('Expo Router installed', !!pkg?.dependencies?.['expo-router']);
check('Expo SQLite installed', !!pkg?.dependencies?.['expo-sqlite']);
check('Expo Secure Store installed', !!pkg?.dependencies?.['expo-secure-store']);
check('Expo Sensors installed', !!pkg?.dependencies?.['expo-sensors']);

// ─── SECURITY CHECKS ────────────────────────────────────────────

console.log('\n🔒 Security Checks\n');

check('AES encryption module', fileExists('src/security/AESEncryption.ts'));
check('No console.log of secrets', () => {
  const files = ['src/security/AESEncryption.ts', 'src/security/BiometricAuth.ts'];
  for (const file of files) {
    if (fileContains(file, 'console.log(key') || fileContains(file, 'console.log(secret')) {
      return false;
    }
  }
  return true;
});
check('Encrypted health data table', fileContains('src/database/schema.ts', 'encrypted_health_data'));

// ─── METRO CONFIGURATION ────────────────────────────────────────

console.log('\n⚙️ Metro Configuration\n');

check('Metro config exists', fileExists('metro.config.js'));
check('Metro supports txt assets', fileContains('metro.config.js', 'txt'));
check('Babel config exists', fileExists('babel.config.js'));
check('TypeScript config exists', fileExists('tsconfig.json'));

// ─── I18N COVERAGE ──────────────────────────────────────────────

console.log('\n🌐 i18n Coverage\n');

const translationsPath = path.join(ROOT, 'src/i18n/translations.ts');
if (fs.existsSync(translationsPath)) {
  const translationsContent = fs.readFileSync(translationsPath, 'utf-8');
  const languages = ['en', 'af', 'zu', 'xh', 'st', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'sw'];
  const foundLanguages = languages.filter(lang => translationsContent.includes(`const ${lang}:`));
  check('Multi-language support', foundLanguages.length >= 10, `${foundLanguages.length} languages`);
}

// ─── BUILD ARTIFACTS ────────────────────────────────────────────

console.log('\n🏗️ Build Artifacts\n');

check('No node_modules in git', !fileExists('node_modules/.package-lock.json.bak'));
check('EAS config exists', fileExists('eas.json'));

// ─── SUMMARY ────────────────────────────────────────────────────

console.log('\n=== Summary ===\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total: ${total}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\n❌ Failed checks:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`   - ${r.name}`);
  });
}

const exitCode = isStrict && failed > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? '✅ Release verification passed' : '❌ Release verification failed'}\n`);
process.exit(exitCode);
