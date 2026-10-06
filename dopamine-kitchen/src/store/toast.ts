import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'
export interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  body?: string
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let seq = 1
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = seq++
    set((s) => ({ items: [...s.items.filter((x) => x.title !== t.title).slice(-2), { ...t, id }] }))
    setTimeout(() => get().dismiss(id), t.action ? 5000 : t.body ? 3200 : 2200)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}))

export const toast = (tone: ToastTone, title: string, body?: string, action?: ToastItem['action']) =>
  useToasts.getState().push({ tone, title, body, action })

// ---------- Confirmation dialog (promise-based) ----------
export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'brand'
}

interface ConfirmState {
  open: ConfirmOptions | null
  resolve?: (v: boolean) => void
  ask: (o: ConfirmOptions) => Promise<boolean>
  close: (v: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: null,
  ask: (o) => new Promise<boolean>((resolve) => set({ open: o, resolve })),
  close: (v) => {
    get().resolve?.(v)
    set({ open: null, resolve: undefined })
  },
}))

export const confirmDialog = (o: ConfirmOptions) => useConfirmStore.getState().ask(o)
