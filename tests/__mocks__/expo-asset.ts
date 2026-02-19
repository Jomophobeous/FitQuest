// Stub for expo-asset in test environment
export const Asset = {
  fromModule: (_moduleId: number) => ({
    localUri: '/tmp/mock-asset.txt',
    uri: '/tmp/mock-asset.txt',
    downloadAsync: async () => {},
  }),
};

export default { Asset };
