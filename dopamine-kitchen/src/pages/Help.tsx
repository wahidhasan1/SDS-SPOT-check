import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CreditCard, FlaskConical, Headphones, Mail, MessageCircle, Package, Phone, RotateCcw, Search, Truck, TicketPercent, User } from 'lucide-react'
import { useStore } from '../store/store'
import { toast } from '../store/toast'
import { cx, fmtDateTime, taka } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { StatusBadge } from '../components/cards'

type Cat = 'all' | 'order' | 'payment' | 'delivery' | 'refund' | 'account' | 'vouchers'
const CATS: { id: Cat; label: string; icon: typeof Package }[] = [
  { id: 'order', label: 'Order issue', icon: Package },
  { id: 'payment', label: 'Payment issue', icon: CreditCard },
  { id: 'delivery', label: 'Delivery issue', icon: Truck },
  { id: 'refund', label: 'Refunds', icon: RotateCcw },
  { id: 'vouchers', label: 'Vouchers', icon: TicketPercent },
  { id: 'account', label: 'Account', icon: User },
]

const FAQ: { cat: Exclude<Cat, 'all'>; q: string; a: string }[] = [
  { cat: 'order', q: 'Is my order real?', a: 'No. Every order on pikk is a simulated test order. It is never sent to a restaurant or store, and nothing will be prepared or delivered.' },
  { cat: 'order', q: 'Can I cancel an order?', a: 'Yes — while an order is “Order Confirmed” or “Preparing”, open it and tap Cancel. Once a rider has picked it up the simulation continues to delivery.' },
  { cat: 'order', q: 'How do I reorder?', a: 'Open Orders, choose a delivered or cancelled order and tap Reorder. Items that are still available are added back to your cart.' },
  { cat: 'payment', q: 'Will I be charged?', a: 'Never. bKash, Nagad, card and cash-on-delivery are all demo flows that do not connect to any payment provider.' },
  { cat: 'payment', q: 'Which test credentials can I use?', a: 'Wallets: 01700000000 or 01800000000 (success), 01700000001 (insufficient balance). OTP 123456, PIN 12345. Cards: 4242 4242 4242 4242 (success), 4000 0000 0000 0002 (declined). Any future expiry and 3-digit CVC.' },
  { cat: 'payment', q: 'Why was my real card rejected?', a: 'On purpose. The demo gateway only accepts published test numbers so that no real financial information is ever collected.' },
  { cat: 'delivery', q: 'How long does delivery take?', a: 'Food simulations target about 30 minutes; shopping targets within 1 day (express: 6 hours). You can speed the simulation up to 10× or 60× from the tracking screen or Settings.' },
  { cat: 'delivery', q: 'Is the rider real?', a: 'No. Riders, their phone numbers and the map are all simulated. Calls and chats with riders are simulated too.' },
  { cat: 'delivery', q: 'What happens when my order is delivered?', a: 'You’ll see “Simulation Complete — No real product was delivered.” plus an optional craving check-in so you can notice how the urge changed.' },
  { cat: 'refund', q: 'How do refunds work?', a: 'Because nothing is charged, refunds are purely simulated. Support chat can log a simulated refund reference for practice.' },
  { cat: 'vouchers', q: 'Why can’t I apply a voucher?', a: 'Check the minimum order, whether it is for food or shopping only, whether it is first-order only, and its expiry date. The error message explains the exact reason.' },
  { cat: 'account', q: 'Where is my data stored?', a: 'Only in your browser’s local storage. You can wipe everything from Settings → Reset demo data.' },
  { cat: 'account', q: 'How do I switch demo accounts?', a: 'Log out from Account, then pick another demo user on the login screen — or use the Demo Control Panel → Users.' },
]

export default function Help() {
  useTitle('Help & Support')
  const [cat, setCat] = useState<Cat>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(0)
  const uid = useStore((s) => s.currentUserId)
  const orders = useStore((s) => s.db.orders)
  const recent = orders.filter((o) => o.userId === uid).sort((a, b) => b.placedAt - a.placedAt).slice(0, 3)
  const faqs = useMemo(() => FAQ.filter((f) => (cat === 'all' || f.cat === cat) && (!q || `${f.q} ${f.a}`.toLowerCase().includes(q.toLowerCase()))), [cat, q])

  return (
    <div className="animate-fade-in">
      <section className="bg-ink-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center">
          <span className="badge bg-amber-300/20 text-amber-200"><FlaskConical className="size-3" /> Simulated support</span>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold">How can we help?</h1>
          <p className="mt-2 text-white/70">Support conversations and resolutions are simulated — no real agent or refund is involved.</p>
          <div className="relative mx-auto mt-5 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help articles" className="input h-12 rounded-full pl-11 text-ink-900" />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CATS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setCat(cat === id ? 'all' : id)} className={cx('card flex flex-col items-center gap-1.5 p-3 text-center text-xs font-semibold transition', cat === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'hover:border-ink-300')}>
              <Icon className="size-5" /> {label}
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold mb-3">Need help with a recent order?</h2>
            <div className="space-y-2">
              {recent.map((o) => (
                <Link key={o.id} to={`/help/chat?order=${o.id}`} className="card card-hover flex items-center gap-3 p-3.5">
                  <Package className="size-5 text-brand-600" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{o.storeName} · {o.id}</p><p className="text-xs text-ink-500">{fmtDateTime(o.placedAt)} · {taka(o.total)}</p></div>
                  <StatusBadge order={o} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold mb-3">{cat === 'all' ? 'Frequently asked questions' : CATS.find((c) => c.id === cat)?.label}</h2>
          {faqs.length === 0 ? <p className="card p-5 text-sm text-ink-500">No articles match “{q}”. Try the chat below.</p> : (
            <div className="card divide-y divide-ink-100 overflow-hidden">
              {faqs.map((f, i) => (
                <div key={f.q}>
                  <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left font-semibold hover:bg-ink-50" aria-expanded={open === i}>
                    {f.q}<ChevronDown className={cx('size-5 shrink-0 transition', open === i && 'rotate-180')} />
                  </button>
                  {open === i && <p className="px-4 pb-4 text-sm text-ink-700 animate-fade-in">{f.a}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link to="/help/chat" className="card card-hover p-5"><MessageCircle className="size-6 text-brand-600" /><p className="mt-2 font-bold">Chat with us</p><p className="text-xs text-ink-500">Simulated assistant · instant replies</p></Link>
          <button onClick={() => toast('info', 'Calling support… (simulated)', 'No phone call is made in the demo.')} className="card card-hover p-5 text-left"><Phone className="size-6 text-brand-600" /><p className="mt-2 font-bold">Call support</p><p className="text-xs text-ink-500">Simulated hotline · 24/7</p></button>
          <button onClick={() => toast('success', 'Ticket created (simulated)', 'Reference SIM-TKT-' + Math.floor(Math.random() * 90000 + 10000))} className="card card-hover p-5 text-left"><Mail className="size-6 text-brand-600" /><p className="mt-2 font-bold">Email a ticket</p><p className="text-xs text-ink-500">Creates a simulated ticket</p></button>
        </section>
        <p className="mt-6 flex items-center gap-2 text-xs text-ink-500"><Headphones className="size-4" /> If you are struggling with compulsive eating or spending, please consider reaching out to a qualified professional.</p>
      </div>
    </div>
  )
}
