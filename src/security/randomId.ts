import * as Crypto from 'expo-crypto';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateSecureId(prefix: string, byteLength = 8): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return `${prefix}_${Date.now()}_${toHex(bytes).slice(0, byteLength * 2)}`;
}
