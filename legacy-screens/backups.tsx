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
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useToast } from '../src/context/ToastContext';
import {
  useBackupsViewModel,
  type BackupListItem,
  type CloudBackupListItem,
} from '../src/viewmodels/useBackupsViewModel';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import { typography, spacing } from '../src/design/theme-system';


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
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const vm = useBackupsViewModel();

  const [passphrase, setPassphrase] = useState('');

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
        fontSize: typography.sizes.h4, 
        fontWeight: '800',
        color: theme.colors.text,
      },
      scroll: {
        paddingHorizontal: theme.spacing[4],
        paddingBottom: theme.spacing[10],
      },
      helperText: {
        fontSize: typography.sizes.label, 
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
        fontSize: typography.sizes.bodySmall, 
        fontWeight: '700',
        color: theme.colors.text,
      },
      backupSub: {
        marginTop: theme.spacing[1],
        fontSize: typography.sizes.caption, 
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
        fontSize: typography.sizes.label, 
        color: theme.colors.textMuted,
      },
    });
  }, [theme]);

  const handleCreateBackup = useCallback(async () => {
    if (vm.busy) return;
    try {
      const result = await vm.createBackup(passphrase.trim());
      showToast({
        message: `${t('backup.created') || 'Backup created'} (${formatBytes(result.bytes)})`,
        type: 'success',
      });
    } catch (e: any) {
      showToast({ message: e?.message ?? t('backup.failed') ?? 'Backup failed', type: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language dep handles re-creation
  }, [vm.busy, passphrase, vm]);

  const handleRestore = useCallback(
    (item: BackupListItem) => {
      if (vm.busy) return;
      Alert.alert(
        t('backup.restoreConfirm') || 'Restore backup?',
        t('backup.restoreWarning') || 'This will replace your local database with the selected backup.',
        [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('common.restore') || 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await vm.restoreBackup(item.uri, passphrase.trim());
                Alert.alert(t('backup.restoreComplete') || 'Restore complete', 'Backup imported successfully.');
                router.canGoBack() ? router.back() : router.replace('/profile');
              } catch (e: any) {
                showToast({ message: e?.message ?? t('backup.restoreFailed') ?? 'Restore failed', type: 'error' });
              }
            },
          },
        ],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language dep handles re-creation
    [vm.busy, passphrase, router, vm],
  );

  const handleDelete = useCallback(
    (item: BackupListItem) => {
      if (vm.busy) return;
      Alert.alert(
        t('backup.deleteConfirm') || 'Delete backup?',
        t('backup.deleteWarning') || 'This cannot be undone.',
        [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('common.delete') || 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await vm.removeBackup(item.uri);
              } catch (e: any) {
                showToast({ message: e?.message ?? t('backup.deleteFailed') ?? 'Delete failed', type: 'error' });
              }
            },
          },
        ],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language dep handles re-creation
    [vm.busy, vm],
  );

  const handleUploadCloud = useCallback(async () => {
    if (!vm.cloudEnabled || vm.busy) return;
    try {
      await vm.uploadCloud(passphrase.trim());
      showToast({ message: t('backup.uploaded') || 'Backup uploaded successfully', type: 'success' });
    } catch (e: any) {
      showToast({ message: e?.message ?? t('backup.uploadFailed') ?? 'Upload failed', type: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language dep handles re-creation
  }, [vm.busy, vm.cloudEnabled, passphrase, vm]);

  const handleRestoreCloud = useCallback(
    (item: CloudBackupListItem) => {
      if (!vm.cloudEnabled || vm.busy) return;
      Alert.alert(
        t('backup.restoreConfirm') || 'Restore cloud backup?',
        t('backup.restoreWarning') || 'This will replace your local database with the selected cloud backup.',
        [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('common.restore') || 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await vm.restoreCloud(item.id, passphrase.trim());
                Alert.alert(t('backup.restoreComplete') || 'Restore complete', 'Cloud backup imported successfully.');
                router.canGoBack() ? router.back() : router.replace('/profile');
              } catch (e: any) {
                showToast({ message: e?.message ?? t('backup.restoreFailed') ?? 'Restore failed', type: 'error' });
              }
            },
          },
        ],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language dep handles re-creation
    [vm.busy, vm.cloudEnabled, passphrase, router, vm],
  );

  const handleDeleteCloud = useCallback(
    (item: CloudBackupListItem) => {
      if (!vm.cloudEnabled || vm.busy) return;
      Alert.alert(
        t('backup.deleteConfirm') || 'Delete cloud backup?',
        t('backup.deleteWarning') || 'This cannot be undone.',
        [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('common.delete') || 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await vm.removeCloud(item.id);
              } catch (e: any) {
                showToast({ message: e?.message ?? t('backup.deleteFailed') ?? 'Delete failed', type: 'error' });
              }
            },
          },
        ],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language dep handles re-creation
    [vm.busy, vm.cloudEnabled, vm],
  );

  return (
    <ScreenErrorBoundary screenName="Backups" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
            style={styles.iconBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('backup.title') || 'Backup & Restore'}</Text>
          <View style={{ width: theme.spacing[8] }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <GlassCard>
            <View style={{ gap: theme.spacing[3] }}>
              <Text style={styles.helperText}>
                {t('backup.helperText') ||
                  'Creates an encrypted backup file of your local database. If you set a passphrase, you must use the same passphrase to restore.'}
              </Text>

              <TextInput
                value={passphrase}
                onChangeText={setPassphrase}
                placeholder={t('backup.optionalPassphrase') || 'Optional passphrase'}
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!vm.busy}
              />

              <GradientButton
                title={vm.busy ? t('backup.working') || 'Working…' : t('backup.createBackup') || 'Create Backup'}
                variant="success"
                size="lg"
                style={vm.busy ? { opacity: 0.7 } : undefined}
                onPress={() => {
                  void handleCreateBackup();
                }}
              />
            </View>
          </GlassCard>

          <View style={styles.sectionGap}>
            <SectionHeader title={t('backup.availableBackups') || 'Available Backups'} />
          </View>

          {vm.loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : vm.items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('backup.noBackups') || 'No backups yet.'}</Text>
            </View>
          ) : (
            <View style={{ gap: theme.spacing[3] }}>
              {vm.items.map((item) => (
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

                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleRestore(item)} disabled={vm.busy}>
                      <MaterialCommunityIcons name="backup-restore" size={18} color={theme.colors.accent} />
                    </TouchableOpacity>

                    <View style={{ width: theme.spacing[2] }} />

                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)} disabled={vm.busy}>
                      <MaterialCommunityIcons name="delete-outline" size={18} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {!!vm.cloudEnabled && (
            <>
              <View style={styles.sectionGap}>
                <SectionHeader title={t('backup.cloudBackups') || 'Cloud Backups'} />
              </View>

              <GlassCard>
                <View style={{ gap: theme.spacing[3] }}>
                  <Text style={styles.helperText}>
                    {t('backup.cloudHelper') ||
                      'Stores the encrypted backup blob on your backend. The server cannot decrypt your data.'}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <GradientButton
                        title={vm.busy ? t('backup.working') || 'Working…' : t('backup.uploadBackup') || 'Upload Backup'}
                        variant="primary"
                        size="md"
                        style={vm.busy ? { opacity: 0.7 } : undefined}
                        onPress={() => {
                          void handleUploadCloud();
                        }}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      disabled={vm.busy || vm.cloudLoading}
                      onPress={() => {
                        void vm.refreshCloud();
                      }}
                    >
                      {vm.cloudLoading ? (
                        <ActivityIndicator color={theme.colors.accent} />
                      ) : (
                        <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.text} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </GlassCard>

              {vm.cloudItems.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>{t('backup.noCloudBackups') || 'No cloud backups yet.'}</Text>
                </View>
              ) : (
                <View style={{ gap: theme.spacing[3] }}>
                  {vm.cloudItems.map((item) => (
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
                          disabled={vm.busy}
                        >
                          <MaterialCommunityIcons name="backup-restore" size={18} color={theme.colors.accent} />
                        </TouchableOpacity>

                        <View style={{ width: theme.spacing[2] }} />

                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleDeleteCloud(item)}
                          disabled={vm.busy}
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
    </ScreenErrorBoundary>
  );
}
