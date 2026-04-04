// Mock: expo-modules-core
export class NativeModule {
  constructor() {}
}
export class EventEmitter {
  addListener(_event: string, _fn: any) { return { remove: () => {} }; }
  removeAllListeners(_event?: string) {}
  emit(_event: string, ..._args: any[]) {}
}
export function requireNativeModule(_name: string): any { return {}; }
export function requireOptionalNativeModule(_name: string): any { return null; }
