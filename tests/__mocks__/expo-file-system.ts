// Stub for expo-file-system in test environment
export const documentDirectory = '/tmp/test-documents/';
export const cacheDirectory = '/tmp/test-cache/';
export async function readAsStringAsync() { return ''; }
export async function writeAsStringAsync() {}
export async function deleteAsync() {}
export async function getInfoAsync() { return { exists: false, size: 0, isDirectory: false }; }
export async function makeDirectoryAsync() {}
export async function readDirectoryAsync() { return []; }
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };
export default { documentDirectory, cacheDirectory, readAsStringAsync, writeAsStringAsync, deleteAsync, getInfoAsync, makeDirectoryAsync, readDirectoryAsync, EncodingType };
