// Stub for expo-local-authentication in test environment
export const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };
export const SecurityLevel = { NONE: 0, SECRET: 1, BIOMETRIC: 2 };
export async function hasHardwareAsync() { return true; }
export async function isEnrolledAsync() { return true; }
export async function authenticateAsync() { return { success: true }; }
export async function supportedAuthenticationTypesAsync() { return [1]; }
export async function getEnrolledLevelAsync() { return 2; }
export default { AuthenticationType, SecurityLevel, hasHardwareAsync, isEnrolledAsync, authenticateAsync, supportedAuthenticationTypesAsync, getEnrolledLevelAsync };
