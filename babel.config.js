module.exports = function(api) {
  api.cache(true);

  const plugins = [];

  // Strip console.log/debug/info in production; preserve console.warn/error for Sentry breadcrumbs
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.push(['transform-remove-console', { exclude: ['warn', 'error'] }]);
  }

  // Reanimated MUST be last
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }]
    ],
    plugins,
  };
};
