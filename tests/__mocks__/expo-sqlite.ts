// Stub for expo-sqlite in test environment
export function openDatabaseSync(_name: string) {
  return {
    execAsync: async () => {},
    getAllAsync: async () => [],
    getFirstAsync: async () => null,
    runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  };
}
export default { openDatabaseSync };
