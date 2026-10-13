import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkCheck, Volume2 } from 'lucide-react'
import { del, errorMessage, post } from '../lib/api'
import { useConfig } from '../lib/session'
import { cx, toast } from '../components/ui'

/** Plays the offline-voice pronunciation of a word. Hidden when pronunciation audio isn't available. */
export function AudioButton({ word, className, accent = 'gb', label }: { word: string; className?: string; accent?: 'gb' | 'us'; label?: string }) {
  const cfg = useConfig()
  const ref = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  if (cfg.data && !cfg.data.features.wordAudio) return null
  const play = async () => {
    ref.current?.pause()
    const a = new Audio(`/api/vocab/audio/${encodeURIComponent(word)}?accent=${accent}`)
    ref.current = a
    setState('loading')
    a.onplaying = () => setState('playing')
    a.onended = () => setState('idle')
    a.onerror = () => {
      setState('idle')
      toast('Audio could not be played.', 'bad')
    }
    await a.play().catch(() => setState('idle'))
  }
  return (
    <button type="button" onClick={play} className={cx('btn btn-ghost size-9 shrink-0 rounded-full p-0 text-primary', className)} aria-label={label ?? `Play pronunciation of ${word}`}>
      <Volume2 className={cx('size-5', state !== 'idle' && 'animate-pulse')} />
    </button>
  )
}

/** Save/remove a word in the user's personal list (spaced repetition). */
export function SaveWordButton({ word, saved, context, source = 'manual', meaning, onChange, compact }: { word: string; saved: boolean; context?: string; source?: string; meaning?: string; onChange?: (saved: boolean) => void; compact?: boolean }) {
  const qc = useQueryClient()
  const [on, setOn] = useState(saved)
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    setBusy(true)
    try {
      if (on) await del(`/vocab/saved/${encodeURIComponent(word)}`)
      else await post('/vocab/saved', { word, context, source, meaning })
      setOn(!on)
      onChange?.(!on)
      qc.invalidateQueries({ queryKey: ['saved'] })
      toast(on ? `Removed “${word}”` : `Saved “${word}” to your words`)
    } catch (e) {
      toast(errorMessage(e), 'bad')
    } finally {
      setBusy(false)
    }
  }
  const Icon = on ? BookmarkCheck : Bookmark
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className={cx('btn btn-sm', on ? 'btn-secondary text-primary' : 'btn-secondary', compact && 'size-9 p-0')} aria-label={on ? `Remove ${word} from my words` : `Save ${word}`}>
      <Icon className={cx('size-4', on && 'fill-current')} /> {!compact && (on ? 'Saved' : 'Save')}
    </button>
  )
}

export type Word = { id: number; word: string; pos: string; ipa: string | null; level: string; topic: string; definition: string; examples: string[]; synonyms: string[]; antonyms: string[]; saved?: boolean; seen?: number; correct?: number }

export function WordCard({ w, open, onToggle }: { w: Word; open: boolean; onToggle: () => void }) {
  return (
    <div className={cx('card transition-colors', open && 'border-primary/40')}>
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={onToggle} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {w.word} <span className="ml-1 text-sm font-medium text-muted">{w.pos}</span>
          </p>
          {!open && <p className="truncate text-sm text-muted">{w.definition}</p>}
        </div>
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-muted">{w.level}</span>
        {!!w.seen && <span className="text-xs text-muted">{w.correct}/{w.seen}</span>}
      </button>
      {open && (
        <div className="-mt-2 px-4 pb-4">
          <div className="flex items-center gap-1">
            {w.ipa && <span className="font-mono text-sm text-muted">{w.ipa}</span>}
            <AudioButton word={w.word} />
            <AudioButton word={w.word} accent="us" label={`Play American pronunciation of ${w.word}`} className="text-muted" />
          </div>
          <p className="mt-1 text-[15px]">{w.definition}</p>
          {w.examples.map((e) => (
            <p key={e} className="mt-2 border-l-2 border-primary/40 pl-3 text-[15px] italic text-muted">{e}</p>
          ))}
          {(w.synonyms.length > 0 || w.antonyms.length > 0) && (
            <div className="mt-3 space-y-1 text-sm">
              {w.synonyms.length > 0 && <p><span className="font-semibold">Similar:</span> <span className="text-muted">{w.synonyms.join(', ')}</span></p>}
              {w.antonyms.length > 0 && <p><span className="font-semibold">Opposite:</span> <span className="text-muted">{w.antonyms.join(', ')}</span></p>}
            </div>
          )}
          <div className="mt-3">
            <SaveWordButton word={w.word} saved={!!w.saved} context={w.examples[0]} source="lesson" meaning={w.definition} />
          </div>
        </div>
      )}
    </div>
  )
}
