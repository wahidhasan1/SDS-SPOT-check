import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bot, FlaskConical, Send } from 'lucide-react'
import { useStore } from '../store/store'
import { isActive, minutesLeft, stageLabel } from '../lib/sim'
import { cx, fmtTime, taka } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { LogoMark } from '../components/Logo'

type Msg = { id: number; from: 'bot' | 'me' | 'agent' | 'system'; text: string; at: number; quick?: string[] }
let seq = 1

export default function SupportChat() {
  useTitle('Support chat')
  const nav = useNavigate()
  const [params] = useSearchParams()
  const orderId = params.get('order')
  const uid = useStore((s) => s.currentUserId)
  const orders = useStore((s) => s.db.orders)
  const user = useStore((s) => s.db.users.find((u) => u.id === s.currentUserId))
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [agent, setAgent] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const mine = orders.filter((o) => o.userId === uid).sort((a, b) => b.placedAt - a.placedAt)
  const ctx = (orderId ? mine.find((o) => o.id === orderId) : undefined) ?? mine.find(isActive) ?? mine[0]

  const push = (m: Omit<Msg, 'id' | 'at'>) => setMsgs((p) => [...p, { ...m, id: seq++, at: Date.now() }])
  const reply = (text: string, quick?: string[], from: Msg['from'] = agent ? 'agent' : 'bot', delay = 900) => {
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      push({ from, text, quick })
    }, delay + Math.min(1200, text.length * 8))
  }

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    push({ from: 'system', text: 'This is a simulated support chat. No real agent is connected and no real refunds are issued.' })
    reply(
      `Hi ${user?.name.split(' ')[0] ?? 'there'}! I'm Dopa, your (simulated) support assistant 🤖${ctx ? `\n\nI can see your order ${ctx.id} from ${ctx.storeName} — ${stageLabel(ctx.kind, ctx.status).title.toLowerCase()}.` : ''}\n\nHow can I help?`,
      ['Where is my order?', 'Payment issue', 'Request a refund', 'Cancel my order', 'Talk to an agent'],
      'bot',
      400,
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, typing])

  const handle = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    push({ from: 'me', text })
    setInput('')
    const t = text.toLowerCase()
    const s = useStore.getState()
    const o = ctx ? s.db.orders.find((x) => x.id === ctx.id) : undefined

    if (pendingCancel && /^(yes|confirm)/.test(t)) {
      s.cancelOrder(pendingCancel)
      setPendingCancel(null)
      return reply(`Done — ${pendingCancel} has been cancelled. Nothing was charged, so there's nothing to refund. Anything else?`, ['Where is my order?', 'No, thanks'])
    }
    if (pendingCancel && /^(no|keep)/.test(t)) {
      setPendingCancel(null)
      return reply('No problem, your order stays on track.', ['Where is my order?'])
    }
    if (/where|status|track|late|eta/.test(t)) {
      if (!o) return reply("I couldn't find any orders on this demo account. Want to place one?", ['Talk to an agent'])
      if (!isActive(o)) return reply(`${o.id} is ${stageLabel(o.kind, o.status).title.toLowerCase()}. ${o.status === 'delivered' ? 'Simulation complete — no real product was delivered.' : ''}`, ['Request a refund', 'Talk to an agent'])
      const left = minutesLeft(o) / s.settings.simSpeed
      return reply(`${o.id} is currently “${stageLabel(o.kind, o.status).title}”. ${o.status === 'confirmed' || o.status === 'preparing' ? '' : `${o.rider.name} is handling it. `}Estimated arrival ${fmtTime(Date.now() + left * 60000)} (simulated).\n\nTip: you can speed up the simulation from the tracking screen.`, ['Open tracking', 'Cancel my order', 'Thanks!'])
    }
    if (/open tracking/.test(t) && o) {
      nav(`/orders/${o.id}`)
      return
    }
    if (/refund|money back|charged/.test(t)) {
      if (!o) return reply('There are no orders to refund on this account.', [])
      const ref = `SIM-RF-${Math.floor(Math.random() * 900000 + 100000)}`
      s.notify({ userId: o.userId, type: 'support', title: `Refund logged for ${o.id} (simulated)`, body: `Reference ${ref}. ${taka(o.total)} was never charged, so no money moves.`, link: `/orders/${o.id}` })
      return reply(`I've logged a simulated refund of ${taka(o.total)} for ${o.id}.\n\nReference: ${ref}\n\nReminder: nothing was ever charged — this is practice for the real-world flow. You'll find the reference in Notifications.`, ['Thanks!', 'Talk to an agent'])
    }
    if (/cancel/.test(t)) {
      if (!o || !isActive(o)) return reply('There is no active order to cancel right now.', ['Where is my order?'])
      if (o.status !== 'confirmed' && o.status !== 'preparing') return reply(`${o.id} has already been picked up, so it can't be cancelled — but don't worry, nothing real is coming.`, ['Where is my order?'])
      setPendingCancel(o.id)
      return reply(`Do you want to cancel ${o.id} from ${o.storeName}?`, ['Yes, cancel it', 'No, keep it'])
    }
    if (/pay|bkash|nagad|card|declin|fail/.test(t)) {
      return reply('Payments here are demo-only. Test credentials:\n• Wallets: 01700000000 (success), 01700000001 (insufficient balance)\n• OTP 123456 · PIN 12345\n• Cards: 4242 4242 4242 4242 (success), 4000 0000 0000 0002 (declined)\n\nReal accounts and cards are always rejected.', ['Request a refund', 'Thanks!'])
    }
    if (/agent|human|person/.test(t)) {
      if (agent) return reply("I'm right here! What else can I help with?", [])
      setAgent(true)
      reply('Connecting you to a support agent…', [], 'bot', 300)
      setTimeout(() => {
        push({ from: 'system', text: 'Nadia (simulated agent) joined the chat' })
        reply(`Assalamu alaikum, this is Nadia from pikk support (a simulated agent). ${o ? `I have ${o.id} open in front of me. ` : ''}How can I make this better for you?`, ['Where is my order?', 'Request a refund', 'Thanks!'], 'agent')
      }, 2600)
      return
    }
    if (/thank|thanks|no, thanks|bye|ok/.test(t)) return reply("You're welcome! Remember: the craving passes — the money stays. 💜", ['Where is my order?'])
    if (/delivery|rider|address/.test(t)) return reply('Riders and deliveries are simulated. Food orders target ~30 minutes, shopping ~1 day. You can change your address before placing an order from checkout or Account → Saved addresses.', ['Where is my order?', 'Talk to an agent'])
    if (/voucher|code|promo|discount/.test(t)) return reply('Try WELCOME50, FOOD20, SHOP100, FREEDEL or FIRSTORDER (first order only). Each has a minimum order and a scope (food / shopping) — the cart explains why one may not apply.', ['Thanks!'])
    return reply("I'm a simulated assistant, so I understand a few topics: order status, payments, refunds, cancellations, vouchers and delivery. Try one of these:", ['Where is my order?', 'Payment issue', 'Request a refund', 'Talk to an agent'])
  }

  const last = msgs[msgs.length - 1]
  return (
    <div className="mx-auto flex h-[calc(100dvh-32px)] max-w-3xl flex-col">
      <div className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 py-3">
        <button onClick={() => nav(-1)} className="icon-btn -ml-2" aria-label="Back"><ArrowLeft className="size-5" /></button>
        {agent ? <span className="grid size-10 place-items-center rounded-full bg-sun-400 font-bold text-ink-900">N</span> : <LogoMark size={40} />}
        <div className="flex-1">
          <p className="font-bold leading-tight">{agent ? 'Nadia · Support' : 'Dopa Support'}</p>
          <p className="text-xs text-emerald-600 font-semibold">● Online <span className="font-normal text-amber-700">· simulated</span></p>
        </div>
        <span className="badge bg-amber-100 text-amber-800"><FlaskConical className="size-3" /> Demo</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-ink-50 px-4 py-4 space-y-3">
        {msgs.map((m) =>
          m.from === 'system' ? (
            <p key={m.id} className="mx-auto max-w-sm rounded-full bg-amber-100 px-3 py-1 text-center text-[11px] font-medium text-amber-900">{m.text}</p>
          ) : (
            <div key={m.id} className={cx('flex animate-fade-in', m.from === 'me' ? 'justify-end' : 'justify-start')}>
              {m.from !== 'me' && <span className="mr-2 mt-auto grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">{m.from === 'agent' ? 'N' : <Bot className="size-4" />}</span>}
              <div className={cx('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line shadow-sm', m.from === 'me' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-ink-900')}>
                {m.text}
                <p className={cx('mt-1 text-[10px]', m.from === 'me' ? 'text-white/60' : 'text-ink-400')}>{fmtTime(m.at)}</p>
              </div>
            </div>
          ),
        )}
        {typing && (
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-brand-100 text-brand-700"><Bot className="size-4" /></span>
            <div className="flex gap-1 rounded-2xl bg-white px-4 py-3 shadow-sm">{[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-ink-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
          </div>
        )}
        {!typing && last?.quick && last.quick.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-9">
            {last.quick.map((q) => <button key={q} onClick={() => handle(q)} className="chip h-8 border-brand-200 text-brand-700 hover:bg-brand-50">{q}</button>)}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); handle(input) }} className="flex gap-2 border-t border-ink-100 bg-white p-3 pb-safe">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…" className="input h-11 rounded-full" aria-label="Message" />
        <button disabled={!input.trim()} className="btn btn-primary size-11 rounded-full p-0" aria-label="Send"><Send className="size-5" /></button>
      </form>
    </div>
  )
}
