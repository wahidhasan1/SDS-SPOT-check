import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronDown, Crop, FileText, ImageUp, Languages, Pencil, RotateCw, ScanText, Trash2, X } from 'lucide-react'
import { ApiError, api, del, errorMessage, patch, post } from '../../lib/api'
import { useConfig, useUser } from '../../lib/session'
import { Badge, EmptyState, ErrorState, LimitNotice, Modal, NotConfigured, Page, PageHeader, PageLoader, Spinner, confirmDialog, cx, toast } from '../../components/ui'
import { AudioButton, SaveWordButton } from '../../features/words'

type Session = { id: string; title: string; text: string; confidence: number | null; source: 'photo' | 'text'; createdAt: number; updatedAt: number; lookups?: string[]; quality?: { confidence: number; words: number; lowConfidenceWords: number } }
type Sense = { pos: string; posLabel: string; definition: string; examples: string[]; synonyms: string[] }
type Explain = { word: string; matched: string; lemma: string; phrase: boolean; ipa: string | null; senses: Sense[]; best: Sense | null; sentence: string }

export default function Read() {
  return (
    <Routes>
      <Route index element={<ReadHome />} />
      <Route path=":id" element={<Reader />} />
    </Routes>
  )
}

function ReadHome() {
  const nav = useNavigate()
  const me = useUser()
  const list = useQuery({ queryKey: ['read-sessions'], queryFn: () => api<Session[]>('/read/sessions') })
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [paste, setPaste] = useState(false)
  const pick = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return toast('Please choose a photo.', 'bad')
    if (f.size > 12 * 1024 * 1024) return toast('That photo is too large (max 12 MB).', 'bad')
    setFile(f)
  }
  if (file) return <CropAndRead file={file} onCancel={() => setFile(null)} onDone={(s) => nav(`/read/${s.id}`, { state: { quality: s.quality } })} />
  const lim = me.plan.limits.ocrPagesPerDay
  return (
    <Page width="max-w-3xl">
      <PageHeader eyebrow="Learn" title="Read with AI" subtitle="Take a photo of a book, article or sign. We turn it into text, then you can tap any word to see what it means in that sentence." />
      <div className="grid gap-3 sm:grid-cols-3">
        <button className="card flex flex-col items-center gap-2 p-5 text-center hover:border-primary/40" onClick={() => camRef.current?.click()}>
          <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"><Camera className="size-6" /></span>
          <b>Take a photo</b><span className="text-xs text-muted">Uses your camera</span>
        </button>
        <button className="card flex flex-col items-center gap-2 p-5 text-center hover:border-primary/40" onClick={() => fileRef.current?.click()}>
          <span className="grid size-12 place-items-center rounded-xl bg-good-soft text-good"><ImageUp className="size-6" /></span>
          <b>Upload an image</b><span className="text-xs text-muted">JPEG, PNG or WebP</span>
        </button>
        <button className="card flex flex-col items-center gap-2 p-5 text-center hover:border-primary/40" onClick={() => setPaste(true)}>
          <span className="grid size-12 place-items-center rounded-xl bg-talk-soft text-talk"><FileText className="size-6" /></span>
          <b>Paste text</b><span className="text-xs text-muted">No photo needed</span>
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <p className="mt-3 text-xs text-muted">Photos are read on our server and deleted immediately — only the text is saved. {typeof lim === 'number' && lim !== -1 && `Your plan includes ${lim} photo pages a day.`}</p>

      <h2 className="h2 mb-3 mt-8">Your texts</h2>
      {list.isLoading ? <PageLoader /> : list.error ? <ErrorState error={list.error} /> : !list.data!.length ? (
        <EmptyState icon={ScanText} title="Nothing here yet" body="Your scanned and pasted texts will appear here." />
      ) : (
        <ul className="space-y-2">
          {list.data!.map((s) => (
            <li key={s.id}>
              <Link to={`/read/${s.id}`} className="card flex items-center gap-3 p-4 hover:border-primary/40">
                {s.source === 'photo' ? <Camera className="size-5 shrink-0 text-muted" /> : <FileText className="size-5 shrink-0 text-muted" />}
                <span className="min-w-0 flex-1"><b className="block truncate">{s.title}</b><span className="block truncate text-sm text-muted">{s.text}</span></span>
                <span className="text-xs text-faint">{new Date(s.updatedAt).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {paste && <PasteModal onClose={() => setPaste(false)} onDone={(s) => nav(`/read/${s.id}`)} />}
    </Page>
  )
}

function PasteModal({ onClose, onDone }: { onClose: () => void; onDone: (s: Session) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal open onClose={onClose} title="Paste text" size="lg" footer={<button className="btn btn-primary" disabled={text.trim().length < 3 || busy} onClick={async () => { setBusy(true); try { onDone(await post<Session>('/read/text', { text })) } catch (e) { toast(errorMessage(e), 'bad'); setBusy(false) } }}>Open in reader</button>}>
      <textarea className="input min-h-60" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an English text here…" aria-label="Text" maxLength={20000} />
    </Modal>
  )
}

/** Preview with optional crop (drag a box) and rotation before sending the photo for OCR. */
function CropAndRead({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (s: Session) => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const [rotate, setRotate] = useState(0)
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [cropping, setCropping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<ApiError | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  // Pointer position in the image's own (unrotated) coordinates, as fractions 0–1.
  const local = (e: RPointerEvent) => {
    const el = box.current!
    const r = el.getBoundingClientRect()
    const cx0 = r.left + r.width / 2
    const cy0 = r.top + r.height / 2
    const a = (-rotate * Math.PI) / 180
    const dx = e.clientX - cx0
    const dy = e.clientY - cy0
    const x = dx * Math.cos(a) - dy * Math.sin(a) + el.offsetWidth / 2
    const y = dx * Math.sin(a) + dy * Math.cos(a) + el.offsetHeight / 2
    return { x: Math.min(1, Math.max(0, x / el.offsetWidth)), y: Math.min(1, Math.max(0, y / el.offsetHeight)) }
  }
  const send = async () => {
    setBusy(true)
    setErr(null)
    const form = new FormData()
    form.append('rotate', String(rotate))
    if (crop && crop.w > 0.03 && crop.h > 0.03) form.append('crop', JSON.stringify(crop))
    form.append('image', file, file.name || 'photo.jpg')
    try {
      onDone(await api<Session>('/read/ocr', { form }))
    } catch (e) {
      setErr(e as ApiError)
      setBusy(false)
    }
  }
  return (
    <Page width="max-w-3xl">
      <PageHeader title="Check your photo" back={{ to: '/read', label: 'Read with AI' }} subtitle="Crop to the text you want, and rotate it so the lines are horizontal." />
      <div className="card overflow-hidden p-3">
        <div className="grid place-items-center overflow-hidden bg-surface-2" style={{ minHeight: 240 }}>
          <div
            ref={box}
            className={cx('relative max-w-full touch-none select-none', cropping && 'cursor-crosshair')}
            style={{ transform: `rotate(${rotate}deg)`, transition: 'transform 200ms' }}
            onPointerDown={(e) => {
              if (!cropping) return
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              start.current = local(e)
              setCrop({ ...start.current, w: 0, h: 0 })
            }}
            onPointerMove={(e) => {
              if (!cropping || !start.current) return
              const p = local(e)
              setCrop({ x: Math.min(p.x, start.current.x), y: Math.min(p.y, start.current.y), w: Math.abs(p.x - start.current.x), h: Math.abs(p.y - start.current.y) })
            }}
            onPointerUp={() => {
              start.current = null
            }}
          >
            <img src={url} alt="Your photo" className="block max-h-[60vh] max-w-full" draggable={false} />
            {crop && crop.w > 0 && (
              <div className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }} />
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={cx('btn btn-sm', cropping ? 'btn-primary' : 'btn-secondary')} onClick={() => setCropping((v) => !v)} aria-pressed={cropping}><Crop className="size-4" /> {cropping ? 'Drag over the text' : 'Crop'}</button>
          {crop && <button className="btn btn-ghost btn-sm" onClick={() => setCrop(null)}><X className="size-4" /> Clear crop</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => setRotate((r) => (r + 90) % 360)}><RotateCw className="size-4" /> Rotate</button>
        </div>
      </div>
      {err && <div className="mt-4">{err.code === 'limit_reached' ? <LimitNotice message={err.message} /> : <p className="rounded-xl bg-bad-soft p-3 text-sm text-bad" role="alert">{err.message}</p>}</div>}
      <div className="mt-4 flex gap-2">
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={send}>{busy ? <><Spinner className="size-5" /> Reading the text…</> : <><ScanText className="size-5" /> Read text</>}</button>
        <button className="btn btn-ghost btn-lg" disabled={busy} onClick={onCancel}>Choose another</button>
      </div>
    </Page>
  )
}

const TOKEN = /([A-Za-z]+(?:['’-][A-Za-z]+)*)|([^A-Za-z]+)/g

function Reader() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['read', id], queryFn: () => api<Session>(`/read/sessions/${id}`) })
  const loc = useLocation()
  const quality = (loc.state as { quality?: Session['quality'] } | null)?.quality
  const [sel, setSel] = useState<{ offset: number; word: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const s = q.data!
  const tokens: { text: string; word: boolean; offset: number }[] = []
  for (const m of s.text.matchAll(TOKEN)) tokens.push({ text: m[0], word: !!m[1], offset: m.index })
  const saveText = async () => {
    try {
      const r = await patch<Session>(`/read/sessions/${s.id}`, { text: draft })
      qc.setQueryData(['read', id], { ...s, ...r })
      setEditing(false)
      toast('Text updated')
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }
  return (
    <Page width="max-w-3xl">
      <PageHeader
        title={s.title}
        back={{ to: '/read', label: 'Read with AI' }}
        action={
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={() => { setDraft(s.text); setEditing(true) }}><Pencil className="size-4" /> Edit text</button>
            <button className="btn btn-ghost btn-sm text-bad" aria-label="Delete" onClick={async () => { if (await confirmDialog({ title: 'Delete this text?', confirm: 'Delete' })) { await del(`/read/sessions/${s.id}`); qc.invalidateQueries({ queryKey: ['read-sessions'] }); nav('/read') } }}><Trash2 className="size-4" /></button>
          </div>
        }
      />
      {quality && quality.confidence < 75 && <p className="mb-4 rounded-xl bg-warn-soft p-3 text-sm text-warn">Some of this photo was hard to read ({quality.confidence}% confidence). Check the text and fix any mistakes with “Edit text”, or try a sharper, straighter photo.</p>}
      {editing ? (
        <div className="card p-4">
          <textarea className="input min-h-[50vh] text-[16px] leading-relaxed" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit recognised text" />
          <div className="mt-3 flex gap-2"><button className="btn btn-primary" onClick={saveText}>Save</button><button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button></div>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">Tap any word to see its meaning in this sentence.</p>
          <article className="card whitespace-pre-wrap p-5 text-[17px] leading-[1.9]" lang="en">
            {tokens.map((t, i) =>
              t.word ? (
                <span key={i} role="button" tabIndex={0} onClick={() => setSel({ offset: t.offset, word: t.text })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel({ offset: t.offset, word: t.text }))} className={cx('cursor-pointer rounded px-px hover:bg-primary-soft focus-visible:bg-primary-soft', sel?.offset === t.offset && 'bg-primary text-on-primary')}>
                  {t.text}
                </span>
              ) : (
                <span key={i}>{t.text}</span>
              ),
            )}
          </article>
          {!!s.lookups?.length && (
            <div className="mt-4"><p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">Words you looked up</p><div className="flex flex-wrap gap-1.5">{s.lookups.map((w) => <span key={w} className="chip">{w}</span>)}</div></div>
          )}
        </>
      )}
      {sel && <WordSheet key={sel.offset} sessionId={s.id} text={s.text} offset={sel.offset} onClose={() => setSel(null)} />}
    </Page>
  )
}

function WordSheet({ sessionId, text, offset, onClose }: { sessionId: string; text: string; offset: number; onClose: () => void }) {
  const cfg = useConfig()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['explain', sessionId, offset], queryFn: () => post<Explain>('/read/explain', { sessionId, text, offset }), staleTime: Infinity })
  const [more, setMore] = useState(false)
  const [tr, setTr] = useState<{ what: 'word' | 'sentence'; text: string; note: string | null; target: string } | null>(null)
  const [trErr, setTrErr] = useState<ApiError | null>(null)
  const [trBusy, setTrBusy] = useState(false)
  useEffect(() => {
    if (q.data) qc.invalidateQueries({ queryKey: ['read', sessionId] })
  }, [q.data, qc, sessionId])
  const translate = async (what: 'word' | 'sentence') => {
    if (!q.data) return
    setTrBusy(true)
    setTrErr(null)
    try {
      const r = await post<{ translation: string; note: string | null; target: string }>('/read/translate', what === 'word' ? { text: q.data.matched, context: q.data.sentence } : { text: q.data.sentence })
      setTr({ what, text: r.translation, note: r.note, target: r.target })
    } catch (e) {
      setTrErr(e as ApiError)
    } finally {
      setTrBusy(false)
    }
  }
  const d = q.data
  return (
    <Modal open onClose={onClose} title={d ? <span className="flex items-center gap-2">{d.phrase ? d.matched : d.word}{d.ipa && <span className="font-mono text-sm font-normal text-muted">{d.ipa}</span>}</span> : 'Looking up…'}>
      {q.isLoading ? <div className="py-6"><Spinner /></div> : q.error ? <p className="text-sm text-bad">{errorMessage(q.error)}</p> : d && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <AudioButton word={d.phrase ? d.lemma : d.word.toLowerCase()} />
            <SaveWordButton word={d.lemma} saved={false} context={d.sentence} meaning={d.best?.definition} source="reading" />
            {d.phrase && <Badge tone="primary">{d.best?.posLabel ?? 'phrase'}</Badge>}
            {d.lemma.toLowerCase() !== d.word.toLowerCase() && !d.phrase && <span className="text-sm text-muted">from “{d.lemma}”</span>}
          </div>
          {d.best ? (
            <div className="rounded-xl bg-primary-soft p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">In this sentence · {d.best.posLabel}</p>
              <p className="mt-1 text-[16px] font-semibold">{d.best.definition}</p>
              {d.best.examples[0] && <p className="mt-1 text-sm italic text-muted">“{d.best.examples[0]}”</p>}
              {d.best.synonyms.length > 0 && <p className="mt-1 text-sm">Similar: {d.best.synonyms.slice(0, 5).join(', ')}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">This word isn’t in our offline dictionary (it may be a name or a recognition mistake).</p>
          )}
          <p className="text-sm text-muted">“{d.sentence}”</p>
          {d.senses.length > 1 && (
            <div>
              <button className="flex items-center gap-1 text-sm font-semibold text-primary" onClick={() => setMore((v) => !v)} aria-expanded={more}><ChevronDown className={cx('size-4 transition', more && 'rotate-180')} /> Other meanings</button>
              {more && <ul className="mt-2 space-y-1.5 text-sm">{d.senses.slice(1).map((s, i) => <li key={i}><span className="text-muted">{s.posLabel}:</span> {s.definition}</li>)}</ul>}
            </div>
          )}
          <div className="border-t border-border pt-3">
            {cfg.data && !cfg.data.features.translation ? (
              <NotConfigured feature="Translation">Translation needs an AI provider key on the server. Meanings above come from our offline dictionary and always work.</NotConfigured>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-secondary btn-sm" disabled={trBusy} onClick={() => translate('word')}><Languages className="size-4" /> Translate word</button>
                  <button className="btn btn-secondary btn-sm" disabled={trBusy} onClick={() => translate('sentence')}><Languages className="size-4" /> Translate sentence</button>
                  {trBusy && <Spinner className="size-4" />}
                </div>
                {tr && <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[15px]"><p className="text-xs font-semibold text-muted">{tr.target} · AI translation</p><p className="mt-0.5 font-semibold">{tr.text}</p>{tr.note && <p className="mt-1 text-sm text-muted">{tr.note}</p>}</div>}
                {trErr && <div className="mt-3">{trErr.code === 'limit_reached' ? <LimitNotice message={trErr.message} /> : trErr.code === 'no_language' ? <p className="text-sm text-muted">{trErr.message} <Link to="/profile/goals" className="link">Set it now</Link></p> : <p className="text-sm text-bad">{trErr.message}</p>}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
