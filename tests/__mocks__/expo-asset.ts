// Mock: expo-asset
export class Asset {
  static fromModule(_module: any): Asset { return new Asset(); }
  static fromURI(_uri: string): Asset { return new Asset(); }
  localUri: string | null = null;
  uri: string = '';
  name: string = '';
  type: string = '';
  width: number | null = null;
  height: number | null = null;
  async downloadAsync(): Promise<this> { return this; }
}
export function useAssets(_modules: any[]): [Asset[] | undefined, Error | undefined] {
  return [undefined, undefined];
}
