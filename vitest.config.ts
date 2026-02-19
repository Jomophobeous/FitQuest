import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    reporters: ['basic'],
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['**/node_modules/**', 'workspace-repos/**'],
  },
  resolve: {
    alias: {
      // Stub native Expo modules that can't run in Node.js
      'expo-crypto': path.resolve(__dirname, 'tests/__mocks__/expo-crypto.ts'),
      'expo-secure-store': path.resolve(__dirname, 'tests/__mocks__/expo-secure-store.ts'),
      'expo-sqlite': path.resolve(__dirname, 'tests/__mocks__/expo-sqlite.ts'),
      'expo-battery': path.resolve(__dirname, 'tests/__mocks__/expo-battery.ts'),
      'expo-local-authentication': path.resolve(__dirname, 'tests/__mocks__/expo-local-authentication.ts'),
      'expo-file-system/legacy': path.resolve(__dirname, 'tests/__mocks__/expo-file-system.ts'),
      'expo-file-system': path.resolve(__dirname, 'tests/__mocks__/expo-file-system.ts'),
      'expo-sensors': path.resolve(__dirname, 'tests/__mocks__/expo-sensors.ts'),
      'expo-random': path.resolve(__dirname, 'tests/__mocks__/expo-random.ts'),
      'expo-modules-core': path.resolve(__dirname, 'tests/__mocks__/expo-modules-core.ts'),
      'expo-asset': path.resolve(__dirname, 'tests/__mocks__/expo-asset.ts'),
    },
  },
});
