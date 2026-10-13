import { PRACTICE_MODE_LABELS } from '@app/shared';
import { fmtDate, fmtDuration, useApi } from '../src/lib/hooks';
import { Avatar, Badge, Card, Empty, ErrorText, Loading, P, Row, Screen } from '../src/components/ui';

export default function CallHistory() {
  const { data, loading, error } = useApi<any[]>('/calls/history');
  return (
    <Screen>
      <ErrorText error={error} />
      {loading ? <Loading /> : !data?.length ? <Empty icon="📞" title="No calls yet" /> : data.map((c) => (
        <Card key={c.id}>
          <Row between>
            <Row>{c.partner && <Avatar avatar={c.partner.avatar} size={36} />}<P>{c.partner?.anonName ?? '—'}</P></Row>
            <Badge label={c.status} tone={c.status === 'completed' ? 'success' : c.status === 'failed' ? 'danger' : 'default'} />
          </Row>
          <P small muted>{fmtDate(c.startedAt)} · {fmtDuration(c.durationSec)} · {PRACTICE_MODE_LABELS[c.mode as keyof typeof PRACTICE_MODE_LABELS]} · {c.topicLabel}</P>
        </Card>
      ))}
    </Screen>
  );
}
