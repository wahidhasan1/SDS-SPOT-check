import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Camera, FileText, ImageUp } from 'lucide-react';
import { Alert, Button, Card, CardHeader, EmptyState, Input, PageHeader, PageLoader, Spinner, Textarea } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 8 * 1024 * 1024;

export default function ReaderHome() {
  const me = useMe();
  const nav = useNavigate();
  const docs = useApi<{ documents: { id: string; title: string; preview: string; confidence: number | null; createdAt: string }[] }>('/api/reader/docs');
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState({ title: '', text: '' });

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setError(f.type === 'image/heic' || f.name.toLowerCase().endsWith('.heic') ? 'HEIC photos are not supported. On iPhone, choose Settings → Camera → Formats → Most Compatible, or upload a screenshot.' : 'Please choose a JPEG, PNG or WebP image.');
    if (f.size > MAX) return setError('This image is larger than 8 MB. Please choose a smaller photo.');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const scan = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', file, file.name);
      const r = await api.post<{ document: { id: string } }>('/api/reader/scan', fd);
      nav(`/reader/${r.document.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const savePaste = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.post<{ document: { id: string } }>('/api/reader/text', { title: paste.title.trim() || 'Pasted text', text: paste.text });
      nav(`/reader/${r.document.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const limit = me.limits.ocr_scan;
  const used = me.usage.ocr_scan ?? 0;
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Book reader" description="Take a photo of an English book page. We recognise the text, and you can tap any word to see what it means in that sentence and save it." />
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Scan a page" subtitle={limit != null ? `${Math.max(0, limit - used)} of ${limit} scans left today` : 'Unlimited scans'} icon={<Camera className="h-5 w-5" />} />
          <div className="p-5">
            <input ref={fileRef} type="file" accept={ACCEPT.join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {preview ? (
              <div>
                <img src={preview} alt="Selected page" className="max-h-80 w-full rounded-xl border border-slate-200 object-contain dark:border-slate-700" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={scan} loading={busy}>{busy ? 'Reading text…' : 'Recognise text'}</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => { setFile(null); setPreview(null); }}>Choose another</Button>
                </div>
                {busy && <p className="muted mt-3 flex items-center gap-2 text-sm"><Spinner className="h-4 w-4" /> Running OCR on the server. This usually takes a few seconds.</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-700" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
                <ImageUp className="h-10 w-10 text-slate-400" />
                <p className="mt-2 text-sm">Drag a photo here, or</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => fileRef.current?.click()}>Upload image</Button>
                  <Button variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => camRef.current?.click()}>Use camera</Button>
                </div>
                <p className="muted mt-3 text-xs">JPEG, PNG or WebP, up to 8 MB. For best results: good light, page flat, camera straight above the text.</p>
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Or paste text" subtitle="From an e-book, article or website" icon={<FileText className="h-5 w-5" />} />
          <form className="space-y-3 p-5" onSubmit={savePaste}>
            <Input label="Title" value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} maxLength={120} placeholder="e.g. Chapter 3" />
            <Textarea label="Text" rows={6} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} maxLength={20000} />
            <Button type="submit" variant="secondary" disabled={paste.text.trim().length < 10}>Open in reader</Button>
          </form>
        </Card>
      </div>
      <h2 className="mt-10 mb-3 text-lg font-semibold">Your pages</h2>
      {docs.loading && !docs.data ? <PageLoader /> : docs.data?.documents.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.data.documents.map((d) => (
            <Link key={d.id} to={`/reader/${d.id}`}><Card className="h-full p-4 hover:shadow-md"><div className="font-semibold">{d.title}</div><p className="muted mt-1 line-clamp-3 text-sm">{d.preview}</p><p className="muted mt-2 text-xs">{formatDateTime(d.createdAt)}{d.confidence != null ? ` · OCR confidence ${d.confidence}%` : ' · pasted text'}</p></Card></Link>
          ))}
        </div>
      ) : <EmptyState title="No pages yet" description="Scan your first page to start reading." />}
    </div>
  );
}
