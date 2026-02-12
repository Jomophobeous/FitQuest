import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');

function read(filePath: string): string {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
}

describe('security policy regressions', () => {
  it('keeps AsyncStorage imports removed from source', () => {
    const srcRoot = path.join(ROOT, 'src');
    const files: string[] = [];

    function walk(dir: string) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
          files.push(full);
        }
      }
    }

    walk(srcRoot);
    const offenders = files.filter((file) =>
      fs.readFileSync(file, 'utf8').includes("from '@react-native-async-storage/async-storage'")
    );
    expect(offenders).toEqual([]);
  });

  it('keeps secureDelete table whitelist in encrypted DB', () => {
    const encryptedDb = read('src/security/EncryptedDatabase.ts');
    expect(encryptedDb).toContain("table !== 'encrypted_health_data'");
    expect(encryptedDb).toContain("table !== 'encrypted_ai_conversations'");
    expect(encryptedDb).toContain("table !== 'encrypted_notes'");
    expect(encryptedDb).toContain("table !== 'health_alerts'");
  });
});
