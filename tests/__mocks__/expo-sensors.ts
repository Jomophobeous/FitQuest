// Mock: expo-sensors
const noop = { remove: () => {} };
const mockSensor = {
  addListener: (_cb: any) => noop,
  removeAllListeners: () => {},
  setUpdateInterval: (_ms: number) => {},
  isAvailableAsync: async () => true,
};
export const Accelerometer = { ...mockSensor };
export const Gyroscope = { ...mockSensor };
export const Magnetometer = { ...mockSensor };
export const Barometer = { ...mockSensor };
export const Pedometer = {
  ...mockSensor,
  getStepCountAsync: async (_start: Date, _end: Date) => ({ steps: 0 }),
  watchStepCount: (_cb: any) => noop,
  isAvailableAsync: async () => true,
};
export const DeviceMotion = { ...mockSensor };
