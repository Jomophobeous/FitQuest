module.exports = function(api) {
  api.cache(true);

  const plugins = [];

  // Strip console.* calls in production builds to reduce noise and bundle size
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.push('transform-remove-console');
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
