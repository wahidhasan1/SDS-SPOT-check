import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Package, RotateCcw, Ruler, Share2, ShieldCheck, Star, TicketPercent, Truck, Zap } from 'lucide-react'
import { useCurrentArea, useStore } from '../store/store'
import { toast } from '../store/toast'
import { areaById } from '../data/areas'
import { cx, discounted, taka, timeAgo } from '../lib/format'
import { reviewsFor, ratingBreakdown } from '../lib/reviews'
import { voucherHeadline } from '../lib/pricing'
import { useSimLoad, useTitle } from '../lib/hooks'
import { FavButton, ProductCard } from '../components/cards'
import { Badge, EmptyState, Img, Modal, QtyStepper, Rating, SectionHeader, Skeleton, StoreLogo, Stars } from '../components/ui'

export default function ProductPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const p = useStore((s) => s.db.products.find((x) => x.id === id))
  const brands = useStore((s) => s.db.brands)
  const products = useStore((s) => s.db.products)
  const vouchers = useStore((s) => s.db.vouchers)
  const addToCart = useStore((s) => s.addToCart)
  const addRecent = useStore((s) => s.addRecentlyViewed)
  const { areaId } = useCurrentArea()
  const loading = useSimLoad([id], 450)
  const [img, setImg] = useState(0)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [qty, setQty] = useState(1)
  const [sizeErr, setSizeErr] = useState(false)
  const [guide, setGuide] = useState(false)
  const [allReviews, setAllReviews] = useState(false)
  useTitle(p?.name ?? 'Product')

  useEffect(() => {
    if (!p) return
    addRecent('product', p.id)
    setImg(0)
    setSize(p.sizes.length === 1 ? p.sizes[0] : '')
    setColor(p.colors[0]?.name ?? '')
    setQty(1)
    setSizeErr(false)
  }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const reviews = useMemo(() => (p ? reviewsFor(p.id, 'shop', 10, p.colors.map((c) => `${c.name}${p.sizes.length > 1 ? ` · ${p.sizes[Math.min(2, p.sizes.length - 1)]}` : ''}`)) : []), [p])
  if (!p) return <div className="mx-auto max-w-3xl px-4"><EmptyState emoji="🧥" title="Product not found" body="It may have been removed from the demo catalog." action={<Link to="/shop" className="btn btn-primary">Continue shopping</Link>} /></div>

  const brand = brands.find((b) => b.id === p.brandId)
  const price = discounted(p.price, p.discountPct)
  const shopVouchers = vouchers.filter((v) => v.active && v.expiresAt > Date.now() && v.scope !== 'food')
  const similar = products.filter((x) => x.id !== p.id && (x.category === p.category || x.brandId === p.brandId)).slice(0, 8)
  const outOfStock = p.stock === 0
  const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  const bd = ratingBreakdown(p.rating, p.reviewCount)

  const add = (buyNow: boolean) => {
    if (outOfStock) return
    if (!size) {
      setSizeErr(true)
      toast('warning', 'Please select a size')
      return
    }
    addToCart({ kind: 'shop', refId: p.id, storeId: p.brandId, name: p.name, image: p.images[0], unitPrice: price, qty, size: p.sizes.length > 1 ? size : undefined, color })
    if (buyNow) nav('/checkout?kind=shop')
    else toast('success', 'Added to cart', `${qty}× ${p.name}${p.sizes.length > 1 ? ` · ${size}` : ''} · ${color}`, { label: 'View cart', onClick: () => nav('/cart?tab=shop') })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6 animate-fade-in pb-28 md:pb-6">
      <div className="flex items-center gap-2 text-sm text-ink-500 mb-4">
        <button onClick={() => nav(-1)} className="icon-btn size-9 -ml-2" aria-label="Back"><ArrowLeft className="size-5" /></button>
        <Link to="/shop" className="hover:text-brand-700">Shop</Link><ChevronRight className="size-3.5" />
        <Link to={`/shop?cat=${p.category}`} className="hover:text-brand-700 capitalize">{p.category}</Link><ChevronRight className="size-3.5" />
        <span className="truncate text-ink-700">{p.subcategory}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Gallery */}
        <div className="min-w-0">
          {loading ? <Skeleton className="aspect-[4/5] rounded-3xl" /> : (
            <div className="relative overflow-hidden rounded-3xl bg-white shadow-card">
              <Img key={p.images[img]} src={p.images[img]} alt={`${p.name} image ${img + 1}`} art={p.category} className="aspect-[4/5] animate-fade-in" />
              {p.discountPct > 0 && <span className="absolute left-4 top-4 rounded-xl bg-coral-500 px-2.5 py-1 text-sm font-extrabold text-white">-{p.discountPct}%</span>}
              <div className="absolute right-4 top-4 flex flex-col gap-2">
                <FavButton type="products" id={p.id} />
                <button onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => undefined); toast('success', 'Link copied') }} className="grid size-10 place-items-center rounded-full bg-white/95 shadow-card" aria-label="Share"><Share2 className="size-[18px]" /></button>
              </div>
              {p.images.length > 1 && (
                <>
                  <button onClick={() => setImg((img - 1 + p.images.length) % p.images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-white/90 shadow-card" aria-label="Previous image"><ChevronLeft className="size-5" /></button>
                  <button onClick={() => setImg((img + 1) % p.images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-white/90 shadow-card" aria-label="Next image"><ChevronRight className="size-5" /></button>
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {p.images.map((_, i) => <span key={i} className={cx('h-1.5 rounded-full transition-all', i === img ? 'w-6 bg-white' : 'w-1.5 bg-white/60')} />)}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {p.images.map((src, i) => (
              <button key={src} onClick={() => setImg(i)} className={cx('overflow-hidden rounded-xl ring-2 transition', i === img ? 'ring-brand-600' : 'ring-transparent opacity-70 hover:opacity-100')} aria-label={`Show image ${i + 1}`}>
                <Img src={src} alt={`${p.name} thumbnail ${i + 1}`} art={p.category} className="size-16 sm:size-20" />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="min-w-0">
          <Link to={`/store/${brand?.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-ink-700 hover:text-brand-700">
            {brand && <StoreLogo initials={brand.initials} bg={brand.logoBg} size={28} className="ring-0 rounded-lg" />} {brand?.name} <ChevronRight className="size-4" />
          </Link>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold leading-tight">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Rating value={p.rating} count={p.reviewCount} size="md" />
            <span className="text-ink-300">|</span>
            {outOfStock ? <Badge tone="danger">Out of stock</Badge> : p.stock <= 5 ? <Badge tone="warning">Only {p.stock} left</Badge> : <Badge tone="success">In stock</Badge>}
            {p.tags.filter((t) => !['Low stock', 'Sold out'].includes(t)).map((t) => <Badge key={t} tone="brand">{t}</Badge>)}
          </div>

          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-3xl font-extrabold">{taka(price)}</span>
            {p.discountPct > 0 && (
              <>
                <span className="text-lg text-ink-400 line-through">{taka(p.price)}</span>
                <Badge tone="coral" className="mb-1">Save {taka(p.price - price)}</Badge>
              </>
            )}
          </div>
          <p className="text-xs text-ink-500 mt-1">Inclusive of VAT · Demo price — you will not be charged</p>

          {shopVouchers.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
              {shopVouchers.map((v) => (
                <span key={v.code} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800">
                  <TicketPercent className="size-3.5" /> {voucherHeadline(v)} · <span className="font-mono">{v.code}</span>
                </span>
              ))}
            </div>
          )}

          {/* Colour */}
          <div className="mt-6">
            <p className="text-sm font-bold">Colour: <span className="font-normal text-ink-500">{color}</span></p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {p.colors.map((c) => (
                <button key={c.name} onClick={() => setColor(c.name)} title={c.name} aria-label={c.name} aria-pressed={color === c.name} className={cx('grid size-10 place-items-center rounded-full ring-2 ring-offset-2 transition', color === c.name ? 'ring-brand-600' : 'ring-transparent hover:ring-ink-200')}>
                  <span className="size-full rounded-full border border-black/10" style={{ background: c.hex }} />
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          {p.sizes.length > 1 && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className={cx('text-sm font-bold', sizeErr && 'text-red-600')}>Size{size && <span className="font-normal text-ink-500">: {size}</span>}{sizeErr && ' — please choose one'}</p>
                <button onClick={() => setGuide(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Ruler className="size-3.5" /> Size guide</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.sizes.map((s, i) => {
                  const unavailable = outOfStock || (p.stock < 10 && i === p.sizes.length - 1)
                  return (
                    <button key={s} disabled={unavailable} onClick={() => { setSize(s); setSizeErr(false) }} className={cx('h-11 min-w-12 rounded-xl border px-3 text-sm font-semibold transition', size === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white hover:border-ink-400', unavailable && 'line-through opacity-40', sizeErr && !size && 'border-red-300')}>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <p className="text-sm font-bold">Quantity</p>
            <QtyStepper value={qty} onChange={setQty} min={1} max={Math.max(1, Math.min(10, p.stock))} />
          </div>

          {/* CTA */}
          <div className="fixed inset-x-0 bottom-[68px] z-30 flex gap-2 border-t border-ink-100 bg-white/95 p-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
            <button disabled={outOfStock} onClick={() => add(false)} className="btn btn-secondary btn-lg flex-1">Add to cart</button>
            <button disabled={outOfStock} onClick={() => add(true)} className="btn btn-primary btn-lg flex-1">{outOfStock ? 'Out of stock' : 'Buy now'}</button>
          </div>

          {/* Delivery info */}
          <div className="mt-6 card divide-y divide-ink-100">
            <div className="flex gap-3 p-4">
              <Truck className="size-5 text-brand-600 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">Get it by {tomorrow} (simulated)</p>
                <p className="text-ink-500">Standard delivery to {areaById(areaId).name} within 24 hours · ৳60 · Free over ৳3,000</p>
              </div>
            </div>
            {p.expressAvailable && (
              <div className="flex gap-3 p-4">
                <Zap className="size-5 text-coral-500 shrink-0" />
                <div className="text-sm"><p className="font-bold">Same-day express available</p><p className="text-ink-500">Within 6 hours inside Dhaka · ৳120</p></div>
              </div>
            )}
            <div className="flex gap-3 p-4">
              <RotateCcw className="size-5 text-ink-500 shrink-0" />
              <div className="text-sm"><p className="font-bold">7-day easy returns</p><p className="text-ink-500">Returns are simulated too — nothing ever ships.</p></div>
            </div>
            <div className="flex gap-3 p-4">
              <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
              <div className="text-sm"><p className="font-bold">100% simulation guarantee</p><p className="text-ink-500">No real payment, no real delivery, no real brand involved.</p></div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="font-display text-lg font-bold">About this product</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{p.description}</p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {p.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {h}</li>)}
            </ul>
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-500"><Package className="size-4" /> SKU {p.id.toUpperCase()} · {p.subcategory} · Sold by {brand?.name} (fictional)</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-12">
        <SectionHeader title="Ratings & reviews" subtitle="Generated demo reviews" />
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="card p-5 h-fit">
            <p className="font-display text-5xl font-extrabold">{p.rating.toFixed(1)}</p>
            <Stars value={Math.round(p.rating)} size={16} />
            <p className="text-sm text-ink-500 mt-1">{p.reviewCount.toLocaleString()} ratings</p>
            <div className="mt-4 space-y-1.5">
              {bd.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{5 - i}</span><Star className="size-3 fill-amber-400 text-amber-400" />
                  <div className="h-2 flex-1 rounded-full bg-ink-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(n / p.reviewCount) * 100}%` }} /></div>
                  <span className="w-8 text-right text-ink-500">{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {reviews.slice(0, 4).map((r) => <ReviewItem key={r.id} r={r} />)}
            <button className="btn btn-secondary w-full" onClick={() => setAllReviews(true)}>See all {reviews.length} reviews</button>
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="You might also crave" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {similar.map((x) => <ProductCard key={x.id} p={x} brand={brands.find((b) => b.id === x.brandId)} />)}
          </div>
        </section>
      )}

      <Modal open={guide} onClose={() => setGuide(false)} title="Size guide">
        <p className="text-sm text-ink-500 mb-3">Measurements in inches (demo chart).</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ink-500"><th className="py-2">Size</th><th>Chest</th><th>Waist</th><th>Length</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {p.sizes.map((s, i) => <tr key={s}><td className="py-2 font-semibold">{s}</td><td>{36 + i * 2}</td><td>{30 + i * 2}</td><td>{27 + i}</td></tr>)}
          </tbody>
        </table>
      </Modal>
      <Modal open={allReviews} onClose={() => setAllReviews(false)} title={`Reviews (${reviews.length})`}>
        <div className="space-y-3">{reviews.map((r) => <ReviewItem key={r.id} r={r} />)}</div>
      </Modal>
    </div>
  )
}

function ReviewItem({ r }: { r: ReturnType<typeof reviewsFor>[number] }) {
  const [helpful, setHelpful] = useState(false)
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{r.name} <span className="ml-1 text-xs font-medium text-emerald-600">✓ Simulated buyer</span></p>
        <span className="text-xs text-ink-400">{timeAgo(r.date)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2"><Stars value={r.rating} size={14} />{r.variant && <span className="text-xs text-ink-500">{r.variant}</span>}</div>
      <p className="mt-2 text-sm text-ink-700">{r.text}</p>
      <button onClick={() => setHelpful(!helpful)} className={cx('mt-2 text-xs font-semibold', helpful ? 'text-brand-700' : 'text-ink-500')}>👍 Helpful ({r.helpful + (helpful ? 1 : 0)})</button>
    </div>
  )
}
