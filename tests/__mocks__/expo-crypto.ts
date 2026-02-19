// Stub for expo-crypto in test environment
export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
export const CryptoEncoding = { HEX: 'hex', BASE64: 'base64' };
export async function digestStringAsync(_algo: string, data: string) {
  // Simple hash stub — returns a deterministic hex string
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}
export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}
export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}
export default { digestStringAsync, getRandomBytesAsync, getRandomBytes, CryptoDigestAlgorithm, CryptoEncoding };
