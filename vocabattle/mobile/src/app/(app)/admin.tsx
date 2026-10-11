import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';

import { Badge, Banner, Button, Card, EmptyState, ErrorView, LoadingView, Row, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';

/**
 * Minimal moderation dashboard. Access is decided by the server (user_roles);
 * a non-moderator calling these RPCs gets "Insufficient privileges". Content
 * management and quota configuration UIs are Phase 4 (separate admin web app).
 */
export default function Admin() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: api.adminOverview });
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.adminReports('open') });
  const issues = useQuery({ queryKey: ['admin-issues'], queryFn: api.adminBattleIssues });
  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.adminUpdateReport(id, status, status === 'resolved' ? 'Reviewed in app' : 'Dismissed in app'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });

  if (overview.isPending) return <LoadingView />;
  if (overview.error) return <Screen title="Admin" back><ErrorView error={overview.error} onRetry={() => overview.refetch()} /></Screen>;
  const o = overview.data as Record<string, number>;

  return (
    <Screen title="Admin dashboard" subtitle="All actions are audit-logged." back refreshing={overview.isRefetching} onRefresh={() => { overview.refetch(); reports.refetch(); issues.refetch(); }}>
      <Row gap={Spacing.sm}>
        <StatTile icon="people" label="Users" value={o.users_total} />
        <StatTile icon="flash" label="Battles today" value={o.battles_today} tone="warning" />
        <StatTile icon="radio" label="Live" value={o.battles_live} tone="success" />
      </Row>
      <Row gap={Spacing.sm}>
        <StatTile icon="flag" label="Open reports" value={o.open_reports} tone="danger" />
        <StatTile icon="warning" label="Flags" value={o.unreviewed_flags} tone="warning" />
        <StatTile icon="star" label="Premium" value={o.premium_users} tone="info" />
      </Row>
      <SectionHeader title="Open reports" />
      {reports.data?.length ? reports.data.map((r) => (
        <Card key={String(r.id)}>
          <Row style={{ justifyContent: 'space-between' }}><Text variant="bodyStrong">{String(r.reported_label)} {r.reported_username ? `(@${r.reported_username})` : ''}</Text><Badge label={String(r.reason)} tone="danger" /></Row>
          {r.details ? <Text variant="small" color="textMuted">{String(r.details)}</Text> : null}
          <Text variant="tiny" color="textFaint">{String(r.reports_against_user)} report(s) against this user · {new Date(String(r.created_at)).toLocaleString()}</Text>
          <Row gap={Spacing.sm}>
            <Button title="Resolve" size="sm" onPress={() => resolve.mutate({ id: String(r.id), status: 'resolved' })} />
            <Button title="Dismiss" size="sm" variant="secondary" onPress={() => resolve.mutate({ id: String(r.id), status: 'dismissed' })} />
          </Row>
        </Card>
      )) : <EmptyState icon="checkmark-done" title="No open reports" />}
      <SectionHeader title="Integrity flags & failed battles" />
      <Card>
        {(issues.data?.flags ?? []).slice(0, 10).map((f) => (
          <View key={String(f.id)}><Text variant="small">{String(f.kind)} · {String(f.username ?? 'unknown')} · {new Date(String(f.created_at)).toLocaleString()}</Text></View>
        ))}
        {(issues.data?.failed_battles ?? []).slice(0, 10).map((b) => (
          <View key={String(b.id)}><Text variant="small" color="textMuted">{String(b.status)} ({String(b.end_reason)}) · {String(b.mode)} · {new Date(String(b.created_at)).toLocaleString()}</Text></View>
        ))}
        {!issues.data?.flags.length && !issues.data?.failed_battles.length ? <Text color="textMuted">Nothing to review.</Text> : null}
      </Card>
      <Banner tone="phase" title="Phase 4" message="Content management (vocabulary, questions, lessons), quota configuration and usage analytics will live in a separate admin web app using the same role-checked RPCs." />
    </Screen>
  );
}
