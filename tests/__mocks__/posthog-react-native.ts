import { vi } from 'vitest';

const mockClient = {
  capture: vi.fn(),
  identify: vi.fn(),
  screen: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
  ready: vi.fn().mockResolvedValue(undefined),
};

export default class PostHog {
  constructor() {
    return mockClient as any;
  }
  static async ready() {}
}

export const PostHogProvider = ({ children }: any) => children;
export const usePostHog = () => mockClient;
