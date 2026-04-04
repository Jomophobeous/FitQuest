// Mock: expo-file-system
export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';

export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };

export async function readAsStringAsync(_uri: string, _options?: any): Promise<string> {
  return '';
}
export async function writeAsStringAsync(_uri: string, _contents: string, _options?: any): Promise<void> {}
export async function deleteAsync(_uri: string, _options?: any): Promise<void> {}
export async function getInfoAsync(_uri: string, _options?: any): Promise<{ exists: boolean; size: number; isDirectory: boolean }> {
  return { exists: false, size: 0, isDirectory: false };
}
export async function makeDirectoryAsync(_uri: string, _options?: any): Promise<void> {}
export async function readDirectoryAsync(_uri: string): Promise<string[]> { return []; }
export async function copyAsync(_options: any): Promise<void> {}
export async function moveAsync(_options: any): Promise<void> {}
