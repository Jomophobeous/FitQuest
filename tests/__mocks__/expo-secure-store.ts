// Stub for expo-secure-store in test environment
const store: Record<string, string> = {};
export async function getItemAsync(key: string) { return store[key] ?? null; }
export async function setItemAsync(key: string, value: string, _options?: any) { store[key] = value; }
export async function deleteItemAsync(key: string) { delete store[key]; }
export function clearAll() { for (const k in store) delete store[k]; }
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 9;
export default { getItemAsync, setItemAsync, deleteItemAsync, clearAll, WHEN_UNLOCKED_THIS_DEVICE_ONLY };
