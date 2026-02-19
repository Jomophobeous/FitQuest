// Stub for expo-random in test environment
export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}
export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  return getRandomBytes(length);
}
export default { getRandomBytes, getRandomBytesAsync };
