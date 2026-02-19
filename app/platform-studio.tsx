import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { DEFAULT_USER_ID } from '../src/context/DatabaseContext';
import {
  addPlatformTemplate,
  createPlatformWorkspace,
  getPlatformStudioOverview,
  setPlatformWorkspacePublished,
} from '../src/services/platformStudioService';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';

interface OverviewState {
  templates: Array<{
    id: string;
    title: string;
    goal: string;
    daysPerWeek: number;
  }>;
  workspaces: Array<{
    workspaceId: string;
    ownerId: string;
    templateIds: string[];
    published: boolean;
  }>;
  publishedCount: number;
}

export default function PlatformStudioScreen() {
  const { theme } = useTheme();
  const [titleInput, setTitleInput] = useState('');
  const [goalInput, setGoalInput] = useState('body_control');
  const [daysInput, setDaysInput] = useState('4');
  const [overview, setOverview] = useState<OverviewState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await getPlatformStudioOverview(DEFAULT_USER_ID);
    setOverview(data as OverviewState);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    if (!overview) {
      return {
        templateCount: 0,
        workspaceCount: 0,
        publishedCount: 0,
      };
    }
    return {
      templateCount: overview.templates.length,
      workspaceCount: overview.workspaces.length,
      publishedCount: overview.publishedCount,
    };
  }, [overview]);

  const handleAddTemplate = useCallback(async () => {
    if (busy) return;

    const title = titleInput.trim();
    const goal = goalInput.trim();
    const days = Number(daysInput);

    if (!title || !goal || !Number.isInteger(days)) {
      Alert.alert('Missing fields', 'Provide title, goal and valid integer days.');
      return;
    }

    setBusy(true);
    try {
      await addPlatformTemplate({
        title,
        goal,
        daysPerWeek: days,
        capabilities: ['PROGRAM_BUILDER'],
      });
      setTitleInput('');
      await refresh();
    } catch (error: any) {
      Alert.alert('Template failed', error?.message ?? 'Could not create template');
    } finally {
      setBusy(false);
    }
  }, [busy, daysInput, goalInput, refresh, titleInput]);

  const handleCreateWorkspace = useCallback(async () => {
    if (busy || !overview || overview.templates.length === 0) return;
    setBusy(true);
    try {
      await createPlatformWorkspace(DEFAULT_USER_ID, [overview.templates[0].id]);
      await refresh();
    } catch (error: any) {
      Alert.alert('Workspace failed', error?.message ?? 'Could not create workspace');
    } finally {
      setBusy(false);
    }
  }, [busy, overview, refresh]);

  const handleTogglePublished = useCallback(async (workspaceId: string, next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await setPlatformWorkspacePublished(workspaceId, next);
      await refresh();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not update workspace');
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <SectionHeader title="Platform Studio" />
      <GlassCard>
        <Text style={[styles.title, { color: theme.colors.text }]}>Phase 7 Runtime</Text>
        <Text style={[styles.sub, { color: theme.colors.textMuted }]}>Build templates and publish coach workspaces.</Text>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="book-open-page-variant" size={18} color={theme.colors.accent} />
            <Text style={[styles.statText, { color: theme.colors.text }]}>Templates: {stats.templateCount}</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="folder-multiple" size={18} color={theme.colors.accent} />
            <Text style={[styles.statText, { color: theme.colors.text }]}>Workspaces: {stats.workspaceCount}</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="publish" size={18} color={theme.colors.accent} />
            <Text style={[styles.statText, { color: theme.colors.text }]}>Published: {stats.publishedCount}</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Create Template</Text>
        <TextInput
          value={titleInput}
          onChangeText={setTitleInput}
          placeholder="Template title"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <TextInput
          value={goalInput}
          onChangeText={setGoalInput}
          placeholder="Goal (e.g. strength)"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <TextInput
          value={daysInput}
          onChangeText={setDaysInput}
          placeholder="Days per week"
          keyboardType="number-pad"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}
        />
        <GradientButton title="Add Template" onPress={handleAddTemplate} />
      </GlassCard>

      <GlassCard>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Workspaces</Text>
        <GradientButton title="Create Workspace" onPress={handleCreateWorkspace} variant="success" />

        {overview?.workspaces.map((workspace) => (
          <View key={workspace.workspaceId} style={[styles.workspaceRow, { borderColor: theme.colors.border }]}> 
            <View style={styles.workspaceInfo}>
              <Text style={[styles.workspaceTitle, { color: theme.colors.text }]}>{workspace.workspaceId}</Text>
              <Text style={[styles.workspaceSub, { color: theme.colors.textMuted }]}>
                Templates linked: {workspace.templateIds.length}
              </Text>
            </View>
            <Switch
              value={workspace.published}
              onValueChange={(next) => {
                void handleTogglePublished(workspace.workspaceId, next);
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              thumbColor={workspace.published ? theme.colors.surface : theme.colors.textMuted}
            />
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
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  sub: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  workspaceRow: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workspaceInfo: {
    flex: 1,
    marginRight: 8,
  },
  workspaceTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  workspaceSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
