import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import {
  getEnterpriseHardeningRuntime,
  updateEnterpriseHardeningRuntime,
  type EnterpriseHardeningRuntime,
} from '../src/services/enterpriseHardeningService';

export default function EnterpriseHardeningScreen() {
  const { theme } = useTheme();
  const [runtime, setRuntime] = useState<EnterpriseHardeningRuntime | null>(null);
  const [coverageInput, setCoverageInput] = useState('78');
  const [incidentInput, setIncidentInput] = useState('2');
  const [breachInput, setBreachInput] = useState('1');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const current = await getEnterpriseHardeningRuntime();
    setRuntime(current);
    setCoverageInput(String(current.controlsCoveragePercent));
    setIncidentInput(String(current.incidentCount30d));
    setBreachInput(String(current.slaBreaches30d));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRecalculate = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await updateEnterpriseHardeningRuntime({
        controlsCoveragePercent: Number(coverageInput),
        incidentCount30d: Number(incidentInput),
        slaBreaches30d: Number(breachInput),
      });
      setRuntime(next);
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not recompute hardening snapshot');
    } finally {
      setBusy(false);
    }
  }, [breachInput, busy, coverageInput, incidentInput]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <SectionHeader title="Enterprise Hardening" />

      <GlassCard>
        <Text style={[styles.title, { color: theme.colors.text }]}>Phase 10 Runtime</Text>
        <Text style={[styles.sub, { color: theme.colors.textMuted }]}>SLO, controls, and risk dashboard hardening model.</Text>

        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Risk score</Text>
          <Text style={[styles.metricValue, { color: theme.colors.warning }]}>{runtime?.snapshot.riskScore ?? 0}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>SLO targets</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]}>{runtime?.snapshot.sloTargets.length ?? 0}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Compliance controls</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]}>{runtime?.snapshot.controls.length ?? 0}</Text>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Inputs (30-day window)</Text>
        <TextInput
          value={coverageInput}
          onChangeText={setCoverageInput}
          keyboardType="number-pad"
          placeholder="Controls coverage %"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <TextInput
          value={incidentInput}
          onChangeText={setIncidentInput}
          keyboardType="number-pad"
          placeholder="Incident count"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <TextInput
          value={breachInput}
          onChangeText={setBreachInput}
          keyboardType="number-pad"
          placeholder="SLA breaches"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <GradientButton title="Recalculate Risk" variant="warning" onPress={handleRecalculate} />
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
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
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
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
});
