/**
 * Backups Screen ViewModel
 * Encapsulates local + cloud backup operations, state, and mutation queue.
 */
import { useState, useCallback, useEffect } from 'react';
import { createViewModel } from './createViewModel';
import {
  deleteEncryptedBackup,
  exportEncryptedBackup,
  importEncryptedBackup,
  listEncryptedBackups,
  type BackupListItem,
} from '../services/backupService';
import {
  deleteCloudBackup,
  isCloudBackupConfigured,
  listCloudBackups,
  restoreCloudBackup,
  uploadLocalBackupToCloud,
  type CloudBackupListItem,
} from '../services/cloudBackupService';
import { enqueueMutation } from '../services/mutationQueueService';

export type { BackupListItem, CloudBackupListItem };

export const useBackupsViewModel = createViewModel(() => {
  const [items, setItems] = useState<BackupListItem[]>([]);
  const [cloudItems, setCloudItems] = useState<CloudBackupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const cloudEnabled = isCloudBackupConfigured();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listEncryptedBackups());
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!cloudEnabled) return;
    setCloudLoading(true);
    try {
      setCloudItems(await listCloudBackups());
    } catch {
      setCloudItems([]);
    } finally {
      setCloudLoading(false);
    }
  }, [cloudEnabled]);

  useEffect(() => {
    refresh();
    void refreshCloud();
  }, [refresh, refreshCloud]);

  const createBackup = useCallback(
    async (passphrase?: string): Promise<{ bytes: number }> => {
      setBusy(true);
      try {
        const result = await exportEncryptedBackup({
          passphrase: passphrase && passphrase.length > 0 ? passphrase : undefined,
        });
        await refresh();
        return result;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const restoreBackup = useCallback(async (backupUri: string, passphrase?: string) => {
    setBusy(true);
    try {
      await importEncryptedBackup({
        backupUri,
        passphrase: passphrase && passphrase.length > 0 ? passphrase : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const removeBackup = useCallback(
    async (uri: string) => {
      setBusy(true);
      try {
        await deleteEncryptedBackup(uri);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const uploadCloud = useCallback(
    async (passphrase?: string) => {
      setBusy(true);
      try {
        await uploadLocalBackupToCloud({
          passphrase: passphrase && passphrase.length > 0 ? passphrase : undefined,
        });
        await refreshCloud();
      } catch (e) {
        if (!passphrase || passphrase.length === 0) {
          await enqueueMutation('backup.upload_latest', {}, { dedupeKey: 'backup.upload_latest.manual' });
        }
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [refreshCloud],
  );

  const restoreCloud = useCallback(async (id: string, passphrase?: string) => {
    setBusy(true);
    try {
      await restoreCloudBackup({
        id,
        passphrase: passphrase && passphrase.length > 0 ? passphrase : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const removeCloud = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await deleteCloudBackup(id);
        await refreshCloud();
      } finally {
        setBusy(false);
      }
    },
    [refreshCloud],
  );

  return {
    items,
    cloudItems,
    loading,
    cloudLoading,
    busy,
    cloudEnabled,
    refreshCloud,
    createBackup,
    restoreBackup,
    removeBackup,
    uploadCloud,
    restoreCloud,
    removeCloud,
  };
});
