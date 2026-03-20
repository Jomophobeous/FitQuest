const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Expo config plugin that adds aaptOptions { noCompress } to android/app/build.gradle.
 * Ensures bundled assets (exercise images as .webp/.jpg/.png) remain uncompressed
 * so they can be served via file:///android_asset/ paths at runtime.
 */
function withAndroidAaptOptions(config) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Skip if already configured
    if (buildGradle.includes('noCompress')) {
      return config;
    }

    // Insert aaptOptions block inside android { ... } after the first opening brace
    config.modResults.contents = buildGradle.replace(
      /android\s*\{/,
      `android {
    aaptOptions {
        noCompress 'webp', 'jpg', 'png'
    }`
    );

    return config;
  });
}

module.exports = withAndroidAaptOptions;
