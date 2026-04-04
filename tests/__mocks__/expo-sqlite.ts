// Mock: expo-sqlite — minimal SQLite mock for testing

export function openDatabaseSync(_name: string): any {
  const rows: any[] = [];
  return {
    execAsync: async (_sql: string) => {},
    runAsync: async (_sql: string, ..._params: any[]) => ({ lastInsertRowId: 1, changes: 0 }),
    getFirstAsync: async (_sql: string, ..._params: any[]) => null,
    getAllAsync: async (_sql: string, ..._params: any[]) => rows,
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
    closeAsync: async () => {},
    withExclusiveTransactionAsync: async (fn: (tx: any) => Promise<void>) => fn({
      execAsync: async () => {},
      runAsync: async () => ({ lastInsertRowId: 1, changes: 0 }),
      getFirstAsync: async () => null,
      getAllAsync: async () => [],
    }),
  };
}

export function openDatabaseAsync(_name: string): Promise<any> {
  return Promise.resolve(openDatabaseSync(_name));
}

export const SQLiteProvider = ({ children }: any) => children;
