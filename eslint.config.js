// @ts-check
const tseslint = require('typescript-eslint');
const reactNative = require('eslint-plugin-react-native');

/** @type {any[]} */
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
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-native': reactNative,
    },
    rules: {
      // Core safety rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off', // handled by @typescript-eslint/no-unused-vars
      'no-undef': 'off', // handled by TypeScript
      // Prevent raw text outside ThemedText — catches i18n misses
      'react-native/no-raw-text': ['warn', { skip: ['ThemedText'] }],
      // Relax during transition — tighten once warnings are cleaned up
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
