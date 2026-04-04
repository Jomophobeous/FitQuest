// Mock: expo-local-authentication
export const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };
export const SecurityLevel = { NONE: 0, SECRET: 1, BIOMETRIC: 2 };

export async function hasHardwareAsync(): Promise<boolean> { return true; }
export async function isEnrolledAsync(): Promise<boolean> { return true; }
export async function authenticateAsync(_options?: any): Promise<{ success: boolean }> {
  return { success: true };
}
export async function supportedAuthenticationTypesAsync(): Promise<number[]> {
  return [AuthenticationType.FINGERPRINT];
}
export async function getEnrolledLevelAsync(): Promise<number> {
  return SecurityLevel.BIOMETRIC;
}
