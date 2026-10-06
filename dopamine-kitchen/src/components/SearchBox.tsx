import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Search, Store, TrendingUp, X, Utensils, ShoppingBag, LayoutGrid } from 'lucide-react'
import { useStore } from '../store/store'
import { POPULAR_SEARCHES, searchAll, type SearchHit } from '../lib/search'
import { cx, taka, discounted } from '../lib/format'
import { useT } from '../i18n'
import { Img } from './ui'

export function hitLink(h: SearchHit): string {
  switch (h.type) {
    case 'restaurant': return `/restaurant/${h.item.id}`
    case 'dish': return `/restaurant/${h.item.restaurantId}?item=${h.item.id}`
    case 'product': return `/product/${h.item.id}`
    case 'brand': return `/store/${h.item.id}`
    case 'category': return h.item.vertical === 'food' ? `/food?cat=${h.item.id}` : `/shop?cat=${h.item.id}`
  }
}

export function SearchBox({ autoFocus, className, initial = '', onDone }: { autoFocus?: boolean; className?: string; initial?: string; onDone?: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const [q, setQ] = useState(initial)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const db = useStore((s) => s.db)
  const recent = useStore((s) => s.recentSearches)
  const addRecent = useStore((s) => s.addRecentSearch)
  const clearRecent = useStore((s) => s.clearRecentSearches)

  useEffect(() => setQ(initial), [initial])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const hits = useMemo(() => {
    const all = searchAll(q, db)
    const by = (t: SearchHit['type'], n: number) => all.filter((h) => h.type === t).slice(0, n)
    return [...by('category', 2), ...by('restaurant', 3), ...by('dish', 3), ...by('brand', 2), ...by('product', 3)]
  }, [q, db])

  const go = (query: string) => {
    const s = query.trim()
    if (!s) return
    addRecent(s)
    setOpen(false)
    onDone?.()
    nav(`/search?q=${encodeURIComponent(s)}`)
  }
  const goHit = (h: SearchHit) => {
    addRecent(q.trim() || ('name' in h.item ? h.item.name : h.item.label))
    setOpen(false)
    onDone?.()
    nav(hitLink(h))
  }

  return (
    <div ref={ref} className={cx('relative', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (active >= 0 && hits[active]) goHit(hits[active])
          else go(q)
        }}
        className="relative"
        role="search"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)) }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={t('search.placeholder')}
          aria-label="Search"
          className="input h-11 rounded-full bg-ink-50 border-transparent pl-10 pr-10 focus:bg-white"
        />
        {q && (
          <button type="button" aria-label="Clear search" onClick={() => { setQ(''); setActive(-1) }} className="absolute right-2 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-full text-ink-400 hover:bg-ink-100">
            <X className="size-4" />
          </button>
        )}
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-ink-100 bg-white p-2 shadow-lift animate-fade-in">
          {!q.trim() ? (
            <div className="p-2">
              {recent.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Recent searches</p>
                    <button onClick={clearRecent} className="text-xs font-semibold text-brand-700 hover:underline">Clear</button>
                  </div>
                  <div className="mb-3">
                    {recent.map((r) => (
                      <button key={r} onClick={() => go(r)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm hover:bg-ink-50">
                        <Clock className="size-4 text-ink-400" /> {r}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="px-1 mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Popular right now</p>
              <div className="flex flex-wrap gap-2 px-1 pb-1">
                {POPULAR_SEARCHES.map((p) => (
                  <button key={p} onClick={() => go(p)} className="chip h-8"><TrendingUp className="size-3.5 text-coral-500" /> {p}</button>
                ))}
              </div>
            </div>
          ) : hits.length === 0 ? (
            <div className="p-5 text-center text-sm text-ink-500">
              No suggestions for “{q}”. Press Enter to search everything.
            </div>
          ) : (
            <ul>
              {hits.map((h, i) => (
                <li key={`${h.type}-${'id' in h.item ? h.item.id : i}`}>
                  <button onMouseEnter={() => setActive(i)} onClick={() => goHit(h)} className={cx('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left', active === i ? 'bg-brand-50' : 'hover:bg-ink-50')}>
                    <HitIcon h={h} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{'name' in h.item ? h.item.name : h.item.label}</span>
                      <span className="block text-xs text-ink-500 truncate">{hitSub(h, db.restaurants)}</span>
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{h.type}</span>
                  </button>
                </li>
              ))}
              <li>
                <button onClick={() => go(q)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                  <Search className="size-4" /> See all results for “{q}”
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function HitIcon({ h }: { h: SearchHit }) {
  if (h.type === 'restaurant') return <Img src={h.item.cover} alt={h.item.name} art={h.item.categories[0]} className="size-10 rounded-xl shrink-0" />
  if (h.type === 'dish') return <Img src={h.item.image} alt={h.item.name} art={h.item.category} className="size-10 rounded-xl shrink-0" />
  if (h.type === 'product') return <Img src={h.item.images[0]} alt={h.item.name} art={h.item.category} className="size-10 rounded-xl shrink-0" />
  const Icon = h.type === 'brand' ? Store : h.item.vertical === 'food' ? Utensils : h.item.vertical === 'shop' ? ShoppingBag : LayoutGrid
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-[18px]" /></span>
}

function hitSub(h: SearchHit, restaurants: { id: string; name: string }[]) {
  switch (h.type) {
    case 'restaurant': return h.item.cuisines.join(' · ')
    case 'dish': return `${restaurants.find((r) => r.id === h.item.restaurantId)?.name ?? ''} · ${taka(h.item.price)}`
    case 'product': return `${h.item.subcategory} · ${taka(discounted(h.item.price, h.item.discountPct))}`
    case 'brand': return h.item.tagline
    case 'category': return h.item.vertical === 'food' ? 'Food category' : 'Shopping category'
  }
}
