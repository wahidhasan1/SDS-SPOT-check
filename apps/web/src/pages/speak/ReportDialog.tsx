import { useState } from 'react';
import { REPORT_REASONS } from '@fluentpath/shared';
import { Alert, Button, Modal, Textarea, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';

export function ReportDialog({ target, onClose, onDone, kind }: { target: { callId: string; alias: string } | null; onClose: () => void; onDone?: () => void; kind: 'call' | 'battle' }) {
  const toast = useToast();
  const [reason, setReason] = useState<string>('harassment');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/${kind === 'call' ? 'calls' : 'battles'}/${target.callId}/report`, { reason, details: details.trim(), block });
      toast('Report sent. Thank you for helping keep FluentPath safe.');
      onDone?.();
      onClose();
      setDetails('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={Boolean(target)} onClose={onClose} title={`Report ${target?.alias ?? ''}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={submit} loading={busy}>Send report</Button></>}>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      <fieldset className="space-y-2">
        <legend className="label">What happened?</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm"><input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} /> {r.label}</label>
        ))}
      </fieldset>
      <div className="mt-4"><Textarea label="Details (optional)" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what happened. Moderators will review your report." /></div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> Also block this user so we never match you again</label>
      <p className="muted mt-3 text-xs">The person will not be told who reported them.</p>
    </Modal>
  );
}
