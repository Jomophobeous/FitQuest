import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import {
  deleteEncryptedBackup,
  exportEncryptedBackup,
  importEncryptedBackup,
  listEncryptedBackups,
  type BackupListItem,
} from '../src/services/backupService';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import {
  deleteCloudBackup,
  isCloudBackupConfigured,
  listCloudBackups,
  restoreCloudBackup,
  uploadLocalBackupToCloud,
  type CloudBackupListItem,
} from '../src/services/cloudBackupService';
import { enqueueMutation } from '../src/services/mutationQueueService';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

export default function BackupsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [items, setItems] = useState<BackupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');

  const [cloudItems, setCloudItems] = useState<CloudBackupListItem[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const cloudEnabled = isCloudBackupConfigured();

  const styles = useMemo(() => {
    return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.colors.background,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[2],
        paddingBottom: theme.spacing[2],
      },
      headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: theme.colors.text,
      },
      scroll: {
        paddingHorizontal: theme.spacing[4],
        paddingBottom: theme.spacing[10],
      },
      helperText: {
        fontSize: 13,
        color: theme.colors.textMuted,
        lineHeight: 18,
      },
      input: {
        marginTop: theme.spacing[3],
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        color: theme.colors.text,
        backgroundColor: theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface,
      },
      sectionGap: {
        marginTop: theme.spacing[5],
      },
      backupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      backupMeta: {
        flex: 1,
        marginRight: theme.spacing[3],
      },
      backupName: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.text,
      },
      backupSub: {
        marginTop: theme.spacing[1],
        fontSize: 12,
        color: theme.colors.textMuted,
      },
      iconBtn: {
        width: theme.spacing[8],
        height: theme.spacing[8],
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface,
      },
      empty: {
        paddingVertical: theme.spacing[6],
        alignItems: 'center',
      },
      emptyText: {
        fontSize: 13,
        color: theme.colors.textMuted,
      },
    });
  }, [theme]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listEncryptedBackups();
      setItems(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!cloudEnabled) return;
    setCloudLoading(true);
    try {
      const next = await listCloudBackups();
      setCloudItems(next);
    } catch {
      // Avoid noisy alerts on automatic refresh.
      setCloudItems([]);
    } finally {
      setCloudLoading(false);
    }
  }, [cloudEnabled]);

  useEffect(() => {
    refresh();
    void refreshCloud();
  }, [refresh, refreshCloud]);

  const handleCreateBackup = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await exportEncryptedBackup({
        passphrase: passphrase.trim().length > 0 ? passphrase : undefined,
      });

      await refresh();

      Alert.alert(
        'Backup created',
        `Saved encrypted backup (${formatBytes(result.bytes)}).`
      );
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [busy, passphrase, refresh]);

  const handleRestore = useCallback(
    (item: BackupListItem) => {
      if (busy) return;
      Alert.alert(
        'Restore backup?',
        'This will replace your local database with the selected backup.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await importEncryptedBackup({
                  backupUri: item.uri,
                  passphrase: passphrase.trim().length > 0 ? passphrase : undefined,
                });
                Alert.alert('Restore complete', 'Backup imported successfully.');
                router.back();
              } catch (e: any) {
                Alert.alert('Restore failed', e?.message ?? 'Unknown error');
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [busy, passphrase, router]
  );

  const handleDelete = useCallback(
    (item: BackupListItem) => {
      if (busy) return;
      Alert.alert('Delete backup?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteEncryptedBackup(item.uri);
              await refresh();
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message ?? 'Unknown error');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [busy, refresh]
  );

  const handleUploadCloud = useCallback(async () => {
    if (!cloudEnabled || busy) return;
    setBusy(true);
    try {
      await uploadLocalBackupToCloud({
        passphrase: passphrase.trim().length > 0 ? passphrase : undefined,
      });
      await refreshCloud();
      Alert.alert('Uploaded', 'Encrypted backup uploaded successfully.');
    } catch (e: any) {
      if (passphrase.trim().length === 0) {
        await enqueueMutation('backup.upload_latest', {}, { dedupeKey: 'backup.upload_latest.manual' });
      }
      Alert.alert('Upload failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [busy, cloudEnabled, passphrase, refreshCloud]);

  const handleRestoreCloud = useCallback(
    (item: CloudBackupListItem) => {
      if (!cloudEnabled || busy) return;
      Alert.alert(
        'Restore cloud backup?',
        'This will replace your local database with the selected cloud backup.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await restoreCloudBackup({
                  id: item.id,
                  passphrase: passphrase.trim().length > 0 ? passphrase : undefined,
                });
                Alert.alert('Restore complete', 'Cloud backup imported successfully.');
                router.back();
              } catch (e: any) {
                Alert.alert('Restore failed', e?.message ?? 'Unknown error');
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [busy, cloudEnabled, passphrase, router]
  );

  const handleDeleteCloud = useCallback(
    (item: CloudBackupListItem) => {
      if (!cloudEnabled || busy) return;
      Alert.alert('Delete cloud backup?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteCloudBackup(item.id);
              await refreshCloud();
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message ?? 'Unknown error');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [busy, cloudEnabled, refreshCloud]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <View style={{ width: theme.spacing[8] }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassCard>
          <View style={{ gap: theme.spacing[3] }}>
            <Text style={styles.helperText}>
              Creates an encrypted backup file of your local database. If you set a passphrase, you must use the same
              passphrase to restore.
            </Text>

            <TextInput
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Optional passphrase"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              editable={!busy}
            />

            <GradientButton
              title={busy ? 'Working…' : 'Create Backup'}
              variant="success"
              size="lg"
              style={busy ? { opacity: 0.7 } : undefined}
              onPress={() => {
                void handleCreateBackup();
              }}
            />
          </View>
        </GlassCard>

        <View style={styles.sectionGap}>
          <SectionHeader title="Available Backups" />
        </View>

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No backups yet.</Text>
          </View>
        ) : (
          <View style={{ gap: theme.spacing[3] }}>
            {items.map((item) => (
              <GlassCard key={item.uri}>
                <View style={styles.backupRow}>
                  <View style={styles.backupMeta}>
                    <Text style={styles.backupName} numberOfLines={1}>
                      {item.filename}
                    </Text>
                    <Text style={styles.backupSub}>
                      {formatDateTime(item.modified_at)} • {formatBytes(item.bytes)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => handleRestore(item)}
                    disabled={busy}
                  >
                    <MaterialCommunityIcons name="backup-restore" size={18} color={theme.colors.accent} />
                  </TouchableOpacity>

                  <View style={{ width: theme.spacing[2] }} />

                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => handleDelete(item)}
                    disabled={busy}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {!!cloudEnabled && (
          <>
            <View style={styles.sectionGap}>
              <SectionHeader title="Cloud Backups" />
            </View>

            <GlassCard>
              <View style={{ gap: theme.spacing[3] }}>
                <Text style={styles.helperText}>
                  Stores the encrypted backup blob on your Phase 2 backend (CRUD-only). The server cannot decrypt your
                  data.
                </Text>

                <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                  <View style={{ flex: 1 }}>
                    <GradientButton
                      title={busy ? 'Working…' : 'Upload Backup'}
                      variant="primary"
                      size="md"
                      style={busy ? { opacity: 0.7 } : undefined}
                      onPress={() => {
                        void handleUploadCloud();
                      }}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    disabled={busy || cloudLoading}
                    onPress={() => {
                      void refreshCloud();
                    }}
                  >
                    {cloudLoading ? (
                      <ActivityIndicator color={theme.colors.accent} />
                    ) : (
                      <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.text} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>

            {cloudItems.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No cloud backups yet.</Text>
              </View>
            ) : (
              <View style={{ gap: theme.spacing[3] }}>
                {cloudItems.map((item) => (
                  <GlassCard key={item.id}>
                    <View style={styles.backupRow}>
                      <View style={styles.backupMeta}>
                        <Text style={styles.backupName} numberOfLines={1}>
                          {item.id}
                        </Text>
                        <Text style={styles.backupSub}>{formatDateTime(item.createdAt)}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleRestoreCloud(item)}
                        disabled={busy}
                      >
                        <MaterialCommunityIcons name="backup-restore" size={18} color={theme.colors.accent} />
                      </TouchableOpacity>

                      <View style={{ width: theme.spacing[2] }} />

                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleDeleteCloud(item)}
                        disabled={busy}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={18} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
