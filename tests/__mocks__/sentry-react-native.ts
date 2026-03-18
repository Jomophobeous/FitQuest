import { vi } from 'vitest';

export function init() {}
export function captureException() {}
export function addBreadcrumb() {}
export function setTag() {}
export function setUser() {}
export function wrap(component: any) { return component; }

export default {
  init: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  setUser: vi.fn(),
  wrap: (c: any) => c,
};
