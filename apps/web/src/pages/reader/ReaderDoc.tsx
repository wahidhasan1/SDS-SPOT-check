import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { SelectableText } from '../../components/learning/SelectableText';
import { Alert, Button, Card, ConfirmDialog, ErrorState, Input, PageLoader, Textarea, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Doc { id: string; title: string; recognizedText: string; correctedText: string | null; confidence: number | null; createdAt: string }

export default function ReaderDoc() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<{ document: Doc; imageUrl: string | null }>(`/api/reader/docs/${id}`);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', text: '' });
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const d = data.document;
  const text = d.correctedText ?? d.recognizedText;

  const saveEdit = async () => {
    setBusy(true);
    try {
      const r = await api.patch<{ document: Doc }>(`/api/reader/docs/${d.id}`, { title: draft.title.trim() || d.title, correctedText: draft.text.trim() });
      setData({ ...data, document: r.document });
      setEditing(false);
      toast('Text updated');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/reader" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> Book reader</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{d.title}</h1><p className="muted text-sm">{formatDateTime(d.createdAt)}{d.confidence != null ? ` · OCR confidence ${d.confidence}%` : ''}{d.correctedText ? ' · corrected by you' : ''}</p></div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => { setDraft({ title: d.title, text }); setEditing(true); }}>Correct text</Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDel(true)}>Delete</Button>
        </div>
      </div>
      {d.confidence != null && d.confidence < 70 && <Alert tone="warning" className="mt-4">The text recognition confidence is low. Some words may be wrong — use “Correct text” to fix them.</Alert>}
      <div className={`mt-6 grid gap-6 ${data.imageUrl ? 'lg:grid-cols-5' : ''}`}>
        {data.imageUrl && <Card className="p-3 lg:col-span-2"><img src={data.imageUrl} alt="Original page" className="w-full rounded-lg" /></Card>}
        <Card className="p-6 lg:col-span-3">
          {editing ? (
            <div className="space-y-3">
              <Input label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} />
              <Textarea label="Text" rows={16} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} className="font-serif" />
              <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button loading={busy} onClick={saveEdit} disabled={!draft.text.trim()}>Save</Button></div>
            </div>
          ) : (
            <>
              <p className="muted mb-4 text-sm">Tap any word to see its meaning in this sentence.</p>
              <div className="space-y-4 font-serif text-lg leading-8">
                {text.split(/\n\s*\n/).map((para, i) => <p key={i}><SelectableText text={para} source="reader" /></p>)}
              </div>
            </>
          )}
        </Card>
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} danger title="Delete this page?" message="The photo and recognised text will be deleted. Words you saved stay in your vocabulary." confirmLabel="Delete" onConfirm={async () => { await api.del(`/api/reader/docs/${d.id}`); nav('/reader'); }} />
    </div>
  );
}
