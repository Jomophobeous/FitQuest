/**
 * DebugPanel — Dev-only real-time system observability screen.
 *
 * 6 Sections:
 *   1. USER STATE — consistency, fatigue, engagement, churn risk
 *   2. LOCAL STORAGE — last 5 workouts, last write, DB health
 *   3. EVENT STREAM — last 20 logEvent() calls
 *   4. NETWORK — online/offline, last API result
 *   5. SYNC ENGINE — queue length, last sync, retry count
 *   6. NAVIGATION TRACE — last 10 routes
 *
 * Access: dev-only (__DEV__ gate). Route: /dev/debug-panel
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useConnectivity } from '../../src/context/ConnectivityContext';
import ThemedText from '../../src/components/ThemedText';
import { spacing } from '../../src/design/theme-system';

// debugBuffer removed — stub types and functions
type DebugEntry = {
  id: string;
  type: string;
  label: string;
  message: string;
  timestamp: number;
  payload?: unknown;
  data?: unknown;
};
const getDebugEntries = (): DebugEntry[] => [];
const subscribeDebugBuffer =
  (_cb: () => void): (() => void) =>
  () => {};
const clearDebugBuffer = (): void => {};

// ── Types for data loading ──

interface UserStateSnapshot {
  consistencyScore: number | null;
  engagementLevel: string | null;
  fatigueTier: string | null;
  churnRisk: boolean | null;
  daysSinceLastWorkout: number | null;
  streak: number | null;
}

interface WorkoutRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_minutes: number;
  total_exercises: number;
}

interface SyncSnapshot {
  pendingCount: number;
  lastSyncChannel: string | null;
  lastSyncTimestamp: number | null;
}

interface DbHealthResult {
  ok: boolean;
  rowCount: number;
  latencyMs: number;
}

// ── Main Component ──

export default function DebugPanel() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isOnline, pendingSyncCount } = useConnectivity();

  const [userState, setUserState] = useState<UserStateSnapshot | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutRow[]>([]);
  const [dbHealth, setDbHealth] = useState<DbHealthResult | null>(null);
  const [syncSnapshot, setSyncSnapshot] = useState<SyncSnapshot>({
    pendingCount: 0,
    lastSyncChannel: null,
    lastSyncTimestamp: null,
  });
  const [entries, setEntries] = useState<DebugEntry[]>(getDebugEntries());
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Subscribe to debug buffer live updates
  useEffect(() => {
    const unsub = subscribeDebugBuffer(() => setEntries([...getDebugEntries()]));
    return unsub;
  }, []);

  const loadData = useCallback(async () => {
    try {
      // User state (UserStateEngine removed)
      setUserState(null);
    } catch {
      setUserState(null);
    }

    try {
      // Recent workouts
      const { getRecentSessions } = await import('../../src/database/service');
      const sessions = await getRecentSessions('user_local_001', 5);
      setRecentWorkouts(
        sessions.map((s: any) => ({
          id: s.id,
          started_at: s.started_at,
          completed_at: s.completed_at,
          duration_minutes: s.duration_minutes,
          total_exercises: s.total_exercises,
        })),
      );
    } catch {
      setRecentWorkouts([]);
    }

    try {
      // DB health check
      const startMs = Date.now();
      const { getAppState } = await import('../../src/database/service');
      await getAppState('telemetry_log');
      const latencyMs = Date.now() - startMs;
      setDbHealth({ ok: true, rowCount: -1, latencyMs });
    } catch {
      setDbHealth({ ok: false, rowCount: 0, latencyMs: -1 });
    }

    // Sync services removed — stub snapshot
    setSyncSnapshot({ pendingCount: 0, lastSyncChannel: null, lastSyncTimestamp: null });
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const toggleSection = (section: string) => setExpandedSection((prev) => (prev === section ? null : section));

  const fmt = (ts: number) => new Date(ts).toLocaleTimeString();
  const fmtDate = (ts: string | null) => (ts ? new Date(ts).toLocaleString() : '—');

  const bg = theme.colors.background;
  const _surface = theme.colors.surface;
  const accent = theme.colors.accent;
  const error = theme.colors.error;
  const warning = theme.colors.warning;
  const muted = theme.colors.textMuted;
  const text = theme.colors.text;

  // Filtered entries
  const eventEntries = entries
    .filter((e) => e.type === 'event')
    .slice(-20)
    .reverse();
  const navEntries = entries
    .filter((e) => e.type === 'navigation')
    .slice(-10)
    .reverse();

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
        </TouchableOpacity>
        <ThemedText variant="h3" weight="700" style={{ flex: 1, marginLeft: spacing[3] }}>
          Debug Panel
        </ThemedText>
        <TouchableOpacity onPress={() => clearDebugBuffer()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ThemedText variant="caption" style={{ color: error }}>
            CLEAR
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing[4], paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={accent} />}
      >
        {/* ── SECTION 1: USER STATE ── */}
        <SectionCard
          title="USER STATE"
          icon="account-cog"
          color={accent}
          theme={theme}
          expanded={expandedSection === 'user'}
          onToggle={() => toggleSection('user')}
        >
          {userState ? (
            <>
              <Row label="Consistency Score" value={String(userState.consistencyScore ?? '—')} theme={theme} />
              <Row label="Engagement Level" value={userState.engagementLevel ?? '—'} theme={theme} />
              <Row
                label="Fatigue Tier"
                value={userState.fatigueTier ?? '—'}
                theme={theme}
                valueColor={userState.fatigueTier === 'HIGH' ? warning : undefined}
              />
              <Row
                label="Churn Risk"
                value={userState.churnRisk ? 'YES' : 'NO'}
                theme={theme}
                valueColor={userState.churnRisk ? error : accent}
              />
              <Row label="Days Since Workout" value={String(userState.daysSinceLastWorkout ?? '—')} theme={theme} />
              <Row label="Streak" value={String(userState.streak ?? 0)} theme={theme} />
            </>
          ) : (
            <ThemedText variant="caption" color="muted">
              No user state loaded
            </ThemedText>
          )}
        </SectionCard>

        {/* ── SECTION 2: LOCAL STORAGE ── */}
        <SectionCard
          title="LOCAL STORAGE (SQLite)"
          icon="database"
          color="#6366F1"
          theme={theme}
          expanded={expandedSection === 'db'}
          onToggle={() => toggleSection('db')}
        >
          {/* DB Health */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: dbHealth?.ok ? accent : error }]} />
            <ThemedText variant="caption" style={{ color: text }}>
              DB: {dbHealth ? (dbHealth.ok ? `OK (${dbHealth.latencyMs}ms)` : 'FAIL') : 'checking…'}
            </ThemedText>
          </View>

          {/* Last 5 workouts */}
          <ThemedText variant="caption" weight="600" style={{ color: muted, marginTop: spacing[2] }}>
            Last 5 Workouts
          </ThemedText>
          {recentWorkouts.length === 0 ? (
            <ThemedText variant="caption" color="muted">
              No workouts found
            </ThemedText>
          ) : (
            recentWorkouts.map((w) => (
              <View key={w.id} style={styles.miniRow}>
                <ThemedText variant="caption" style={{ color: text, flex: 1 }} numberOfLines={1}>
                  {fmtDate(w.started_at)}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: muted }}>
                  {w.duration_minutes}min · {w.total_exercises} ex
                </ThemedText>
              </View>
            ))
          )}
        </SectionCard>

        {/* ── SECTION 3: EVENT STREAM ── */}
        <SectionCard
          title="EVENT STREAM"
          icon="pulse"
          color="#F59E0B"
          theme={theme}
          expanded={expandedSection === 'events'}
          onToggle={() => toggleSection('events')}
        >
          <ThemedText variant="caption" color="muted" style={{ marginBottom: spacing[1] }}>
            Last 20 logEvent() calls (newest first)
          </ThemedText>
          {eventEntries.length === 0 ? (
            <ThemedText variant="caption" color="muted">
              No events yet
            </ThemedText>
          ) : (
            eventEntries.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="caption" weight="600" style={{ color: text }} numberOfLines={1}>
                    {e.label}
                  </ThemedText>
                  {!!e.payload && (
                    <ThemedText variant="caption" style={{ color: muted, fontSize: 10 }} numberOfLines={2}>
                      {JSON.stringify(e.payload).slice(0, 120)}
                    </ThemedText>
                  )}
                </View>
                <ThemedText variant="caption" style={{ color: muted, fontSize: 9, marginLeft: spacing[2] }}>
                  {fmt(e.timestamp)}
                </ThemedText>
              </View>
            ))
          )}
        </SectionCard>

        {/* ── SECTION 4: NETWORK ── */}
        <SectionCard
          title="NETWORK"
          icon="wifi"
          color={isOnline ? accent : error}
          theme={theme}
          expanded={expandedSection === 'network'}
          onToggle={() => toggleSection('network')}
        >
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? accent : error }]} />
            <ThemedText variant="caption" style={{ color: text }}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </ThemedText>
          </View>
          {/* Network debug entries */}
          {entries
            .filter((e) => e.type === 'network')
            .slice(-5)
            .reverse()
            .map((e) => (
              <View key={e.id} style={styles.miniRow}>
                <ThemedText variant="caption" style={{ color: text, flex: 1 }} numberOfLines={1}>
                  {e.label}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: muted, fontSize: 9 }}>
                  {fmt(e.timestamp)}
                </ThemedText>
              </View>
            ))}
        </SectionCard>

        {/* ── SECTION 5: SYNC ENGINE ── */}
        <SectionCard
          title="SYNC ENGINE"
          icon="sync"
          color="#8B5CF6"
          theme={theme}
          expanded={expandedSection === 'sync'}
          onToggle={() => toggleSection('sync')}
        >
          <Row
            label="Queue Length"
            value={String(syncSnapshot.pendingCount)}
            theme={theme}
            valueColor={syncSnapshot.pendingCount > 0 ? warning : accent}
          />
          <Row label="Connectivity Pending" value={String(pendingSyncCount ?? 0)} theme={theme} />
          <Row label="Last Sync Channel" value={syncSnapshot.lastSyncChannel ?? '—'} theme={theme} />
          <Row
            label="Last Sync At"
            value={syncSnapshot.lastSyncTimestamp ? fmt(syncSnapshot.lastSyncTimestamp) : '—'}
            theme={theme}
          />
          {/* Sync debug entries */}
          {entries
            .filter((e) => e.type === 'sync')
            .slice(-5)
            .reverse()
            .map((e) => (
              <View key={e.id} style={styles.miniRow}>
                <ThemedText variant="caption" style={{ color: text, flex: 1 }} numberOfLines={1}>
                  {e.label}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: muted, fontSize: 9 }}>
                  {fmt(e.timestamp)}
                </ThemedText>
              </View>
            ))}
        </SectionCard>

        {/* ── SECTION 6: NAVIGATION TRACE ── */}
        <SectionCard
          title="NAVIGATION TRACE"
          icon="map-marker-path"
          color="#EC4899"
          theme={theme}
          expanded={expandedSection === 'nav'}
          onToggle={() => toggleSection('nav')}
        >
          <ThemedText variant="caption" color="muted" style={{ marginBottom: spacing[1] }}>
            Last 10 route changes (newest first)
          </ThemedText>
          {navEntries.length === 0 ? (
            <ThemedText variant="caption" color="muted">
              No navigation events yet
            </ThemedText>
          ) : (
            navEntries.map((e) => (
              <View key={e.id} style={styles.miniRow}>
                <ThemedText variant="caption" style={{ color: text, flex: 1 }} numberOfLines={1}>
                  {e.label}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: muted, fontSize: 9 }}>
                  {fmt(e.timestamp)}
                </ThemedText>
              </View>
            ))
          )}
        </SectionCard>

        {/* Interaction entries */}
        <SectionCard
          title="INTERACTIONS"
          icon="gesture-tap"
          color="#14B8A6"
          theme={theme}
          expanded={expandedSection === 'interactions'}
          onToggle={() => toggleSection('interactions')}
        >
          {entries
            .filter((e) => e.type === 'interaction')
            .slice(-10)
            .reverse()
            .map((e) => (
              <View key={e.id} style={styles.miniRow}>
                <ThemedText variant="caption" style={{ color: text, flex: 1 }} numberOfLines={1}>
                  {e.label}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: muted, fontSize: 9 }}>
                  {fmt(e.timestamp)}
                </ThemedText>
              </View>
            ))}
          {entries.filter((e) => e.type === 'interaction').length === 0 && (
            <ThemedText variant="caption" color="muted">
              No interactions yet
            </ThemedText>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

// ── Sub-Components ──

function SectionCard({
  title,
  icon,
  color,
  theme,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  color: string;
  theme: any;
  expanded: boolean | null;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const isOpen = expanded !== false;
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
        <ThemedText
          variant="bodySmall"
          weight="700"
          style={{ color: theme.colors.text, flex: 1, marginLeft: spacing[2] }}
        >
          {title}
        </ThemedText>
        <MaterialCommunityIcons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>
      {isOpen && <View style={styles.cardBody}>{children}</View>}
    </View>
  );
}

function Row({ label, value, theme, valueColor }: { label: string; value: string; theme: any; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <ThemedText variant="caption" style={{ color: theme.colors.textMuted, flex: 1 }}>
        {label}
      </ThemedText>
      <ThemedText variant="caption" weight="600" style={{ color: valueColor ?? theme.colors.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
  },
  cardBody: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
