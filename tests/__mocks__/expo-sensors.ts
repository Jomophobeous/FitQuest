// Stub for expo-sensors in test environment
const noop = { remove: () => {} };
export const Accelerometer = {
  addListener: () => noop,
  removeAllListeners: () => {},
  setUpdateInterval: () => {},
  isAvailableAsync: async () => false,
};
export const Gyroscope = {
  addListener: () => noop,
  removeAllListeners: () => {},
  setUpdateInterval: () => {},
  isAvailableAsync: async () => false,
};
export const Pedometer = {
  watchStepCount: () => noop,
  getStepCountAsync: async () => ({ steps: 0 }),
  isAvailableAsync: async () => false,
};
export default { Accelerometer, Gyroscope, Pedometer };
