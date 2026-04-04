// Mock: @sentry/react-native — uses vi.fn() for test spy assertions
import { vi } from 'vitest';

export const init = vi.fn();
export const captureException = vi.fn(() => '');
export const captureMessage = vi.fn(() => '');
export const setUser = vi.fn();
export const setTag = vi.fn();
export const addBreadcrumb = vi.fn();
export const withScope = vi.fn((fn: (scope: any) => void) => fn({
  setLevel: vi.fn(),
  setTag: vi.fn(),
  setExtra: vi.fn(),
  setExtras: vi.fn(),
  setContext: vi.fn(),
}));
export const getClient = vi.fn(() => ({
  getOptions: () => ({ enabled: true }),
}));
export const wrap = (component: any) => component;
export const ReactNativeTracing = class {};
export const ReactNavigationInstrumentation = class {};
