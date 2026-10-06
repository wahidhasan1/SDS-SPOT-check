import { create } from 'zustand'
import type { Address } from '../data/types'

interface UIState {
  locationOpen: boolean
  setLocationOpen: (v: boolean) => void
  addressForm: { open: boolean; editing?: Address; onSaved?: (id: string) => void }
  openAddressForm: (editing?: Address, onSaved?: (id: string) => void) => void
  closeAddressForm: () => void
}

export const useUI = create<UIState>((set) => ({
  locationOpen: false,
  setLocationOpen: (v) => set({ locationOpen: v }),
  addressForm: { open: false },
  openAddressForm: (editing, onSaved) => set({ addressForm: { open: true, editing, onSaved } }),
  closeAddressForm: () => set({ addressForm: { open: false } }),
}))
