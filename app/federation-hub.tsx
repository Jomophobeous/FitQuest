import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import {
  getFederationPolicyRuntime,
  listFederationIntegrations,
  registerFederationIntegration,
  revalidateFederationRegistry,
  updateFederationPolicyRuntime,
  type IntegrationRuntimeRecord,
} from '../src/services/federationRegistryService';

export default function FederationHubScreen() {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [integrationName, setIntegrationName] = useState('Partner Integration');
  const [providerName, setProviderName] = useState('Partner Provider');
  const [scopeInput, setScopeInput] = useState('read:workouts,write:progress');
  const [allowImport, setAllowImport] = useState(true);
  const [allowExport, setAllowExport] = useState(true);
  const [integrations, setIntegrations] = useState<IntegrationRuntimeRecord[]>([]);

  const refresh = useCallback(async () => {
    const [policy, registry] = await Promise.all([
      getFederationPolicyRuntime(),
      listFederationIntegrations(),
    ]);

    setAllowImport(policy.allowImport);
    setAllowExport(policy.allowExport);
    setIntegrations(registry);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const handleSavePolicy = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateFederationPolicyRuntime({ allowImport, allowExport });
      const next = await revalidateFederationRegistry();
      setIntegrations(next);
    } catch (error: any) {
      Alert.alert('Policy update failed', error?.message ?? 'Could not update federation policy');
    } finally {
      setBusy(false);
    }
  }, [allowExport, allowImport, busy]);

  const handleRegister = useCallback(async () => {
    if (busy) return;
    const name = integrationName.trim();
    const provider = providerName.trim();
    if (!name || !provider) {
      Alert.alert('Missing info', 'Provide integration and provider names.');
      return;
    }

    const scopes = scopeInput
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);

    setBusy(true);
    try {
      await registerFederationIntegration({
        id: `int_${Date.now()}`,
        name,
        provider,
        tier: 'CERTIFIED',
        scopes,
      });
      await refresh();
    } catch (error: any) {
      Alert.alert('Registration failed', error?.message ?? 'Could not register integration');
    } finally {
      setBusy(false);
    }
  }, [busy, integrationName, providerName, refresh, scopeInput]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textMuted }}>Loading federation hub…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <SectionHeader title="Federation Hub" />

      <GlassCard>
        <Text style={[styles.title, { color: theme.colors.text }]}>Phase 9 Runtime</Text>
        <Text style={[styles.sub, { color: theme.colors.textMuted }]}>Partner integration registry with policy scope enforcement.</Text>

        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Allow import</Text>
          <Switch
            value={allowImport}
            onValueChange={setAllowImport}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor={allowImport ? theme.colors.surface : theme.colors.textMuted}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Allow export</Text>
          <Switch
            value={allowExport}
            onValueChange={setAllowExport}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor={allowExport ? theme.colors.surface : theme.colors.textMuted}
          />
        </View>

        <GradientButton title="Save Policy" onPress={handleSavePolicy} />
      </GlassCard>

      <GlassCard>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Register Integration</Text>
        <TextInput
          value={integrationName}
          onChangeText={setIntegrationName}
          placeholder="Integration name"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <TextInput
          value={providerName}
          onChangeText={setProviderName}
          placeholder="Provider"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <TextInput
          value={scopeInput}
          onChangeText={setScopeInput}
          placeholder="Scopes (comma separated)"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <GradientButton title="Register" variant="success" onPress={handleRegister} />
      </GlassCard>

      <GlassCard>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Registry</Text>
        {integrations.map((record) => (
          <View key={`${record.integration.id}_${record.lastCheckedAt}`} style={[styles.integrationCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}>
            <View style={styles.integrationHeader}>
              <Text style={[styles.integrationTitle, { color: theme.colors.text }]}>{record.integration.name}</Text>
              <MaterialCommunityIcons
                name={record.active ? 'check-circle' : 'alert-circle'}
                size={16}
                color={record.active ? theme.colors.accent : theme.colors.warning}
              />
            </View>
            <Text style={[styles.integrationSub, { color: theme.colors.textMuted }]}>
              {record.integration.provider} · {record.integration.tier}
            </Text>
            <Text style={[styles.integrationReason, { color: theme.colors.textSecondary }]}>{record.statusReason}</Text>
          </View>
        ))}
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  sub: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  integrationCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  integrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  integrationTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  integrationSub: {
    fontSize: 12,
    marginTop: 2,
  },
  integrationReason: {
    fontSize: 12,
    marginTop: 6,
  },
});
