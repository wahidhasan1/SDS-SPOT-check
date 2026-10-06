import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bike, ChevronRight, Clock, Flame, Info, Leaf, MapPin, Plus, Search, Share2, ShoppingBag, Star, Tag, X, Store, UtensilsCrossed } from 'lucide-react'
import type { MenuItem, Restaurant } from '../data/types'
import { useCurrentArea, useStore } from '../store/store'
import { confirmDialog, toast } from '../store/toast'
import { areaById } from '../data/areas'
import { foodDelivery } from '../lib/pricing'
import { reviewsFor, ratingBreakdown } from '../lib/reviews'
import { cx, taka, timeAgo } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { FavButton } from '../components/cards'
import { Badge, EmptyState, Img, Modal, Price, QtyStepper, Rating, Skeleton, StoreLogo, Stars } from '../components/ui'

export default function RestaurantPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const r = useStore((s) => s.db.restaurants.find((x) => x.id === id))
  const allMenu = useStore((s) => s.db.menu)
  const cart = useStore((s) => s.cart)
  const addRecent = useStore((s) => s.addRecentlyViewed)
  const { areaId } = useCurrentArea()
  const loading = false
  const [q, setQ] = useState('')
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  useTitle(r?.name ?? 'Restaurant')

  useEffect(() => {
    if (r) addRecent('restaurant', r.id)
  }, [r?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const menu = useMemo(() => allMenu.filter((m) => m.restaurantId === id), [allMenu, id])
  const filtered = useMemo(() => (q ? menu.filter((m) => `${m.name} ${m.description}`.toLowerCase().includes(q.toLowerCase())) : menu), [menu, q])
  const sections = useMemo(() => {
    if (!r) return []
    const out: { name: string; items: MenuItem[] }[] = []
    const popular = filtered.filter((m) => m.popular)
    if (popular.length && !q) out.push({ name: 'Popular', items: popular })
    const names = [...new Set([...r.sections.filter((s) => s !== 'Popular'), ...filtered.map((m) => m.section)])]
    for (const n of names) {
      const items = filtered.filter((m) => m.section === n)
      if (items.length) out.push({ name: n, items })
    }
    return out
  }, [r, filtered, q])

  // Scroll-spy for the sticky section tabs
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vis) setActiveSection(vis.target.getAttribute('data-section') ?? '')
      },
      { rootMargin: '-140px 0px -60% 0px' },
    )
    Object.values(sectionRefs.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [sections, loading])

  const itemId = params.get('item')
  const openItem = menu.find((m) => m.id === itemId) ?? null
  const setItem = (mid: string | null) => {
    const p = new URLSearchParams(params)
    if (mid) p.set('item', mid)
    else p.delete('item')
    setParams(p, { replace: true })
  }

  if (!r) return <div className="mx-auto max-w-3xl px-4"><EmptyState icon={Store} title="Restaurant not found" body="It may have been removed from the demo catalog." action={<Link to="/food" className="btn btn-primary">Browse restaurants</Link>} /></div>

  const d = foodDelivery(r, areaId)
  const foodLines = cart.filter((l) => l.kind === 'food')
  const myLines = foodLines.filter((l) => l.storeId === r.id)
  const cartCount = myLines.reduce((a, l) => a + l.qty, 0)
  const cartTotal = myLines.reduce((a, l) => a + l.qty * l.unitPrice, 0)

  const scrollTo = (name: string) => {
    const el = sectionRefs.current[name]
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' })
  }

  return (
    <div className="animate-fade-in">
      {/* Cover */}
      <div className="relative">
        <Img src={r.cover} alt={r.name} art={r.categories[0]} className="h-48 sm:h-72 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/30" />
        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-7xl items-center justify-between p-4">
          <button onClick={() => nav(-1)} className="grid size-10 place-items-center rounded-full bg-white/95 shadow-card" aria-label="Back"><ArrowLeft className="size-5" /></button>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => undefined); toast('success', 'Link copied', 'Share the craving, not the calories.') }} className="grid size-10 place-items-center rounded-full bg-white/95 shadow-card" aria-label="Share"><Share2 className="size-[18px]" /></button>
            <FavButton type="restaurants" id={r.id} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
          <div className="min-w-0">
            {/* Info card */}
            <div className="relative -mt-14 card p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <StoreLogo emoji={r.logoEmoji} bg={r.logoBg} size={68} className="-mt-12 sm:-mt-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight">{r.name}</h1>
                    {r.isOpen ? <Badge tone="success">Open</Badge> : <Badge tone="danger">Closed</Badge>}
                    <Badge tone="warning">Demo restaurant</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{r.tagline}</p>
                  <p className="mt-0.5 text-sm text-ink-500">{'৳'.repeat(r.priceLevel)} · {r.cuisines.join(' · ')}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onClick={() => setReviewsOpen(true)} className="rounded-xl bg-ink-50 p-3 text-left hover:bg-ink-100">
                  <Rating value={r.rating} size="md" />
                  <p className="text-xs text-ink-500 mt-0.5 flex items-center">{r.reviewCount.toLocaleString()} reviews <ChevronRight className="size-3" /></p>
                </button>
                <div className="rounded-xl bg-ink-50 p-3">
                  <p className="flex items-center gap-1 text-sm font-bold"><Clock className="size-4 text-brand-600" /> {d.etaLabel}</p>
                  <p className="text-xs text-ink-500 mt-0.5">Delivery time</p>
                </div>
                <div className="rounded-xl bg-ink-50 p-3">
                  <p className="flex items-center gap-1 text-sm font-bold"><Bike className="size-4 text-brand-600" /> {taka(d.fee)}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{d.km} km · Min. {taka(r.minOrder)}</p>
                </div>
                <button onClick={() => setInfoOpen(true)} className="rounded-xl bg-ink-50 p-3 text-left hover:bg-ink-100">
                  <p className="flex items-center gap-1 text-sm font-bold"><MapPin className="size-4 text-brand-600" /> {areaById(r.areaId).name}</p>
                  <p className="text-xs text-ink-500 mt-0.5 flex items-center">More info <ChevronRight className="size-3" /></p>
                </button>
              </div>
              {r.offer && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-sun-200 bg-sun-50 p-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-sun-400 text-ink-900"><Tag className="size-4" /></span>
                  <div className="flex-1 text-sm">
                    <p className="font-bold text-sun-800">{r.offer.label}</p>
                    {r.offer.voucherCode && <p className="text-xs text-sun-800/80">Use code <b className="font-mono">{r.offer.voucherCode}</b> at checkout</p>}
                  </div>
                </div>
              )}
              {!r.isOpen && (
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-ink-900 p-3 text-white">
                  <Clock className="size-5 text-amber-300" />
                  <p className="text-sm"><b>Closed right now.</b> Opens at {r.opensAt}. You can browse the menu, but ordering is paused.</p>
                </div>
              )}
            </div>

            {/* Sticky section nav */}
            <div className="sticky top-16 z-20 -mx-4 mt-4 border-b border-ink-100 bg-ink-50/95 px-4 pt-3 pb-2 backdrop-blur">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search in ${r.name}`} className="input h-10 pl-9 rounded-full" />
                {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" aria-label="Clear"><X className="size-4" /></button>}
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {sections.map((s) => (
                  <button key={s.name} onClick={() => scrollTo(s.name)} className={cx('h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition', activeSection === s.name ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-100')}>
                    {s.name} <span className="opacity-60">{s.items.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Menu */}
            {loading ? (
              <div className="mt-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="card flex gap-4 p-4"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-4 w-16" /></div><Skeleton className="size-24 sm:size-28" /></div>)}</div>
            ) : sections.length === 0 ? (
              <EmptyState icon={UtensilsCrossed} title={q ? `No dishes match “${q}”` : 'Menu coming soon'} body={q ? 'Try a different dish name.' : 'This demo restaurant has no menu items yet.'} />
            ) : (
              sections.map((s) => (
                <section key={s.name} data-section={s.name} ref={(el) => { sectionRefs.current[s.name] = el }} className="mt-7">
                  <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">{s.name === 'Popular' && <Flame className="size-5 text-sun-600" />}{s.name}</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.items.map((m) => <MenuRow key={`${s.name}-${m.id}`} m={m} r={r} onOpen={() => setItem(m.id)} />)}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* Desktop cart */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 mt-6 card p-5">
              <h3 className="font-display text-lg font-bold flex items-center gap-2"><ShoppingBag className="size-5" /> Your order</h3>
              {myLines.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-4xl">🛍️</div>
                  <p className="mt-2 text-sm font-semibold">Your cart is empty</p>
                  <p className="text-xs text-ink-500">Add something delicious (and imaginary).</p>
                  {foodLines.length > 0 && <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">You have items from another restaurant in your cart.</p>}
                </div>
              ) : (
                <>
                  <div className="mt-3 space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                    {myLines.map((l) => (
                      <div key={l.key} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug">{l.name}</p>
                          {l.optionLabels?.length ? <p className="text-xs text-ink-500 line-clamp-2">{l.optionLabels.join(', ')}</p> : null}
                          <p className="text-sm font-bold mt-0.5">{taka(l.unitPrice * l.qty)}</p>
                        </div>
                        <QtyStepper size="sm" value={l.qty} onChange={(v) => useStore.getState().setQty(l.key, v)} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-ink-100 pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span className="font-semibold">{taka(cartTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-500">Delivery</span><span className="font-semibold">{taka(d.fee)}</span></div>
                    {cartTotal < r.minOrder && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">Add {taka(r.minOrder - cartTotal)} more to reach the minimum order.</p>}
                  </div>
                  <Link to="/cart?tab=food" className="btn btn-primary w-full mt-4">Review cart · {taka(cartTotal)}</Link>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile cart bar */}
      {cartCount > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-[68px] md:bottom-4 z-30 px-3 animate-slide-up">
          <Link to="/cart?tab=food" className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-brand-600 p-3 pl-4 text-white shadow-glow">
            <span className="grid size-8 place-items-center rounded-lg bg-white/20 text-sm font-bold">{cartCount}</span>
            <span className="flex-1 font-bold">View your cart</span>
            <span className="font-bold">{taka(cartTotal)}</span>
          </Link>
        </div>
      )}

      {openItem && <ItemModal key={openItem.id} m={openItem} r={r} onClose={() => setItem(null)} />}
      <ReviewsModal open={reviewsOpen} onClose={() => setReviewsOpen(false)} r={r} />
      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title={r.name} size="sm">
        <div className="space-y-3 text-sm">
          <p className="flex gap-2"><MapPin className="size-4 text-ink-400 shrink-0 mt-0.5" /> {r.address}, {areaById(r.areaId).name}, Dhaka</p>
          <p className="flex gap-2"><Clock className="size-4 text-ink-400 shrink-0 mt-0.5" /> {r.isOpen ? 'Open now · 11:00 AM – 11:30 PM' : `Closed · opens at ${r.opensAt}`}</p>
          <p className="flex gap-2"><Bike className="size-4 text-ink-400 shrink-0 mt-0.5" /> {d.km} km from you · delivery fee {taka(d.fee)} · min. order {taka(r.minOrder)}</p>
          <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-900"><Info className="size-4 shrink-0 mt-0.5" /> {r.name} is a fictional restaurant created for this simulation. Orders are never sent to any real business.</p>
        </div>
      </Modal>
    </div>
  )
}

/** Adds a food line, asking first if the cart has another restaurant's items. */
export async function addFoodLine(r: Restaurant, line: Parameters<ReturnType<typeof useStore.getState>['addToCart']>[0]) {
  const s = useStore.getState()
  if (!r.isOpen) {
    toast('warning', `${r.name} is closed`, `Ordering opens at ${r.opensAt}.`)
    return false
  }
  const other = s.cart.find((l) => l.kind === 'food' && l.storeId !== r.id)
  if (other) {
    const otherName = s.db.restaurants.find((x) => x.id === other.storeId)?.name ?? 'another restaurant'
    const ok = await confirmDialog({ title: 'Start a new food cart?', body: `Your cart already has items from ${otherName}. Adding this will clear them.`, confirmLabel: 'Start new cart' })
    if (!ok) return false
    s.replaceFoodCart(line)
  } else s.addToCart(line)
  return true
}

function MenuRow({ m, r, onOpen }: { m: MenuItem; r: Restaurant; onOpen: () => void }) {
  const cart = useStore((s) => s.cart)
  const lines = cart.filter((l) => l.kind === 'food' && l.refId === m.id)
  const setQty = useStore((s) => s.setQty)
  const qty = lines.reduce((a, l) => a + l.qty, 0)
  const simple = !m.options?.length
  const quickAdd = async (e: MouseEvent) => {
    e.stopPropagation()
    if (!simple) return onOpen()
    const ok = await addFoodLine(r, { kind: 'food', refId: m.id, storeId: r.id, name: m.name, image: m.image, unitPrice: m.price, qty: 1 })
    if (ok) toast('success', `Added ${m.name}`, undefined)
  }
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} className={cx('card card-hover flex gap-3 p-3.5 text-left cursor-pointer', !m.available && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {m.popular && <Badge tone="sun"><Flame className="size-3" /> Popular</Badge>}
          {m.spicy && <span title="Spicy" className="text-xs">🌶️</span>}
          {m.veg && <span title="Vegetarian"><Leaf className="size-3.5 text-emerald-600" /></span>}
        </div>
        <h3 className="mt-1 font-semibold leading-snug">{m.name}</h3>
        <p className="mt-1 text-[13px] text-ink-500 line-clamp-2">{m.description}</p>
        <div className="mt-2 flex items-center gap-2">
          <Price value={m.price} original={m.originalPrice} size="sm" />
          {m.options?.length ? <span className="text-[11px] text-ink-400">Customisable</span> : null}
          {!m.available && <Badge tone="neutral">Sold out</Badge>}
        </div>
      </div>
      <div className="relative shrink-0">
        <Img src={m.image} alt={m.name} art={m.category} className="size-24 sm:size-28 rounded-xl" />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
          {qty > 0 && simple ? (
            <QtyStepper size="sm" value={qty} onChange={(v) => setQty(lines[0].key, v)} />
          ) : (
            <button disabled={!m.available} onClick={quickAdd} aria-label={`Add ${m.name}`} className="relative grid size-9 place-items-center rounded-full bg-white text-brand-700 shadow-lift border border-ink-100 hover:bg-brand-600 hover:text-white transition disabled:opacity-50">
              <Plus className="size-5" />
              {qty > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{qty}</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemModal({ m, r, onClose }: { m: MenuItem; r: Restaurant; onClose: () => void }) {
  const [sel, setSel] = useState<Record<string, string[]>>(() => Object.fromEntries((m.options ?? []).filter((g) => g.required && g.type === 'single').map((g) => [g.id, [g.options[0].id]])))
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const extras = (m.options ?? []).flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)))
  const unit = m.price + extras.reduce((a, o) => a + o.price, 0)
  const toggle = (gid: string, oid: string, type: 'single' | 'multi', max?: number) =>
    setSel((p) => {
      const cur = p[gid] ?? []
      if (type === 'single') return { ...p, [gid]: [oid] }
      if (cur.includes(oid)) return { ...p, [gid]: cur.filter((x) => x !== oid) }
      if (max && cur.length >= max) {
        toast('info', `Choose up to ${max}`)
        return p
      }
      return { ...p, [gid]: [...cur, oid] }
    })
  const submit = async () => {
    const missing = (m.options ?? []).find((g) => g.required && !(sel[g.id]?.length))
    if (missing) return setErr(`Please choose: ${missing.name}`)
    const labels = (m.options ?? []).flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id) && !(g.type === 'single' && o.price === 0 && g.id === 'combo')).map((o) => o.name))
    if (note.trim()) labels.push(`Note: ${note.trim()}`)
    const ok = await addFoodLine(r, { kind: 'food', refId: m.id, storeId: r.id, name: m.name, image: m.image, unitPrice: unit, qty, optionLabels: labels })
    if (ok) {
      toast('success', `Added ${qty}× ${m.name}`)
      onClose()
    }
  }
  return (
    <Modal open onClose={onClose} size="md" footer={
      <div className="flex items-center gap-3">
        <QtyStepper value={qty} onChange={setQty} min={1} />
        <button className="btn btn-primary flex-1 h-12" disabled={!m.available || !r.isOpen} onClick={submit}>
          {!r.isOpen ? 'Restaurant closed' : !m.available ? 'Sold out' : <>Add to cart · {taka(unit * qty)}</>}
        </button>
      </div>
    }>
      <Img src={m.image} alt={m.name} art={m.category} className="-mx-5 -mt-1 aspect-[16/10] sm:rounded-t-none" />
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {m.popular && <Badge tone="sun">Popular</Badge>}
          {m.spicy && <Badge tone="danger">Spicy</Badge>}
          {m.veg && <Badge tone="success">Vegetarian</Badge>}
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">{m.name}</h2>
          <FavButton type="foods" id={m.id} size="sm" className="shrink-0 border border-ink-100" />
        </div>
        <p className="mt-1 text-sm text-ink-500">{m.description}</p>
        <Price value={m.price} original={m.originalPrice} className="mt-2" />
      </div>
      {(m.options ?? []).map((g) => (
        <div key={g.id} className="mt-5">
          <div className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
            <p className="font-bold text-sm">{g.name}</p>
            <span className={cx('text-[11px] font-bold uppercase', g.required ? 'text-brand-700' : 'text-ink-400')}>{g.required ? 'Required' : g.max ? `Optional · up to ${g.max}` : 'Optional'}</span>
          </div>
          <div className="mt-1 divide-y divide-ink-100">
            {g.options.map((o) => {
              const on = sel[g.id]?.includes(o.id) ?? false
              return (
                <label key={o.id} className="flex cursor-pointer items-center gap-3 px-1 py-3">
                  <input type={g.type === 'single' ? 'radio' : 'checkbox'} name={g.id} checked={on} onChange={() => toggle(g.id, o.id, g.type, g.max)} className="size-[18px] accent-brand-600" />
                  <span className="flex-1 text-sm">{o.name}</span>
                  <span className="text-sm text-ink-500">{o.price > 0 ? `+${taka(o.price)}` : o.price < 0 ? `−${taka(-o.price)}` : 'Free'}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
      <div className="mt-5">
        <p className="font-bold text-sm mb-1.5">Special instructions</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="e.g. Less spicy, no onion (the kitchen is imaginary, but go ahead)" className="input h-20 py-2.5 resize-none" />
      </div>
      {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{err}</p>}
    </Modal>
  )
}

function ReviewsModal({ open, onClose, r }: { open: boolean; onClose: () => void; r: Restaurant }) {
  const reviews = useMemo(() => reviewsFor(r.id, 'food', 8), [r.id])
  const bd = ratingBreakdown(r.rating, r.reviewCount)
  return (
    <Modal open={open} onClose={onClose} title="Ratings & reviews">
      <div className="flex items-center gap-5 rounded-2xl bg-ink-50 p-4">
        <div className="text-center">
          <p className="font-display text-4xl font-extrabold">{r.rating.toFixed(1)}</p>
          <Stars value={Math.round(r.rating)} size={14} />
          <p className="text-xs text-ink-500 mt-1">{r.reviewCount.toLocaleString()} ratings</p>
        </div>
        <div className="flex-1 space-y-1">
          {bd.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-3">{5 - i}</span><Star className="size-3 fill-amber-400 text-amber-400" />
              <div className="h-1.5 flex-1 rounded-full bg-ink-200"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(n / r.reviewCount) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-400">Reviews are generated demo content.</p>
      <div className="mt-2 divide-y divide-ink-100">
        {reviews.map((rv) => (
          <div key={rv.id} className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{rv.name}</p>
              <span className="text-xs text-ink-400">{timeAgo(rv.date)}</span>
            </div>
            <Stars value={rv.rating} size={13} />
            <p className="mt-1 text-sm text-ink-700">{rv.text}</p>
          </div>
        ))}
      </div>
    </Modal>
  )
}
