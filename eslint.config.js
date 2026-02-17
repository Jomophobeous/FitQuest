// @ts-check
/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      'web-build/**',
      '.expo/**',
      'agents/**',
      'Figma UI/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Core safety rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off', // handled by TypeScript
      'no-undef': 'off', // handled by TypeScript
    },
  },
];
