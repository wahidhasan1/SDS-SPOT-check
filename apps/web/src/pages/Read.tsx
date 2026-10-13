import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage, formatDate, useApi } from '../lib/hooks';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui';

function ImagePrep({ file, onReady, onCancel }: { file: File; onReady: (blob: Blob) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rot, setRot] = useState(0);
  const [crop, setCrop] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [enhance, setEnhance] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!img || !canvas.current) return;
    const c = canvas.current;
    const swap = rot % 180 !== 0;
    const sw = img.width * (1 - (crop.left + crop.right) / 100);
    const sh = img.height * (1 - (crop.top + crop.bottom) / 100);
    const scale = Math.min(1, 2400 / Math.max(sw, sh));
    c.width = Math.round((swap ? sh : sw) * scale);
    c.height = Math.round((swap ? sw : sh) * scale);
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.filter = enhance ? 'grayscale(1) contrast(1.35)' : 'none';
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, img.width * (crop.left / 100), img.height * (crop.top / 100), sw, sh, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale);
    ctx.restore();
  }, [img, rot, crop, enhance]);
  const slider = (k: keyof typeof crop, label: string) => (
    <label className="small row">{label}<input type="range" min={0} max={45} value={crop[k]} onChange={(e) => setCrop((c) => ({ ...c, [k]: Number(e.target.value) }))} /></label>
  );
  return (
    <div className="card stack">
      <h3>Adjust the photo</h3>
      {!img ? <Loading /> : <canvas ref={canvas} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 10, alignSelf: 'center' }} />}
      <div className="row wrap">
        <button className="btn secondary sm" onClick={() => setRot((r) => (r + 270) % 360)}>⟲ Rotate left</button>
        <button className="btn secondary sm" onClick={() => setRot((r) => (r + 90) % 360)}>⟳ Rotate right</button>
        <label className="row small"><input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} /> Enhance contrast</label>
      </div>
      <div className="grid cols-4">{slider('top', 'Crop top')}{slider('bottom', 'Crop bottom')}{slider('left', 'Crop left')}{slider('right', 'Crop right')}</div>
      <div className="row">
        <button className="btn" onClick={() => canvas.current?.toBlob((b) => b && onReady(b), 'image/jpeg', 0.9)} data-testid="scan-confirm">Extract text</button>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function ReadHomePage() {
  const nav = useNavigate();
  const { entitlements } = useAuth();
  const caps = useApi<any>('/reading/capabilities');
  const sessions = useApi<any[]>('/reading/sessions');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const upload = async (blob: Blob, name = 'page.jpg') => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, name);
      const r = await api.upload<any>('/reading/scan', fd);
      nav(`/read/${r.id}`, { state: { warnings: r.warnings } });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
      setFile(null);
    }
  };
  const fromText = async () => {
    try {
      const r = await api.post<any>('/reading/sessions', { text: paste });
      nav(`/read/${r.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const scansLeft = entitlements?.limits.aiReadingScansPerDay == null ? null : entitlements.limits.aiReadingScansPerDay - entitlements.usageToday.aiReadingScans;
  return (
    <div className="stack lg">
      <PageHeader title="Read with AI" subtitle="Photograph a page from a book or article, then tap any word to see what it means in that sentence." />
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {file ? (
            <ImagePrep file={file} onReady={(b) => upload(b)} onCancel={() => setFile(null)} />
          ) : (
            <div className="card stack center">
              <div style={{ fontSize: 48 }}>📷</div>
              <h3>Scan a page</h3>
              <p className="small muted">Use a clear, well-lit photo with the page filling the frame. JPG, PNG, WEBP or HEIC up to 8 MB.</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => camRef.current?.click()} disabled={busy}>Take a photo</button>
                <button className="btn secondary" onClick={() => fileRef.current?.click()} disabled={busy}>Upload an image</button>
              </div>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
              <input ref={fileRef} type="file" accept="image/*" hidden data-testid="scan-file" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
              {busy && <div className="row" style={{ justifyContent: 'center' }}><span className="spinner" /> Reading the text…</div>}
              {scansLeft !== null && <div className="tiny muted">{Math.max(0, scansLeft)} scans left today</div>}
            </div>
          )}
          <ErrorBox error={err} />
          <div className="card stack">
            <h3>…or paste text</h3>
            <textarea className="input" rows={4} placeholder="Paste a paragraph you are reading" value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button className="btn secondary" disabled={!paste.trim()} onClick={fromText}>Open in reader</button>
          </div>
        </div>
        <div className="stack">
          <div className="card small">
            <b>How meanings are found</b>
            <ul style={{ paddingLeft: 18 }}>
              <li>Text recognition (OCR) runs on our server; your photo is deleted right after processing and only the text is kept.</li>
              <li>{caps.data?.aiMeanings ? 'Word meanings in context are explained by an AI model (Claude). The selected sentence is sent to the AI provider.' : 'Meanings come from an offline dictionary (WordNet), choosing the sense that best fits the sentence. AI explanations are not configured on this server.'}</li>
              <li>{caps.data?.translation ? 'Translation is available.' : 'Translation is not configured on this server.'}</li>
              <li>Please respect copyright: scan pages for your own study, not to reproduce whole books.</li>
            </ul>
          </div>
          <div className="card">
            <h3>Your reading sessions</h3>
            {sessions.loading ? <Loading /> : !sessions.data?.length ? <Empty icon="📖" title="No scans yet" /> : (
              <div className="list">
                {sessions.data.map((s) => (
                  <Link key={s.id} to={`/read/${s.id}`} className="list-item" style={{ color: 'var(--text)' }}>
                    <span style={{ flex: 1 }}>{s.title}</span><span className="tiny muted">{formatDate(s.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Token {
  text: string;
  word: boolean;
  i: number;
}

function sentenceAround(text: string, idx: number): string {
  const before = text.lastIndexOf('.', idx - 1);
  const starts = [before, text.lastIndexOf('!', idx - 1), text.lastIndexOf('?', idx - 1), text.lastIndexOf('\n', idx - 1)];
  const start = Math.max(...starts) + 1;
  const ends = ['.', '!', '?', '\n'].map((c) => text.indexOf(c, idx)).filter((x) => x >= 0);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(start, end).trim();
}

export function ReaderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, setData } = useApi<any>(`/reading/sessions/${id}`);
  const [sel, setSel] = useState<{ word: string; sentence: string; offset: number } | null>(null);
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [tr, setTr] = useState<any>(null);
  const [lang, setLang] = useState(user?.translationLanguage ?? '');
  const text: string = data?.text ?? '';
  const low = useMemo(() => new Set<string>((data?.lowConfidenceWords ?? []).map((w: any) => w.text.toLowerCase().replace(/[^a-z'-]/g, ''))), [data]);
  const tokens: Token[] = useMemo(() => {
    const out: Token[] = [];
    const re = /([A-Za-z]+(?:['’-][A-Za-z]+)*)|([^A-Za-z]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push({ text: m[0], word: !!m[1], i: m.index });
    return out;
  }, [text]);

  const lookup = async (t: Token) => {
    const sentence = sentenceAround(text, t.i);
    setSel({ word: t.text, sentence, offset: t.i });
    setRes(null);
    setTr(null);
    setSaved(false);
    setErr(null);
    setBusy(true);
    try {
      setRes(await api.post('/reading/lookup', { word: t.text, sentence, sessionId: id }));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const saveWord = async () => {
    if (!sel || !res) return;
    const meaning = res.ai?.meaningInContext ?? res.curated?.meaning ?? res.dictionary?.senses[0]?.definition;
    const word = res.ai?.headword ?? res.dictionary?.lemma ?? sel.word;
    try {
      await api.post('/vocabulary/saved', { word, meaning, example: res.ai?.examples?.[0], context: sel.sentence, source: 'ai_reading' });
      setSaved(true);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const translateSentence = async () => {
    if (!sel || !lang) return;
    setTr({ loading: true });
    try {
      setTr(await api.post('/reading/translate', { text: sel.sentence, targetLanguage: lang }));
    } catch (e) {
      setTr({ error: errorMessage(e) });
    }
  };
  const saveCorrection = async () => {
    try {
      const r = await api.put<any>(`/reading/sessions/${id}`, { text: draft });
      setData({ ...data, ...r });
      setEditing(false);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="stack">
      <Link to="/read" className="small">← Read with AI</Link>
      <div className="row between wrap">
        <h1 style={{ margin: 0 }}>{data.title}</h1>
        <div className="row small">
          {data.confidence != null && <span className={`badge ${data.confidence >= 80 ? 'success' : 'warning'}`}>OCR confidence {Math.round(data.confidence)}%</span>}
          {data.corrected && <span className="badge">Corrected</span>}
          <button className="btn secondary sm" onClick={() => { setDraft(text); setEditing(!editing); }}>{editing ? 'Cancel' : '✏️ Correct text'}</button>
        </div>
      </div>
      <div className="writing-layout" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
        <div className="card">
          {editing ? (
            <div className="stack">
              <textarea className="editor" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button className="btn" onClick={saveCorrection}>Save corrections</button>
            </div>
          ) : (
            <div className="reading-text" data-testid="reader-text">
              {tokens.map((t, k) =>
                t.word ? (
                  <span key={k} role="button" tabIndex={0} className={`w ${sel?.offset === t.i ? 'sel' : ''} ${low.has(t.text.toLowerCase()) ? 'lowconf' : ''}`}
                    onClick={() => lookup(t)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && lookup(t)}>
                    {t.text}
                  </span>
                ) : (
                  <span key={k} style={{ whiteSpace: 'pre-wrap' }}>{t.text}</span>
                ),
              )}
            </div>
          )}
          {low.size > 0 && !editing && <div className="tiny muted mt">Words with a wavy underline were hard to read — check them against the page.</div>}
        </div>
        <div style={{ position: 'sticky', top: 76 }} className="stack">
          <div className="card stack" data-testid="word-panel">
            {!sel ? <Empty icon="👆" title="Tap any word">Its meaning in this sentence will appear here.</Empty> : (
              <>
                <div className="small muted">“{sel.sentence}”</div>
                {busy && <div className="row"><span className="spinner" /> Looking up “{sel.word}”…</div>}
                <ErrorBox error={err} />
                {res && !res.found && <div className="alert warning small">{res.message}</div>}
                {res?.found && (
                  <>
                    {res.ai ? (
                      <div className="stack" style={{ gap: 6 }}>
                        <div className="row between"><h2 style={{ margin: 0 }} data-testid="lookup-headword">{res.ai.headword}</h2><span className="badge">{res.ai.partOfSpeech} · {res.ai.cefrEstimate}</span></div>
                        {res.ai.isPhraseOrIdiom && <span className="badge accent">Phrase / idiom</span>}
                        {res.ai.ocrSuspect && <div className="alert warning small">This may be a text-recognition error. Check the original page.</div>}
                        <div><b>In this sentence:</b> {res.ai.meaningInContext}</div>
                        <div className="small muted">General meaning: {res.ai.generalDefinition}</div>
                        {res.ai.examples.map((e: string) => <div key={e} className="small">• {e}</div>)}
                        {res.ai.synonymsInContext.length > 0 && <div className="small">Similar: {res.ai.synonymsInContext.join(', ')}</div>}
                        {res.ai.otherCommonMeanings.length > 0 && <details className="small"><summary>Other meanings</summary>{res.ai.otherCommonMeanings.map((m: string) => <div key={m}>• {m}</div>)}</details>}
                        {res.ai.translation && <div className="small"><b>{user?.translationLanguage}:</b> {res.ai.translation}</div>}
                        <div className="tiny muted">Explained by AI — may occasionally be wrong.</div>
                      </div>
                    ) : res.dictionary ? (
                      <div className="stack" style={{ gap: 6 }}>
                        <div className="row between"><h2 style={{ margin: 0 }} data-testid="lookup-headword">{res.dictionary.lemma}</h2><span className="badge">{res.dictionary.senses[0].partOfSpeech}</span></div>
                        <div><b>{res.dictionary.method === 'lesk' ? 'Best match for this sentence:' : 'Most common meaning:'}</b> <span data-testid="lookup-meaning">{res.dictionary.senses[0].definition}</span></div>
                        {res.dictionary.senses[0].examples.slice(0, 2).map((e: string) => <div key={e} className="small">• {e}</div>)}
                        {res.dictionary.senses[0].synonyms.length > 0 && <div className="small">Similar: {res.dictionary.senses[0].synonyms.join(', ')}</div>}
                        {res.dictionary.senses.length > 1 && (
                          <details className="small"><summary>Other meanings ({res.dictionary.senses.length - 1})</summary>{res.dictionary.senses.slice(1, 8).map((s: any, i: number) => <div key={i}>• <i>{s.partOfSpeech}</i> {s.definition}</div>)}</details>
                        )}
                        <div className="tiny muted">From the WordNet dictionary, matched to your sentence automatically.</div>
                      </div>
                    ) : null}
                    {res.curated && (
                      <div className="card flat small"><b>Learner note:</b> {res.curated.meaning}{res.curated.examples?.[0] && <div className="muted">“{res.curated.examples[0]}”</div>}</div>
                    )}
                    <button className="btn" disabled={saved} onClick={saveWord} data-testid="lookup-save">{saved ? '✓ Saved to vocabulary' : '+ Save word'}</button>
                  </>
                )}
                <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <b className="small">Translate this sentence</b>
                  <div className="row">
                    <input className="input" placeholder="Language, e.g. Spanish" value={lang} onChange={(e) => setLang(e.target.value)} />
                    <button className="btn secondary sm" disabled={!lang} onClick={translateSentence}>Translate</button>
                  </div>
                  {tr?.loading && <span className="spinner" />}
                  {tr?.error && <div className="alert error small">{tr.error}</div>}
                  {tr && tr.available === false && <div className="alert info small">{tr.message}</div>}
                  {tr?.translation && <div className="small"><b>{tr.translation}</b>{tr.notes && <div className="muted">{tr.notes}</div>}</div>}
                </div>
              </>
            )}
          </div>
          {data.lookups?.length > 0 && (
            <div className="card small">
              <b>Looked up in this text</b>
              <div className="row wrap mt">{[...new Set<string>(data.lookups.map((l: any) => l.word))].slice(0, 30).map((w) => <span key={w} className="badge">{w}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
