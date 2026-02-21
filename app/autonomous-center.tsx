import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { DEFAULT_USER_ID } from '../src/context/DatabaseContext';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import {
  evaluatePostWorkoutPolicyDecision,
  getAutomationPolicy,
  listAutomationDecisions,
  updateAutomationPolicy,
  type PolicyDecisionRecord,
} from '../src/services/autonomousPolicyRuntime';

type SafetyMode = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

const SAFETY_SEQUENCE: SafetyMode[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'];

function nextSafetyMode(mode: SafetyMode): SafetyMode {
  const index = SAFETY_SEQUENCE.indexOf(mode);
  if (index < 0 || index === SAFETY_SEQUENCE.length - 1) return SAFETY_SEQUENCE[0];
  return SAFETY_SEQUENCE[index + 1];
}

export default function AutonomousCenterScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<{
    policyId: string;
    name: string;
    safetyMode: SafetyMode;
    maxDailyAdjustments: number;
    requiresHumanReview: boolean;
  } | null>(null);
  const [decisions, setDecisions] = useState<PolicyDecisionRecord[]>([]);

  const refresh = useCallback(async () => {
    const [currentPolicy, recentDecisions] = await Promise.all([
      getAutomationPolicy(DEFAULT_USER_ID),
      listAutomationDecisions(DEFAULT_USER_ID, 10),
    ]);
    setPolicy(currentPolicy as any);
    setDecisions(recentDecisions);
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

  const handleToggleHumanReview = useCallback(async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updateAutomationPolicy(DEFAULT_USER_ID, {
        requiresHumanReview: next,
      });
      setPolicy(updated as any);
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not update policy');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleCycleSafetyMode = useCallback(async () => {
    if (busy || !policy) return;
    setBusy(true);
    try {
      const updated = await updateAutomationPolicy(DEFAULT_USER_ID, {
        safetyMode: nextSafetyMode(policy.safetyMode),
      });
      setPolicy(updated as any);
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not update safety mode');
    } finally {
      setBusy(false);
    }
  }, [busy, policy]);

  const runSimulation = useCallback(async (completionRatio: number, averageDifficulty: number, isDeload: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const decision = await evaluatePostWorkoutPolicyDecision(DEFAULT_USER_ID, {
        completionRatio,
        averageDifficulty,
        isDeload,
      });
      setDecisions((prev) => [decision, ...prev].slice(0, 10));
    } catch (error: any) {
      Alert.alert('Simulation failed', error?.message ?? 'Could not run simulation');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textMuted }}>Loading autonomous policy center…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <SectionHeader title="Autonomous Center" />

      <GlassCard>
        <Text style={[styles.title, { color: theme.colors.text }]}>Phase 8 Runtime</Text>
        <Text style={[styles.sub, { color: theme.colors.textMuted }]}>Policy-driven auto-adjustments with transparent rationale.</Text>

        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Safety mode</Text>
          <Text style={[styles.value, { color: theme.colors.accent }]}>{policy?.safetyMode ?? 'BALANCED'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Daily adjustments cap</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>{policy?.maxDailyAdjustments ?? 0}</Text>
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Require human review</Text>
          <Switch
            value={Boolean(policy?.requiresHumanReview)}
            onValueChange={(next) => {
              void handleToggleHumanReview(next);
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor={policy?.requiresHumanReview ? theme.colors.surface : theme.colors.textMuted}
          />
        </View>

        <GradientButton title="Cycle Safety Mode" onPress={handleCycleSafetyMode} />
      </GlassCard>

      <GlassCard>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Decision Simulations</Text>
        <GradientButton
          title="Simulate High Readiness"
          variant="success"
          onPress={() => {
            void runSimulation(0.95, 4.0, false);
          }}
        />
        <View style={styles.buttonGap} />
        <GradientButton
          title="Simulate High Strain"
          variant="warning"
          onPress={() => {
            void runSimulation(0.55, 8.5, true);
          }}
        />

        {decisions.map((record) => (
          <View key={`${record.id}_${record.createdAt}`} style={[styles.decisionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.decisionAction, { color: theme.colors.text }]}>
              {record.decision.action} · Confidence {Math.round(record.decision.confidence * 100)}%
            </Text>
            <Text style={[styles.decisionMeta, { color: theme.colors.textMuted }]}>
              Readiness {record.readinessScore} · Strain {record.strainScore}
            </Text>
            <Text style={[styles.decisionReason, { color: theme.colors.textSecondary }]}>
              {record.decision.rationale}
            </Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  buttonGap: {
    height: 10,
  },
  decisionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  decisionAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  decisionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  decisionReason: {
    fontSize: 12,
    marginTop: 6,
  },
});
