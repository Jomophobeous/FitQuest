// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude workspace-repos/, server/, and android build outputs from Metro bundling.
// These contain full git checkouts and native build artifacts that slow Metro
// and can cause module resolution conflicts in Expo Go.
// IMPORTANT: Patterns are anchored to the project root to avoid accidentally
// blocking paths that contain "server" (e.g. the "mobile_without server" directory name).
const projectRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList ? [config.resolver.blockList] : [];
config.resolver.blockList = [
  ...defaultBlockList,
  new RegExp(`${projectRoot}/workspace-repos/.*`),
  new RegExp(`${projectRoot}/server/.*`),
  new RegExp(`${projectRoot}/android/build/.*`),
  // Block native build artifacts inside node_modules that exhaust inotify watchers
  /.*\/android\/build\/.*/,
  /.*\/ios\/build\/.*/,
];

// Treat .model files as binary assets (not source code).
// This prevents Metro from trying to parse large JSON model files
// synchronously, which would freeze the JS thread and crash the app.
// Also treat .txt files as assets for FitMind reader templates (pdf.min.txt, epub.min.txt, etc.)
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'model', 'txt'];

// Fix: expo-auth-session internally imports expo-application but can't
// resolve it from its own node_modules when npm hoists differently.
// Map it to our top-level copy so Metro always finds it.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-application': path.resolve(__dirname, 'node_modules/expo-application'),
};

// Enable inline requires for faster startup — modules load on first use
config.transformer = {
  ...config.transformer,
  inlineRequires: true,
};

module.exports = config;
