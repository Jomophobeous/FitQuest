// Mock: @sentry/react-native
export const init = (_options?: any) => {};
export const captureException = (_error: any, _context?: any) => '';
export const captureMessage = (_message: string, _level?: any) => '';
export const setUser = (_user: any) => {};
export const setTag = (_key: string, _value: string) => {};
export const addBreadcrumb = (_breadcrumb: any) => {};
export const withScope = (fn: (scope: any) => void) => fn({
  setTag: () => {},
  setExtra: () => {},
  setContext: () => {},
});
export const wrap = (component: any) => component;
export const ReactNativeTracing = class {};
export const ReactNavigationInstrumentation = class {};
