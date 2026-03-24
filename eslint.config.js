// @ts-check
const tseslint = require('typescript-eslint');
const reactNative = require('eslint-plugin-react-native');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const prettierConfig = require('eslint-config-prettier');

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
      'workspace-repos/**',
      'website/**',
      'training/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-native': reactNative,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ═══════════════════════════════════════
      // HARD ENFORCEMENT — build must fail
      // ═══════════════════════════════════════

      // Syntax & scope safety
      'no-unreachable': 'error',
      'no-extra-semi': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-func-assign': 'error',
      'no-inner-declarations': 'error',
      // Allow __DEV__ && console.log(...) pattern
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],

      // JSX safety
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': ['error', { allowGlobals: true }],
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-children-prop': 'error',

      // React Hooks — rules of hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-raw-text': ['warn', { skip: ['ThemedText'] }],

      // ═══════════════════════════════════════
      // TypeScript — relaxed during transition
      // ═══════════════════════════════════════
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Prettier must be last — disables formatting rules that conflict
  prettierConfig,
];
