// Mock: expo-battery
export const BatteryState = { UNPLUGGED: 0, CHARGING: 1, FULL: 2, UNKNOWN: 3 };
export async function getBatteryLevelAsync(): Promise<number> { return 0.85; }
export async function getBatteryStateAsync(): Promise<number> { return BatteryState.UNPLUGGED; }
export async function isLowPowerModeEnabledAsync(): Promise<boolean> { return false; }
