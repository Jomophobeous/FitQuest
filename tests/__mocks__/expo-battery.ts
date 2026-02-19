// Stub for expo-battery in test environment
export const BatteryState = { UNPLUGGED: 0, CHARGING: 1, FULL: 2, UNKNOWN: 3 };
export async function getBatteryLevelAsync() { return 0.85; }
export async function getBatteryStateAsync() { return BatteryState.UNPLUGGED; }
export function addBatteryStateListener(_fn: Function) { return { remove: () => {} }; }
export default { BatteryState, getBatteryLevelAsync, getBatteryStateAsync, addBatteryStateListener };
