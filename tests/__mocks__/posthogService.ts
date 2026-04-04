// Mock: posthogService
export const captureEvent = (_event: string, _properties?: Record<string, any>) => {};
export const identifyUser = (_userId: string, _properties?: Record<string, any>) => {};
export const captureScreen = (_screenName: string, _properties?: Record<string, any>) => {};
export const resetPostHog = () => {};
export default { captureEvent, identifyUser, captureScreen, resetPostHog };
