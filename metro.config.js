// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Treat .model files as binary assets (not source code).
// This prevents Metro from trying to parse large JSON model files
// synchronously, which would freeze the JS thread and crash the app.
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'model'];

module.exports = config;
