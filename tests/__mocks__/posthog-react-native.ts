// Mock: posthog-react-native
export class PostHog {
  constructor(_apiKey: string, _options?: any) {}
  capture(_event: string, _properties?: Record<string, any>): void {}
  identify(_distinctId: string, _properties?: Record<string, any>): void {}
  screen(_name: string, _properties?: Record<string, any>): void {}
  flush(): void {}
  reset(): void {}
  async enable(): Promise<void> {}
  async disable(): Promise<void> {}
}
export const usePostHog = (): PostHog | null => null;
export const PostHogProvider = ({ children }: any) => children;
